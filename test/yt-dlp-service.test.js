const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AUTH_STRATEGIES,
  ENCODING_MODES,
  applyFfmpegProgressEntry,
  buildTranscodeProgress,
  buildAuthArgs,
  classifyYtDlpError,
  createTranscodeProgressState,
  createFinalAccessError,
  createMissingFinalFileError,
  extractProgressPercent,
  formatEta,
  formatDuration,
  isDownloadProgressLine,
  parseFfmpegProgressLine,
  parseProgressPayload,
  parseFfmpegSpeedMultiplier,
  parseFfmpegTimestampToSeconds,
  parseProgressLine,
  parseYtDlpError,
  resolveFinalCandidate,
  resolveTranscodeProfiles,
  sanitizeCliProgressValue,
  shouldTryNextStrategy
} = require('../src/services/yt-dlp-service');

test('AUTH_STRATEGIES keeps the expected automatic auth order', () => {
  assert.deepEqual(AUTH_STRATEGIES, ['none', 'chrome', 'edge', 'brave']);
});

test('ENCODING_MODES keeps the expected selectable encoding order', () => {
  assert.deepEqual(ENCODING_MODES, ['cpu_quality', 'gpu_fast', 'gpu_quality']);
});

test('parseProgressLine turns yt-dlp progress output into structured progress', () => {
  assert.deepEqual(parseProgressLine('download: 42.3%|1.2MiB/s|00:15'), {
    phase: 'downloading',
    percent: 42.3,
    speed: '1.2MiB/s',
    eta: '00:15'
  });
});

test('parseProgressLine also accepts progress lines without the download prefix', () => {
  assert.deepEqual(parseProgressLine('34.8%|19.81MiB/s|00:23'), {
    phase: 'downloading',
    percent: 34.8,
    speed: '19.81MiB/s',
    eta: '00:23'
  });
});

test('parseProgressPayload strips the download prefix when present', () => {
  assert.deepEqual(parseProgressPayload('download:34.8%|19.81MiB/s|00:23'), ['34.8%', '19.81MiB/s', '00:23']);
  assert.deepEqual(parseProgressPayload('34.8%|19.81MiB/s|00:23'), ['34.8%', '19.81MiB/s', '00:23']);
});

test('isDownloadProgressLine recognizes both prefixed and raw progress rows', () => {
  assert.equal(isDownloadProgressLine('download:34.8%|19.81MiB/s|00:23'), true);
  assert.equal(isDownloadProgressLine('34.8%|19.81MiB/s|00:23'), true);
  assert.equal(isDownloadProgressLine('filepath=F:\\videos\\clip.mp4'), false);
});

test('sanitizeCliProgressValue strips ANSI codes and extra whitespace', () => {
  assert.equal(
    sanitizeCliProgressValue('\u001b[0;32m  42.3% \u001b[0m'),
    '42.3%'
  );
});

test('extractProgressPercent reads numeric progress from formatted yt-dlp output', () => {
  assert.equal(extractProgressPercent('\u001b[0;32m  42.3% \u001b[0m'), 42.3);
  assert.equal(extractProgressPercent('  7.0% of 120.00MiB'), 7);
  assert.equal(extractProgressPercent('unknown'), 0);
});

test('parseFfmpegProgressLine reads ffmpeg progress key-value output', () => {
  assert.deepEqual(parseFfmpegProgressLine('out_time=00:00:05.50'), {
    key: 'out_time',
    value: '00:00:05.50'
  });
});

test('parseFfmpegTimestampToSeconds converts ffmpeg timestamps to seconds', () => {
  assert.equal(parseFfmpegTimestampToSeconds('00:02:03.50'), 123.5);
});

test('parseFfmpegSpeedMultiplier reads encoder speed values', () => {
  assert.equal(parseFfmpegSpeedMultiplier('1.75x'), 1.75);
  assert.equal(parseFfmpegSpeedMultiplier('N/A'), 0);
});

test('formatEta keeps remaining time compact', () => {
  assert.equal(formatEta(73), '1m 13s');
  assert.equal(formatEta(0), '');
});

test('formatDuration keeps finished transcoding time compact', () => {
  assert.equal(formatDuration(45000, 'milliseconds'), '45s');
  assert.equal(formatDuration(252000, 'milliseconds'), '4m 12s');
  assert.equal(formatDuration(3790000, 'milliseconds'), '1h 03m 10s');
});

test('parseYtDlpError rewrites access failures into a simple message', () => {
  const message = parseYtDlpError('ERROR: Sign in to confirm your age\n');
  assert.equal(message, 'This link is not currently accessible to the app.');
});

test('buildAuthArgs returns no args for public access', () => {
  assert.deepEqual(buildAuthArgs('none'), []);
});

test('buildAuthArgs returns browser session args for chrome', () => {
  assert.deepEqual(buildAuthArgs('chrome'), ['--cookies-from-browser', 'chrome']);
});

test('classifyYtDlpError recognizes invalid links', () => {
  const details = classifyYtDlpError('ERROR: Unsupported URL: https://example.com\n');
  assert.equal(details.reasonCode, 'invalid-link');
  assert.match(details.message, /valid/i);
});

test('classifyYtDlpError recognizes unavailable access', () => {
  const details = classifyYtDlpError('ERROR: Sign in to confirm your age\n');
  assert.equal(details.reasonCode, 'access-unavailable');
});

test('classifyYtDlpError recognizes browser session failures', () => {
  const details = classifyYtDlpError('ERROR: Could not copy Chrome cookie database. See issue 7271\n');
  assert.equal(details.reasonCode, 'browser-session-unavailable');
});

test('shouldTryNextStrategy retries for unavailable access', () => {
  assert.equal(shouldTryNextStrategy('access-unavailable'), true);
  assert.equal(shouldTryNextStrategy('browser-session-unavailable'), true);
  assert.equal(shouldTryNextStrategy('invalid-link'), false);
});

test('createFinalAccessError prefers the simplified browser-session message when needed', () => {
  const error = createFinalAccessError([
    { reasonCode: 'access-unavailable', message: 'x' },
    { reasonCode: 'browser-session-unavailable', message: 'y' }
  ]);
  assert.equal(error.reasonCode, 'access-unavailable');
  assert.match(error.message, /browser sessions/i);
});

test('resolveFinalCandidate prefers the printed final path when present', () => {
  assert.equal(
    resolveFinalCandidate('F:\\videos\\clip.mp4', 'F:\\videos', ['clip.mp4']),
    'F:\\videos\\clip.mp4'
  );
});

test('resolveFinalCandidate falls back to the discovered media file in the target directory', () => {
  assert.equal(
    resolveFinalCandidate('', 'F:\\videos', ['notes.txt', 'clip.mkv']),
    'F:\\videos\\clip.mkv'
  );
});

test('createMissingFinalFileError explains MP4-only failures clearly', () => {
  const error = createMissingFinalFileError(false);
  assert.equal(error.reasonCode, 'mp4-only-unavailable');
  assert.match(error.message, /saved as mp4/i);
  assert.match(error.message, /mkv fallback/i);
  assert.equal(error.logMessage, 'MP4-only output did not produce a final file.');
});

test('createMissingFinalFileError keeps a generic message when MKV fallback is already enabled', () => {
  const error = createMissingFinalFileError(true);
  assert.equal(error.reasonCode, 'missing-final-file');
  assert.match(error.message, /no final media file/i);
});

test('resolveTranscodeProfiles uses CPU-only encoding for cpu_quality mode', () => {
  const profiles = resolveTranscodeProfiles('cpu_quality');
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].encoder, 'libx264');
});

test('resolveTranscodeProfiles tries GPU encoders in the expected order for gpu_fast', () => {
  const profiles = resolveTranscodeProfiles('gpu_fast');
  assert.deepEqual(
    profiles.map((profile) => profile.encoder),
    ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264']
  );
  assert.equal(profiles.at(-1).kind, 'cpu');
});

test('resolveTranscodeProfiles keeps GPU-first order for gpu_quality', () => {
  const profiles = resolveTranscodeProfiles('gpu_quality');
  assert.deepEqual(
    profiles.map((profile) => profile.encoder),
    ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264']
  );
  assert.equal(profiles[0].kind, 'gpu');
  assert.equal(profiles.at(-1).kind, 'cpu');
});

test('applyFfmpegProgressEntry updates transcoding state from ffmpeg output', () => {
  const progressState = createTranscodeProgressState(120);
  applyFfmpegProgressEntry(progressState, { key: 'out_time', value: '00:00:30.00' }, 120);
  applyFfmpegProgressEntry(progressState, { key: 'speed', value: '2.00x' }, 120);

  assert.equal(progressState.outTimeSeconds, 30);
  assert.equal(progressState.speedMultiplier, 2);
  assert.equal(progressState.speedText, '2.00x');
});

test('buildTranscodeProgress computes percent and eta from transcoding state', () => {
  const progressState = createTranscodeProgressState(120);
  progressState.outTimeSeconds = 30;
  progressState.speedMultiplier = 2;
  progressState.speedText = '2.00x';

  assert.deepEqual(buildTranscodeProgress(progressState), {
    phase: 'transcoding',
    percent: 25,
    speed: '2.00x',
    eta: '45s'
  });
});

test('buildTranscodeProgress finishes at 100 percent when encoding ends', () => {
  const progressState = createTranscodeProgressState(120);
  progressState.outTimeSeconds = 118;
  progressState.speedText = '1.00x';

  assert.deepEqual(buildTranscodeProgress(progressState, true), {
    phase: 'transcoding',
    percent: 100,
    speed: '1.00x',
    eta: ''
  });
});

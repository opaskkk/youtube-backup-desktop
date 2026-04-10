const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { getBinaryPaths } = require('./binary-manager');
const {
  buildOutputTemplate,
  buildTargetDirectory,
  chooseBestResolution,
  collectWarnings,
  formatResolution,
  resolveOutputStem
} = require('./job-utils');

const AUTH_STRATEGIES = ['none', 'chrome', 'edge', 'brave'];
const MEDIA_EXTENSIONS = ['.mp4', '.mkv', '.webm'];
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass'];
const THUMBNAIL_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const ENCODING_MODES = ['cpu_quality', 'gpu_fast', 'gpu_quality'];

function createYtDlpRunner(app) {
  const binaries = getBinaryPaths(app);

  function buildBaseArgs(authStrategy) {
    return [
      '--no-playlist',
      '--ffmpeg-location',
      path.dirname(binaries.ffmpeg),
      '--encoding',
      'utf-8',
      ...buildAuthArgs(authStrategy)
    ];
  }

  function spawnYtDlp(args, options = {}) {
    return spawn(binaries.ytDlp, args, {
      windowsHide: true,
      ...options
    });
  }

  async function inspect(config, handlers = {}) {
    const attemptErrors = [];

    for (const authStrategy of AUTH_STRATEGIES) {
      try {
        handlers.onLog?.(`Checking link access using ${formatStrategyLabel(authStrategy)}.`);
        const info = await inspectWithStrategy(config, authStrategy, handlers, spawnYtDlp, buildBaseArgs);
        return {
          title: info.title || config.url,
          videoId: info.id || '',
          bestResolution: chooseBestResolution(info.formats),
          isPrivate: Boolean(info.availability && info.availability !== 'public'),
          resolvedAuthStrategy: authStrategy,
          info
        };
      } catch (error) {
        attemptErrors.push({
          authStrategy,
          reasonCode: error.reasonCode || 'unknown',
          message: error.message
        });

        if (!shouldTryNextStrategy(error.reasonCode)) {
          throw error;
        }
      }
    }

    throw createFinalAccessError(attemptErrors);
  }

async function download(config, inspectResult, handlers = {}) {
    const targetDirectory = buildTargetDirectory(config.outputDir, inspectResult.info);
    await fs.mkdir(targetDirectory, { recursive: true });

    const outputTemplate = buildOutputTemplate(inspectResult.info, config.customTitle);

    const directAttempt = await runYtDlpDownloadAttempt({
      config,
      inspectResult,
      handlers,
      spawnYtDlp,
      buildBaseArgs,
      targetDirectory,
      outputTemplate,
      mergeOutputFormat: config.allowMkvFallback ? 'mp4/mkv' : 'mp4',
      archivePath: config.archivePath
    });

    if (directAttempt.finalCandidate) {
      return buildDownloadResult(config, inspectResult, targetDirectory, directAttempt);
    }

    if (config.allowMkvFallback) {
      throw createMissingFinalFileError(true);
    }

    handlers.onLog?.('Preparing a source file for MP4 re-encoding.');

    const sourceAttempt = await runYtDlpDownloadAttempt({
      config,
      inspectResult,
      handlers,
      spawnYtDlp,
      buildBaseArgs,
      targetDirectory,
      outputTemplate,
      mergeOutputFormat: 'mkv',
      archivePath: null
    });

    if (!sourceAttempt.finalCandidate) {
      throw createTranscodePreparationError();
    }

    handlers.onLog?.('Re-encoding to MP4 because direct MP4 output was not possible.');
    handlers.onProgress?.({
      phase: 'transcoding',
      percent: 0,
      speed: '',
      eta: ''
    });

    const transcoded = await transcodeToMp4({
      sourcePath: sourceAttempt.finalCandidate,
      outputPath: path.join(targetDirectory, `${resolveOutputStem(inspectResult.info, config.customTitle)}.mp4`),
      ffmpegPath: binaries.ffmpeg,
      ffprobePath: binaries.ffprobe,
      encodingMode: config.encodingMode,
      durationSeconds: await resolveDurationSeconds(inspectResult.info, sourceAttempt.finalCandidate, binaries.ffprobe),
      handlers
    });

    if (sourceAttempt.finalCandidate !== transcoded.outputPath) {
      await fs.rm(sourceAttempt.finalCandidate, { force: true });
    }

    const finalFiles = await fs.readdir(targetDirectory);
    return buildDownloadResult(config, inspectResult, targetDirectory, {
      finalCandidate: transcoded.outputPath,
      container: 'mp4',
      files: finalFiles,
      transcodeEncoder: transcoded.encoder,
      transcodeDurationMs: transcoded.durationMs,
      wasTranscodedToMp4: true
    });
  }

  return {
    inspect,
    download
  };
}

async function inspectWithStrategy(config, authStrategy, handlers, spawnYtDlp, buildBaseArgs) {
  const args = [
    ...buildBaseArgs(authStrategy),
    '--dump-single-json',
    '--no-warnings',
    '--skip-download',
    config.url
  ];

  const child = spawnYtDlp(args);
  handlers.onSpawn?.({ childProcess: child, kind: 'yt-dlp' });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    handlers.onLog?.(text.trim());
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    throw createYtDlpProcessError(stderr, 'The app could not inspect this link.');
  }

  return JSON.parse(stdout);
}

async function runYtDlpDownloadAttempt({
  config,
  inspectResult,
  handlers,
  spawnYtDlp,
  buildBaseArgs,
  targetDirectory,
  outputTemplate,
  mergeOutputFormat,
  archivePath
}) {
  const args = [
    ...buildBaseArgs(inspectResult.resolvedAuthStrategy || 'none'),
    '--newline',
    '--progress',
    '--progress-template',
    'download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '--format',
    'bv*+ba/b',
    '--merge-output-format',
    mergeOutputFormat,
    '--paths',
    targetDirectory,
    '--output',
    outputTemplate,
    '--embed-metadata',
    '--compat-options',
    'no-live-chat',
    '--no-part',
    '--print',
    'after_move:filepath=%(filepath)s',
    '--print',
    'after_move:container=%(ext)s',
    config.url
  ];

  if (archivePath) {
    args.push('--download-archive', archivePath);
  }

  if (config.writeMetadata) {
    args.push('--write-info-json', '--no-clean-infojson');
  }

  if (config.writeThumbnail) {
    args.push('--write-thumbnail');
  }

  if (config.writeSubs) {
    args.push('--write-auto-subs', '--write-subs', '--convert-subs', 'srt');
  }

  const child = spawnYtDlp(args, {
    env: {
      ...process.env,
      PYTHONUTF8: '1'
    }
  });
  handlers.onSpawn?.({ childProcess: child, kind: 'yt-dlp' });

  let stderr = '';
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let finalPath = '';
  let container = '';

  child.stdout.on('data', (chunk) => {
    stdoutBuffer = consumeOutput(chunk.toString(), stdoutBuffer, handlers, (value) => {
      finalPath = value.finalPath || finalPath;
      container = value.container || container;
    });
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    stderrBuffer = consumeOutput(text, stderrBuffer, handlers, (value) => {
      finalPath = value.finalPath || finalPath;
      container = value.container || container;
    });
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    throw createYtDlpProcessError(stderr, 'The app could not download this link.');
  }

  const files = await fs.readdir(targetDirectory);
  return {
    files,
    finalCandidate: resolveFinalCandidate(finalPath, targetDirectory, files),
    container: container || '',
    wasTranscodedToMp4: false
  };
}

async function transcodeToMp4({
  sourcePath,
  outputPath,
  ffmpegPath,
  ffprobePath,
  encodingMode,
  durationSeconds,
  handlers
}) {
  const profiles = resolveTranscodeProfiles(encodingMode);
  let lastError = null;
  let triedGpuEncoder = false;

  for (const profile of profiles) {
    await fs.rm(outputPath, { force: true });

    if (profile.kind === 'gpu') {
      triedGpuEncoder = true;
    }

    handlers.onLog?.(`Trying ${profile.label} for MP4 re-encoding.`);
    const startedAt = Date.now();

    const args = [
      '-y',
      '-progress',
      'pipe:2',
      '-nostats',
      '-i',
      sourcePath,
      ...profile.videoArgs,
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outputPath
    ];

    const child = spawn(ffmpegPath, args, {
      windowsHide: true
    });
    handlers.onSpawn?.({ childProcess: child, kind: 'ffmpeg' });

    let stderr = '';
    let stderrBuffer = '';
    let currentProgress = createTranscodeProgressState(durationSeconds);
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      stderrBuffer = consumeTranscodeProgressOutput(
        text,
        stderrBuffer,
        durationSeconds,
        currentProgress,
        (progress) => handlers.onProgress?.(progress)
      );
    });

    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });

    if (exitCode === 0) {
      await fs.access(outputPath);
      handlers.onProgress?.({
        phase: 'transcoding',
        percent: 100,
        speed: currentProgress.speedText || '',
        eta: ''
      });
      if (profile.kind === 'cpu' && triedGpuEncoder) {
        handlers.onLog?.('GPU encoding was unavailable. Falling back to CPU encoding.');
      }
      handlers.onLog?.(`Using ${profile.encoder} for MP4 re-encoding.`);
      return {
        outputPath,
        encoder: profile.encoder,
        durationMs: Math.max(0, Date.now() - startedAt)
      };
    }

    lastError = stderr;
  }

  throw createTranscodeError(lastError);
}

function buildDownloadResult(config, inspectResult, targetDirectory, attempt) {
  const finalExt = attempt.container || path.extname(attempt.finalCandidate).replace('.', '') || 'unknown';
  const subtitlePaths = attempt.files
    .filter((file) => SUBTITLE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .map((file) => path.join(targetDirectory, file));
  const metadataPath = attempt.files
    .filter((file) => file.endsWith('.info.json'))
    .map((file) => path.join(targetDirectory, file))[0] || null;
  const thumbnailPath = attempt.files
    .filter((file) => THUMBNAIL_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .map((file) => path.join(targetDirectory, file))
    .find((filePath) => !filePath.endsWith('.part')) || null;

  const result = {
    videoId: inspectResult.info.id || '',
    title: inspectResult.info.title || config.url,
    finalPath: attempt.finalCandidate,
    container: finalExt,
    resolution: inspectResult.bestResolution || formatResolution(inspectResult.info.width, inspectResult.info.height),
    subtitlePaths,
    metadataPath,
    thumbnailPath,
    warnings: [],
    transcodeEncoder: attempt.transcodeEncoder || '',
    transcodeDurationMs: attempt.transcodeDurationMs || 0,
    wasTranscodedToMp4: Boolean(attempt.wasTranscodedToMp4),
    targetDirectory
  };
  result.warnings = collectWarnings(result, {
    writeMetadata: config.writeMetadata,
    writeThumbnail: config.writeThumbnail,
    writeSubs: config.writeSubs
  });
  return result;
}

function consumeOutput(text, buffer, handlers, onData) {
  const nextBuffer = `${buffer}${text}`;
  const lines = nextBuffer.split(/\r?\n/);
  const remainder = lines.pop() || '';

  for (const line of lines) {
    const value = parseStructuredLine(line);
    if (!value) {
      continue;
    }

    handlers.onLog?.(value.raw);
    if (value.progress) {
      handlers.onProgress?.(value.progress);
    }
    onData(value);
  }

  return remainder;
}

function buildAuthArgs(authStrategy) {
  if (!authStrategy || authStrategy === 'none') {
    return [];
  }

  return ['--cookies-from-browser', authStrategy];
}

function resolveFinalCandidate(finalPath, targetDirectory, files = []) {
  if (finalPath) {
    return finalPath;
  }

  const mediaFile = files.find((file) => MEDIA_EXTENSIONS.includes(path.extname(file).toLowerCase()));
  return mediaFile ? path.join(targetDirectory, mediaFile) : '';
}

function resolveTranscodeProfiles(encodingMode) {
  const mode = ENCODING_MODES.includes(encodingMode) ? encodingMode : 'gpu_fast';

  if (mode === 'cpu_quality') {
    return [
      {
        kind: 'cpu',
        encoder: 'libx264',
        label: 'CPU high quality',
        videoArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18']
      }
    ];
  }

  if (mode === 'gpu_quality') {
    return [
      {
        kind: 'gpu',
        encoder: 'h264_nvenc',
        label: 'GPU high quality (NVIDIA)',
        videoArgs: ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '19']
      },
      {
        kind: 'gpu',
        encoder: 'h264_qsv',
        label: 'GPU high quality (Intel)',
        videoArgs: ['-c:v', 'h264_qsv', '-preset', 'medium', '-global_quality', '20']
      },
      {
        kind: 'gpu',
        encoder: 'h264_amf',
        label: 'GPU high quality (AMD)',
        videoArgs: ['-c:v', 'h264_amf', '-quality', 'quality', '-qp_i', '20', '-qp_p', '22']
      },
      {
        kind: 'cpu',
        encoder: 'libx264',
        label: 'CPU high quality fallback',
        videoArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18']
      }
    ];
  }

  return [
    {
      kind: 'gpu',
      encoder: 'h264_nvenc',
      label: 'GPU fast (NVIDIA)',
      videoArgs: ['-c:v', 'h264_nvenc', '-preset', 'p3', '-rc', 'vbr', '-cq', '24']
    },
    {
      kind: 'gpu',
      encoder: 'h264_qsv',
      label: 'GPU fast (Intel)',
      videoArgs: ['-c:v', 'h264_qsv', '-preset', 'faster', '-global_quality', '24']
    },
    {
      kind: 'gpu',
      encoder: 'h264_amf',
      label: 'GPU fast (AMD)',
      videoArgs: ['-c:v', 'h264_amf', '-quality', 'speed', '-qp_i', '24', '-qp_p', '26']
    },
    {
      kind: 'cpu',
      encoder: 'libx264',
      label: 'CPU fallback',
      videoArgs: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20']
    }
  ];
}

function parseStructuredLine(line) {
  const raw = String(line).trim();
  if (!raw) {
    return null;
  }

  if (isDownloadProgressLine(raw)) {
    return { raw, progress: parseProgressLine(raw) };
  }

  if (raw.startsWith('filepath=')) {
    return { raw, finalPath: raw.slice('filepath='.length).trim() };
  }

  if (raw.startsWith('container=')) {
    return { raw, container: raw.slice('container='.length).trim() };
  }

  return { raw };
}

function parseProgressLine(line) {
  const payload = parseProgressPayload(line);
  return {
    phase: 'downloading',
    percent: extractProgressPercent(payload[0]),
    speed: sanitizeCliProgressValue(payload[1]),
    eta: sanitizeCliProgressValue(payload[2])
  };
}

function parseProgressPayload(line) {
  const raw = String(line || '').trim();
  const payload = raw.startsWith('download:') ? raw.slice('download:'.length) : raw;
  return payload.split('|');
}

function isDownloadProgressLine(line) {
  const raw = String(line || '').trim();
  if (!raw) {
    return false;
  }

  const payload = raw.startsWith('download:') ? raw.slice('download:'.length) : raw;
  const parts = payload.split('|');
  if (parts.length < 3) {
    return false;
  }

  const firstPart = sanitizeCliProgressValue(parts[0]);
  return /%/.test(firstPart) || /\d+(?:\.\d+)?/.test(firstPart);
}

function sanitizeCliProgressValue(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProgressPercent(value) {
  const sanitized = sanitizeCliProgressValue(value);
  const match = sanitized.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return 0;
  }

  const numeric = Number.parseFloat(match[1]);
  return Number.isFinite(numeric) ? numeric : 0;
}

function createTranscodeProgressState(durationSeconds) {
  return {
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0,
    outTimeSeconds: 0,
    speedMultiplier: 0,
    speedText: ''
  };
}

function consumeTranscodeProgressOutput(text, buffer, durationSeconds, progressState, onProgress) {
  const nextBuffer = `${buffer}${text}`;
  const lines = nextBuffer.split(/\r?\n/);
  const remainder = lines.pop() || '';

  for (const line of lines) {
    const entry = parseFfmpegProgressLine(line);
    if (!entry) {
      continue;
    }

    applyFfmpegProgressEntry(progressState, entry, durationSeconds);

    if (entry.key === 'progress') {
      onProgress?.(buildTranscodeProgress(progressState, entry.value === 'end'));
    }
  }

  return remainder;
}

function parseFfmpegProgressLine(line) {
  const raw = String(line || '').trim();
  if (!raw || !raw.includes('=')) {
    return null;
  }

  const separatorIndex = raw.indexOf('=');
  return {
    key: raw.slice(0, separatorIndex).trim(),
    value: raw.slice(separatorIndex + 1).trim()
  };
}

function applyFfmpegProgressEntry(progressState, entry, durationSeconds) {
  progressState.durationSeconds = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : progressState.durationSeconds;

  if (entry.key === 'out_time') {
    progressState.outTimeSeconds = parseFfmpegTimestampToSeconds(entry.value);
    return;
  }

  if (entry.key === 'out_time_ms') {
    const numeric = Number.parseFloat(entry.value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      progressState.outTimeSeconds = numeric >= 100000 ? numeric / 1000000 : numeric / 1000;
    }
    return;
  }

  if (entry.key === 'out_time_us') {
    const numeric = Number.parseFloat(entry.value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      progressState.outTimeSeconds = numeric / 1000000;
    }
    return;
  }

  if (entry.key === 'speed') {
    progressState.speedText = entry.value;
    progressState.speedMultiplier = parseFfmpegSpeedMultiplier(entry.value);
  }
}

function buildTranscodeProgress(progressState, isComplete = false) {
  const durationSeconds = Number.isFinite(progressState.durationSeconds) ? progressState.durationSeconds : 0;
  const outTimeSeconds = Number.isFinite(progressState.outTimeSeconds) ? progressState.outTimeSeconds : 0;
  const clampedOutTime = durationSeconds > 0 ? Math.min(outTimeSeconds, durationSeconds) : outTimeSeconds;
  const percent = isComplete
    ? 100
    : durationSeconds > 0
      ? Math.max(0, Math.min(100, (clampedOutTime / durationSeconds) * 100))
      : 0;

  let eta = '';
  if (!isComplete && durationSeconds > 0 && progressState.speedMultiplier > 0) {
    const remainingSeconds = Math.max(0, durationSeconds - clampedOutTime) / progressState.speedMultiplier;
    eta = formatEta(remainingSeconds);
  }

  return {
    phase: 'transcoding',
    percent,
    speed: progressState.speedText || '',
    eta
  };
}

function parseFfmpegTimestampToSeconds(value) {
  const normalized = String(value || '').trim();
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(normalized);
  if (!match) {
    return 0;
  }

  const [, hours, minutes, seconds] = match;
  return (Number.parseInt(hours, 10) * 3600) + (Number.parseInt(minutes, 10) * 60) + Number.parseFloat(seconds);
}

function parseFfmpegSpeedMultiplier(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const numeric = Number.parseFloat(normalized.replace(/x$/i, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }

  const rounded = Math.max(1, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

function formatDuration(secondsOrMs, unit = 'seconds') {
  const totalSeconds = unit === 'milliseconds'
    ? Math.round((Number(secondsOrMs) || 0) / 1000)
    : Math.round(Number(secondsOrMs) || 0);

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

async function resolveDurationSeconds(info, sourcePath, ffprobePath) {
  const infoDuration = Number.parseFloat(info?.duration);
  if (Number.isFinite(infoDuration) && infoDuration > 0) {
    return infoDuration;
  }

  if (!sourcePath || !ffprobePath) {
    return 0;
  }

  return probeDurationSeconds(sourcePath, ffprobePath);
}

async function probeDurationSeconds(sourcePath, ffprobePath) {
  const child = spawn(ffprobePath, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    sourcePath
  ], {
    windowsHide: true
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    return 0;
  }

  const duration = Number.parseFloat(stdout.trim());
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function parseYtDlpError(stderr) {
  return classifyYtDlpError(stderr).message;
}

function createYtDlpProcessError(stderr, fallbackMessage) {
  const details = classifyYtDlpError(stderr);
  const error = new Error(details.message || fallbackMessage);
  error.reasonCode = details.reasonCode || 'unknown';
  return error;
}

function classifyYtDlpError(stderr) {
  const lines = String(stderr || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const errorLine = lines.reverse().find((line) => line.toLowerCase().includes('error'));
  if (!errorLine) {
    return {
      reasonCode: 'unknown',
      message: ''
    };
  }

  const lower = errorLine.toLowerCase();

  if (
    lower.includes('unsupported url')
    || lower.includes('invalid url')
    || lower.includes('incomplete url')
  ) {
    return {
      reasonCode: 'invalid-link',
      message: 'This link does not look valid for download.'
    };
  }

  if (
    lower.includes('sign in to confirm')
    || lower.includes('age restricted')
    || lower.includes('members-only')
    || lower.includes('private video')
    || lower.includes('video is private')
    || lower.includes('video unavailable')
    || lower.includes('requested format is not available')
  ) {
    return {
      reasonCode: 'access-unavailable',
      message: 'This link is not currently accessible to the app.'
    };
  }

  if (
    lower.includes('could not copy chrome cookie database')
    || lower.includes('could not copy') && lower.includes('cookie')
    || lower.includes('permission denied') && lower.includes('cookie')
    || lower.includes('database is locked')
    || lower.includes('locked') && lower.includes('cookie')
    || lower.includes('cookies from browser')
    || lower.includes('failed to decrypt cookies')
    || lower.includes('cookies')
  ) {
    return {
      reasonCode: 'browser-session-unavailable',
      message: 'The app could not reuse a local browser session for this link.'
    };
  }

  return {
    reasonCode: 'unknown',
    message: errorLine.replace(/^error:\s*/i, '')
  };
}

function shouldTryNextStrategy(reasonCode) {
  return reasonCode === 'access-unavailable' || reasonCode === 'browser-session-unavailable';
}

function createFinalAccessError(attemptErrors) {
  const sawAccessError = attemptErrors.some((attempt) => attempt.reasonCode === 'access-unavailable');
  const sawBrowserError = attemptErrors.some((attempt) => attempt.reasonCode === 'browser-session-unavailable');

  let message = 'This link is not currently accessible to the app.';
  let reasonCode = 'access-unavailable';

  if (!sawAccessError && sawBrowserError) {
    message = 'The app could not access this link, even after checking local browser sessions.';
    reasonCode = 'browser-session-unavailable';
  } else if (sawAccessError && sawBrowserError) {
    message = 'The app could not access this link, even after checking local browser sessions.';
  }

  const error = new Error(message);
  error.reasonCode = reasonCode;
  error.attemptErrors = attemptErrors;
  return error;
}

function createMissingFinalFileError(allowMkvFallback) {
  const error = new Error(
    allowMkvFallback
      ? 'The app finished downloading, but no final media file was found.'
      : 'This video could not be saved as MP4 without changing quality. Turn on MKV fallback to save the highest-quality version.'
  );
  error.reasonCode = allowMkvFallback ? 'missing-final-file' : 'mp4-only-unavailable';
  error.logMessage = allowMkvFallback
    ? 'Download finished without a final media file.'
    : 'MP4-only output did not produce a final file.';
  return error;
}

function createTranscodePreparationError() {
  const error = new Error('The app could not prepare this video for MP4 re-encoding.');
  error.reasonCode = 'transcode-preparation-failed';
  error.logMessage = 'MP4 re-encoding could not start because no intermediate media file was created.';
  return error;
}

function createTranscodeError(stderr) {
  const error = new Error('The app could not finish MP4 re-encoding for this video.');
  error.reasonCode = 'transcode-failed';
  error.logMessage = 'MP4 re-encoding failed.';
  error.stderr = stderr;
  return error;
}

function formatStrategyLabel(authStrategy) {
  if (authStrategy === 'none') {
    return 'public access';
  }

  return `${authStrategy} browser session`;
}

module.exports = {
  AUTH_STRATEGIES,
  ENCODING_MODES,
  applyFfmpegProgressEntry,
  buildTranscodeProgress,
  buildAuthArgs,
  classifyYtDlpError,
  consumeTranscodeProgressOutput,
  createFinalAccessError,
  createMissingFinalFileError,
  createTranscodeError,
  createTranscodePreparationError,
  createYtDlpProcessError,
  createYtDlpRunner,
  createTranscodeProgressState,
  consumeOutput,
  extractProgressPercent,
  formatEta,
  formatDuration,
  isDownloadProgressLine,
  parseProgressPayload,
  parseProgressLine,
  parseFfmpegProgressLine,
  parseFfmpegSpeedMultiplier,
  parseFfmpegTimestampToSeconds,
  parseYtDlpError,
  sanitizeCliProgressValue,
  probeDurationSeconds,
  resolveDurationSeconds,
  resolveFinalCandidate,
  resolveTranscodeProfiles,
  runYtDlpDownloadAttempt,
  shouldTryNextStrategy,
  transcodeToMp4
};

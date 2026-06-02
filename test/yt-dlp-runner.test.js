const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AUTH_STRATEGIES,
  buildAuthArgs,
  buildDownloadResult,
  filterRelatedOutputFiles,
  isArchiveSkipLine,
  resolveFinalCandidate
} = require('../src/services/yt-dlp-runner');

test('yt-dlp-runner keeps the expected auth strategy order and browser args', () => {
  assert.deepEqual(AUTH_STRATEGIES, ['none', 'chrome', 'edge', 'brave']);
  assert.deepEqual(buildAuthArgs('edge'), ['--cookies-from-browser', 'edge']);
});

test('buildDownloadResult collects sidecar paths and warnings from the attempt output', () => {
  const result = buildDownloadResult(
    {
      url: 'https://www.youtube.com/watch?v=test123',
      writeMetadata: true,
      writeThumbnail: true,
      writeSubs: true
    },
    {
      bestResolution: '1920x1080',
      info: {
        id: 'test123',
        title: 'Sample Title',
        width: 1920,
        height: 1080
      }
    },
    'F:\\videos',
    {
      finalCandidate: 'F:\\videos\\sample.mp4',
      container: 'mp4',
      files: ['sample.mp4', 'sample.info.json', 'sample.en.srt', 'sample.webp'],
      transcodeEncoder: '',
      transcodeDurationMs: 0,
      wasTranscodedToMp4: false
    }
  );

  assert.equal(result.finalPath, 'F:\\videos\\sample.mp4');
  assert.equal(result.metadataPath, 'F:\\videos\\sample.info.json');
  assert.deepEqual(result.subtitlePaths, ['F:\\videos\\sample.en.srt']);
  assert.equal(result.thumbnailPath, 'F:\\videos\\sample.webp');
  assert.deepEqual(result.warnings, []);
});

test('buildDownloadResult ignores unrelated sidecar files in a reused output folder', () => {
  const result = buildDownloadResult(
    {
      url: 'https://www.youtube.com/watch?v=test123',
      customTitle: 'current video',
      writeMetadata: true,
      writeThumbnail: true,
      writeSubs: true
    },
    {
      bestResolution: '1920x1080',
      info: {
        id: 'test123',
        title: 'Original Title',
        width: 1920,
        height: 1080
      }
    },
    'F:\\videos',
    {
      finalCandidate: 'F:\\videos\\current video.mp4',
      container: 'mp4',
      files: [
        'current video.mp4',
        'current video.info.json',
        'old video.info.json',
        'old video.en.srt',
        'old video.webp'
      ],
      transcodeEncoder: '',
      transcodeDurationMs: 0,
      wasTranscodedToMp4: false
    }
  );

  assert.equal(result.metadataPath, 'F:\\videos\\current video.info.json');
  assert.deepEqual(result.subtitlePaths, []);
  assert.equal(result.thumbnailPath, null);
});

test('buildDownloadResult reports missing requested sidecar files and transcoding fallback', () => {
  const result = buildDownloadResult(
    {
      url: 'https://www.youtube.com/watch?v=test123',
      writeMetadata: true,
      writeThumbnail: true,
      writeSubs: true
    },
    {
      bestResolution: '',
      info: {
        id: 'test123',
        title: 'Sample Title',
        width: 1280,
        height: 720
      }
    },
    'F:\\videos',
    {
      finalCandidate: 'F:\\videos\\sample.mp4',
      container: 'mp4',
      files: ['sample.mp4'],
      transcodeEncoder: 'libx264',
      transcodeDurationMs: 3210,
      wasTranscodedToMp4: true
    }
  );

  assert.match(result.warnings[0], /re-encoding/i);
  assert.match(result.warnings[1], /metadata file/i);
  assert.match(result.warnings[2], /thumbnail/i);
  assert.match(result.warnings[3], /subtitles/i);
  assert.equal(result.resolution, '1280x720');
});

test('resolveFinalCandidate ignores media files that existed before the current attempt', () => {
  assert.equal(
    resolveFinalCandidate('', 'F:\\videos', ['old.mkv', 'current.mp4'], {
      previousFiles: new Set(['old.mkv']),
      outputStem: 'current'
    }),
    'F:\\videos\\current.mp4'
  );

  assert.equal(
    resolveFinalCandidate('', 'F:\\videos', ['old.mkv'], {
      previousFiles: new Set(['old.mkv'])
    }),
    ''
  );
});

test('filterRelatedOutputFiles keeps only files matching the output stem', () => {
  assert.deepEqual(
    filterRelatedOutputFiles(
      ['clip.mp4', 'clip.info.json', 'other.info.json', 'clip.en.srt'],
      { title: 'clip' },
      '',
      ''
    ),
    ['clip.mp4', 'clip.info.json', 'clip.en.srt']
  );
});

test('isArchiveSkipLine recognizes yt-dlp download archive skips', () => {
  assert.equal(isArchiveSkipLine('[download] test123 has already been recorded in the archive'), true);
  assert.equal(isArchiveSkipLine('[download] Destination: clip.mp4'), false);
});

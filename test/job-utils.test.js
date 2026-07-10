const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path').win32;
const {
  sanitizeSegment,
  chooseBestResolution,
  resolveOutputStem,
  buildOutputTemplate,
  buildTargetDirectory,
  createArchivePath,
  collectWarnings
} = require('../src/services/job-utils');

test('sanitizeSegment removes invalid Windows characters', () => {
  assert.equal(sanitizeSegment('my:bad/file*name?'), 'my bad file name');
});

test('chooseBestResolution picks the largest available video stream', () => {
  const resolution = chooseBestResolution([
    { vcodec: 'avc1', width: 1280, height: 720, fps: 30 },
    { vcodec: 'avc1', width: 1920, height: 1080, fps: 30 },
    { vcodec: 'vp9', width: 1920, height: 1080, fps: 60 }
  ]);
  assert.equal(resolution, '1920x1080');
});

test('resolveOutputStem prefers the custom title when provided', () => {
  assert.equal(
    resolveOutputStem({ title: 'Original title', id: 'abc123' }, 'My custom:name'),
    'My custom name'
  );
});

test('buildOutputTemplate falls back to the original title when custom title is blank', () => {
  assert.equal(
    buildOutputTemplate({ title: 'Launch trailer', id: 'abc123' }, ''),
    'Launch trailer.%(ext)s'
  );
});

test('buildTargetDirectory saves directly to the selected output folder', () => {
  const targetDir = buildTargetDirectory('F:\\Backups', {
    channel: 'My Channel',
    id: 'abc123',
    upload_date: '20260410',
    title: 'Launch trailer'
  });

  assert.equal(targetDir, 'F:\\Backups');
});

test('createArchivePath keeps duplicate archive in app data instead of the output folder', () => {
  assert.equal(createArchivePath('F:\\AppData\\YouTubeBackup'), path.join('F:\\AppData\\YouTubeBackup', 'download-archive.txt'));
});

test('collectWarnings skips subtitle warnings unless subtitle saving was requested', () => {
  assert.deepEqual(
    collectWarnings({
      container: 'mp4',
      wasTranscodedToMp4: false,
      subtitlePaths: [],
      metadataPath: null,
      thumbnailPath: null
    }, {
      writeMetadata: false,
      writeThumbnail: false,
      writeSubs: false
    }),
    []
  );
});

test('collectWarnings reports missing sidecar files only when the user requested them', () => {
  assert.deepEqual(
    collectWarnings({
      container: 'mkv',
      wasTranscodedToMp4: false,
      subtitlePaths: [],
      metadataPath: null,
      thumbnailPath: null
    }, {
      writeMetadata: true,
      writeThumbnail: true,
      writeSubs: true
    }),
    [
      'Saved as MKV because the selected streams could not be merged into MP4 without quality loss.',
      'Metadata JSON was requested, but no metadata file was saved.',
      'Thumbnail saving was requested, but no thumbnail file was saved.',
      'No subtitles were saved for this video.'
    ]
  );
});

test('collectWarnings reports MP4 re-encoding when MP4 compatibility fallback was used', () => {
  assert.deepEqual(
    collectWarnings({
      container: 'mp4',
      wasTranscodedToMp4: true,
      subtitlePaths: [],
      metadataPath: null,
      thumbnailPath: null
    }, {
      writeMetadata: false,
      writeThumbnail: false,
      writeSubs: false
    }),
    [
      'Saved as MP4 after re-encoding to keep MP4 compatibility.'
    ]
  );
});

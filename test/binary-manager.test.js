const assert = require('node:assert/strict');
const test = require('node:test');
const pinnedBinaries = require('../scripts/pinned-binaries.json');
const { manifestMatchesPinnedVersions } = require('../src/services/binary-manager');

test('binary manifest must match pinned yt-dlp and ffmpeg versions and checksums', () => {
  const matching = {
    ytDlp: { version: pinnedBinaries.ytDlp.version, sha256: pinnedBinaries.ytDlp.sha256 },
    ffmpeg: { version: pinnedBinaries.ffmpeg.version, sha256: pinnedBinaries.ffmpeg.sha256 }
  };
  assert.equal(manifestMatchesPinnedVersions(matching), true);
  assert.equal(manifestMatchesPinnedVersions({
    ...matching,
    ytDlp: { ...matching.ytDlp, version: 'outdated' }
  }), false);
});

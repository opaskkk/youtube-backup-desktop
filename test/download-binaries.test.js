const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  fileMatchesHash,
  sha256File,
  validateBinarySpec
} = require('../scripts/download-binaries');

test('sha256File and fileMatchesHash reject partial or changed binaries', async (t) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'youtube-backup-hash-'));
  t.after(() => fs.rm(tempDir, { recursive: true, force: true }));
  const filePath = path.join(tempDir, 'tool.exe');
  await fs.writeFile(filePath, 'verified binary');
  const expected = '86fd6fb55a10988213329d914da3f5fbbc213ee143b46148ed21b60d9454e3dc';

  assert.equal(await sha256File(filePath), expected);
  assert.equal(await fileMatchesHash(filePath, expected), true);
  await fs.appendFile(filePath, ' partial');
  assert.equal(await fileMatchesHash(filePath, expected), false);
});

test('validateBinarySpec requires a pinned version, URL, and SHA-256', () => {
  assert.doesNotThrow(() => validateBinarySpec('tool', {
    version: '1.0.0',
    url: 'https://example.com/tool.exe',
    sha256: 'a'.repeat(64)
  }));
  assert.throws(() => validateBinarySpec('tool', {
    version: '1.0.0',
    url: 'https://example.com/tool.exe',
    sha256: 'not-a-checksum'
  }), /Invalid pinned binary manifest/);
});

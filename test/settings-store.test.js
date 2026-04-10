const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  loadSettings,
  normalizeEncodingMode,
  normalizeLanguage,
  normalizeWindowBounds,
  resolveDefaultSettings,
  saveSettingsSync
} = require('../src/services/settings-store');

async function createTempApp(locale = 'en-US') {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-backup-settings-'));
  return {
    getLocale() {
      return locale;
    },
    getPath(name) {
      if (name === 'userData') {
        return userData;
      }

      throw new Error(`Unsupported path request: ${name}`);
    }
  };
}

test('normalizeLanguage keeps supported languages', () => {
  assert.equal(normalizeLanguage('ko'), 'ko');
  assert.equal(normalizeLanguage('en'), 'en');
});

test('normalizeLanguage falls back to english for unsupported values', () => {
  assert.equal(normalizeLanguage('ja'), 'en');
  assert.equal(normalizeLanguage(''), 'en');
});

test('normalizeEncodingMode keeps supported modes and falls back to gpu_fast', () => {
  assert.equal(normalizeEncodingMode('cpu_quality'), 'cpu_quality');
  assert.equal(normalizeEncodingMode('gpu_fast'), 'gpu_fast');
  assert.equal(normalizeEncodingMode('gpu_quality'), 'gpu_quality');
  assert.equal(normalizeEncodingMode('weird'), 'gpu_fast');
});

test('normalizeWindowBounds keeps valid window bounds and rejects invalid values', () => {
  assert.deepEqual(
    normalizeWindowBounds({ x: 12.2, y: 34.8, width: 1280, height: 860, isMaximized: true }),
    { x: 12, y: 35, width: 1280, height: 860, isMaximized: true }
  );
  assert.equal(normalizeWindowBounds({ x: 0, y: 0, width: 100, height: 100 }), null);
  assert.equal(normalizeWindowBounds(null), null);
});

test('resolveDefaultSettings prefers Korean when the app locale is Korean', () => {
  const app = {
    getLocale() {
      return 'ko-KR';
    }
  };

  assert.equal(resolveDefaultSettings(app).language, 'ko');
  assert.equal(resolveDefaultSettings(app).encodingMode, 'gpu_fast');
});

test('resolveDefaultSettings falls back to English for non-Korean locales', () => {
  const app = {
    getLocale() {
      return 'en-US';
    }
  };

  assert.equal(resolveDefaultSettings(app).language, 'en');
  assert.equal(resolveDefaultSettings(app).encodingMode, 'gpu_fast');
});

test('loadSettings migrates legacy advanced output settings once', async () => {
  const app = await createTempApp('ko-KR');
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');

  await fs.writeFile(settingsPath, JSON.stringify({
    language: 'ko',
    allowMkvFallback: true,
    writeMetadata: true,
    writeThumbnail: true,
    writeSubs: true
  }, null, 2), 'utf8');

  const settings = await loadSettings(app);
  const persisted = JSON.parse(await fs.readFile(settingsPath, 'utf8'));

  assert.equal(settings.writeMetadata, false);
  assert.equal(settings.writeThumbnail, false);
  assert.equal(settings.writeSubs, false);
  assert.equal(settings.didResetAdvancedOutputDefaults, true);
  assert.equal(persisted.didResetAdvancedOutputDefaults, true);
});

test('loadSettings keeps user choices after the migration marker is present', async () => {
  const app = await createTempApp('en-US');
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');

  await fs.writeFile(settingsPath, JSON.stringify({
    language: 'en',
    didResetAdvancedOutputDefaults: true,
    allowMkvFallback: true,
    writeMetadata: true,
    writeThumbnail: false,
    writeSubs: true
  }, null, 2), 'utf8');

  const settings = await loadSettings(app);

  assert.equal(settings.writeMetadata, true);
  assert.equal(settings.writeThumbnail, false);
  assert.equal(settings.writeSubs, true);
});

test('loadSettings falls back to gpu_fast when encodingMode is missing or invalid', async () => {
  const app = await createTempApp('en-US');
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');

  await fs.writeFile(settingsPath, JSON.stringify({
    language: 'en',
    didResetAdvancedOutputDefaults: true,
    encodingMode: 'invalid-mode'
  }, null, 2), 'utf8');

  const settings = await loadSettings(app);

  assert.equal(settings.encodingMode, 'gpu_fast');
});

test('loadSettings restores valid window bounds from settings', async () => {
  const app = await createTempApp('en-US');
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');

  await fs.writeFile(settingsPath, JSON.stringify({
    language: 'en',
    didResetAdvancedOutputDefaults: true,
    windowBounds: { x: 100, y: 120, width: 1280, height: 860, isMaximized: false }
  }, null, 2), 'utf8');

  const settings = await loadSettings(app);
  assert.deepEqual(settings.windowBounds, { x: 100, y: 120, width: 1280, height: 860, isMaximized: false });
});

test('saveSettingsSync writes non-empty settings with window bounds', async () => {
  const app = await createTempApp('en-US');
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');

  const saved = saveSettingsSync(app, {
    language: 'en',
    windowBounds: { x: 320, y: 180, width: 1400, height: 900, isMaximized: true }
  });

  const raw = await fs.readFile(settingsPath, 'utf8');
  const persisted = JSON.parse(raw);

  assert.ok(raw.trim().length > 0);
  assert.deepEqual(saved.windowBounds, { x: 320, y: 180, width: 1400, height: 900, isMaximized: true });
  assert.deepEqual(persisted.windowBounds, { x: 320, y: 180, width: 1400, height: 900, isMaximized: true });
  assert.equal(persisted.language, 'en');
});

const fsSync = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

const SUPPORTED_ENCODING_MODES = ['cpu_quality', 'gpu_fast', 'gpu_quality'];
const SUPPORTED_THEME_MODES = ['light', 'dark', 'system'];

const BASE_DEFAULT_SETTINGS = {
  outputDir: '',
  preferContainer: 'mp4',
  allowMkvFallback: true,
  encodingMode: 'gpu_fast',
  writeMetadata: false,
  writeThumbnail: false,
  writeSubs: false,
  language: 'en',
  themeMode: 'system',
  windowBounds: null,
  didResetAdvancedOutputDefaults: true
};

function normalizeLanguage(language) {
  return language === 'ko' ? 'ko' : 'en';
}

function normalizeEncodingMode(encodingMode) {
  return SUPPORTED_ENCODING_MODES.includes(encodingMode) ? encodingMode : 'gpu_fast';
}

function normalizeThemeMode(themeMode) {
  return SUPPORTED_THEME_MODES.includes(themeMode) ? themeMode : 'system';
}

function normalizeWindowBounds(windowBounds) {
  if (!windowBounds || typeof windowBounds !== 'object') {
    return null;
  }

  const x = Number(windowBounds.x);
  const y = Number(windowBounds.y);
  const width = Number(windowBounds.width);
  const height = Number(windowBounds.height);
  const isMaximized = windowBounds.isMaximized === true;

  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }

  if (width < 320 || height < 240) {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    isMaximized
  };
}

function resolveDefaultSettings(app) {
  const locale = String(app?.getLocale?.() || '').toLowerCase();

  return {
    ...BASE_DEFAULT_SETTINGS,
    language: locale.startsWith('ko') ? 'ko' : 'en'
  };
}

function getSettingsPath(app) {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getTempSettingsPath(settingsPath) {
  return `${settingsPath}.tmp`;
}

async function readStoredSettings(app) {
  const settingsPath = getSettingsPath(app);
  const raw = await fs.readFile(settingsPath, 'utf8');
  return JSON.parse(raw);
}

function readStoredSettingsSync(app) {
  const settingsPath = getSettingsPath(app);
  const raw = fsSync.readFileSync(settingsPath, 'utf8');
  return JSON.parse(raw);
}

function buildNextSettings(app, storedSettings, settings) {
  const nextSettings = { ...resolveDefaultSettings(app), ...storedSettings, ...settings };
  nextSettings.language = normalizeLanguage(nextSettings.language);
  nextSettings.encodingMode = normalizeEncodingMode(nextSettings.encodingMode);
  nextSettings.themeMode = normalizeThemeMode(nextSettings.themeMode);
  nextSettings.windowBounds = normalizeWindowBounds(nextSettings.windowBounds);
  nextSettings.didResetAdvancedOutputDefaults = true;
  return nextSettings;
}

async function writeSettingsAtomic(settingsPath, settings) {
  const tempPath = getTempSettingsPath(settingsPath);
  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(tempPath, JSON.stringify(settings, null, 2), 'utf8');
  await fs.rename(tempPath, settingsPath);
}

function writeSettingsAtomicSync(settingsPath, settings) {
  const tempPath = getTempSettingsPath(settingsPath);
  fsSync.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fsSync.writeFileSync(tempPath, JSON.stringify(settings, null, 2), 'utf8');
  fsSync.renameSync(tempPath, settingsPath);
}

async function loadSettings(app) {
  const settingsPath = getSettingsPath(app);
  const defaultSettings = resolveDefaultSettings(app);

  try {
    const storedSettings = await readStoredSettings(app);
    const parsed = { ...defaultSettings, ...storedSettings };
    parsed.language = normalizeLanguage(parsed.language);
    parsed.encodingMode = normalizeEncodingMode(parsed.encodingMode);
    parsed.themeMode = normalizeThemeMode(parsed.themeMode);
    parsed.windowBounds = normalizeWindowBounds(parsed.windowBounds);
    parsed.didResetAdvancedOutputDefaults = storedSettings.didResetAdvancedOutputDefaults === true;

    if (!parsed.didResetAdvancedOutputDefaults) {
      parsed.writeMetadata = false;
      parsed.writeThumbnail = false;
      parsed.writeSubs = false;
      parsed.didResetAdvancedOutputDefaults = true;
      await writeSettingsAtomic(settingsPath, parsed);
    }

    return parsed;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Failed to load settings, falling back to defaults.', error);
    }

    return { ...defaultSettings };
  }
}

async function saveSettings(app, settings) {
  let storedSettings = {};
  try {
    storedSettings = await readStoredSettings(app);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Failed to read current settings before save, falling back to defaults.', error);
    }
  }

  const nextSettings = buildNextSettings(app, storedSettings, settings);
  const settingsPath = getSettingsPath(app);
  await writeSettingsAtomic(settingsPath, nextSettings);
  return nextSettings;
}

function saveSettingsSync(app, settings) {
  let storedSettings = {};
  try {
    storedSettings = readStoredSettingsSync(app);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('Failed to read current settings before sync save, falling back to defaults.', error);
    }
  }

  const nextSettings = buildNextSettings(app, storedSettings, settings);
  const settingsPath = getSettingsPath(app);
  writeSettingsAtomicSync(settingsPath, nextSettings);
  return nextSettings;
}

module.exports = {
  DEFAULT_SETTINGS: BASE_DEFAULT_SETTINGS,
  SUPPORTED_ENCODING_MODES,
  SUPPORTED_THEME_MODES,
  loadSettings,
  normalizeEncodingMode,
  normalizeLanguage,
  normalizeThemeMode,
  normalizeWindowBounds,
  resolveDefaultSettings,
  saveSettings,
  saveSettingsSync
};

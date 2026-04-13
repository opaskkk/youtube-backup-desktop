const {
  applyFfmpegProgressEntry,
  buildTranscodeProgress,
  consumeOutput,
  consumeTranscodeProgressOutput,
  createTranscodeProgressState,
  extractProgressPercent,
  formatDuration,
  formatEta,
  isDownloadProgressLine,
  parseFfmpegProgressLine,
  parseFfmpegSpeedMultiplier,
  parseFfmpegTimestampToSeconds,
  parseProgressLine,
  parseProgressPayload,
  sanitizeCliProgressValue
} = require('./progress-parser');

const {
  classifyYtDlpError,
  createFinalAccessError,
  createMissingFinalFileError,
  createTranscodeError,
  createTranscodePreparationError,
  createYtDlpProcessError,
  parseYtDlpError,
  shouldTryNextStrategy
} = require('./error-classifier');

const {
  ENCODING_MODES,
  probeDurationSeconds,
  resolveDurationSeconds,
  resolveTranscodeProfiles,
  transcodeToMp4
} = require('./transcode-service');

const {
  AUTH_STRATEGIES,
  buildAuthArgs,
  createYtDlpRunner,
  resolveFinalCandidate,
  runYtDlpDownloadAttempt
} = require('./yt-dlp-runner');

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

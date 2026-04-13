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

function parseYtDlpError(stderr) {
  return classifyYtDlpError(stderr).message;
}

function createYtDlpProcessError(stderr, fallbackMessage) {
  const details = classifyYtDlpError(stderr);
  const error = new Error(details.message || fallbackMessage);
  error.reasonCode = details.reasonCode || 'unknown';
  return error;
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

module.exports = {
  classifyYtDlpError,
  createFinalAccessError,
  createMissingFinalFileError,
  createTranscodeError,
  createTranscodePreparationError,
  createYtDlpProcessError,
  parseYtDlpError,
  shouldTryNextStrategy
};

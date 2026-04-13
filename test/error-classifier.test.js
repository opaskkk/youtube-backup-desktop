const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createFinalAccessError,
  createTranscodeError,
  createYtDlpProcessError
} = require('../src/services/error-classifier');

test('createYtDlpProcessError falls back to the provided message when stderr has no known error line', () => {
  const error = createYtDlpProcessError('warning only', 'Fallback message');
  assert.equal(error.message, 'Fallback message');
  assert.equal(error.reasonCode, 'unknown');
});

test('createFinalAccessError prefers the browser-session message when only browser attempts failed', () => {
  const error = createFinalAccessError([
    { reasonCode: 'browser-session-unavailable', message: 'chrome failed' },
    { reasonCode: 'browser-session-unavailable', message: 'edge failed' }
  ]);

  assert.equal(error.reasonCode, 'browser-session-unavailable');
  assert.match(error.message, /browser sessions/i);
  assert.equal(error.attemptErrors.length, 2);
});

test('createTranscodeError preserves stderr for debugging', () => {
  const error = createTranscodeError('ffmpeg exploded');
  assert.equal(error.reasonCode, 'transcode-failed');
  assert.equal(error.logMessage, 'MP4 re-encoding failed.');
  assert.equal(error.stderr, 'ffmpeg exploded');
});

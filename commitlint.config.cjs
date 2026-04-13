module.exports = {
  extends: ['@commitlint/config-conventional'],
  ignores: [
    (message = '') => /^작업:\s/.test(String(message).trim())
  ]
};

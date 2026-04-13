const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8'
  });
}

function runShell(cwd, command) {
  return execFileSync('C:\\Program Files\\Git\\bin\\sh.exe', ['-lc', command], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      COMMITLINT_SKIP: '1'
    }
  });
}

test('commit-msg hook rewrites imperative english subjects into the auto-generated 작업 template', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-commit-hook-'));
  const messageFile = path.join(repoRoot, 'COMMIT_EDITMSG');

  git(repoRoot, ['init']);
  git(repoRoot, ['config', 'user.name', 'Test User']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);

  fs.mkdirSync(path.join(repoRoot, '.githooks'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'scripts'), { recursive: true });

  fs.copyFileSync(
    path.join(process.cwd(), '.githooks', 'prepare-commit-msg'),
    path.join(repoRoot, '.githooks', 'prepare-commit-msg')
  );
  fs.copyFileSync(
    path.join(process.cwd(), '.githooks', 'commit-msg'),
    path.join(repoRoot, '.githooks', 'commit-msg')
  );
  fs.copyFileSync(
    path.join(process.cwd(), 'scripts', 'prepare-commit-msg.cjs'),
    path.join(repoRoot, 'scripts', 'prepare-commit-msg.cjs')
  );

  fs.writeFileSync(path.join(repoRoot, 'package.json'), '{\n  "name": "demo"\n}\n', 'utf8');
  git(repoRoot, ['add', 'package.json']);

  fs.writeFileSync(messageFile, 'Add auto-generated commit hooks and supporting tests\n', 'utf8');
  runShell(repoRoot, '".githooks/commit-msg" "COMMIT_EDITMSG"');

  const nextMessage = fs.readFileSync(messageFile, 'utf8');
  assert.match(nextMessage, /^작업: 설정\/빌드 업데이트 \(1건\)/);
  assert.match(nextMessage, /name 키 조정/);
});

test('commit-msg hook keeps manual conventional commit subjects unchanged', () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-commit-hook-'));
  const messageFile = path.join(repoRoot, 'COMMIT_EDITMSG');

  git(repoRoot, ['init']);
  fs.mkdirSync(path.join(repoRoot, '.githooks'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'scripts'), { recursive: true });

  fs.copyFileSync(
    path.join(process.cwd(), '.githooks', 'prepare-commit-msg'),
    path.join(repoRoot, '.githooks', 'prepare-commit-msg')
  );
  fs.copyFileSync(
    path.join(process.cwd(), '.githooks', 'commit-msg'),
    path.join(repoRoot, '.githooks', 'commit-msg')
  );
  fs.copyFileSync(
    path.join(process.cwd(), 'scripts', 'prepare-commit-msg.cjs'),
    path.join(repoRoot, 'scripts', 'prepare-commit-msg.cjs')
  );

  fs.writeFileSync(messageFile, 'feat: preserve release commits\n', 'utf8');
  runShell(repoRoot, 'if ".githooks/commit-msg" "COMMIT_EDITMSG"; then exit 0; else exit 1; fi');

  assert.equal(fs.readFileSync(messageFile, 'utf8'), 'feat: preserve release commits\n');
});

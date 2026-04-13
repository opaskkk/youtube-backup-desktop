const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  AUTO_GENERATED_MARKER,
  applyPrepareCommitMessage,
  buildAutoCommitMessage,
  classifyPath,
  hasUserContent,
  parseNumstat,
  shouldAutoGenerate,
  summarizeFile
} = require('../scripts/prepare-commit-msg.cjs');

function git(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8'
  });
}

test('classifyPath maps repository areas to the expected labels', () => {
  assert.equal(classifyPath('src/services/yt-dlp-runner.js'), '서비스');
  assert.equal(classifyPath('src/renderer/renderer.js'), '렌더러');
  assert.equal(classifyPath('README.md'), '문서');
  assert.equal(classifyPath('.githooks/prepare-commit-msg'), '훅/커밋');
  assert.equal(classifyPath('package.json'), '설정/빌드');
});

test('shouldAutoGenerate only fills blank non-merge commit messages', () => {
  assert.equal(shouldAutoGenerate({ source: '', existingMessage: '' }), true);
  assert.equal(shouldAutoGenerate({ source: 'merge', existingMessage: '' }), false);
  assert.equal(shouldAutoGenerate({ source: '', existingMessage: 'fix: manual message\n' }), false);
});

test('parseNumstat parses text and binary entries', () => {
  assert.deepEqual(parseNumstat('12\t3\tsrc/main.js\n-\t-\tassets/icon.png\n'), [
    {
      path: 'src/main.js',
      added: 12,
      deleted: 3,
      binary: false
    },
    {
      path: 'assets/icon.png',
      added: 0,
      deleted: 0,
      binary: true
    }
  ]);
});

test('summarizeFile extracts compact summaries for code, markdown, and binary changes', () => {
  assert.equal(
    summarizeFile('src/main.js', '+function createWindow() {}\n+const state = {}\n'),
    'createWindow 함수 추가/수정 / state 선언 추가/수정'
  );
  assert.equal(
    summarizeFile('README.md', '+## Release Flow\n+### Packaging\n'),
    '## Release Flow / ### Packaging'
  );
  assert.equal(summarizeFile('icon.png', '', true), '바이너리 변경');
});

test('buildAutoCommitMessage follows the shared 작업: 템플릿 형식', () => {
  const message = buildAutoCommitMessage([
    {
      path: 'src/services/download-manager.js',
      added: 12,
      deleted: 3,
      binary: false,
      label: '서비스',
      summary: 'downloadManager 함수 추가/수정'
    },
    {
      path: 'test/download-manager.test.js',
      added: 5,
      deleted: 0,
      binary: false,
      label: '테스트',
      summary: '구현 세부 조정'
    }
  ]);

  assert.match(message, /^작업: 서비스\/테스트 업데이트 \(2건\)/);
  assert.match(message, /변경 규모: 파일 2건, \+17 \/ -3/);
  assert.match(message, /주요 변경/);
  assert.match(message, /\[서비스\] src\/services\/download-manager\.js/);
  assert.match(message, new RegExp(AUTO_GENERATED_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('applyPrepareCommitMessage writes the auto-generated template for blank messages only', async () => {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-prepare-'));
  const messageFile = path.join(repoRoot, 'COMMIT_EDITMSG');

  git(repoRoot, ['init']);
  git(repoRoot, ['config', 'user.name', 'Test User']);
  git(repoRoot, ['config', 'user.email', 'test@example.com']);

  fs.writeFileSync(path.join(repoRoot, 'package.json'), '{\n  "name": "demo"\n}\n', 'utf8');
  git(repoRoot, ['add', 'package.json']);

  fs.writeFileSync(messageFile, '', 'utf8');
  const wrote = applyPrepareCommitMessage({ messageFile, source: '', repoRoot });
  const generated = fs.readFileSync(messageFile, 'utf8');

  assert.equal(wrote, true);
  assert.match(generated, /^작업: 설정\/빌드 업데이트 \(1건\)/);
  assert.match(generated, /name 키 조정/);

  fs.writeFileSync(messageFile, 'fix: keep manual message\n', 'utf8');
  const skipped = applyPrepareCommitMessage({ messageFile, source: '', repoRoot });
  assert.equal(skipped, false);
  assert.equal(fs.readFileSync(messageFile, 'utf8'), 'fix: keep manual message\n');
});

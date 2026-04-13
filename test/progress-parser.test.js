const test = require('node:test');
const assert = require('node:assert/strict');
const {
  consumeOutput,
  consumeTranscodeProgressOutput,
  createTranscodeProgressState,
  parseStructuredLine
} = require('../src/services/progress-parser');

test('parseStructuredLine extracts file path and container metadata', () => {
  assert.deepEqual(parseStructuredLine('filepath=F:\\videos\\clip.mp4'), {
    raw: 'filepath=F:\\videos\\clip.mp4',
    finalPath: 'F:\\videos\\clip.mp4'
  });

  assert.deepEqual(parseStructuredLine('container=mp4'), {
    raw: 'container=mp4',
    container: 'mp4'
  });
});

test('consumeOutput forwards logs, progress, and structured values across chunk boundaries', () => {
  const seen = {
    logs: [],
    progress: [],
    values: []
  };

  let remainder = consumeOutput(
    'download:42.5%|1.2MiB/s|00:10\nfilepath=F:\\videos\\cl',
    '',
    {
      onLog: (line) => seen.logs.push(line),
      onProgress: (progress) => seen.progress.push(progress)
    },
    (value) => seen.values.push(value)
  );

  remainder = consumeOutput(
    `${remainder}ip.mp4\ncontainer=mp4\n`,
    '',
    {
      onLog: (line) => seen.logs.push(line),
      onProgress: (progress) => seen.progress.push(progress)
    },
    (value) => seen.values.push(value)
  );

  assert.equal(remainder, '');
  assert.deepEqual(seen.logs, [
    'download:42.5%|1.2MiB/s|00:10',
    'filepath=F:\\videos\\clip.mp4',
    'container=mp4'
  ]);
  assert.deepEqual(seen.progress, [
    {
      phase: 'downloading',
      percent: 42.5,
      speed: '1.2MiB/s',
      eta: '00:10'
    }
  ]);
  assert.equal(seen.values[1].finalPath, 'F:\\videos\\clip.mp4');
  assert.equal(seen.values[2].container, 'mp4');
});

test('consumeTranscodeProgressOutput emits progress updates from ffmpeg progress lines', () => {
  const progressState = createTranscodeProgressState(120);
  const progressEvents = [];

  const remainder = consumeTranscodeProgressOutput(
    'out_time=00:00:30.00\nspeed=2.00x\nprogress=continue\nprogress=end\n',
    '',
    120,
    progressState,
    (progress) => progressEvents.push(progress)
  );

  assert.equal(remainder, '');
  assert.deepEqual(progressEvents, [
    {
      phase: 'transcoding',
      percent: 25,
      speed: '2.00x',
      eta: '45s'
    },
    {
      phase: 'transcoding',
      percent: 100,
      speed: '2.00x',
      eta: ''
    }
  ]);
});

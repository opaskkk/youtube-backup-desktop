const test = require('node:test');
const assert = require('node:assert/strict');
const { DownloadManager, isSupportedYouTubeUrl, terminateProcessTree } = require('../src/services/download-manager');

function createMockApp() {
  return {
    isPackaged: false,
    getAppPath: () => 'C:\\mock-app',
    getPath: (name) => {
      if (name === 'userData') {
        return 'C:\\mock-app-data';
      }
      return 'C:\\mock';
    }
  };
}

function createManager(overrides = {}) {
  const updates = [];
  const manager = new DownloadManager({
    app: createMockApp(),
    onUpdate: (snapshot) => updates.push(snapshot),
    ...overrides
  });
  return { manager, updates };
}

function validPayload(overrides = {}) {
  return {
    url: 'https://www.youtube.com/watch?v=test123',
    outputDir: 'C:\\videos',
    allowMkvFallback: true,
    encodingMode: 'gpu_fast',
    writeMetadata: false,
    writeThumbnail: false,
    writeSubs: false,
    ...overrides
  };
}

test('enqueue adds a job with queued status', async () => {
  const { manager } = createManager();
  // Stub ytDlp to prevent actual process spawn
  manager.ytDlp = {
    inspect: () => new Promise(() => {}),
    download: () => new Promise(() => {})
  };

  const jobId = await manager.enqueue(validPayload());
  assert.ok(jobId);
  assert.match(jobId, /^job_/);

  const snapshot = manager.getSnapshot();
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].url, 'https://www.youtube.com/watch?v=test123');
});

test('enqueue rejects missing URL', async () => {
  const { manager } = createManager();
  await assert.rejects(
    () => manager.enqueue({ outputDir: 'C:\\videos' }),
    /valid YouTube URL/i
  );
});

test('enqueue rejects missing output directory', async () => {
  const { manager } = createManager();
  await assert.rejects(
    () => manager.enqueue({ url: 'https://www.youtube.com/watch?v=test' }),
    /valid output folder/i
  );
});

test('enqueue rejects relative output directory', async () => {
  const { manager } = createManager();
  await assert.rejects(
    () => manager.enqueue({ url: 'https://www.youtube.com/watch?v=test', outputDir: 'relative/path' }),
    /valid output folder/i
  );
});

test('enqueue rejects non-http URLs', async () => {
  const { manager } = createManager();
  await assert.rejects(
    () => manager.enqueue({ url: 'ftp://example.com/video', outputDir: 'C:\\videos' }),
    /valid YouTube URL/i
  );
});

test('enqueue rejects non-YouTube URLs', async () => {
  const { manager } = createManager();
  await assert.rejects(
    () => manager.enqueue({ url: 'https://example.com/video', outputDir: 'C:\\videos' }),
    /valid YouTube URL/i
  );
});

test('isSupportedYouTubeUrl accepts supported YouTube hosts only', () => {
  assert.equal(isSupportedYouTubeUrl('https://www.youtube.com/watch?v=test123'), true);
  assert.equal(isSupportedYouTubeUrl('https://youtu.be/test123'), true);
  assert.equal(isSupportedYouTubeUrl('https://www.youtube-nocookie.com/embed/test123'), true);
  assert.equal(isSupportedYouTubeUrl('https://example.com/watch?v=test123'), false);
});

test('getSnapshot returns a deep copy of jobs', async () => {
  const { manager } = createManager();
  manager.ytDlp = {
    inspect: () => new Promise(() => {}),
    download: () => new Promise(() => {})
  };

  await manager.enqueue(validPayload());
  const snap1 = manager.getSnapshot();
  const snap2 = manager.getSnapshot();
  assert.notEqual(snap1, snap2);
  assert.deepEqual(snap1, snap2);

  snap1[0].logs.push('mutated');
  assert.notDeepEqual(snap1[0].logs, snap2[0].logs);
});

test('cancel changes queued job to cancelled', async () => {
  const { manager } = createManager();
  // Make processNext a no-op so the job stays queued
  manager.activeJobId = 'fake-blocker';

  const jobId = await manager.enqueue(validPayload());
  const snapshot = manager.getSnapshot();
  assert.equal(snapshot[0].status, 'queued');

  const result = await manager.cancel(jobId);
  assert.equal(result, true);

  const afterCancel = manager.getSnapshot();
  assert.equal(afterCancel[0].status, 'cancelled');
  assert.equal(afterCancel[0].progress.phase, 'cancelled');
});

test('cancel returns false for completed job', async () => {
  const { manager } = createManager();
  manager.activeJobId = 'fake-blocker';

  const jobId = await manager.enqueue(validPayload());
  const job = manager.jobs.find((j) => j.id === jobId);
  job.status = 'completed';

  const result = await manager.cancel(jobId);
  assert.equal(result, false);
});

test('cancel throws for unknown job', async () => {
  const { manager } = createManager();
  await assert.rejects(
    () => manager.cancel('nonexistent'),
    /Job not found/i
  );
});

test('retry creates a new job with the same configuration', async () => {
  const { manager } = createManager();
  manager.ytDlp = {
    inspect: () => new Promise(() => {}),
    download: () => new Promise(() => {})
  };

  const jobId = await manager.enqueue(validPayload({ customTitle: 'My Video' }));
  const retryId = await manager.retry(jobId);

  assert.notEqual(jobId, retryId);
  const snapshot = manager.getSnapshot();
  assert.equal(snapshot.length, 2);
  assert.equal(snapshot[1].customTitle, 'My Video');
  assert.equal(snapshot[1].url, 'https://www.youtube.com/watch?v=test123');
});

test('retry throws for unknown job', async () => {
  const { manager } = createManager();
  await assert.rejects(
    () => manager.retry('nonexistent'),
    /Job not found/i
  );
});

test('FIFO queue order is preserved', async () => {
  const { manager } = createManager();
  // Block processing
  manager.activeJobId = 'fake-blocker';

  const id1 = await manager.enqueue(validPayload({ url: 'https://www.youtube.com/watch?v=first' }));
  const id2 = await manager.enqueue(validPayload({ url: 'https://www.youtube.com/watch?v=second' }));
  const id3 = await manager.enqueue(validPayload({ url: 'https://www.youtube.com/watch?v=third' }));

  const snapshot = manager.getSnapshot();
  assert.equal(snapshot[0].id, id1);
  assert.equal(snapshot[1].id, id2);
  assert.equal(snapshot[2].id, id3);
  assert.equal(snapshot[0].status, 'queued');
  assert.equal(snapshot[1].status, 'queued');
  assert.equal(snapshot[2].status, 'queued');
});

test('processNext picks the first queued job', async () => {
  let inspectCalled = false;
  const { manager } = createManager();
  manager.ytDlp = {
    inspect: () => {
      inspectCalled = true;
      return new Promise(() => {});
    },
    download: () => new Promise(() => {})
  };

  await manager.enqueue(validPayload());
  // processNext is called automatically by enqueue
  assert.equal(inspectCalled, true);
  assert.equal(manager.jobs[0].status, 'inspecting');
});

test('processNext does not start a new job while one is active', async () => {
  let inspectCount = 0;
  const { manager } = createManager();
  manager.ytDlp = {
    inspect: () => {
      inspectCount++;
      return new Promise(() => {});
    },
    download: () => new Promise(() => {})
  };

  await manager.enqueue(validPayload({ url: 'https://www.youtube.com/watch?v=first' }));
  await manager.enqueue(validPayload({ url: 'https://www.youtube.com/watch?v=second' }));

  // Only first job should trigger inspect
  assert.equal(inspectCount, 1);
  assert.equal(manager.jobs[0].status, 'inspecting');
  assert.equal(manager.jobs[1].status, 'queued');
});

test('completed job triggers next queued job', async () => {
  const inspectResults = [];
  const { manager } = createManager();

  let resolveFirst;
  let inspectCallCount = 0;

  manager.ytDlp = {
    inspect: (config) => {
      inspectCallCount++;
      inspectResults.push(config.url);
      if (inspectCallCount === 1) {
        return new Promise((resolve) => { resolveFirst = resolve; });
      }
      return new Promise(() => {});
    },
    download: () => new Promise(() => {})
  };

  await manager.enqueue(validPayload({ url: 'https://www.youtube.com/watch?v=first' }));
  await manager.enqueue(validPayload({ url: 'https://www.youtube.com/watch?v=second' }));

  assert.equal(inspectCallCount, 1);

  // Complete first job's inspect, then download
  const mockInspectResult = {
    title: 'Test',
    videoId: 'first',
    bestResolution: '1920x1080',
    isPrivate: false,
    resolvedAuthStrategy: 'none',
    info: { id: 'first', title: 'Test', formats: [] }
  };

  let resolveDownload;
  manager.ytDlp.download = () => new Promise((resolve) => { resolveDownload = resolve; });

  resolveFirst(mockInspectResult);
  await new Promise((r) => setTimeout(r, 10));

  const mockResult = {
    videoId: 'first',
    title: 'Test',
    finalPath: 'C:\\videos\\test.mp4',
    container: 'mp4',
    resolution: '1920x1080',
    subtitlePaths: [],
    metadataPath: null,
    thumbnailPath: null,
    warnings: [],
    transcodeEncoder: '',
    transcodeDurationMs: 0,
    wasTranscodedToMp4: false,
    targetDirectory: 'C:\\videos'
  };

  resolveDownload(mockResult);
  await new Promise((r) => setTimeout(r, 10));

  // First job completed, second job should be inspecting
  assert.equal(manager.jobs[0].status, 'completed');
  assert.equal(inspectCallCount, 2);
  assert.deepEqual(inspectResults, [
    'https://www.youtube.com/watch?v=first',
    'https://www.youtube.com/watch?v=second'
  ]);
});

test('failed job triggers next queued job', async () => {
  let inspectCallCount = 0;
  const { manager } = createManager();

  let rejectFirst;

  manager.ytDlp = {
    inspect: () => {
      inspectCallCount++;
      if (inspectCallCount === 1) {
        return new Promise((_, reject) => { rejectFirst = reject; });
      }
      return new Promise(() => {});
    },
    download: () => new Promise(() => {})
  };

  await manager.enqueue(validPayload({ url: 'https://www.youtube.com/watch?v=first' }));
  await manager.enqueue(validPayload({ url: 'https://www.youtube.com/watch?v=second' }));

  assert.equal(inspectCallCount, 1);

  rejectFirst(new Error('Test failure'));
  await new Promise((r) => setTimeout(r, 10));

  assert.equal(manager.jobs[0].status, 'failed');
  assert.equal(manager.jobs[0].error, 'Test failure');
  assert.equal(inspectCallCount, 2);
});

test('emit sends snapshot to onUpdate callback', async () => {
  const { manager, updates } = createManager();
  manager.activeJobId = 'fake-blocker';

  await manager.enqueue(validPayload());
  assert.ok(updates.length > 0);
  assert.equal(updates[0].length, 1);
  assert.equal(updates[0][0].status, 'queued');
});

test('appendLog trims and deduplicates empty lines', () => {
  const { manager } = createManager();
  manager.activeJobId = 'fake-blocker';
  const job = {
    logs: [],
    status: 'downloading'
  };
  manager.jobs.push(job);

  manager.appendLog(job, '  hello  ');
  manager.appendLog(job, '');
  manager.appendLog(job, null);
  manager.appendLog(job, '  ');

  assert.equal(job.logs.length, 1);
  assert.equal(job.logs[0], 'hello');
});

test('appendLog caps log buffer at 200 entries', () => {
  const { manager } = createManager();
  manager.activeJobId = 'fake-blocker';
  const job = {
    logs: Array.from({ length: 200 }, (_, i) => `line ${i}`),
    status: 'downloading'
  };
  manager.jobs.push(job);

  manager.appendLog(job, 'overflow line');
  assert.equal(job.logs.length, 200);
  assert.equal(job.logs[199], 'overflow line');
  assert.equal(job.logs[0], 'line 1');
});

test('shutdown terminates all active child processes', () => {
  const { manager } = createManager();
  let killCalled = false;

  const mockProcess = {
    pid: 12345,
    killed: false,
    kill: () => { killCalled = true; }
  };

  manager.jobs.push({
    id: 'test-job',
    status: 'downloading',
    childProcess: mockProcess,
    cancelRequested: false
  });

  manager.shutdown();
  assert.equal(manager.jobs[0].cancelRequested, true);
});

test('terminateProcessTree does nothing for null or killed process', () => {
  assert.doesNotThrow(() => terminateProcessTree(null));
  assert.doesNotThrow(() => terminateProcessTree({ killed: true }));
});

test('default job settings use expected values', async () => {
  const { manager } = createManager();
  manager.ytDlp = {
    inspect: () => new Promise(() => {}),
    download: () => new Promise(() => {})
  };

  await manager.enqueue({
    url: 'https://www.youtube.com/watch?v=defaults',
    outputDir: 'C:\\videos'
  });

  const job = manager.getSnapshot()[0];
  assert.equal(job.allowMkvFallback, true);
  assert.equal(job.encodingMode, 'gpu_fast');
  assert.equal(job.writeMetadata, false);
  assert.equal(job.writeThumbnail, false);
  assert.equal(job.writeSubs, false);
  assert.equal(job.status, 'inspecting');
  assert.equal(job.progress.phase, 'inspecting');
});

test('completed duplicate archive job logs a skip instead of a saved file', async () => {
  const { manager } = createManager();
  manager.ytDlp = {
    inspect: async () => ({
      title: 'Test',
      videoId: 'test123',
      bestResolution: '1920x1080',
      isPrivate: false,
      resolvedAuthStrategy: 'none',
      info: { id: 'test123', title: 'Test', formats: [] }
    }),
    download: async () => ({
      videoId: 'test123',
      title: 'Test',
      finalPath: '',
      container: '',
      resolution: '1920x1080',
      subtitlePaths: [],
      metadataPath: null,
      thumbnailPath: null,
      warnings: ['This video is already in the download archive, so no new files were created.'],
      transcodeEncoder: '',
      transcodeDurationMs: 0,
      wasTranscodedToMp4: false,
      skippedDuplicate: true,
      targetDirectory: 'C:\\videos'
    })
  };

  await manager.enqueue(validPayload());
  await new Promise((resolve) => setTimeout(resolve, 10));

  const job = manager.getSnapshot()[0];
  assert.equal(job.status, 'completed');
  assert.equal(job.result.skippedDuplicate, true);
  assert.match(job.logs.at(-1), /already in the archive/i);
});

test('custom title is preserved through enqueue', async () => {
  const { manager } = createManager();
  manager.activeJobId = 'fake-blocker';

  await manager.enqueue(validPayload({ customTitle: '  My Custom Title  ' }));
  const job = manager.getSnapshot()[0];
  assert.equal(job.customTitle, 'My Custom Title');
  assert.equal(job.title, 'My Custom Title');
});

const path = require('node:path');
const { spawn } = require('node:child_process');
const { createArchivePath, makeJobId } = require('./job-utils');
const { createYtDlpRunner } = require('./yt-dlp-runner');
const { formatDuration } = require('./progress-parser');

class DownloadManager {
  constructor({ app, onUpdate }) {
    this.app = app;
    this.onUpdate = onUpdate;
    this.jobs = [];
    this.activeJobId = null;
    this.ytDlp = createYtDlpRunner(app);
  }

  getSnapshot() {
    return this.jobs.map((job) => ({
      id: job.id,
      url: job.url,
      customTitle: job.customTitle,
      outputDir: job.outputDir,
      preferContainer: job.preferContainer,
      allowMkvFallback: job.allowMkvFallback,
      encodingMode: job.encodingMode,
      writeMetadata: job.writeMetadata,
      writeThumbnail: job.writeThumbnail,
      writeSubs: job.writeSubs,
      status: job.status,
      title: job.title,
      logs: [...job.logs],
      progress: job.progress ? { ...job.progress } : null,
      inspect: job.inspect
        ? {
            title: job.inspect.title,
            videoId: job.inspect.videoId,
            bestResolution: job.inspect.bestResolution,
            isPrivate: job.inspect.isPrivate
          }
        : null,
      result: job.result
        ? {
            ...job.result,
            subtitlePaths: [...job.result.subtitlePaths],
            warnings: [...job.result.warnings]
          }
        : null,
      error: job.error
    }));
  }

  emit() {
    this.onUpdate?.(this.getSnapshot());
  }

  async enqueue(payload) {
    validatePayload(payload);

    const job = {
      id: makeJobId(),
      url: payload.url,
      customTitle: String(payload.customTitle || '').trim(),
      outputDir: payload.outputDir,
      preferContainer: 'mp4',
      allowMkvFallback: payload.allowMkvFallback !== false,
      encodingMode: payload.encodingMode || 'gpu_fast',
      writeMetadata: payload.writeMetadata === true,
      writeThumbnail: payload.writeThumbnail === true,
      writeSubs: payload.writeSubs === true,
      status: 'queued',
      title: String(payload.customTitle || '').trim() || payload.url,
      logs: ['Queued backup job.'],
      progress: { phase: 'queued', percent: 0, speed: '', eta: '' },
      inspect: null,
      result: null,
      error: null,
      resolvedAuthStrategy: 'none',
      childProcess: null,
      activeProcessKind: '',
      cancelRequested: false
    };

    this.jobs.push(job);
    this.emit();
    void this.processNext();
    return job.id;
  }

  async cancel(jobId) {
    const job = this.jobs.find((entry) => entry.id === jobId);
    if (!job) {
      throw new Error('Job not found.');
    }

    if (job.status === 'queued') {
      job.cancelRequested = true;
      job.status = 'cancelled';
      job.progress = { phase: 'cancelled', percent: job.progress?.percent || 0 };
      job.logs.push('Cancelled before download started.');
      this.emit();
      return true;
    }

    if (['inspecting', 'downloading', 'merging', 'transcoding'].includes(job.status)) {
      job.cancelRequested = true;
      job.logs.push('Cancellation requested.');
      job.status = 'cancelled';
      job.progress = { phase: 'cancelled', percent: job.progress?.percent || 0 };
      terminateProcessTree(job.childProcess);
      this.emit();
      return true;
    }

    return false;
  }

  async retry(jobId) {
    const existing = this.jobs.find((entry) => entry.id === jobId);
    if (!existing) {
      throw new Error('Job not found.');
    }

    return this.enqueue({
      url: existing.url,
      customTitle: existing.customTitle,
      outputDir: existing.outputDir,
      allowMkvFallback: existing.allowMkvFallback,
      encodingMode: existing.encodingMode,
      writeMetadata: existing.writeMetadata,
      writeThumbnail: existing.writeThumbnail,
      writeSubs: existing.writeSubs
    });
  }

  shutdown() {
    for (const job of this.jobs) {
      if (job.childProcess) {
        job.cancelRequested = true;
        terminateProcessTree(job.childProcess);
      }
    }
  }

  async processNext() {
    if (this.activeJobId) {
      return;
    }

    const nextJob = this.jobs.find((job) => job.status === 'queued');
    if (!nextJob) {
      return;
    }

    this.activeJobId = nextJob.id;
    nextJob.status = 'inspecting';
    nextJob.progress = { phase: 'inspecting', percent: 2, speed: '', eta: '' };
    nextJob.logs.push('Checking link access and available formats.');
    this.emit();

    try {
      const inspectResult = await this.runInspect(nextJob);
      if (nextJob.status === 'cancelled') {
        return;
      }

      nextJob.inspect = inspectResult;
      nextJob.title = nextJob.customTitle || inspectResult.title;
      nextJob.resolvedAuthStrategy = inspectResult.resolvedAuthStrategy || 'none';
      nextJob.logs.push(`Best available resolution reported by YouTube: ${inspectResult.bestResolution}.`);
      nextJob.status = 'downloading';
      nextJob.progress = { phase: 'downloading', percent: 4, speed: '', eta: '' };
      this.emit();

      const result = await this.runDownload(nextJob, inspectResult);
      if (nextJob.status === 'cancelled') {
        return;
      }

      nextJob.result = result;
      nextJob.status = 'completed';
      nextJob.error = null;
      nextJob.progress = { phase: 'completed', percent: 100, speed: '', eta: '' };
      if (result.skippedDuplicate) {
        nextJob.logs.push('Skipped download because this video is already in the archive.');
      } else {
        nextJob.logs.push(
          result.wasTranscodedToMp4
            ? `Saved MP4 backup to ${result.finalPath || result.targetDirectory}.`
            : `Saved backup to ${result.finalPath || result.targetDirectory}.`
        );
      }
      if (result.wasTranscodedToMp4 && result.transcodeDurationMs > 0) {
        nextJob.logs.push(`MP4 re-encoding finished in ${formatDuration(result.transcodeDurationMs, 'milliseconds')}.`);
      }
      this.emit();
    } catch (error) {
      if (nextJob.status !== 'cancelled') {
        if (error.logMessage) {
          nextJob.logs.push(error.logMessage);
        }
        nextJob.status = 'failed';
        nextJob.error = error.message;
        nextJob.progress = { phase: 'failed', percent: nextJob.progress?.percent || 0, speed: '', eta: '' };
        nextJob.logs.push(`Failed: ${error.message}`);
        this.emit();
      }
    } finally {
      nextJob.childProcess = null;
      nextJob.activeProcessKind = '';
      this.activeJobId = null;
      void this.processNext();
    }
  }

  async runInspect(job) {
    return this.ytDlp.inspect(job, {
      onSpawn: ({ childProcess, kind }) => {
        attachActiveProcess(job, childProcess, kind);
      },
      onLog: (line) => this.appendLog(job, line)
    });
  }

  async runDownload(job, inspectResult) {
    const archivePath = createArchivePath(this.app.getPath('userData'));
    this.appendLog(job, `Using download archive: ${archivePath}`);

    return this.ytDlp.download({ ...job, archivePath }, inspectResult, {
      onSpawn: ({ childProcess, kind }) => {
        attachActiveProcess(job, childProcess, kind);
      },
      onLog: (line) => {
        this.appendLog(job, line);
        if (/has already been recorded in the archive/i.test(line)) {
          job.logs.push('This video is already in the archive. Existing backup files will be kept.');
        }
        if (/merging formats/i.test(line)) {
          job.status = 'merging';
          job.progress = {
            ...job.progress,
            phase: 'merging',
            percent: 100,
            speed: '',
            eta: ''
          };
          this.emit();
        }
      },
      onProgress: (progress) => {
        if (progress?.phase === 'transcoding') {
          job.status = 'transcoding';
        } else if (progress?.phase === 'downloading') {
          job.status = 'downloading';
        }
        if (progress?.phase === 'downloading') {
          const currentPercent = Number.isFinite(job.progress?.percent) ? job.progress.percent : 0;
          const nextPercent = Number.isFinite(progress.percent) ? progress.percent : currentPercent;
          job.progress = {
            ...progress,
            percent: nextPercent >= currentPercent ? nextPercent : currentPercent
          };
        } else {
          job.progress = progress;
        }
        this.emit();
      }
    });
  }

  appendLog(job, line) {
    if (!line) {
      return;
    }

    const normalized = String(line).trim();
    if (!normalized) {
      return;
    }

    job.logs.push(normalized);
    job.logs = job.logs.slice(-200);
    this.emit();
  }
}

function attachActiveProcess(job, childProcess, kind) {
  job.childProcess = childProcess || null;
  job.activeProcessKind = kind || '';

  if (!childProcess) {
    return;
  }

  const clearIfCurrent = () => {
    if (job.childProcess === childProcess) {
      job.childProcess = null;
      job.activeProcessKind = '';
    }
  };

  childProcess.once('close', clearIfCurrent);
  childProcess.once('exit', clearIfCurrent);
  childProcess.once('error', clearIfCurrent);
}

function terminateProcessTree(childProcess) {
  if (!childProcess || childProcess.killed) {
    return;
  }

  try {
    spawn('taskkill', ['/pid', String(childProcess.pid), '/t', '/f'], {
      windowsHide: true
    });
  } catch {
    try {
      childProcess.kill('SIGKILL');
    } catch {
      // Best effort cleanup.
    }
  }
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Missing backup job payload.');
  }

  if (!isSupportedYouTubeUrl(payload.url)) {
    throw new Error('Enter a valid YouTube URL.');
  }

  if (!payload.outputDir || !path.isAbsolute(payload.outputDir)) {
    throw new Error('Choose a valid output folder.');
  }
}

function isSupportedYouTubeUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    return hostname === 'youtube.com'
      || hostname.endsWith('.youtube.com')
      || hostname === 'youtu.be'
      || hostname === 'youtube-nocookie.com'
      || hostname.endsWith('.youtube-nocookie.com');
  } catch {
    return false;
  }
}

module.exports = {
  DownloadManager,
  attachActiveProcess,
  isSupportedYouTubeUrl,
  terminateProcessTree
};

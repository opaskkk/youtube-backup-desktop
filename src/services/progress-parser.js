function parseStructuredLine(line) {
  const raw = String(line).trim();
  if (!raw) {
    return null;
  }

  if (isDownloadProgressLine(raw)) {
    return { raw, progress: parseProgressLine(raw) };
  }

  if (raw.startsWith('filepath=')) {
    return { raw, finalPath: raw.slice('filepath='.length).trim() };
  }

  if (raw.startsWith('container=')) {
    return { raw, container: raw.slice('container='.length).trim() };
  }

  return { raw };
}

function parseProgressLine(line) {
  const payload = parseProgressPayload(line);
  return {
    phase: 'downloading',
    percent: extractProgressPercent(payload[0]),
    speed: sanitizeCliProgressValue(payload[1]),
    eta: sanitizeCliProgressValue(payload[2])
  };
}

function parseProgressPayload(line) {
  const raw = String(line || '').trim();
  const payload = raw.startsWith('download:') ? raw.slice('download:'.length) : raw;
  return payload.split('|');
}

function isDownloadProgressLine(line) {
  const raw = String(line || '').trim();
  if (!raw) {
    return false;
  }

  const payload = raw.startsWith('download:') ? raw.slice('download:'.length) : raw;
  const parts = payload.split('|');
  if (parts.length < 3) {
    return false;
  }

  const firstPart = sanitizeCliProgressValue(parts[0]);
  return /%/.test(firstPart) || /\d+(?:\.\d+)?/.test(firstPart);
}

function sanitizeCliProgressValue(value) {
  return String(value || '')
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractProgressPercent(value) {
  const sanitized = sanitizeCliProgressValue(value);
  const match = sanitized.match(/(\d+(?:\.\d+)?)/);
  if (!match) {
    return 0;
  }

  const numeric = Number.parseFloat(match[1]);
  return Number.isFinite(numeric) ? numeric : 0;
}

function consumeOutput(text, buffer, handlers, onData) {
  const nextBuffer = `${buffer}${text}`;
  const lines = nextBuffer.split(/\r?\n/);
  const remainder = lines.pop() || '';

  for (const line of lines) {
    const value = parseStructuredLine(line);
    if (!value) {
      continue;
    }

    handlers.onLog?.(value.raw);
    if (value.progress) {
      handlers.onProgress?.(value.progress);
    }
    onData(value);
  }

  return remainder;
}

function createTranscodeProgressState(durationSeconds) {
  return {
    durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0,
    outTimeSeconds: 0,
    speedMultiplier: 0,
    speedText: ''
  };
}

function consumeTranscodeProgressOutput(text, buffer, durationSeconds, progressState, onProgress) {
  const nextBuffer = `${buffer}${text}`;
  const lines = nextBuffer.split(/\r?\n/);
  const remainder = lines.pop() || '';

  for (const line of lines) {
    const entry = parseFfmpegProgressLine(line);
    if (!entry) {
      continue;
    }

    applyFfmpegProgressEntry(progressState, entry, durationSeconds);

    if (entry.key === 'progress') {
      onProgress?.(buildTranscodeProgress(progressState, entry.value === 'end'));
    }
  }

  return remainder;
}

function parseFfmpegProgressLine(line) {
  const raw = String(line || '').trim();
  if (!raw || !raw.includes('=')) {
    return null;
  }

  const separatorIndex = raw.indexOf('=');
  return {
    key: raw.slice(0, separatorIndex).trim(),
    value: raw.slice(separatorIndex + 1).trim()
  };
}

function applyFfmpegProgressEntry(progressState, entry, durationSeconds) {
  progressState.durationSeconds = Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : progressState.durationSeconds;

  if (entry.key === 'out_time') {
    progressState.outTimeSeconds = parseFfmpegTimestampToSeconds(entry.value);
    return;
  }

  if (entry.key === 'out_time_ms') {
    const numeric = Number.parseFloat(entry.value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      progressState.outTimeSeconds = numeric >= 100000 ? numeric / 1000000 : numeric / 1000;
    }
    return;
  }

  if (entry.key === 'out_time_us') {
    const numeric = Number.parseFloat(entry.value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      progressState.outTimeSeconds = numeric / 1000000;
    }
    return;
  }

  if (entry.key === 'speed') {
    progressState.speedText = entry.value;
    progressState.speedMultiplier = parseFfmpegSpeedMultiplier(entry.value);
  }
}

function buildTranscodeProgress(progressState, isComplete = false) {
  const durationSeconds = Number.isFinite(progressState.durationSeconds) ? progressState.durationSeconds : 0;
  const outTimeSeconds = Number.isFinite(progressState.outTimeSeconds) ? progressState.outTimeSeconds : 0;
  const clampedOutTime = durationSeconds > 0 ? Math.min(outTimeSeconds, durationSeconds) : outTimeSeconds;
  const percent = isComplete
    ? 100
    : durationSeconds > 0
      ? Math.max(0, Math.min(100, (clampedOutTime / durationSeconds) * 100))
      : 0;

  let eta = '';
  if (!isComplete && durationSeconds > 0 && progressState.speedMultiplier > 0) {
    const remainingSeconds = Math.max(0, durationSeconds - clampedOutTime) / progressState.speedMultiplier;
    eta = formatEta(remainingSeconds);
  }

  return {
    phase: 'transcoding',
    percent,
    speed: progressState.speedText || '',
    eta
  };
}

function parseFfmpegTimestampToSeconds(value) {
  const normalized = String(value || '').trim();
  const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(normalized);
  if (!match) {
    return 0;
  }

  const [, hours, minutes, seconds] = match;
  return (Number.parseInt(hours, 10) * 3600) + (Number.parseInt(minutes, 10) * 60) + Number.parseFloat(seconds);
}

function parseFfmpegSpeedMultiplier(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const numeric = Number.parseFloat(normalized.replace(/x$/i, ''));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '';
  }

  const rounded = Math.max(1, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

function formatDuration(secondsOrMs, unit = 'seconds') {
  const totalSeconds = unit === 'milliseconds'
    ? Math.round((Number(secondsOrMs) || 0) / 1000)
    : Math.round(Number(secondsOrMs) || 0);

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return '';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

module.exports = {
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
  parseStructuredLine,
  sanitizeCliProgressValue
};

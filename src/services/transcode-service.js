const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const {
  consumeTranscodeProgressOutput,
  createTranscodeProgressState
} = require('./progress-parser');
const { createTranscodeError } = require('./error-classifier');

const ENCODING_MODES = ['cpu_quality', 'gpu_fast', 'gpu_quality'];

function resolveTranscodeProfiles(encodingMode) {
  const mode = ENCODING_MODES.includes(encodingMode) ? encodingMode : 'gpu_fast';

  if (mode === 'cpu_quality') {
    return [
      {
        kind: 'cpu',
        encoder: 'libx264',
        label: 'CPU high quality',
        videoArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18']
      }
    ];
  }

  if (mode === 'gpu_quality') {
    return [
      {
        kind: 'gpu',
        encoder: 'h264_nvenc',
        label: 'GPU high quality (NVIDIA)',
        videoArgs: ['-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr', '-cq', '19']
      },
      {
        kind: 'gpu',
        encoder: 'h264_qsv',
        label: 'GPU high quality (Intel)',
        videoArgs: ['-c:v', 'h264_qsv', '-preset', 'medium', '-global_quality', '20']
      },
      {
        kind: 'gpu',
        encoder: 'h264_amf',
        label: 'GPU high quality (AMD)',
        videoArgs: ['-c:v', 'h264_amf', '-quality', 'quality', '-qp_i', '20', '-qp_p', '22']
      },
      {
        kind: 'cpu',
        encoder: 'libx264',
        label: 'CPU high quality fallback',
        videoArgs: ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18']
      }
    ];
  }

  return [
    {
      kind: 'gpu',
      encoder: 'h264_nvenc',
      label: 'GPU fast (NVIDIA)',
      videoArgs: ['-c:v', 'h264_nvenc', '-preset', 'p3', '-rc', 'vbr', '-cq', '24']
    },
    {
      kind: 'gpu',
      encoder: 'h264_qsv',
      label: 'GPU fast (Intel)',
      videoArgs: ['-c:v', 'h264_qsv', '-preset', 'faster', '-global_quality', '24']
    },
    {
      kind: 'gpu',
      encoder: 'h264_amf',
      label: 'GPU fast (AMD)',
      videoArgs: ['-c:v', 'h264_amf', '-quality', 'speed', '-qp_i', '24', '-qp_p', '26']
    },
    {
      kind: 'cpu',
      encoder: 'libx264',
      label: 'CPU fallback',
      videoArgs: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20']
    }
  ];
}

async function transcodeToMp4({
  sourcePath,
  outputPath,
  ffmpegPath,
  ffprobePath,
  encodingMode,
  durationSeconds,
  handlers
}) {
  const profiles = resolveTranscodeProfiles(encodingMode);
  let lastError = null;
  let triedGpuEncoder = false;

  for (const profile of profiles) {
    await fs.rm(outputPath, { force: true });

    if (profile.kind === 'gpu') {
      triedGpuEncoder = true;
    }

    handlers.onLog?.(`Trying ${profile.label} for MP4 re-encoding.`);
    const startedAt = Date.now();

    const args = [
      '-y',
      '-progress',
      'pipe:2',
      '-nostats',
      '-i',
      sourcePath,
      ...profile.videoArgs,
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-movflags',
      '+faststart',
      outputPath
    ];

    const child = spawn(ffmpegPath, args, {
      windowsHide: true
    });
    handlers.onSpawn?.({ childProcess: child, kind: 'ffmpeg' });

    let stderr = '';
    let stderrBuffer = '';
    let currentProgress = createTranscodeProgressState(durationSeconds);
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      stderrBuffer = consumeTranscodeProgressOutput(
        text,
        stderrBuffer,
        durationSeconds,
        currentProgress,
        (progress) => handlers.onProgress?.(progress)
      );
    });

    const exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });

    if (exitCode === 0) {
      await fs.access(outputPath);
      handlers.onProgress?.({
        phase: 'transcoding',
        percent: 100,
        speed: currentProgress.speedText || '',
        eta: ''
      });
      if (profile.kind === 'cpu' && triedGpuEncoder) {
        handlers.onLog?.('GPU encoding was unavailable. Falling back to CPU encoding.');
      }
      handlers.onLog?.(`Using ${profile.encoder} for MP4 re-encoding.`);
      return {
        outputPath,
        encoder: profile.encoder,
        durationMs: Math.max(0, Date.now() - startedAt)
      };
    }

    lastError = stderr;
  }

  throw createTranscodeError(lastError);
}

async function resolveDurationSeconds(info, sourcePath, ffprobePath) {
  const infoDuration = Number.parseFloat(info?.duration);
  if (Number.isFinite(infoDuration) && infoDuration > 0) {
    return infoDuration;
  }

  if (!sourcePath || !ffprobePath) {
    return 0;
  }

  return probeDurationSeconds(sourcePath, ffprobePath);
}

async function probeDurationSeconds(sourcePath, ffprobePath) {
  const child = spawn(ffprobePath, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    sourcePath
  ], {
    windowsHide: true
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    return 0;
  }

  const duration = Number.parseFloat(stdout.trim());
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

module.exports = {
  ENCODING_MODES,
  probeDurationSeconds,
  resolveDurationSeconds,
  resolveTranscodeProfiles,
  transcodeToMp4
};

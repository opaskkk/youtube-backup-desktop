const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { getBinaryPaths } = require('./binary-manager');
const {
  buildOutputTemplate,
  buildTargetDirectory,
  chooseBestResolution,
  collectWarnings,
  formatResolution,
  resolveOutputStem
} = require('./job-utils');
const { consumeOutput } = require('./progress-parser');
const {
  createMissingFinalFileError,
  createTranscodePreparationError,
  createYtDlpProcessError,
  shouldTryNextStrategy,
  createFinalAccessError
} = require('./error-classifier');
const { transcodeToMp4, resolveDurationSeconds } = require('./transcode-service');

const AUTH_STRATEGIES = ['none', 'chrome', 'edge', 'brave'];
const MEDIA_EXTENSIONS = ['.mp4', '.mkv', '.webm'];
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass'];
const THUMBNAIL_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function createYtDlpRunner(app) {
  const binaries = getBinaryPaths(app);

  function buildBaseArgs(authStrategy) {
    return [
      '--no-playlist',
      '--ffmpeg-location',
      path.dirname(binaries.ffmpeg),
      '--encoding',
      'utf-8',
      ...buildAuthArgs(authStrategy)
    ];
  }

  function spawnYtDlp(args, options = {}) {
    return spawn(binaries.ytDlp, args, {
      windowsHide: true,
      ...options
    });
  }

  async function inspect(config, handlers = {}) {
    const attemptErrors = [];

    for (const authStrategy of AUTH_STRATEGIES) {
      try {
        handlers.onLog?.(`Checking link access using ${formatStrategyLabel(authStrategy)}.`);
        const info = await inspectWithStrategy(config, authStrategy, handlers, spawnYtDlp, buildBaseArgs);
        return {
          title: info.title || config.url,
          videoId: info.id || '',
          bestResolution: chooseBestResolution(info.formats),
          isPrivate: Boolean(info.availability && info.availability !== 'public'),
          resolvedAuthStrategy: authStrategy,
          info
        };
      } catch (error) {
        attemptErrors.push({
          authStrategy,
          reasonCode: error.reasonCode || 'unknown',
          message: error.message
        });

        if (!shouldTryNextStrategy(error.reasonCode)) {
          throw error;
        }
      }
    }

    throw createFinalAccessError(attemptErrors);
  }

  async function download(config, inspectResult, handlers = {}) {
    const targetDirectory = buildTargetDirectory(config.outputDir, inspectResult.info);
    await fs.mkdir(targetDirectory, { recursive: true });

    const outputTemplate = buildOutputTemplate(inspectResult.info, config.customTitle);

    const directAttempt = await runYtDlpDownloadAttempt({
      config,
      inspectResult,
      handlers,
      spawnYtDlp,
      buildBaseArgs,
      targetDirectory,
      outputTemplate,
      mergeOutputFormat: config.allowMkvFallback ? 'mp4/mkv' : 'mp4',
      archivePath: config.archivePath
    });

    if (directAttempt.skippedDuplicate) {
      return buildSkippedDuplicateResult(config, inspectResult, targetDirectory);
    }

    if (directAttempt.finalCandidate) {
      return buildDownloadResult(config, inspectResult, targetDirectory, directAttempt);
    }

    if (config.allowMkvFallback) {
      throw createMissingFinalFileError(true);
    }

    handlers.onLog?.('Preparing a source file for MP4 re-encoding.');

    const sourceAttempt = await runYtDlpDownloadAttempt({
      config,
      inspectResult,
      handlers,
      spawnYtDlp,
      buildBaseArgs,
      targetDirectory,
      outputTemplate,
      mergeOutputFormat: 'mkv',
      archivePath: null
    });

    if (!sourceAttempt.finalCandidate) {
      throw createTranscodePreparationError();
    }

    handlers.onLog?.('Re-encoding to MP4 because direct MP4 output was not possible.');
    handlers.onProgress?.({
      phase: 'transcoding',
      percent: 0,
      speed: '',
      eta: ''
    });

    const transcoded = await transcodeToMp4({
      sourcePath: sourceAttempt.finalCandidate,
      outputPath: path.join(targetDirectory, `${resolveOutputStem(inspectResult.info, config.customTitle)}.mp4`),
      ffmpegPath: binaries.ffmpeg,
      ffprobePath: binaries.ffprobe,
      encodingMode: config.encodingMode,
      durationSeconds: await resolveDurationSeconds(inspectResult.info, sourceAttempt.finalCandidate, binaries.ffprobe),
      handlers
    });

    if (sourceAttempt.finalCandidate !== transcoded.outputPath) {
      await fs.rm(sourceAttempt.finalCandidate, { force: true });
    }

    const finalFiles = await fs.readdir(targetDirectory);
    return buildDownloadResult(config, inspectResult, targetDirectory, {
      finalCandidate: transcoded.outputPath,
      container: 'mp4',
      files: finalFiles,
      relatedFiles: filterRelatedOutputFiles(finalFiles, inspectResult.info, config.customTitle, transcoded.outputPath),
      transcodeEncoder: transcoded.encoder,
      transcodeDurationMs: transcoded.durationMs,
      wasTranscodedToMp4: true
    });
  }

  return {
    inspect,
    download
  };
}

async function inspectWithStrategy(config, authStrategy, handlers, spawnYtDlp, buildBaseArgs) {
  const args = [
    ...buildBaseArgs(authStrategy),
    '--dump-single-json',
    '--no-warnings',
    '--skip-download',
    config.url
  ];

  const child = spawnYtDlp(args);
  handlers.onSpawn?.({ childProcess: child, kind: 'yt-dlp' });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    handlers.onLog?.(text.trim());
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    throw createYtDlpProcessError(stderr, 'The app could not inspect this link.');
  }

  return JSON.parse(stdout);
}

async function runYtDlpDownloadAttempt({
  config,
  inspectResult,
  handlers,
  spawnYtDlp,
  buildBaseArgs,
  targetDirectory,
  outputTemplate,
  mergeOutputFormat,
  archivePath
}) {
  const filesBefore = await readDirectoryFileNames(targetDirectory);
  const outputStem = resolveOutputStem(inspectResult.info, config.customTitle);
  const args = [
    ...buildBaseArgs(inspectResult.resolvedAuthStrategy || 'none'),
    '--newline',
    '--progress',
    '--progress-template',
    'download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
    '--format',
    'bv*+ba/b',
    '--merge-output-format',
    mergeOutputFormat,
    '--paths',
    targetDirectory,
    '--output',
    outputTemplate,
    '--embed-metadata',
    '--compat-options',
    'no-live-chat',
    '--no-part',
    '--print',
    'after_move:filepath=%(filepath)s',
    '--print',
    'after_move:container=%(ext)s',
    config.url
  ];

  if (archivePath) {
    args.push('--download-archive', archivePath);
  }

  if (config.writeMetadata) {
    args.push('--write-info-json', '--no-clean-infojson');
  }

  if (config.writeThumbnail) {
    args.push('--write-thumbnail');
  }

  if (config.writeSubs) {
    args.push('--write-auto-subs', '--write-subs', '--convert-subs', 'srt');
  }

  const child = spawnYtDlp(args, {
    env: {
      ...process.env,
      PYTHONUTF8: '1'
    }
  });
  handlers.onSpawn?.({ childProcess: child, kind: 'yt-dlp' });

  let stderr = '';
  let stdoutBuffer = '';
  let stderrBuffer = '';
  let finalPath = '';
  let container = '';
  let skippedDuplicate = false;

  const handleStructuredValue = (value) => {
    finalPath = value.finalPath || finalPath;
    container = value.container || container;
    skippedDuplicate = skippedDuplicate || isArchiveSkipLine(value.raw);
  };

  child.stdout.on('data', (chunk) => {
    stdoutBuffer = consumeOutput(chunk.toString(), stdoutBuffer, handlers, handleStructuredValue);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    stderrBuffer = consumeOutput(text, stderrBuffer, handlers, handleStructuredValue);
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  if (stdoutBuffer) {
    stdoutBuffer = consumeOutput('\n', stdoutBuffer, handlers, handleStructuredValue);
  }

  if (stderrBuffer) {
    stderrBuffer = consumeOutput('\n', stderrBuffer, handlers, handleStructuredValue);
  }

  if (exitCode !== 0) {
    throw createYtDlpProcessError(stderr, 'The app could not download this link.');
  }

  const files = await fs.readdir(targetDirectory);
  const newFiles = files.filter((file) => !filesBefore.has(file));
  const relatedFiles = filterRelatedOutputFiles(files, inspectResult.info, config.customTitle, finalPath, newFiles);
  const finalCandidate = resolveFinalCandidate(finalPath, targetDirectory, relatedFiles, {
    previousFiles: filesBefore,
    outputStem
  });

  return {
    files,
    newFiles,
    relatedFiles,
    finalCandidate,
    container: container || '',
    skippedDuplicate: skippedDuplicate && !finalCandidate && newFiles.length === 0,
    wasTranscodedToMp4: false
  };
}

function buildDownloadResult(config, inspectResult, targetDirectory, attempt) {
  const finalExt = attempt.container || path.extname(attempt.finalCandidate).replace('.', '') || 'unknown';
  const relatedFiles = attempt.relatedFiles || filterRelatedOutputFiles(
    attempt.files,
    inspectResult.info,
    config.customTitle,
    attempt.finalCandidate,
    attempt.newFiles
  );
  const subtitlePaths = relatedFiles
    .filter((file) => SUBTITLE_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .map((file) => path.join(targetDirectory, file));
  const metadataPath = relatedFiles
    .filter((file) => file.endsWith('.info.json'))
    .map((file) => path.join(targetDirectory, file))[0] || null;
  const thumbnailPath = relatedFiles
    .filter((file) => THUMBNAIL_EXTENSIONS.includes(path.extname(file).toLowerCase()))
    .map((file) => path.join(targetDirectory, file))
    .find((filePath) => !filePath.endsWith('.part')) || null;

  const result = {
    videoId: inspectResult.info.id || '',
    title: inspectResult.info.title || config.url,
    finalPath: attempt.finalCandidate,
    container: finalExt,
    resolution: inspectResult.bestResolution || formatResolution(inspectResult.info.width, inspectResult.info.height),
    subtitlePaths,
    metadataPath,
    thumbnailPath,
    warnings: [],
    transcodeEncoder: attempt.transcodeEncoder || '',
    transcodeDurationMs: attempt.transcodeDurationMs || 0,
    wasTranscodedToMp4: Boolean(attempt.wasTranscodedToMp4),
    skippedDuplicate: Boolean(attempt.skippedDuplicate),
    targetDirectory
  };
  result.warnings = collectWarnings(result, {
    writeMetadata: config.writeMetadata,
    writeThumbnail: config.writeThumbnail,
    writeSubs: config.writeSubs
  });
  return result;
}

function buildSkippedDuplicateResult(config, inspectResult, targetDirectory) {
  return {
    videoId: inspectResult.info.id || '',
    title: inspectResult.info.title || config.url,
    finalPath: '',
    container: '',
    resolution: inspectResult.bestResolution || formatResolution(inspectResult.info.width, inspectResult.info.height),
    subtitlePaths: [],
    metadataPath: null,
    thumbnailPath: null,
    warnings: ['This video is already in the download archive, so no new files were created.'],
    transcodeEncoder: '',
    transcodeDurationMs: 0,
    wasTranscodedToMp4: false,
    skippedDuplicate: true,
    targetDirectory
  };
}

function buildAuthArgs(authStrategy) {
  if (!authStrategy || authStrategy === 'none') {
    return [];
  }

  return ['--cookies-from-browser', authStrategy];
}

function resolveFinalCandidate(finalPath, targetDirectory, files = [], options = {}) {
  if (finalPath) {
    return finalPath;
  }

  const previousFiles = options.previousFiles || new Set();
  const outputStem = options.outputStem || '';
  const mediaFile = files.find((file) => {
    if (!MEDIA_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
      return false;
    }

    if (previousFiles.has(file)) {
      return false;
    }

    if (outputStem && path.parse(file).name !== outputStem) {
      return false;
    }

    return true;
  });
  return mediaFile ? path.join(targetDirectory, mediaFile) : '';
}

async function readDirectoryFileNames(directoryPath) {
  try {
    const files = await fs.readdir(directoryPath);
    return new Set(files);
  } catch {
    return new Set();
  }
}

function filterRelatedOutputFiles(files = [], info = {}, customTitle = '', finalPath = '', preferredFiles = null) {
  const candidates = Array.isArray(preferredFiles) && preferredFiles.length > 0 ? preferredFiles : files;
  const outputStem = resolveOutputStem(info, customTitle);
  const finalBaseName = finalPath ? path.basename(finalPath, path.extname(finalPath)) : '';

  return candidates.filter((file) => {
    const parsed = path.parse(file);
    if (parsed.name === outputStem || parsed.name.startsWith(`${outputStem}.`)) {
      return true;
    }

    return Boolean(finalBaseName) && (parsed.name === finalBaseName || parsed.name.startsWith(`${finalBaseName}.`));
  });
}

function isArchiveSkipLine(line) {
  return /has already been recorded in the archive/i.test(String(line || ''));
}

function formatStrategyLabel(authStrategy) {
  if (authStrategy === 'none') {
    return 'public access';
  }

  return `${authStrategy} browser session`;
}

module.exports = {
  AUTH_STRATEGIES,
  buildAuthArgs,
  buildDownloadResult,
  createYtDlpRunner,
  filterRelatedOutputFiles,
  inspectWithStrategy,
  isArchiveSkipLine,
  resolveFinalCandidate,
  runYtDlpDownloadAttempt
};

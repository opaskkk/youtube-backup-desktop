const path = require('node:path');

function sanitizeSegment(input, fallback = 'unknown') {
  const value = String(input || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');

  return value || fallback;
}

function makeJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatResolution(width, height) {
  if (!width || !height) {
    return 'Unknown';
  }

  return `${width}x${height}`;
}

function chooseBestResolution(formats = []) {
  const candidates = formats
    .filter((format) => format.vcodec && format.vcodec !== 'none' && format.width && format.height)
    .sort((left, right) => {
      const leftPixels = left.width * left.height;
      const rightPixels = right.width * right.height;
      if (leftPixels !== rightPixels) {
        return rightPixels - leftPixels;
      }

      return (right.fps || 0) - (left.fps || 0);
    });

  return candidates[0] ? formatResolution(candidates[0].width, candidates[0].height) : 'Unknown';
}

function resolveOutputStem(info = {}, customTitle = '') {
  return sanitizeSegment(customTitle || info.title || info.id || 'untitled', 'untitled');
}

function buildTargetDirectory(outputDir) {
  return outputDir;
}

function buildOutputTemplate(info, customTitle = '') {
  return `${resolveOutputStem(info, customTitle)}.%(ext)s`;
}

function createArchivePath(appDataDir) {
  return path.join(appDataDir, 'download-archive.txt');
}

function collectWarnings(result, options = {}) {
  const warnings = [];
  if (result.wasTranscodedToMp4) {
    warnings.push('Saved as MP4 after re-encoding to keep MP4 compatibility.');
  }

  if (result.container === 'mkv') {
    warnings.push('Saved as MKV because the selected streams could not be merged into MP4 without quality loss.');
  }

  if (options.writeMetadata && !result.metadataPath) {
    warnings.push('Metadata JSON was requested, but no metadata file was saved.');
  }

  if (options.writeThumbnail && !result.thumbnailPath) {
    warnings.push('Thumbnail saving was requested, but no thumbnail file was saved.');
  }

  if (options.writeSubs && !result.subtitlePaths.length) {
    warnings.push('No subtitles were saved for this video.');
  }
  return warnings;
}

module.exports = {
  sanitizeSegment,
  makeJobId,
  formatResolution,
  chooseBestResolution,
  resolveOutputStem,
  buildTargetDirectory,
  buildOutputTemplate,
  createArchivePath,
  collectWarnings
};

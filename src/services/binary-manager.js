const fs = require('node:fs/promises');
const path = require('node:path');

function getVendorRoot(app) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'vendor', 'win32')
    : path.join(app.getAppPath(), 'vendor', 'win32');
}

function getBinaryPaths(app) {
  const vendorRoot = getVendorRoot(app);

  return {
    vendorRoot,
    ytDlp: path.join(vendorRoot, 'yt-dlp.exe'),
    ffmpeg: path.join(vendorRoot, 'ffmpeg.exe'),
    ffprobe: path.join(vendorRoot, 'ffprobe.exe')
  };
}

async function ensureBundledBinaries(app) {
  const binaries = getBinaryPaths(app);
  const checks = await Promise.allSettled([
    fs.access(binaries.ytDlp),
    fs.access(binaries.ffmpeg),
    fs.access(binaries.ffprobe)
  ]);

  const missing = [];
  if (checks[0].status === 'rejected') {
    missing.push('yt-dlp.exe');
  }
  if (checks[1].status === 'rejected') {
    missing.push('ffmpeg.exe');
  }
  if (checks[2].status === 'rejected') {
    missing.push('ffprobe.exe');
  }

  if (missing.length > 0) {
    throw new Error(
      `Bundled download binaries are missing (${missing.join(', ')}). Run "npm install" or "npm run download:bin" to fetch them.`
    );
  }

  return binaries;
}

module.exports = {
  ensureBundledBinaries,
  getBinaryPaths
};

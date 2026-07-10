const fs = require('node:fs/promises');
const path = require('node:path');
const pinnedBinaries = require('../../scripts/pinned-binaries.json');

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
    ffprobe: path.join(vendorRoot, 'ffprobe.exe'),
    manifest: path.join(vendorRoot, 'binary-manifest.json')
  };
}

function manifestMatchesPinnedVersions(manifest) {
  return manifest?.ytDlp?.version === pinnedBinaries.ytDlp.version
    && manifest?.ytDlp?.sha256 === pinnedBinaries.ytDlp.sha256
    && manifest?.ffmpeg?.version === pinnedBinaries.ffmpeg.version
    && manifest?.ffmpeg?.sha256 === pinnedBinaries.ffmpeg.sha256;
}

async function ensureBundledBinaries(app) {
  const binaries = getBinaryPaths(app);
  const checks = await Promise.allSettled([
    fs.access(binaries.ytDlp),
    fs.access(binaries.ffmpeg),
    fs.access(binaries.ffprobe),
    fs.access(binaries.manifest)
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
  if (checks[3].status === 'rejected') {
    missing.push('binary-manifest.json');
  }

  if (missing.length === 0) {
    try {
      const manifest = JSON.parse(await fs.readFile(binaries.manifest, 'utf8'));
      if (!manifestMatchesPinnedVersions(manifest)) missing.push('current verified binary versions');
    } catch {
      missing.push('valid binary-manifest.json');
    }
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
  getBinaryPaths,
  manifestMatchesPinnedVersions
};

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const pinnedBinaries = require('./pinned-binaries.json');

const vendorRoot = path.join(__dirname, '..', 'vendor', 'win32');
const installedManifestPath = path.join(vendorRoot, 'binary-manifest.json');
const MAX_REDIRECTS = 5;

function binarySpec(name, urlEnv, hashEnv) {
  const pinned = pinnedBinaries[name];
  const spec = {
    ...pinned,
    url: process.env[urlEnv] || pinned.url,
    sha256: (process.env[hashEnv] || pinned.sha256 || '').toLowerCase()
  };
  validateBinarySpec(name, spec);
  return spec;
}

function validateBinarySpec(name, spec) {
  if (!spec || !spec.version || !spec.url || !/^[a-f0-9]{64}$/i.test(spec.sha256 || '')) {
    throw new Error(`Invalid pinned binary manifest entry: ${name}`);
  }
  new URL(spec.url);
}

async function ensureDir(target) {
  await fsp.mkdir(target, { recursive: true });
}

async function downloadFile(url, destination, redirects = 0) {
  if (redirects > MAX_REDIRECTS) {
    throw new Error(`Too many redirects while downloading ${url}`);
  }

  await new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        const redirectedUrl = new URL(response.headers.location, url).toString();
        downloadFile(redirectedUrl, destination, redirects + 1).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Failed to download ${url}. Status ${response.statusCode}`));
        return;
      }

      pipeline(response, fs.createWriteStream(destination)).then(resolve, reject);
    });
    request.on('error', reject);
  });
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(filePath);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', resolve);
    input.on('error', reject);
  });
  return hash.digest('hex');
}

async function fileMatchesHash(filePath, expectedHash) {
  if (!(await exists(filePath))) return false;
  return (await sha256File(filePath)) === expectedHash.toLowerCase();
}

async function downloadVerified(spec, destination, label) {
  const tempPath = `${destination}.download-${process.pid}-${Date.now()}`;
  await ensureDir(path.dirname(destination));
  await fsp.rm(tempPath, { force: true });

  try {
    await downloadFile(spec.url, tempPath);
    const actualHash = await sha256File(tempPath);
    if (actualHash !== spec.sha256) {
      throw new Error(`${label} checksum mismatch. Expected ${spec.sha256}, got ${actualHash}`);
    }
    await fsp.rm(destination, { force: true });
    await fsp.rename(tempPath, destination);
  } finally {
    await fsp.rm(tempPath, { force: true }).catch(() => {});
  }
}

async function exists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function unzipWithPowerShell(zipPath, destination) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`
      ],
      { stdio: 'inherit', windowsHide: true }
    );

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Expand-Archive failed with exit code ${code}`));
    });
  });
}

async function copyFile(source, destination) {
  await ensureDir(path.dirname(destination));
  await fsp.copyFile(source, destination);
}

async function findFile(root, expectedName) {
  const entries = await fsp.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === expectedName.toLowerCase()) {
      return fullPath;
    }
    if (entry.isDirectory()) {
      const nested = await findFile(fullPath, expectedName);
      if (nested) return nested;
    }
  }
  return null;
}

async function readInstalledManifest() {
  try {
    return JSON.parse(await fsp.readFile(installedManifestPath, 'utf8'));
  } catch {
    return null;
  }
}

async function writeInstalledManifest(manifest) {
  const tempPath = `${installedManifestPath}.tmp-${process.pid}`;
  await fsp.writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await fsp.rm(installedManifestPath, { force: true });
  await fsp.rename(tempPath, installedManifestPath);
}

function installedVersionMatches(installed, name, spec) {
  const entry = installed?.[name];
  return entry?.version === spec.version && entry?.sha256 === spec.sha256;
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('Windows binary preparation must run on Windows. Use npm ci --ignore-scripts on other platforms.');
  }

  const ytDlp = binarySpec('ytDlp', 'YTDLP_URL', 'YTDLP_SHA256');
  const ffmpeg = binarySpec('ffmpeg', 'FFMPEG_URL', 'FFMPEG_SHA256');
  await ensureDir(vendorRoot);

  const ytDlpDestination = path.join(vendorRoot, 'yt-dlp.exe');
  if (!(await fileMatchesHash(ytDlpDestination, ytDlp.sha256))) {
    console.log(`Downloading yt-dlp ${ytDlp.version}...`);
    await downloadVerified(ytDlp, ytDlpDestination, 'yt-dlp.exe');
  }

  const ffmpegDestination = path.join(vendorRoot, 'ffmpeg.exe');
  const ffprobeDestination = path.join(vendorRoot, 'ffprobe.exe');
  const installed = await readInstalledManifest();
  const ffmpegReady = installedVersionMatches(installed, 'ffmpeg', ffmpeg)
    && await exists(ffmpegDestination)
    && await exists(ffprobeDestination);

  if (!ffmpegReady) {
    console.log(`Downloading ffmpeg ${ffmpeg.version}...`);
    const archivePath = path.join(os.tmpdir(), `ffmpeg-${ffmpeg.version}-essentials.zip`);
    const extractDir = path.join(os.tmpdir(), `ffmpeg-extract-${process.pid}-${Date.now()}`);
    try {
      await downloadVerified(ffmpeg, archivePath, 'ffmpeg essentials archive');
      await unzipWithPowerShell(archivePath, extractDir);
      const ffmpegSource = await findFile(extractDir, 'ffmpeg.exe');
      const ffprobeSource = await findFile(extractDir, 'ffprobe.exe');
      if (!ffmpegSource || !ffprobeSource) {
        throw new Error('Failed to find ffmpeg.exe and ffprobe.exe in the verified archive.');
      }
      await copyFile(ffmpegSource, ffmpegDestination);
      await copyFile(ffprobeSource, ffprobeDestination);
    } finally {
      await fsp.rm(archivePath, { force: true }).catch(() => {});
      await fsp.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  await writeInstalledManifest({
    ytDlp: { version: ytDlp.version, sha256: ytDlp.sha256 },
    ffmpeg: { version: ffmpeg.version, sha256: ffmpeg.sha256 }
  });
  console.log(`Bundled binaries ready in vendor/win32 (yt-dlp ${ytDlp.version}, ffmpeg ${ffmpeg.version}).`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  binarySpec,
  downloadVerified,
  fileMatchesHash,
  main,
  sha256File,
  validateBinarySpec
};

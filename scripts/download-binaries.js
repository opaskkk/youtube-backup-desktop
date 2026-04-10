const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const { spawn } = require('node:child_process');

const vendorRoot = path.join(__dirname, '..', 'vendor', 'win32');
const ffmpegZipPath = path.join(os.tmpdir(), 'ffmpeg-release-essentials.zip');

const ytDlpUrl = process.env.YTDLP_URL || 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const ffmpegUrl = process.env.FFMPEG_URL || 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

async function ensureDir(target) {
  await fsp.mkdir(target, { recursive: true });
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          downloadFile(response.headers.location, destination).then(resolve, reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}. Status ${response.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(destination);
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      })
      .on('error', reject);
  });
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
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

async function main() {
  await ensureDir(vendorRoot);

  const ytDlpDestination = path.join(vendorRoot, 'yt-dlp.exe');
  if (!(await exists(ytDlpDestination))) {
    console.log('Downloading yt-dlp...');
    await downloadFile(ytDlpUrl, ytDlpDestination);
  }

  const ffmpegDestination = path.join(vendorRoot, 'ffmpeg.exe');
  const ffprobeDestination = path.join(vendorRoot, 'ffprobe.exe');
  if (!(await exists(ffmpegDestination)) || !(await exists(ffprobeDestination))) {
    console.log('Downloading ffmpeg...');
    await downloadFile(ffmpegUrl, ffmpegZipPath);

    const extractDir = path.join(os.tmpdir(), `ffmpeg-extract-${Date.now()}`);
    await unzipWithPowerShell(ffmpegZipPath, extractDir);

    const ffmpegSource = await findFile(extractDir, 'ffmpeg.exe');
    const ffprobeSource = await findFile(extractDir, 'ffprobe.exe');

    if (!ffmpegSource || !ffprobeSource) {
      throw new Error('Failed to find ffmpeg.exe and ffprobe.exe in the downloaded archive.');
    }

    await copyFile(ffmpegSource, ffmpegDestination);
    await copyFile(ffprobeSource, ffprobeDestination);
  }

  console.log('Bundled binaries ready in vendor/win32.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

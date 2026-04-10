# YouTube Backup Desktop

Windows Electron app for backing up individual YouTube videos at the highest quality YouTube makes available.

## Features

- Highest-quality video + audio download via `yt-dlp`
- Simple link-first workflow with a destination folder picker
- Automatic local browser-session fallback for links you can already open
- Best-effort single `MP4` output with automatic `MKV` fallback to avoid re-encoding
- Optional metadata, thumbnail, and subtitle backup
- Download archive to avoid accidental duplicates

## Access

- Paste a video link that you can already open in your browser.
- The app first tries public access, then automatically checks local Chrome, Edge, and Brave sessions.
- There is no browser picker in the UI. Access fallback happens automatically inside the app.

## Development

```powershell
npm install
npm start
```

The app downloads Windows binaries for `yt-dlp` and `ffmpeg` into `vendor/win32/` during `npm install`.

## Commit Workflow

- Commit messages must follow Conventional Commits, for example `feat: add queue retry` or `fix: handle session fallback`
- The `commit-msg` hook validates messages automatically through `commitlint`
- Run `npm run release` to update the version, generate `CHANGELOG.md`, and create a release tag locally

## Packaging

```powershell
npm run dist
```

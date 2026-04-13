# YouTube Backup Desktop

Windows Electron app for backing up individual YouTube videos at the highest quality YouTube makes available.

개별 YouTube 영상을 YouTube가 제공하는 범위 안에서 가능한 최고 화질로 백업하기 위한 Windows Electron 앱입니다.

## Features / 기능

- Highest-quality video + audio download via `yt-dlp`
- Simple link-first workflow with a destination folder picker
- Automatic local browser-session fallback for links you can already open
- Best-effort single `MP4` output with automatic `MKV` fallback to avoid re-encoding
- Optional metadata, thumbnail, and subtitle backup
- Download archive to avoid accidental duplicates

- `yt-dlp`를 이용해 가능한 최고 화질의 비디오와 오디오를 다운로드합니다
- 링크를 붙여 넣고 저장 폴더를 고르는 단순한 흐름을 제공합니다
- 브라우저에서 이미 열 수 있는 링크는 로컬 브라우저 세션으로 자동 폴백을 시도합니다
- 재인코딩을 피하기 위해 가능한 경우 단일 `MP4`로 저장하고, 필요하면 자동으로 `MKV`로 폴백합니다
- 메타데이터, 썸네일, 자막을 선택적으로 함께 백업할 수 있습니다
- 중복 다운로드를 피하기 위한 다운로드 아카이브를 유지합니다

## Access / 접근 방식

- Paste a video link that you can already open in your browser.
- The app first tries public access, then automatically checks local Chrome, Edge, and Brave sessions.
- There is no browser picker in the UI. Access fallback happens automatically inside the app.

- 브라우저에서 실제로 열 수 있는 비디오 링크를 붙여 넣으세요.
- 앱은 먼저 공개 접근을 시도한 뒤, 필요하면 로컬 Chrome, Edge, Brave 세션을 자동으로 확인합니다.
- UI에서 브라우저를 직접 고를 필요는 없으며, 접근 폴백은 앱 내부에서 자동으로 처리됩니다.

## Development / 개발

```powershell
npm install
npm start
```

The app downloads Windows binaries for `yt-dlp` and `ffmpeg` into `vendor/win32/` during `npm install`.

`npm install` 중에 Windows용 `yt-dlp`, `ffmpeg` 바이너리를 `vendor/win32/`로 내려받습니다.

## Commit Workflow / 커밋 워크플로

- Commit messages must follow Conventional Commits, for example `feat: add queue retry` or `fix: handle session fallback`
- The `commit-msg` hook validates messages automatically through `commitlint`
- Run `npm run release` to update the version, generate `CHANGELOG.md`, and create a release tag locally
- Version numbers do not change during normal development or packaging; they change only when `npm run release` is run
- `feat`, `fix`, and `perf` commits contribute to the next release version, and `BREAKING CHANGE` triggers a major version bump

- 커밋 메시지는 Conventional Commits 형식을 따라야 합니다. 예: `feat: add queue retry`, `fix: handle session fallback`
- `commit-msg` 훅이 `commitlint`로 커밋 메시지를 자동 검증합니다
- `npm run release`를 실행하면 버전 갱신, `CHANGELOG.md` 생성/갱신, 로컬 Git 태그 생성이 함께 수행됩니다
- 일반 개발이나 패키징 중에는 버전이 바뀌지 않으며, 버전은 `npm run release`를 실행할 때만 올라갑니다
- `feat`, `fix`, `perf`, `BREAKING CHANGE`는 다음 릴리스 버전 계산의 기준이 됩니다

## Packaging / 패키징

```powershell
npm run dist
```

`npm run dist` only builds the installer package. It does not change the app version, update `CHANGELOG.md`, or create a Git tag.

`npm run dist`는 설치 파일만 빌드합니다. 앱 버전을 바꾸지 않고, `CHANGELOG.md`를 갱신하지 않으며, Git 태그도 만들지 않습니다.

## Release Flow / 릴리스 절차

Use this flow when preparing a user-facing release:

사용자에게 배포할 릴리스를 준비할 때는 아래 순서를 따르세요.

```powershell
# 1. Finish code changes and commit them with Conventional Commits
npm test

# 2. Update version + changelog + local Git tag
npm run release

# 3. Build the Windows installer when needed
npm run dist
```

In short:

- `npm start` / `npm run dev`: run the app for development without changing the version
- `npm run dist`: build the installer without changing the version
- `npm run release`: bump the version, update `CHANGELOG.md`, and create a release tag

정리하면:

- `npm start` / `npm run dev`: 버전을 바꾸지 않고 개발용으로 앱을 실행합니다
- `npm run dist`: 버전을 바꾸지 않고 설치 파일을 빌드합니다
- `npm run release`: 버전을 올리고 `CHANGELOG.md`와 릴리스 태그를 갱신합니다

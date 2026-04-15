# AGENTS.md

## 적용 범위
- 이 파일은 `Youtube_backup` 프로젝트 레포 안에서만 적용한다.
- 상위 `F:\VibeCoding\AGENTS.md`는 참조하지 않는다.
- 세부 훅 정책은 이 파일에 중복하지 않고, 필요할 때 프로젝트 내부 설정과 훅을 따른다.

## 프로젝트 성격
- Windows Electron 데스크톱 앱이다.
- 목적은 개별 YouTube 영상을 YouTube가 제공하는 범위 안에서 가능한 최고 화질로 백업하는 것이다.
- 다운로드 엔진은 `yt-dlp`와 `ffmpeg` Windows 바이너리를 사용하며, 바이너리는 `vendor/win32/`에 준비된다.
- 앱은 공개 접근을 먼저 시도한 뒤 로컬 Chrome, Edge, Brave 브라우저 세션 폴백을 자동으로 확인한다.
- 출력은 MP4를 우선하되 재인코딩을 피하거나 실패를 줄이기 위해 MKV 폴백을 허용한다.
- 메타데이터, 썸네일, 자막 백업과 다운로드 아카이브를 지원한다.

## 주요 경로
- `src/main.js`: Electron 메인 프로세스 진입점.
- `src/preload.js`: 메인/렌더러 간 안전한 브릿지.
- `src/renderer/`: 사용자 화면과 상호작용 코드.
- `src/services/`: 다운로드 매니저, yt-dlp 실행, 바이너리 관리, 설정 저장, 진행률 파싱, 오류 분류 로직.
- `scripts/download-binaries.js`: `yt-dlp`와 `ffmpeg` Windows 바이너리 준비.
- `vendor/win32/`: 배포에 포함되는 외부 바이너리 리소스.
- `build/installer.nsh`: NSIS 설치 커스터마이징.
- `test/`: Node test 기반 서비스/훅/릴리스 흐름 검증.
- `artifacts/`, `dist/`: 빌드와 배포 산출물.

## 실행 명령
- 의존성 설치 및 바이너리 준비: `npm install`
- 개발 실행: `npm run dev`
- 일반 실행: `npm start`
- 디자인/렌더러 미리보기: `npm run preview:design`
- 테스트: `npm test`
- 바이너리 재준비: `npm run download:bin`
- Windows 설치 패키지 빌드: `npm run dist`
- 릴리스 준비: `npm run release`

## 작업 규칙
- `package.json`의 Electron 실행 흐름과 스크립트 이름을 임의로 바꾸지 않는다.
- `npm start`와 `npm run dev`는 개발/일반 실행용이며 버전과 changelog를 바꾸지 않는다.
- `npm run dist`는 설치 파일 빌드 전용이며 버전, `CHANGELOG.md`, Git 태그를 바꾸지 않는다.
- `npm run release`만 버전 갱신, `CHANGELOG.md` 갱신, 로컬 릴리스 태그 생성을 담당한다.
- `vendor/win32`, `scripts/download-binaries.js`, `postinstall`, `extraResources`를 바꾸면 바이너리 준비와 패키징 영향을 함께 확인한다.
- `yt-dlp` 실행, 브라우저 세션 폴백, MP4/MKV 선택, 메타데이터/썸네일/자막 옵션, 다운로드 아카이브 변경은 사용자 데이터 손실이나 중복 다운로드 위험을 우선 검토한다.
- `electron-builder`, `build/installer.nsh`, NSIS 설정 변경은 Windows 설치/배포 검증 대상이다.
- Conventional Commits와 commitlint는 릴리스 흐름에 영향을 주므로, 릴리스 관련 변경 시 `commitlint.config.cjs`, `.husky/`, `package.json` 영향을 확인한다.

## 검증 규칙
- 작은 문서/설정 수정은 변경 파일과 관련 설정의 정합성을 확인한다.
- 서비스 로직 변경은 `npm test`를 실행한다.
- Electron 기동 흐름 변경은 `npm run dev` 또는 `npm start`로 앱 기동을 확인한다.
- 렌더러/디자인 미리보기 변경은 `npm run preview:design`을 확인한다.
- 바이너리 다운로드, `vendor/win32`, `postinstall` 변경은 `npm run download:bin`을 실행한다.
- 패키징, 설치 스크립트, `extraResources`, NSIS 변경은 `npm run dist`까지 실행해 Windows 배포 산출물을 확인한다.
- YouTube 접근, 다운로드, 변환, 자막/썸네일/메타데이터 변경은 관련 `test/`의 서비스 테스트를 우선 확인하고 필요 시 실제 앱 흐름으로 보강한다.

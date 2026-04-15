# AGENTS.md

## 적용 범위
- 이 파일은 `Youtube_backup` 프로젝트 레포 안에서만 적용한다.
- 상위 `F:\VibeCoding\AGENTS.md`는 참조하지 않는다.
- 이 레포의 작업 규칙, 실행 명령, 배포 검증 기준은 이 파일과 프로젝트 내부 설정을 우선한다.

## 프로젝트 성격
- 스택: Windows Electron 데스크톱 앱.
- 주요 진입점: `src/main.js`.
- 패키징: `electron-builder`와 Windows `nsis` 타깃.
- 주요 디렉터리:
  - `src/`: Electron 메인/렌더러/프리뷰 코드.
  - `scripts/`: 바이너리 다운로드와 보조 자동화.
  - `vendor/win32`: Windows 배포에 포함되는 외부 바이너리 리소스.
  - `build/`: NSIS 설치 스크립트와 빌드 리소스.
  - `test/`: Node test 기반 테스트.
  - `artifacts/`, `dist/`: 빌드 및 배포 산출물.

## 실행 명령
- 개발: `npm run dev`
- 일반 실행: `npm start`
- 디자인 미리보기: `npm run preview:design`
- 테스트: `npm test`
- 바이너리 준비: `npm run download:bin`
- 배포 패키지 검증: `npm run dist`

## 작업 규칙
- `package.json`의 Electron 기반 실행 흐름과 스크립트 이름을 임의로 바꾸지 않는다.
- `vendor/win32` 바이너리 리소스는 `scripts/download-binaries.js`와 연동되는 구조를 유지한다.
- `postinstall` 또는 `download:bin` 흐름에 영향을 주는 변경은 바이너리 준비 검증을 포함한다.
- `electron-builder` 설정, `build/installer.nsh`, `extraResources`, Windows `nsis` 패키징에 영향을 주는 변경은 배포 검증을 강화한다.
- Windows 데스크톱 배포 흐름과 충돌하는 빌드 체인이나 패키징 방식을 임의로 도입하지 않는다.
- 릴리스, 커밋 훅, 표준 버전 관리 흐름을 바꾸는 변경은 `commitlint.config.cjs`, `.husky/`, `package.json` 영향을 함께 확인한다.

## 검증 규칙
- 작은 수정: 관련 파일의 문법과 `npm test` 영향 여부를 확인한다.
- 애플리케이션 로직 수정: `npm test`를 실행한다.
- Electron 실행 흐름 변경: `npm run dev` 또는 `npm start`로 앱 기동을 확인한다.
- 디자인/렌더러 프리뷰 변경: `npm run preview:design`을 확인한다.
- 바이너리 다운로드, `vendor/win32`, `postinstall` 변경: `npm run download:bin`을 실행한다.
- 패키징, 설치 스크립트, `extraResources`, NSIS 변경: `npm run dist`까지 실행해 Windows 배포 산출물을 확인한다.

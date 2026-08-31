<p align="center">
  <img src="images/app/icon-source.png" width="128" alt="migam desktop 감자봇 아이콘">
</p>

<h1 align="center">migam desktop</h1>

<p align="center">
  Windows 11 바탕화면을 돌아다니며 집중을 도와주는 감자봇 데스크톱 펫
</p>

<p align="center">
  <a href="https://github.com/guswl03/Desktop-Migam-Window/releases/download/v0.2.0/migam.desktop_0.2.0_x64-setup.exe"><strong>Windows용 설치 파일 다운로드</strong></a>
  ·
  <a href="https://github.com/guswl03/Desktop-Migam-Window/releases/tag/v0.2.0">v0.2.0 릴리즈 보기</a>
</p>

> [!NOTE]
> 현재 설치 파일은 **Windows 11 x64**용입니다. 코드 서명이 없어 Windows에서 SmartScreen 경고가 나타날 수 있습니다.

## 바로 설치하기

1. [migam desktop 설치 파일 다운로드](https://github.com/guswl03/Desktop-Migam-Window/releases/download/v0.2.0/migam.desktop_0.2.0_x64-setup.exe)를 누릅니다.
2. 다운로드한 `migam.desktop_0.2.0_x64-setup.exe`를 실행합니다.
3. SmartScreen이 나타나면 **추가 정보**를 누른 뒤 게시자가 `알 수 없는 게시자`인지와 파일 이름을 확인하고 **실행**을 누릅니다.
4. 설치 안내에 따라 완료하면 migam desktop이 실행됩니다.

설치가 시작되지 않으면 [v0.2.0 릴리즈 페이지](https://github.com/guswl03/Desktop-Migam-Window/releases/tag/v0.2.0)의 **Assets**에서 `migam.desktop_0.2.0_x64-setup.exe`를 직접 내려받으세요.

### 처음 실행했다면

- 감자봇을 **마우스 왼쪽 버튼으로 드래그**해 옮길 수 있습니다. 빠르게 놓으면 던져집니다.
- 감자봇을 **마우스 오른쪽 버튼으로 클릭**하면 타이머, 할 일, GAMCHA, 설정 메뉴가 열립니다.
- 작업표시줄 알림 영역의 감자봇 아이콘에서 창 표시, 긴급 중지, 다시 시작, 종료를 선택할 수 있습니다.
- 문제가 생기거나 모든 동작을 즉시 멈추려면 `Ctrl+Shift+F12`를 누르세요.

### 삭제하기

Windows **설정 → 앱 → 설치된 앱**에서 `migam desktop`을 찾아 제거합니다.

## 주요 기능

- 투명·항상 위 펫 창과 다중 모니터 작업 영역 이동
- 클릭, 드래그, 던지기, 착지·충돌과 사용자가 끌 수 있는 창 등반 애니메이션
- CPU·메모리 사용량에 반응하는 이동과 트레이 표시
- 뽀모도로 타이머와 할 일 집중 연결
- 집중 완료 보상 티켓, GAMCHA와 뽑기 코스튬 185종 인벤토리(기본 3종을 포함한 매니페스트 총 188종)
- 사진 배달, 희귀 이벤트와 저배터리 배터리 배달
- 사용자 규칙과 대상 재검증을 거치는 안전한 방해 창 최소화
- 설정·할 일·GAMCHA 로컬 저장 및 손상 JSON 보존·복구

> [!IMPORTANT]
> 방해 창 개입은 기본적으로 꺼져 있습니다. 사용자가 규칙을 만들고 명시적으로 활성화해야 동작하며, 실제 창 제목이나 프로세스 경로는 저장하거나 로그로 남기지 않습니다.

## 요구 사항과 알려진 제한

- Windows 11 x64
- Microsoft Edge WebView2 Runtime
- 자동 업데이트와 코드 서명은 아직 지원하지 않습니다.
- 특수 최상단 창, 실제 DPI, 다중 모니터 구성, 일부 코스튬 정렬은 환경에 따라 차이가 있을 수 있습니다.

WebView2는 Windows 11에 기본 포함되어 있습니다. 앱 창이 열리지 않는 경우 [Microsoft WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/)을 설치한 뒤 다시 실행하세요.

## 로컬 데이터와 개인정보

설정·할 일·GAMCHA 진행도는 Tauri 앱 데이터 디렉터리의 `settings.json`, `todo.json`, `gamcha.json`에 저장됩니다. 손상된 파일은 이름에 복구 시각을 붙여 별도로 보관하고 안전한 기본값으로 복구합니다.

- 계정, 클라우드 동기화, 분석 기능 없음
- 실제 창 제목과 프로세스 경로 저장·로그 금지
- 관리자, 시스템, 전체 화면, 판정 불가 창은 최소화하지 않음

## 개발하기

### 준비물

- Node.js 22 이상과 npm
- Rust stable MSVC toolchain
- Visual Studio C++ Build Tools와 Windows SDK
- Microsoft Edge WebView2 Runtime

### 실행

```powershell
npm ci
npm run tauri -- dev
```

### 검증

```powershell
npm run test:assets
npm run costumes:blueprint
npm run costumes:validate
npm run costumes:validate-candidates
npm run typecheck
npm test
npm run build
cd src-tauri
cargo test --workspace
cargo fmt --check
cargo clippy --all-targets -- -D warnings
```

설치 파일은 저장소 루트에서 `npm run tauri -- build`로 만들며 `src-tauri/target/release/bundle/` 아래에 생성됩니다.

## 현재 검증 상태

- 에셋 테스트 56개와 프런트엔드 테스트 67개 통과
- Rust 테스트 52개 통과
- 뽑기 코스튬 185종(Common 80, Rare 57, Epic 31, Legendary 12, Special 5)과 기본 3종 검증 통과
- 배치 슬롯 합계 head 99, face 28, neck 22, body 36 및 승인 후보 185개 검증 통과
- TypeScript 검사, Vite production build, rustfmt, Clippy 통과
- 개발 앱 실행은 확인했으며 실제 Windows 추첨·착용·기존 기능 회귀는 수동 확인이 남아 있음

상세한 구현 및 검증 기준은 [개발 문서 색인](docs/README.md)을 참고하세요.

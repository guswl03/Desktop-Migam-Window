# 세션 인수인계

최종 갱신: 2026-08-24

이 문서는 다음 작업 세션이 가장 먼저 확인하는 단일 인수인계 기록이다. 작업을 끝낼 때마다 오래된 내용을 남기지 말고 현재 상태로 갱신한다.

## v0.1.2 배포 준비

- Canvas에서 배경 제거한 사진 배달 캐릭터가 `blob:` URL을 사용하지만 CSP `img-src`가 이를 허용하지 않아 사진만 보이던 원인을 수정했다.
- CSP에는 기존 출처를 유지한 채 `blob:`만 추가했고, 설정이 다시 빠지면 실패하는 Rust 회귀 테스트를 추가했다.
- 앱 버전과 README 다운로드 링크를 `0.1.2`/`v0.1.2`로 동기화했다.
- 로컬 검증: 프런트 53개, Rust 49개, TypeScript, production build, rustfmt, Clippy `-D warnings`, Windows x64 MSI/NSIS 빌드 통과.
- NSIS: `migam desktop_0.1.2_x64-setup.exe`, 19,977,502 bytes, SHA-256 `4C7DE4693B72C8FB3902715936AC364C7BE32BF425AF0383152EE4F7F56573E1`.
- 남은 배포 게이트: PR·main GitHub Actions 통과 후 `v0.1.2` 태그에 NSIS 자산 게시.

## 현재 목표

창 등반·상단 보행 자동 구현은 완료됐다. 실제 Windows 창에서 좌우 충돌·등반 위치·창 이동 추적·최소화 낙하를 수동 확인한 뒤 동작 속도와 스프라이트 오프셋을 미세 조정한다. 투두리스트 고급 축하 연출은 그 다음 작업으로 유지한다.

## 최근 창 등반·상단 보행 작업 요약

- Rust `get_climbable_windows` 명령이 자기 프로세스, 최소화·비표시·도구 창을 제외하고 창 ID와 사각형만 반환한다. 제목·프로세스명은 프런트로 전달하거나 기록하지 않는다.
- Windows 11에서 `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)`를 우선 사용해 실제 보이는 창 테두리에 펫 발이 붙도록 했고 실패하면 `GetWindowRect`로 복구한다.
- 바닥 또는 다른 창 위를 걷다가 진행 방향의 창 벽을 만나면 `climbing`으로 전환하고 좌우 방향에 맞춰 스프라이트를 반전한다.
- 창 상단에 도착하면 760ms `pull-up` 연출 뒤 창 상단을 새 바닥으로 사용해 걷는다. 받침 창이 이동·크기 변경되면 약 220ms 주기로 위치를 따라간다.
- 등반·올라서기·상단 보행 중 창이 최소화되거나 닫히면 `falling`과 기존 중력·착지 상태로 전환한다.
- `images/characters/gamjabot/extra/climbing/`의 실제 투명 PNG 세 장을 사용하며 등반 중 위치가 맞지 않는 코스튬은 숨긴다.
- 자동 검증은 프런트 41개·Rust 44개 테스트, TypeScript 검사, Vite production build, rustfmt와 Clippy가 통과했다. 실제 창 z-order와 DPI별 시각 위치는 수동 확인이 남았다.

## 최근 투두리스트·뽀모도로 작업 요약

- Rust `TodoState`에 CRUD·단일 집중 선택·전체 완료 1회 잠금과 재발동 규칙을 구현했고 단위 테스트로 고정했다.
- 앱 데이터의 `todo.json`을 원자 저장하며 손상 파일은 별도 보존한 뒤 빈 목록으로 안전하게 복구한다.
- Focus 시작 시 선택 ID·제목을 snapshot으로 고정한다. 정상 종료에서만 `완료하기`·`계속하기`·`다음 집중`을 표시하며 Skip·Stop은 항목을 변경하지 않는다.
- `timer`는 펫 위의 작은 시간 말풍선으로 되돌렸고, 펫 우클릭 메뉴의 `투두리스트`로 460×640 독립 `todo` 창을 연다.
- 독립 창은 Todoist·Microsoft To Do·투두메이트·Notion의 빠른 입력과 오늘 목록 구조만 참고한 자체 UI이며 추가·수정·삭제·완료·집중 선택과 완료 항목 숨기기를 제공한다.
- 독립 투두 창의 둥근 카드형 외형은 제거했다. 설정창·펫 우클릭 메뉴와 같은 WinDbg형 상단 메뉴와 리본, `0:000>` 명령줄, 각진 필드·목록, 파란 상태바로 디자인을 통일했다.
- 완료 직후 체크 결과를 볼 수 있도록 500ms 뒤 미완료/완료 그룹을 재정렬한다.
- 마지막 미완료 항목을 직접 완료할 때 `todo://all-completed`가 한 번 발생하며 감자펫은 4.5초 점프·광원 축하를 실행한다.
- 2026-08-23 기준 Rust 43개·프런트 25개 테스트, rustfmt, Clippy, TypeScript 검사와 production build가 통과했다.

## 최근 앱 아이콘 작업 요약

- 배포 빌드를 막던 미추적 `images/characters/gamjabot/final/spritesheet-extended.webp` 참조를 Git에 포함된 `references/base-spritesheet-extended.png`로 교체했다.
- 사용자 표시 제품명과 창 제목, Node/Rust 패키지명을 `migam desktop`으로 통일했다. release 실행 파일은 `src-tauri/target/release/migam-desktop.exe`, NSIS 설치 파일은 `src-tauri/target/release/bundle/nsis/migam desktop_0.1.0_x64-setup.exe`로 생성된다. 기존 Tauri identifier는 저장 데이터와 설치 업그레이드 호환을 위해 유지한다.
- `bundle.windows.nsis.installerIcon`과 `uninstallerIcon`을 `images/app/icon.ico`로 지정해 NSIS 기본 다운로드 아이콘 대신 청록색 감자봇 얼굴이 표시되도록 했다.
- release `main.rs`에 Windows GUI subsystem 속성을 적용했다. 새 release EXE의 PE subsystem 값 2를 확인했으며 설치판 실행 시 검은 터미널 창이 더 이상 생성되지 않는다.
- 독립 투두 창의 WinDbg 분위기는 명령줄·각진 패널·파란 상태바로 유지하되, 클릭할 수 없는 File/Home/Focus/View 메뉴와 장식용 리본 및 내부 가짜 닫기 표시는 제거했다.
- 사용자 제공 청록색 감자봇 얼굴에서 좌측 위 숫자와 바깥 흰 여백을 제외하고 투명 512×512 원본 `images/app/icon-source.png`를 만들었다.
- Tauri 아이콘 생성기로 다중 해상도 Windows `images/app/icon.ico`를 다시 만들었고 release 실행 파일에서 새 아이콘을 추출해 확인했다. 제목 표시줄과 작업표시줄 아이콘은 앱을 완전히 종료하고 재실행해야 바뀐다.
- 기존 `tauri dev`가 오후 7:45의 구형 debug 실행 파일을 다시 사용해 보라색 아이콘과 최신 프런트/구형 설정 계약 불일치가 함께 나타났다. 실행 중 프로세스를 종료하고 해당 패키지의 debug 산출물을 정리한 뒤 완전 재빌드했으며, 새 debug 실행 파일에서 감자봇 아이콘을 직접 추출해 확인했다.
- 개발 중 Rust 재컴파일과 WebView 재로드가 겹치면 `state not managed ... get_bootstrap_state`가 간헐적으로 발생했다. `src/tauri/invoke-when-ready.ts`가 이 오류에만 100ms 간격 최대 30회 재시도하며 설정·펫 코스튬·타이머·GAMCHA·우클릭 메뉴의 최초 상태 조회에 적용된다.

## 최근 GAMCHA 인벤토리 작업 요약

- 전체화면 하단을 가리던 `OUTFIT` 선택·조절 바를 제거하고 기존 GAMCHA 창 안에 `GAMCHA`와 `INVENTORY` 탭을 분리했다.
- 인벤토리는 실제 보유 코스튬만 카드로 표시하며 등급 색, 현재 착용 배지, 선택 상태, 상세 이미지와 착용·기본 모습 전환을 제공한다.
- GAMCHA 창은 펫이 있는 모니터의 전체 해상도가 아니라 Windows 작업 영역에 맞춘다. 화면 가장자리 연출은 유지하면서 작업표시줄은 덮지 않는다.
- 뽑기 버튼은 아래쪽 코스튬 궤도와 겹치지 않도록 작업 영역 하단에서 최소 128px 위에 두고 별도 UI 층으로 올렸다. 한글 버튼은 Segoe UI Variable Display·Segoe UI·맑은 고딕 순으로 표시한다.
- 화면 외곽을 돌던 코스튬 32개는 DOM 생성부터 제거했다. 추첨 중에는 중앙 코스튬만 빠르게 바뀌며 80~94% 범위로 살짝 축소·복귀하는 펄스를 반복한다.
- 로고·결과 스테이지·뽑기 버튼은 화면 중앙의 최대 500px 세로 묶음 안에 배치한다. 스테이지를 고정 좌표에서 상대 배치로 바꿔 당첨 reveal의 scale이 중앙 정렬 transform을 덮어쓰며 아이템이 대각선으로 이동하던 문제도 제거했다.
- 모서리에 흩어져 있던 티켓 수·GAMCHA/INVENTORY 탭·닫기 버튼은 중앙 결과 바로 위의 단일 툴바로 합쳤다. 결과 스테이지 상단은 등급을 왼쪽, `NEW/COLLECTION`을 오른쪽에 작은 글씨로 고정해 서로 겹치지 않는다.
- 코스튬별 X·Y·크기와 위치 초기화는 선택한 카드의 상세 패널 안에서만 표시되며 기존 영구 저장 명령을 그대로 사용한다.
- 오른쪽 상세 미리보기는 아이템 단독 이미지가 아니라 기존 `createPetSprite()`의 Idle 감자펫과 코스튬 오버레이를 그대로 합성한다. 슬라이더 입력 즉시 미리보기를 갱신하고 120ms debounce 뒤 기존 저장 명령으로 영구 반영한다.

## 최근 사진 배달 작업 요약

- 루트 `draw-picture/`의 `191227743` 계열 4장은 실제로 배달할 사진이며, `images/characters/gamjabot/extra/photo-delivery/photos/`에 용도별 이름으로 복사했다. `191554191` 계열 4장은 당기기 포즈 참고 원본으로만 남겼다.
- built-in imagegen으로 기존 감자봇 선화와 맞춘 가로 4프레임 당기기 스트립을 생성해 `images/characters/gamjabot/extra/photo-delivery/gamjabot-pull-strip.png`에 포함했다.
- 생성기가 투명 알파 대신 흰 배경을 출력했으므로 `src/pet/photo-delivery-view.ts`가 바깥 테두리에서 연결된 밝은 픽셀만 Canvas flood-fill로 투명화한다. 검은 외곽선 안쪽의 흰 얼굴·몸통은 보존한다.
- 배달 중 `photo-delivery`는 현재 펫 모니터의 작업 영역만 덮는 투명·비포커스·마우스 입력 통과 창이다. 목적지는 중앙을 제외하고 좌·우 화면 가장자리 중 하나를 고른 뒤 32~122px 안쪽과 세로 전체 범위에서 무작위로 뽑는다.
- 왼쪽 가장자리에 놓을 때는 왼쪽 화면 밖에서, 오른쪽 가장자리에 놓을 때는 오른쪽 화면 밖에서 등장한다. 왼쪽 진입은 사진·펫 표시 순서와 감자펫 방향을 반전해 사진을 화면 안쪽으로 끌고 들어온다.
- 사진·펫 순서는 flex-direction 반전에 의존하지 않는다. 왼쪽 출발은 `사진(order 0)–펫(order 1)`, 오른쪽 출발은 `펫(order 0)–사진(order 1)`으로 명시해 펫이 항상 이동 방향 앞쪽에서 끌도록 고정한다.
- 목적지의 세로 위치는 출발 전에 한 번만 정하며 시작과 도착에 같은 Y 좌표를 사용한다. 전진·밀림 구간은 X축에만 적용되어 사진과 펫이 이동 중 내려가거나 올라가지 않는다.
- 평상시 2~4분마다 사진 4장 중 하나를 무작위 배달한다. Focus뿐 아니라 짧은 휴식·긴 휴식·일시정지 중에도 시작하지 않으며 긴급 중지 시 즉시 숨긴다.
- 펫 우클릭 WinDbg 메뉴에 `사진 배달 테스트`가 있다. 타이머가 `READY`일 때 선택하면 즉시 확인할 수 있다.
- Desktop Goose처럼 힘들어 보이도록 18초 동안 전진·조금 밀림·버팀을 반복한다. 당기는 4자세를 900ms로 재생하고 몸 기울기와 사진 흔들림을 함께 사용한다.
- 사진은 원본 비율을 유지하며 약 300~520px 범위로 키운다. 외곽 제목 표시줄·테두리·여백과 보이는 `X`가 없으며, 사진 우측 상단 46×46px의 투명 영역을 누르면 닫힌다.
- 도착 후 사진은 무작위 목적지에 남고 감자펫만 3.5초 동안 왼쪽으로 퇴장한다. 감자펫 퇴장 뒤 기존 128×128 펫을 복원하고 배달 창은 사진의 실제 위치·크기로 축소한다.
- 사진은 자동으로 사라지지 않으며 사용자가 사진 위의 `X`를 눌러야 닫힌다.
- 자동 검사: 프런트 25개, Rust 38개, TypeScript, Vite production build, rustfmt, Clippy `-D warnings` 통과. 실제 WebView2 투명도·DPI·다중 모니터는 수동 확인이 필요하다.

## 최근 시스템 반응 작업 요약

- Windows 전체 CPU와 메모리 사용률을 1초 단위로 읽고 설정에서 `사용 안 함`, `CPU`, `메모리`, `CPU와 메모리 중 높은 값`을 선택한다.
- 알림 영역에는 CPU 파랑·MEM 빨강 감자봇 아이콘 두 개가 표시된다. 각 아이콘의 굵은 하단 막대가 사용률에 비례하고 툴팁에 정확한 퍼센트와 상태가 나온다.
- 선택된 사용률 0~19%는 기존 걷기, 20~39%는 `running/alert`, 40~59%는 `running/medium`, 60~79%는 `running/fast`, 80~100%는 `running/extreme`의 각 4프레임을 사용한다.
- 새 달리기 원본은 오른쪽 방향이며 왼쪽 이동 시 캐릭터와 코스튬을 함께 반전한다. 단계별 이동·프레임 속도는 1.0/1.15/1.35/1.65/2.1배다.
- 시스템 반응을 켜면 시작 대기와 목적지 사이 휴식 없이 계속 달린다. `사용 안 함`에서만 기존 Idle과 랜덤 휴식을 사용한다.
- 설정의 `시스템 반응 기준` select는 다른 입력과 동일한 각진 WinDbg 테두리, 높이, Consolas 글꼴과 키보드 포커스 표시를 사용한다.

## 최근 설정 조정

- 설정의 펫 영역에 `자동 사진 배달 사용`을 추가했다. 기본값은 ON이며 OFF일 때 2~4분 예약 배달만 막고 우클릭의 `사진 배달 테스트`는 계속 사용할 수 있다.
- 방해 규칙의 유예 시간 하한을 1초, 재감지 대기 하한을 5초로 낮췄고 프런트 입력 제한과 Rust 검증을 일치시켰다.
- 프런트 25개·Rust 43개 테스트, production build, rustfmt, Clippy가 통과했다. 설정 체크박스와 두 최솟값 저장은 실행 중인 Windows 앱에서 수동 확인이 남았다.

## v0.1.1 최종 릴리스 요약

- 원격 `main`의 저배터리 배터리 배달·YouTube Music 노래 무대·스프라이트 잘림 수정까지 포함해 앱 버전을 `0.1.1`로 통일했다.
- README의 직접 다운로드와 릴리스 링크를 `v0.1.1`로 갱신하고, 손상 파일 보관 설명을 일반 사용자 문장으로 바꿨다.
- 프런트 53개·Rust 48개 테스트, TypeScript, Vite production build, rustfmt, Clippy, Windows x64 NSIS 빌드와 main GitHub Actions가 통과했다.
- `v0.1.1` 정식 릴리스에 `migam.desktop_0.1.1_x64-setup.exe`를 게시했다. SHA-256은 `8EEF5636826CE4EC8A287190FA5498B1E0B86A0AC7AAB9A60BECABAF93AE6EA1`이다.
- 코드 서명은 아직 없어 Windows SmartScreen 경고가 나타날 수 있다.

## 현재 상태

- Tauri 2 + Rust + Vite + 순수 TypeScript 기반 구축이 완료되어 있다.
- `pet`, `card`, `timer`, `todo`, `settings`, `gamcha` 창과 트레이, 설정 저장·복구, 전역 긴급 중지가 구현되어 있다.
- 집중 시간이 자연스럽게 끝날 때만 GAMCHA 티켓 1장이 지급된다. Skip과 Stop은 보상하지 않는다.
- GAMCHA 티켓·누적 추첨·보유 코스튬은 앱 데이터 디렉터리의 `gamcha.json`에 저장되고 손상 파일은 별도로 보존한다.
- `pack/manifest.json`은 총 188종이며 `default` 3종을 제외한 185종이 실제 추첨 후보이다.
- 확률은 Common 60%, Rare 25%, Epic 10%, Legendary 4%, Special 1%이다.
- 선택된 등급 안에서는 그 등급의 모든 코스튬을 모을 때까지 중복이 나오지 않는다.
- 자연 집중 완료 시에는 작은 `gamcha-notice` 보상 말풍선만 펫 위에 나타난다.
- 보상 말풍선을 클릭하면 펫이 위치한 모니터 크기의 투명 `gamcha` 오버레이가 열리며, 기존 바탕 화면과 앱 창은 그대로 보인다.
- 추첨은 32개 실제 코스튬이 모니터의 위·오른쪽·아래·왼쪽 네 변을 따라 약 0.9초마다 양방향 회전하고, 결과 카드는 화면 정중앙에 표시된다. 56개 색종이, 중앙 24프레임 감속 셔플과 등급별 공개 효과도 유지한다.
- 중앙 결과는 사각 프레임 없이 경계가 사라지는 원형 등급 광원 위에 아이템·이름만 표시한다. 뽑기 버튼은 작은 반투명 단색 버튼과 상단 3px 무지개 선을 사용한다.
- 타이머 UI polling과 백그라운드 ticker 중 어느 쪽이 먼저 자연 완료를 처리해도 공통 Tick 경로에서 티켓을 지급한다.
- GAMCHA 왼쪽 아래 `OUTFIT` 옷장에서 보유 코스튬 또는 `기본 모습`을 선택해 착용·해제할 수 있다.
- 착용 ID는 `gamcha.json`에 저장되고 `gamcha://equipped` 이벤트로 펫에 즉시 반영되며 재시작 후 복원된다. 보유하지 않은 ID는 Rust에서 거부한다.
- 256×256 코스튬은 128×128로 표시하고 96×104 펫 셀에 `left -16px`, `top -12px`로 중심 정렬한다. 걷기 중 2px 바운스를 적용하고 Hard Impact에서는 숨긴다.
- 185개 모든 추첨 코스튬에 아이템별 `defaultAlignment` 메타데이터가 있으며, 사용자 저장 보정값이 있으면 그 값을 우선 적용한다.
- 보라색 placeholder 대신 `images/characters/gamjabot/final/spritesheet-extended.webp`의 실제 감자봇을 표시한다.
- 감자봇 atlas는 1536×2288, 192×208 셀, 8열×11행이며 deterministic validation과 chroma despill이 통과했다.
- 펫 창은 128×128이며, HTML/root/body/app/shell 배경을 모두 투명하게 두어 감자봇 외 픽셀을 그리지 않는다.
- 원본 192×208 셀을 96×104로 표시해 초기 구현보다 감자봇 크기를 정확히 절반으로 줄였다.
- Idle 6프레임, running-right 8프레임, running-left 8프레임을 실제 atlas에서 재생한다.
- 펫은 1.8~4.6초 Idle 후 현재 모니터 작업 영역의 바닥선을 따라 좌우 Walk한다.
- 현재 모니터의 physical pixel work area를 사용하며 작업표시줄을 제외하고, 일반 창은 완전히 안쪽에 유지한다.
- 창이 작업 영역보다 큰 예외 상황에는 최소 24px가 보이도록 경계를 계산한다.
- 창 이동 권한은 `pet` 창에만 별도 capability로 허용한다.
- 감자봇을 왼쪽 버튼으로 누르면 Dragged가 자동 Idle/Walk를 즉시 중단한다.
- 드래그는 Tauri physical cursor 좌표와 pointer capture를 사용하므로 DPI와 창 이동 중에도 같은 잡기 지점을 유지한다.
- 최근 110ms 포인터 표본이 700px/s 이상이면 Thrown으로 전환하고 최대 속력은 2,500px/s로 제한한다.
- Thrown은 중력 2,200px/s², 반동 계수 0.45, 바닥 마찰 0.80을 사용하고 최대 3초 안에 종료한다.
- 드래그와 던지기 중에도 현재 모니터 work area 기준 최소 24px가 화면에 남는다.
- 던지는 동안 atlas의 jumping 5프레임을 재생한다.
- `images/characters/gamjabot/extra/frames`에 Dragged 4장, Thrown 6장, Landing 4장의 전용 투명 PNG가 준비되어 있다.
- 추가 프레임은 모두 192×208 RGBA이며 `extra/manifest.json`에 재생 순서와 권장 프레임 시간이 기록되어 있다.
- `extra/qa/contact-sheet-normalized.png`와 상태별 GIF로 투명 배경, 캐릭터 단독 표시, chroma despill을 육안 검수했다.
- 사용자 제공 ‘땅에 박힌 감자봇’ 그림은 네모 캐릭터와 삽을 제거해 감자봇과 연결된 흙더미만 남겼으며, `extra/frames/hard-impact/00.png`의 192×208 투명 Hard Impact 프레임으로 정리했다.
- Hard Impact의 감자봇 머리 크기는 일반 착지 프레임과 비슷하게 맞추고 흙더미 바닥선을 셀 하단에 정렬했다.
- Hard Impact 프레임의 흙더미 불투명 픽셀은 208px 셀 최하단까지 닿아 작업표시줄과 투명 틈이 생기지 않는다.
- 드래그 중에는 Dragged 4프레임, 비행 중에는 Thrown 6프레임, 일반 종료에는 Landing 4프레임을 재생한다.
- 바닥 충돌 직전 하강 속도가 1,400px/s 이상이면 반동을 멈추고 Hard Impact를 1초 표시한 뒤 Idle로 돌아간다.
- 걷기·던지기 바닥 반동·Hard Impact는 모두 창 전체가 보이는 동일한 작업 영역 최하단을 사용한다. 드래그 중에만 복구를 위해 최소 24px 표시 경계를 허용한다.
- Rust `PomodoroMachine`은 `PomodoroService`를 통해 앱 전역 상태로 연결되어 있다.
- 타이머는 Stopped, Focus, ShortBreak, LongBreak, Paused 상태와 절대 종료 시각 기반 남은 시간을 사용한다.
- 앱 내부 1초 ticker가 타이머 창 표시 여부와 무관하게 단계 완료를 처리한다.
- `get_timer_state`, `start_focus`, `pause_timer`, `resume_timer`, `skip_phase`, `stop_timer` Tauri 명령이 연결되어 있다.
- 타이머 창은 상태 문구, MM:SS 남은 시간, 완료한 집중 횟수와 모든 제어 버튼을 표시한다.
- 타이머 창은 360×280 안에 맞고 문서 스크롤이 없다. 대기에는 시작만, 실행 중에는 일시정지·건너뛰기·중지, Paused에는 재개·중지만 균등 표시한다.
- 설정 변경은 Stopped 타이머에 즉시 적용되며 실행 중 변경은 다음 Stop 이후부터 적용된다.
- 전역 긴급 중지는 실행 중인 타이머를 Paused로 전환한다.
- 설정 창에서 방해 규칙 이름, 사용 여부, 프로세스 파일명, 창 제목 포함 문자열, 유예 시간과 재감지 대기를 추가·삭제·편집할 수 있다.
- 프로세스명/창 제목 중 하나 이상이 필요하고 프로세스 경로 입력은 거부한다. 유예는 5~600초, 재감지 대기는 30~3,600초다.
- 방해 감지는 기본 off이며 활성 규칙이 있어야 사용자가 명시적으로 켤 수 있다.
- `ForegroundWindowSource` trait과 fake, Win32 `GetForegroundWindow`/PID/프로세스 파일명/제목 snapshot 구현이 있다.
- 전경 창 source는 Focus 실행 중이면서 감지가 켜진 경우에만 1초마다 호출된다.
- 감지 결과 이벤트에는 실제 창 제목·프로세스 경로를 넣지 않고 일치 여부와 사용자가 만든 규칙 ID만 넣는다.
- 설정 창은 감지 결과를 `일치 감지됨 · 규칙 이름` 또는 `일치하는 전경 창 없음`으로 표시한다.
- 사용자가 실제 Chrome/YouTube에서 규칙 일치 표시를 확인해 작업 6 감지 게이트를 통과했다.
- 사용자 제공 그림에서 네모 캐릭터만 분리·복원한 투명 Kick 자산을 `extra/frames/kick/00.png`에 추가했다.
- Kick 전용 투명 `card` 창은 220×180이며 대상 모니터의 왼쪽 화면 밖에서 대상 창 중앙까지 760ms 동안 날아온다.
- 동일 hwnd와 rule이 설정된 grace 동안 유지되어야 Kick이 시작된다.
- 충돌 순간 Focus, 긴급 중지, 개입 설정, fresh foreground hwnd와 규칙 일치를 다시 확인하고 `ShowWindow(SW_MINIMIZE)`를 한 번만 호출한다.
- 대상 변경, Focus 종료와 긴급 중지는 pending Kick을 취소한다.
- 앱 자체 PID, 읽을 수 없는 창, 작업 관리자·Explorer 등 핵심 프로세스와 전체 화면 창은 보호한다.
- 개입 성공/실패 뒤 동일 hwnd·rule에 설정된 cooldown을 적용한다.
- 타이머와 설정 창은 WinDbg를 참고한 밝은 회색 도구 UI다. 파란 활성 탭·상태바, 리본형 상단 영역, 얇은 도킹 패널 경계와 Consolas 상태 표시를 사용한다.
- 타이머의 360×280 무스크롤 조건과 상태별 실제 제어 버튼 수는 WinDbg 스타일 변경 뒤에도 유지된다.

## 이번 세션 변경 파일

- `src/gamcha/gamcha-model.ts`
- `src/gamcha/gamcha-model.test.ts`
- `src/gamcha/gamcha-view.ts`
- `src-tauri/src/domain/gamcha.rs`
- `src-tauri/src/application/gamcha_service.rs`
- `src-tauri/src/presentation/tray.rs`
- `src-tauri/capabilities/default.json`

- `src/contracts.ts`
- `src/main.ts`
- `src/intervention/kick-view.ts`
- `src/styles.css`
- `src/pet/motion.ts`
- `src/pet/motion.test.ts`
- `src/pet/physics.ts`
- `src/pet/physics.test.ts`
- `src/pet/sprite.ts`
- `src/pet/tauri-motion-runtime.ts`
- `src/timer/timer-view.ts`
- `src/timer/timer-view.test.ts`
- `src-tauri/src/application/pomodoro_service.rs`
- `src-tauri/src/application/foreground_monitor.rs`
- `src-tauri/src/domain/pomodoro.rs`
- `src-tauri/src/domain/distraction.rs`
- `src-tauri/src/domain/foreground.rs`
- `src-tauri/src/domain/settings.rs`
- `src-tauri/src/infrastructure/mod.rs`
- `src-tauri/src/infrastructure/windows/mod.rs`
- `src-tauri/src/infrastructure/windows/foreground_window.rs`
- `src-tauri/src/app_state.rs`
- `src-tauri/src/presentation/commands.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/capabilities/pet-motion.json`
- `src-tauri/tauri.conf.json`
- `docs/13-progress-board.md`
- `docs/17-session-handoff.md`
- `docs/18-todo-pomodoro-spec.md`
- `images/characters/gamjabot/extra/manifest.json`
- `images/characters/gamjabot/extra/frames/dragged/*.png`
- `images/characters/gamjabot/extra/frames/thrown/*.png`
- `images/characters/gamjabot/extra/frames/landing/*.png`
- `images/characters/gamjabot/extra/frames/hard-impact/00.png`
- `images/characters/gamjabot/extra/frames/kick/00.png`
- `images/characters/gamjabot/extra/qa/contact-sheet-normalized.png`
- `images/characters/gamjabot/extra/qa/previews/*.gif`

## 검증 상태

- Chrome `YouTube Music` 창 감지와 무대·춤 반응을 추가했다. 기존 `images/characters/gamjabot/pack/dance/`의 6프레임을 사용하며 집중 타이머와 드래그가 우선한다.
- 구현 후 프런트 50개·Rust 46개 테스트, TypeScript, production build, rustfmt와 Clippy를 통과했다. 실제 Chrome 창 제목 인식과 128×128 무대 가독성은 Windows 사용자 화면에서 수동 확인이 필요하다.
- 사용자 확인 후 무대는 280×220으로 확대하고, 신규 `singing-dance-sheet-v1.png`의 마이크 노래·춤 6포즈로 교체했다. 창 크기 전환은 하단 중앙 접점을 보존하며 종료 시 128×128로 복구한다.
- 확장 무대 변경 후 프런트 50개·Rust 47개 테스트, TypeScript, production/release build, rustfmt와 Clippy를 통과했다. Windows 화면에서 무대 크기와 복원 위치를 수동 확인해야 한다.

- GAMCHA 구현 후 `npm test`: 프런트 18개 테스트 통과.
- GAMCHA 구현 후 `cargo test`: Rust 32개 테스트 통과.
- `cargo fmt`, `cargo clippy --all-targets -- -D warnings`: 통과.
- `npm run tauri -- build --no-bundle`: 통과, release 실행 파일 생성.
- 일반 사용자 Windows에서 자연 완료 보상, 말풍선 위치, 등급별 연출과 재시작 복원은 수동 확인이 필요하다.
- 사용자 확인에서 발견된 `휴식 전환 후 TICKET 0` 경쟁 조건과 추첨 전 깨진 빈 이미지는 수정했고 전체 검사를 재통과했다.
- 타이머 초기 연결 실패 시 `타이머를 불러오지 못했습니다`가 작은 말풍선에서 크게 잘리던 UI를 제거했다. 이제 `재연결 --:--` 상태에서 500ms polling으로 자동 복구한다.
- GAMCHA 2단계 전체화면 변경 후 프런트 18개·Rust 32개·Clippy와 release build를 재통과했다.
- 코스튬 착용 구현 후 프런트 18개·Rust 33개, Clippy와 release build를 통과했다.
- 코스튬을 이름 기준 `head`·`face`·`neck`·`body`·`full` 슬롯으로 분류하고 슬롯별 크기와 기준점을 적용했다. 사용자에게 보인 `rare_025` 연금술사 보석모는 머리 위에 작게 정렬된다.
- 백그라운드 Tick이 일시적으로 실패해도 스레드를 종료하지 않고 다음 주기에 복구한다. Tick 상태 이벤트 전달도 best-effort로 바꿔 집중 중 전경 감시와 Kick이 함께 영구 중단되는 경로를 제거했다.
- 위 수정 후 `npm test` 프런트 18개, TypeScript 검사, 별도 임시 경로 Vite production build, `cargo fmt --check`, Rust 33개 테스트를 통과했다. 실행 중 앱이 기본 `dist`와 `target`을 잠근 상태라 검증 출력만 임시 경로를 사용했다.
- GAMCHA 옷장에 코스튬별 X(-80~80), Y(-80~80), 크기(48~180) 슬라이더와 `위치 초기화`를 추가했다. 선택한 코스튬을 먼저 적용한 뒤 조절하면 펫에 약 120ms 단위로 반영되고 `gamcha.json`에 코스튬 ID별로 저장된다.
- 저장되지 않은 코스튬은 기존 슬롯 기본값을 사용하며, 과거 `gamcha.json`은 새 `costumeAlignments` 필드가 없어도 자동으로 빈 값으로 읽는다.
- 개별 보정 기반 구현 후 프런트 20개, Rust 34개 테스트, TypeScript, Vite production build와 Clippy `-D warnings`를 통과했다.
- Windows `GetSystemTimes`와 `GlobalMemoryStatusEx`로 시스템 전체 CPU·메모리 사용률을 읽는다. CPU는 지수 이동 평균을 적용하고 750ms 이내 중복 요청은 캐시해 설정 창과 펫 창의 동시 조회로 값이 흔들리지 않게 했다.
- 설정의 펫 섹션에서 시스템 반응 기준을 `사용 안 함`, `CPU`, `메모리`, `CPU와 메모리 중 높은 값` 중 고를 수 있고 현재 두 수치를 1초마다 함께 표시한다. 기존 schema 2 설정은 새 필드가 없으면 안전하게 `사용 안 함`으로 읽는다.
- 선택 부하 30% 미만은 이동·프레임 0.7배와 waiting, 60~79%는 1.45배, 80% 이상은 2배, 70% 이상 제자리에서는 busy를 사용한다. 메모리를 감시하는 모드에서 메모리 90% 이상이면 failed 동작을 사용한다. 집중 타이머 동작이 항상 우선한다.
- 시스템 반응 구현 후 프런트 23개, Rust 36개 테스트, TypeScript, Vite production build와 Clippy `-D warnings`를 통과했다.
- 펫 우클릭의 Windows 네이티브 메뉴를 292×430 무장식 `pet-menu` 웹뷰로 교체했다. WinDbg식 제목·탭·명령줄·파란 상태바와 각진 명령 행을 사용하며 타이머 상태/남은 시간, CPU·메모리, GAMCHA 티켓을 표시한다.
- 집중 시작/일시정지/재개/중지 버튼은 현재 타이머 단계에 맞춰 활성화된다. GAMCHA·타이머·설정·긴급 중지·펫 재개·종료도 기존 명령을 그대로 사용한다. Escape, 닫기, 포커스 이탈 시 메뉴가 숨겨진다.
- 우클릭 좌표를 기준으로 팝업을 열되 현재 모니터 작업 영역을 벗어날 경우 좌·상 방향으로 뒤집고 마지막으로 작업 영역에 clamp한다.
- WinDbg 우클릭 메뉴 구현 후 프런트 23개·Rust 36개 테스트, TypeScript와 별도 임시 경로 Vite production build를 통과했다.
- 기존 앱 트레이를 파란 CPU 감자봇 아이콘으로 바꾸고 빨간 MEM 감자봇 아이콘을 추가했다. 두 아이콘 모두 1초마다 갱신되며 10개의 방사형 칸으로 사용률을, 얼굴로 `0~29 여유`, `30~59 보통`, `60~79 바쁨`, `80~100 과부하`를 표현한다.
- 두 아이콘에 마우스를 올리면 `CPU 37% · 보통`, `MEM 82% · 과부하` 형식으로 정확한 수치가 표시된다. 어느 아이콘을 눌러도 기존 펫·타이머·GAMCHA·설정·긴급 중지 메뉴를 사용할 수 있다.
- CPU·MEM 트레이 구현 후 프런트 테스트 23개, Rust 테스트 38개, TypeScript, Vite production build, `cargo fmt`, `cargo clippy --all-targets -- -D warnings`를 통과했다. 실제 Windows 알림 영역 표시와 DPI 축소 결과는 재시작 후 수동 확인이 필요하다.
- Windows 알림 영역에서 방사형 선이 너무 작게 보인다는 사용자 확인에 따라 얼굴 폭을 약 40% 키워 64px 캔버스를 거의 채우고, 게이지를 아이콘 전폭의 굵은 하단 막대로 교체했다. CPU는 파랑, MEM은 빨강이며 막대 길이가 실제 사용률에 비례한다. 변경 후 Rust 38개 테스트와 Clippy를 통과했다.
- 루트 `running/`의 alert·medium·fast·extreme 각 4장, 총 16장(256×256 RGBA, validation `ok: true`)을 실제 이동 애니메이션에 연결했다. 선택된 CPU/MEM/통합 부하가 0~19이면 기존 걷기, 20~39 alert, 40~59 medium, 60~79 fast, 80~100 extreme을 사용한다.
- 새 자산은 오른쪽 방향 원본을 쓰고 왼쪽 이동 시 감자봇과 코스튬을 함께 좌우 반전한다. 이동 중 부하 구간이 바뀌어도 1초 metrics polling에서 즉시 애니메이션을 교체한다. 이동 속도와 프레임 속도도 단계별 1.0/1.15/1.35/1.65/2.1배로 맞췄다.
- 구간별 달리기 연결 후 프런트 테스트 24개, TypeScript 검사와 별도 임시 경로 Vite production build를 통과했으며 16개 PNG가 production asset에 포함됨을 확인했다.
- 사용자 확인에서 목적지 사이마다 기존 Idle 자세로 멈추는 장면이 보였으므로 CPU/MEM/통합 모드에서는 도착 즉시 새 목적지를 뽑아 연속 달리도록 변경했다. 시스템 반응 `사용 안 함`에서만 기존 랜덤 휴식을 유지하며, 설정을 켠 순간 Idle 중이면 바로 이동을 시작한다. 변경 후 프런트 테스트 25개, TypeScript와 production build를 통과했다.
- 창 측면 충돌 직후 바로 미끄러져 올라가던 흐름을 `로프 던지기(680ms) → 로프 타기 → 창 위로 올라서기`로 교체했다. built-in imagegen으로 생성하고 배경 추출한 `rope-throw-strip-v1.png`, `rope-climb-strip-v1.png`는 각 4프레임 RGBA이며 실제 투명 알파를 확인했다.
- 긴 로프는 176px 폭의 별도 `climb-rope` 투명 웹뷰와 SVG 곡선으로 표시한다. 투척 중에는 갈고리가 회전하며 포물선으로 날아가고, 걸리는 순간 곡선이 수직 로프로 팽팽해진다. 클릭을 통과시키며 등반 종료·낙하·집중 시작·드래그·앱 종료에서 즉시 숨긴다.
- 감자봇의 측면 겹침을 8px에서 26px로 늘려 몸이 창에 더 붙도록 했다. 대상 창이 이동하면 감자봇과 로프가 함께 재정렬되고, 최소화·종료 시 기존 낙하 흐름으로 복귀한다.
- 사용자 화면에서 펫 창 너비의 49% 겹침은 몸과 얼굴까지 창에 달라붙는 문제가 있었다. 최종 겹침을 32%로 줄여 손과 발만 로프에 닿게 하고, Win32 프레임의 투명 여백은 펫 창 너비의 11%만큼 안쪽으로 보정했다.
- `rope-throw-strip-v2.png`는 몸을 비틀어 갈고리를 힘껏 던지는 4프레임, `rope-climb-strip-v2.png`는 좌우 손과 다리를 번갈아 쓰며 상하로 들썩이는 4프레임이다. 투척은 600ms, 투척 프레임은 150ms, 등반 프레임은 135ms로 조정했다.
- 실제 화면에서 긴 SVG 로프가 스프라이트 안의 짧은 로프와 겹쳐 발 아래까지 내려오던 문제를 수정했다. 긴 로프는 윗손에서 끝나고 스프라이트의 손 사이 로프가 이어받으며, 윗손이 창 모서리에 도착하면 등반을 끝내고 `pull-up`이 남은 수직·수평 이동을 담당한다. 닻처럼 보이던 갈고리는 작은 단일 J형 갈고리로 교체했다.
- 재시작 화면에서 SVG 로프는 창 밖에 있지만 손은 창 테두리를 잡던 11% 좌표 차이를 확인했다. 감자봇을 로프 쪽으로 동일한 11%만큼 이동하고, 로프 상단만 창 모서리까지 짧게 휘어 J형 갈고리에 연결되도록 분리했다.
- 같은 가로 벽에 여러 Win32 표면이 겹치면 아래쪽 표면을 골라 갈고리가 창 중간에 걸리던 문제를 수정했다. 동일 벽에서는 가장 높은 실제 창을 우선하고, 화면 위 공간이 부족한 창은 보행 위치만 작업 영역 안으로 제한한다. 로프 웹뷰의 리사이즈 직후 SVG를 다시 그려 갈고리부터 손까지 줄이 끊기지 않게 했다.
- 최종 실화면 기준으로 긴 줄 끝을 손 쪽으로 16px 이동하고 6px 연장해, 스프라이트 내부의 짧은 줄과 한 선처럼 연결되도록 미세 조정했다.
- 등반 프레임마다 내부 줄 시작점이 달라 다시 작은 틈이 드러나는 문제를 막기 위해 SVG 줄을 펫 높이의 60%까지 연장했다. 외부 줄과 내부 줄이 아래 손까지 겹치므로 프레임 전환 중에도 끊김이 보이지 않는다.
- 최종 사용자 결정으로 자동 창 이동에서는 로프 투척·등반을 사용하지 않는다. 창 벽 충돌 시 로프 창을 숨기고 기존 `jumping` 5프레임으로 전환해 창 가장자리 안쪽까지 포물선 점프한다. 높이 차이에 따라 1.1~2.2초 동안 천천히 이동하며 착지 후 기존 창 위 보행·창 소멸 낙하 흐름을 이어간다. 로프 자산과 코드는 향후 선택 동작용으로 보존한다.
- 창 위 점프 착지 직후 `window-tumble`을 약 980ms 실행한다. 착지 프레임과 CSS 회전을 함께 사용해 옆으로 철퍼덕 넘어져 잠깐 누웠다가 일어나며, 이후 같은 창을 지지 표면으로 유지한 채 보행을 재개한다.
- 사진 배달 후보에 제공받은 `real-heogeodeongseu.png`를 일반 사진과 분리해 정확히 1% 확률로 추가했다. 이 희귀 사진에는 X가 없고 사진 자체를 다섯 번 눌러야 사라진다.
- 희귀 사진의 다섯 번째 클릭에서는 사진 창을 현재 모니터 작업 영역 전체로 다시 넓힌 뒤 Idle 감자봇 34개가 서로 다른 속도·크기·회전으로 하늘에서 떨어지는 약 4.2초 연출을 실행하고 자동 종료한다. 일반 사진의 기존 투명 X 닫기는 유지한다.
- 사진과 당기는 스프라이트가 준비되기 전에 원래 펫을 숨기던 순서를 바꿨다. 배달 웹뷰가 자산을 디코딩하고 당기는 감자봇을 그릴 준비가 끝난 시점에만 원래 펫을 숨기며, 배경 제거 실패 시에도 원본 당기기 스프라이트를 fallback으로 사용해 감자가 통째로 사라지지 않는다.
- 희귀 사진 확률 경계 테스트를 추가했고 프런트 47개·Rust 45개 테스트, TypeScript 검사, production/release build, rustfmt와 Clippy를 통과했다. 최신 실행 파일은 `src-tauri/target/release/migam-desktop.exe`다.
- 서로 겹친 창에서 펫이 잘린 화면은 128px 투명 창의 clipping이 아니라 앞쪽 앱 뒤로 펫 WebView가 내려간 Z-order 문제였다. 펫 런타임이 400ms마다 `alwaysOnTop`을 비활성 방식으로 재확인하며, 긴급 중지 해제와 사진 배달 종료·정착 복원에서도 펫을 보여주기 전에 Rust가 최상단 속성을 다시 적용한다. 프런트 47개·Rust 45개 테스트, TypeScript, production/release build, rustfmt와 Clippy를 통과했다.
- 추가 사용자 확인에서 넘어지는 순간에는 Z-order와 별개로 자체 clipping도 남아 있었다. `window-tumble`이 발 근처 `58% 92%`를 축으로 82도 회전하면서 96×104 몸이 128×128 WebView 밖으로 튀어나간 것이 원인이었다. 회전축을 몸 중앙 `50% 52%`로 옮기고 누운 구간을 76%로 축소해 최외곽이 WebView 안에 남도록 했다. 프런트 47개 테스트, TypeScript와 production build를 통과했다.
- 실행 중 앱이 기본 `dist/assets`와 `target/release/.cargo-build-lock`을 보유해 이 마지막 CSS 수정의 release 실행 파일 교체만 완료하지 못했다. 앱과 개발 터미널을 완전히 종료한 뒤 `npm run tauri -- build --no-bundle`을 다시 실행해야 최신 release EXE에 포함된다.
- 최종 로프 개선 후 프런트 43개, Rust 45개 테스트, TypeScript, production/release build, rustfmt와 Clippy를 통과했다. 실행 파일은 `src-tauri/target/release/migam-desktop.exe`다.
- Windows `GetSystemPowerStatus`로 배터리를 5초마다 확인한다. 배터리가 존재하고 충전 중이 아니며 20% 이하가 되면 감자봇이 놀란 뒤 가까운 화면 가장자리로 달려 나가고, 큰 빨간 배터리를 힘겹게 들고 천천히 돌아와 약 2.4초 동안 보여준다.
- 동일한 저전력 상태에서는 한 번만 실행하며 충전 시작·25% 이상 회복 시 다음 이벤트를 재무장한다. 집중 타이머가 최우선이고, 타이머 중 감지된 이벤트는 종료 뒤 실행한다. 음악 무대 중에는 무대를 접은 후 연출하고 종료 뒤 음악 상태로 복귀한다.
- 배터리가 없는 데스크톱에서도 `펫 우클릭 → 저전력 이벤트 테스트`로 전체 연출을 강제 실행할 수 있다. 전용 자산은 `images/characters/gamjabot/extra/frames/low-battery-carry-sheet-v1.png`이며 3×2 투명 시트다.
- 저전력 이벤트 적용 후 프런트 53개·Rust 48개 테스트, TypeScript production build와 Clippy를 통과했다.
- 배터리 시트 자체에는 안전 여백이 있었지만 기본 `.pet-sprite`가 96×104여서 128×128 셀의 오른쪽 32px가 잘렸다. `battery-*` 애니메이션 동안만 표시 영역을 128×128로 확장하고 코스튬을 숨기도록 수정했다. 프런트 53개 테스트와 TypeScript 검사는 통과했으며, 실행 중 앱이 `dist/assets`를 잠가 최신 release 빌드만 앱 종료 후 재실행해야 한다.

- 감자봇 `final/validation-extended.json`: `ok: true`, 1536×2288, 8×11, 오류·경고 없음.
- 감자봇 `qa/chroma-despill-extended.json`: `ok: true`.
- `npm test`: 펫 경계·음수 모니터 좌표·최소 24px·목적지·이동 테스트 4개 통과.
- `npm run typecheck`: 통과.
- `npm run build`: 통과. 감자봇 WebP가 production asset에 포함됨.
- 50% 크기 변경 후 `npm test`와 `npm run build` 재통과.
- Drag/Throw 구현 후 `npm test`: 이동 5개와 던지기 물리 5개, 총 10개 통과.
- Drag/Throw 구현 후 `npm run typecheck`, `npm run build`: 통과.
- Drag/Throw 구현 후 `npm run tauri -- build --no-bundle`: 통과, release exe 생성.
- `cargo test`: 기존 Rust 테스트 16개 통과.
- `cargo clippy --all-targets -- -D warnings`: 통과.
- `npm run tauri -- build --no-bundle`: 통과, release exe 생성.
- 전체 `tauri build`는 release exe 생성 후 WiX 다운로드가 샌드박스 네트워크 정책으로 차단되어 MSI만 만들지 못했다.
- Codex 샌드박스에서는 Windows GUI 동작을 직접 볼 수 없어 투명 창과 실제 이동은 일반 사용자 세션 확인이 필요하다.
- 크기 변경 뒤 debug Tauri build는 실행 중인 기존 dev 앱이 `target/debug/desktop-pet-mvp.exe`를 잠가 교체하지 못했다. 앱 종료 후 다시 실행하면 된다.
- 추가 동작 이미지 14장은 192×208 RGBA로 정규화되었고, 프레임 검사에서 오류·경고가 없으며 최종 chroma despill을 통과했다.
- Hard Impact 연결 후 `npm test` 11개, `npm run typecheck`, `npm run build`가 모두 통과했다.
- 바닥 경계 정렬 수정 후 자동 테스트는 12개이며 Hard Impact가 화면 아래로 잘리던 원인을 제거했다.
- Pomodoro 구현 후 `cargo test`: Rust 20개 테스트 통과.
- Pomodoro 구현 후 `npm test`: 프런트 16개 테스트 통과.
- Pomodoro 구현 후 `npm run build`, `cargo fmt`, `cargo clippy --all-targets -- -D warnings`: 통과.
- Pomodoro 구현 후 `npm run tauri -- build --no-bundle`: 통과, release 실행 파일 생성.
- 전경 창·규칙 구현 후 `cargo test`: Rust 24개 테스트 통과.
- 전경 창·규칙 구현 후 `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`: 통과.
- 전경 창·규칙 구현 후 `npm test`: 프런트 16개 테스트 통과, `npm run build`: 통과.
- 안전 개입 구현 후 `cargo test`: Rust 24개 테스트 통과, grace 후 시작·fresh 재검증·긴급 중지 취소 포함.
- 안전 개입 구현 후 `cargo clippy --all-targets -- -D warnings`: 통과.
- 안전 개입 구현 후 `npm test`: 프런트 16개 테스트 통과, `npm run build`: Kick PNG 포함 production build 통과.
- WinDbg UI 적용 후 `npm test`: 프런트 16개 테스트 통과, `npm run build`: 통과.
- WinDbg raw UI 조정 후 `npm test`: 프런트 16개 테스트 통과, `npm run build`: 통과. 타이머와 설정창을 고전 Win32 디버거의 조밀하고 거친 형태로 조정했다.
- 펫 우클릭에 Windows 네이티브 메뉴를 연결해 타이머·설정·긴급 중지·재시작·종료를 실행할 수 있다.
- 타이머 창은 156×76 투명 무장식 말풍선이며 `상태 · 남은 시간`만 표시하고, 열린 동안 250ms 간격으로 펫 위치를 따라간다. 제어는 펫 우클릭·트레이 메뉴로 이동했다.
- 우클릭 메뉴·말풍선 연결 후 `npm test` 16개, `cargo test` 24개, `cargo clippy --all-targets -- -D warnings`, `npm run build`가 통과했다.
- 집중 타이머가 활성화되면 펫의 자동 이동과 드래그가 중단된다. Focus에서는 컴퓨터 작업 전용 이미지 `images/characters/gamjabot/extra/frames/focused/00.png`를 표시하고, 휴식·일시정지에도 제자리에서 대기한다.
- 집중 전용 이미지는 built-in imagegen으로 생성·배경 추출했으며 1186×1327 RGBA, corner alpha 0을 확인했다.
- Chrome 프로세스 경로 조회가 실패하면 ToolHelp 프로세스 목록에서 파일명을 재확인한다. Kick 창은 `focusable: false`로 대상 창의 전경 상태를 빼앗지 않으며 감지 주기는 250ms다.

## 차단 요소와 위험

- 일반 사용자 데스크톱에서 감자봇 외 배경이 완전히 투명한지 확인해야 한다.
- 단일 모니터에서 작업표시줄을 침범하지 않는지, 가능한 경우 보조 모니터/다른 DPI에서도 확인해야 한다.
- 설정의 `visualScalePercent`는 아직 실제 펫 창/스프라이트 크기에 적용되지 않는다.
- v2 자산의 16방향 blind visual QA는 원래 생성 환경의 ACL 문제로 완료되지 않았지만, 이번 단계에서 사용하는 행 0~2는 deterministic validation과 접촉 시트 육안 확인을 마쳤다.
- pointer capture가 움직이는 투명 Tauri 창에서도 release까지 유지되는지 Windows 실제 입력으로 확인해야 한다.
- Windows 실제 타이머 창에서 키보드 포커스, 버튼 활성 상태, 창 숨김 중 시간 진행과 긴급 중지 일시정지를 확인해야 한다.
- 단계 전환 Windows 알림과 트레이의 현재 상태·제어 메뉴는 아직 연결하지 않았다.
- Win32 전경 창 판독과 설정 창의 감지 상태는 일반 사용자 데스크톱에서 실제 메모장/브라우저로 확인해야 한다.
- 투명 Kick 창의 실제 비행 위치, 포커스를 빼앗지 않는지와 최소화 충돌 타이밍은 Windows 사용자 세션에서 확인해야 한다.
- 펫 Dragged/Thrown 상태를 Rust 개입 서비스에 알리는 연결은 아직 없어 해당 두 상태의 즉시 취소를 보강해야 한다.
- 사진 배달 스프라이트는 런타임 외곽 배경 제거 결과를 일반 사용자 WebView2에서 확인해야 한다. 잔상이 있으면 `isLightBackground` 임계값만 조정한다.
- 사진 배달 중 원래 펫의 이동 루프는 숨은 상태에서도 진행된다. 복원 위치가 어색하면 연출 시작·종료 이벤트로 모션 일시정지를 추가한다.

## 다음 작업

1. 앱을 완전히 재시작하고 작업표시줄까지 내려온 일반 창 하나를 펫 진행 경로 앞에 둔다.
2. 좌우 양쪽에서 로프 투척 → 로프 등반 → 올라서기 → 창 위 걷기가 자연스럽게 이어지고 손·몸·로프가 창 가장자리에 붙는지 확인한다.
3. 펫이 창 위에 있을 때 창을 이동·크기 변경하고, 최소화·종료했을 때 낙하와 착지가 이어지는지 확인한다.
4. 125% 이상 DPI, 다중 모니터와 일부 겹친 창에서 발 위치·경계 선택을 확인하고 필요하면 오프셋을 조정한다.
5. 이후 투두 CRUD·집중 정상 종료·전체 완료 축하를 Windows에서 검증하고 고급 축하 설정을 연결한다.

## 작업 10 완료 게이트

- 투두 CRUD·선택·완료 상태가 재시작 후 복원된다.
- 미완료 우선 정렬과 완료 직후 500ms 지연 이동이 동작한다.
- Focus 시작 시 선택 ID가 고정되고 정상 완료에서만 사용자에게 완료 여부를 묻는다.
- Skip·Stop·삭제로는 항목을 자동 완료하거나 전체 완료 축하를 발생시키지 않는다.
- 마지막 미완료 항목을 사용자가 완료할 때만 축하가 한 번 발생하고 재발동·재시작 규칙이 지켜진다.
- 긴급 중지가 축하를 즉시 취소하고 움직임 줄이기와 효과음 설정이 적용된다.
- 키보드 조작, Rust·TypeScript 테스트, rustfmt, Clippy와 production build가 통과한다.

## 작업 5 완료 게이트

- Stopped→Focus→ShortBreak/LongBreak→Focus 전환이 동작한다.
- Pause/Resume가 남은 시간을 보존하고 Skip/Stop이 올바르게 동작한다.
- 타이머 창을 숨겨도 종료 시각 기준으로 시간이 진행된다.
- 긴급 중지가 실행 중 타이머를 일시정지한다.
- 상태를 색상뿐 아니라 텍스트로도 표시하고 모든 제어를 키보드로 사용할 수 있다.
- Rust·TypeScript 테스트, Clippy와 production build가 통과한다.

## 작업 3 완료 게이트

- 실제 감자봇만 보이고 창 배경이 완전히 투명하다.
- Idle과 좌·우 Walk가 실제 감자봇 프레임으로 재생된다.
- 단일/다중 모니터 작업 영역을 벗어나 영구 유실되지 않는다.
- 작업표시줄 영역을 침범하지 않는다.
- 자동 테스트, TypeScript 검사와 release exe 빌드가 통과한다.

## 작업 4 완료 게이트

- Dragged가 Idle/Walk를 즉시 중단한다.
- 천천히 놓기와 빠르게 던지기가 구분된다.
- 던진 감자봇이 중력과 화면 경계 반동을 적용받는다.
- 어떤 던지기도 3초 이내 종료되고 화면 밖으로 영구 유실되지 않는다.
- 포인터 속도와 물리 자동 테스트가 통과한다.

## 마지막 인수인계

```text
현재 상태: 사진 배달 캐릭터 CSP 수정과 v0.1.2 버전·README·Windows 설치 산출물 준비 완료, PR·main CI·정식 게시 대기
마지막 성공 검사: 2026-08-24 프런트 53개·Rust 49개·typecheck·production build·fmt·Clippy·Windows x64 MSI/NSIS build 통과
완료한 기능: `img-src blob:` 허용과 설정 회귀 테스트, v0.1.2 패키지 버전·README 직접 설치 링크, NSIS 설치 파일 생성
다음으로 할 일: PR과 main CI 통과 후 v0.1.2 태그에 NSIS를 게시하고 실제 Windows에서 사진 배달 캐릭터를 수동 확인
알려진 위험: 설치 파일은 코드 서명이 없어 SmartScreen 경고가 나타날 수 있고, WebView 실제 표시 확인은 새 설치판 게시 후 필요
실행/테스트 방법: 로컬 NSIS 산출물 또는 `. .\scripts\use-project-rust.ps1` 후 README 개발 명령 사용
```

## 2026-08-30 작업 인수인계

- 최종 작업 브랜치: `feat/costume-catalog-overhaul`
- 보존 작업 폴더: `C:\Users\hglee\Documents\ChatGPT\개발톤\Desktop-Migam-Window-costume-catalog-overhaul`
- 사진 배달은 최대 480×390·최소 280×224, 17.5초로 조정했다. 1% 희귀 사진의 자연 발생 확률과 5회 클릭 이스터에그는 그대로다.
- 개발 모드에서는 기존 사진 배달·저전력 우클릭 테스트와 설정의 희귀 사진 강제 테스트를 사용할 수 있다. 프로덕션 번들에는 이 세 테스트 UI를 넣지 않는다.
- `창 오르기 사용`은 기본 ON이며 설정에 영구 저장된다. OFF 전환은 진행 중인 등반을 강제 중단하지 않고 다음 등반부터 막는다.
- `pack/manifest.json`의 코스튬 156종에 명시적 슬롯과 기본 정렬값을 기록했다. 사용자 저장 보정값을 가장 먼저 사용하므로 기존 사용자의 커스텀 배치는 보존된다.
- 도감 전수 판정은 유지 109종·배치 보정 30종·원본 재제작 17종이다. 재제작 PNG는 기존 ID·이름·등급·파일 경로를 그대로 유지하고 256×256 RGBA 투명 자산으로 교체했다.
- 재제작 대상: common 017·061·064·065, rare 015·018·019·035·040·046, epic 007·023, legendary 001·002·004·006, special 001.
- 빠르게 다른 카드를 누를 때 이전 이미지 로드 완료가 현재 상세 미리보기를 덮어쓰지 않도록 최신 요청만 반영한다.
- 자동 QA는 도감 156종 누락·중복, PNG 규격과 투명 영역, 검토 분류, 배치 보정 반영을 검사한다. 결과 원장은 `pack/qa/catalog-audit.json`, 등급별 접촉 시트는 `pack/qa/generated/*.svg`다.
- 최종 로컬 검사: 자산 6개, 프런트 65개, Rust 51개 테스트 모두 통과; TypeScript·프로덕션 빌드 통과; 프로덕션 개발용 테스트 UI 문자열 0건.
- 아직 푸시·PR·main 병합·설치판 배포를 하지 않았다. 원래 작업 폴더의 사용자 미커밋 변경도 건드리지 않았다.

남은 수동 확인: Windows에서 사진 배달 체감 크기·속도, 창 오르기 ON/OFF, 몸체·얼굴 구멍형을 포함한 대표 재제작 코스튬 착용 모습을 확인한다.

## 2026-09-01 신규 185종 도감 최종 인수인계

- `pack/manifest.json`은 뽑기 코스튬 185종과 기존 기본 3종, 총 188종이다.
- 뽑기 등급 수는 Common 80·Rare 57·Epic 31·Legendary 12·Special 5이고, 배치 슬롯 수는 head 99·face 28·neck 22·body 36이다.
- 185개 ID·이름·파일 경로가 모두 고유하며 ID는 승인된 정규 범위와 정확히 일치한다. 런타임과 매니페스트에는 `full`, split 파생 ID, `parentSetId`, `source`, derived-component 지원이 없다.
- 프로덕션 PNG 185개와 `pack/qa/accepted/` 승인본 185개는 항목별 SHA-256이 모두 같고 불일치는 0개다. 모든 blueprint 행은 `accepted`다.
- `pack/qa/generated/final/`의 5개 시트는 185개 셀을 매니페스트 순서로 포함하고 warning 요소가 없다.
- Special 매핑은 `special_001` 사진 배달/body, `special_002` 집중 타이머/head, `special_003` 창 오르기/neck, `special_004` GAMCHA/face, `special_005` 미감이 정체성/head다.
- 구 semantic repair 스크립트·원장·raw/worn 시트와 package 명령은 제거되어 있으며 새 blueprint·candidate·final QA 흐름만 사용한다.
- 새로 실행한 검증은 에셋 56/56, 프런트 20파일·67테스트, Rust 52테스트, blueprint 185, candidate 185, production 185, final sheets 5/185, TypeScript·Vite production build·rustfmt·Clippy 모두 통과했다.
- 후보 프로모션 파이프라인 전체 테스트는 36개 통과·실패 0개이며, Windows가 symlink 생성을 거부한 안전성 테스트 1개만 명시적으로 skip했다.
- `npm run tauri -- dev`는 Vite 준비, Rust dev build, `migam-desktop.exe` 실행까지 성공했다. 연결 worktree의 deny-read ACL로 UI 자동화 도구가 종료되어 실제 추첨·착용 및 기존 기능 회귀의 Windows 수동 확인은 남아 있다.
- `src-tauri/Cargo.toml`은 working tree와 index blob hash가 모두 `ec0a238b0252a93116d8a3c29ec5db1fbdf74503`으로 같으며 staging·커밋에서 제외한다.
- 이번 단계에서는 배포·푸시·PR·병합을 수행하지 않았다.

```text
현재 상태: 신규 185종 게임 아이템 도감 자동 검증 완료, Windows 수동 인수 검사 대기
마지막 성공 검사: 2026-09-01 에셋 56·프런트 67·Rust 52, blueprint/candidate/production 185, TypeScript·production build·fmt·Clippy 통과
완료한 기능: 기존 ID·희귀도·소유 호환을 유지한 185종 신규 카탈로그, 개별 배치, 최종 이미지·시트·해시·레거시 검증
다음으로 할 일: 일반 Windows 사용자 세션에서 등급별 대표 추첨·이름·아트·소유 복원·단일 장착·클리핑과 사진 배달·뽀모도로·창 오르기·설정을 확인
알려진 위험: 자동 검증은 모두 통과했지만 위 실제 Windows 상호작용·시각 확인은 ACL 제한 때문에 아직 완료하지 못함
실행/테스트 방법: README의 개발 실행과 카탈로그 QA 명령 사용
```

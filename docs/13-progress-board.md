# 13. 진행 현황판

최종 갱신: 2026-08-24
현재 단계: 창 등반·상단 보행 자동 구현 완료, Windows 실제 창 수동 검증
전체 상태: 기존 기능을 유지하면서 일반 창 측면 등반·올라서기·상단 보행·창 소멸 낙하까지 자동 검사 통과

## 단계별 상태

| 단계 | 상태 | 시작 | 완료 | 담당 | 결과/링크 |
|---|---|---|---|---|---|
| 0. 환경 확인·프로젝트 생성 | 완료 | 2026-08-23 | 2026-08-23 | Codex | 프로젝트 격리 Rust 1.98 MSVC, Node/npm, release build 확인 |
| 1. 앱 셸 | 진행 중 | 2026-08-23 |  | Codex | 다중 창·트레이·전역 단축키 컴파일 완료, 실제 셸 수동 확인 필요 |
| 2. 설정 | 진행 중 | 2026-08-23 |  | Codex | 저장·복구 테스트 통과, UI 재실행 복원 수동 확인 필요 |
| 3. 펫 이동 | 진행 중 | 2026-08-23 |  | Codex | 감자봇 v2 atlas, Idle/Walk, work area clamp와 단위 테스트 완료; Windows 수동 게이트 대기 |
| 4. 클릭·드래그·던지기 | 진행 중 | 2026-08-23 |  | Codex | pointer capture, 속도 판정, 중력·반동·마찰·3초 제한 구현; Windows 수동 게이트 대기 |
| 5. 뽀모도로 | 완료 | 2026-08-23 | 2026-08-23 | Codex | Rust 상태 머신·1초 ticker·Tauri 명령·TypeScript 타이머 UI 및 상태별 버튼 배열 완료 |
| 6. 전경 창과 규칙 | 완료 | 2026-08-23 | 2026-08-23 | Codex | 규칙 UI·저장과 Focus 전용 Win32 일치/불일치 실제 브라우저 검증 완료 |
| 7. 안전한 개입 | 진행 중 | 2026-08-23 |  | Codex | 화면 왼쪽 비행 Kick, grace/cooldown, fresh foreground 재검증과 1회 최소화 구현; Windows 수동 게이트 대기 |
| 8. 긴급 중지 | 대기 |  |  |  |  |
| 9. P1 선택 기능 | 진행 중 | 2026-08-23 |  | Codex | GAMCHA 티켓·룰렛·컬렉션 구현, 코스튬 착용과 Windows 수동 확인 대기 |
| 10. 투두·뽀모도로 연동 | 진행 중 | 2026-08-23 |  | Codex | 핵심 MVP·자동 검사 완료, Windows 수동 검증과 고급 축하 설정 대기 |
| A. 사진 배달 연출 | 완료 | 2026-08-23 | 2026-08-23 | Codex | 4장 무작위 선택, Desktop Goose식 힘겨운 당김, 화면 전체 무작위 배치, 사용자 X 닫기 |
| B. 창 등반·상단 보행 | 진행 중 | 2026-08-24 |  | Codex | Win32 시각 경계 감지, 좌우 등반·올라서기·창 추적·소멸 낙하 구현; Windows 수동 게이트 대기 |
| 11. 최종 검증 | 대기 |  |  |  |  |

상태 값: `대기`, `진행 중`, `차단`, `완료`, `제외`

## 현재 작업

- 작업: 실제 Windows 창을 이용한 펫 등반·상단 보행 수동 검증
- 시작 시각: 2026-08-24
- 목표 종료: 일반 창 좌우 등반·창 이동 추적·최소화 낙하·다중 모니터 경계 확인 시
- 수정 예정 파일: `docs/17-session-handoff.md`의 다음 작업 참조
- 완료 게이트: CRUD·선택 영구 저장, 정상 Focus 종료 수동 완료 선택, 정확한 전체 완료 축하, 긴급 취소와 키보드 조작

## 오늘 완료

- [x] 자기 앱·최소화·비표시·도구 창을 제외한 Win32 창 표면 좌표 명령 구현
- [x] DWM 실제 프레임 경계를 사용해 창 그림자·보이지 않는 테두리로 인한 부유 오차 완화
- [x] 바닥/창 위 이동 중 좌우 벽 충돌, 측면 등반, 상단 올라서기와 창 위 걷기 상태 연결
- [x] 받침 창 이동·크기 변경 추적과 최소화·종료 시 중력 낙하 및 기존 착지 연결
- [x] 등반·올라서기·낙하 투명 스프라이트 3세트 연결, 등반 중 코스튬 숨김
- [x] 프런트 41개·Rust 44개 테스트, TypeScript, Vite build, rustfmt, Clippy 통과

- [x] Git에서 누락된 `final/spritesheet-extended.webp` 참조를 추적 중인 원본 아틀라스로 교체하고 NSIS 설치 EXE 생성 검증
- [x] NSIS 설치·제거 프로그램 아이콘을 청록색 감자봇 얼굴 ICO로 명시하고 설치 EXE 재생성
- [x] release 실행 파일을 Windows GUI subsystem으로 전환해 설치판 실행 시 터미널 창이 함께 열리는 문제 수정
- [x] 독립 투두 창 상단의 동작하지 않는 File/Home/Focus/View 메뉴·리본과 가짜 닫기 표시 제거
- [x] 사용자 표시 제품명·창 제목·Node/Rust 패키지·release 실행 파일·NSIS 설치 파일을 `migam desktop`으로 통일
- [x] GAMCHA 하단 OUTFIT 바 제거와 보유 코스튬 전용 인벤토리 탭 구현
- [x] 인벤토리 상세에 실제 감자펫 착용 미리보기와 슬라이더 즉시 반영 연결
- [x] GAMCHA 전체 화면을 펫이 있는 모니터의 작업 영역에 맞춰 작업표시줄 침범 제거
- [x] GAMCHA 하단 뽑기 버튼을 코스튬 사각 궤도 위쪽의 독립 UI 층으로 이동하고 한글 글꼴 개선
- [x] GAMCHA 화면 외곽 코스튬 32개 사각 회전을 제거하고 중앙 아이템 교체·축소 펄스로 단순화
- [x] GAMCHA 로고·결과·버튼을 중앙 500px 묶음으로 축소하고 최종 아이템 대각선 이동 제거
- [x] GAMCHA 티켓·탭·닫기를 중앙 상단 툴바로 통합하고 등급·NEW 문구 겹침 제거
- [x] Tauri dev 재시작 중 AppState 등록 전 초기 요청을 자동 재시도하는 공통 준비 대기 추가
- [x] 기본 보라색 Tauri 앱 아이콘을 사용자 제공 청록색 감자봇 얼굴 아이콘으로 교체
- [x] 순수 TypeScript 프런트엔드 방침 확정 및 문서 반영
- [x] 창별 최소 UI와 트레이 코드 작성
- [x] 설정 저장·복구 서비스와 command/UI 작성
- [x] 다음 세션용 `AGENTS.md`, `docs/17-session-handoff.md` 추가
- [x] TypeScript typecheck 및 production build 통과
- [x] 프로젝트 격리 Rust stable MSVC 설치 및 환경 스크립트 추가
- [x] Rust 16개 테스트, rustfmt, Clippy 통과
- [x] 전역 `Ctrl+Shift+F12` 등록과 실패 격리 구현
- [x] Tauri release 앱 빌드 성공
- [x] 기존 감자봇 v2 atlas 구조·투명도·접촉 시트 검증
- [x] 보라색 placeholder를 실제 감자봇 스프라이트 렌더러로 교체
- [x] Idle, 좌·우 Walk 애니메이션과 30fps 이하 창 이동 구현
- [x] monitor work area와 음수 좌표를 지원하는 경계 계산 및 프런트 테스트 4개 추가
- [x] 펫 창과 실제 감자봇 표시 크기를 초기 구현의 50%로 축소
- [x] pointer capture 기반 Dragged 상태와 자동 Walk 중단 구현
- [x] 최근 110ms 포인터 표본 기반 놓기 속도 계산과 700px/s 임계값 구현
- [x] 최대 2,500px/s, 중력 2,200px/s², 반동 0.45, 바닥 마찰 0.80의 Thrown 물리 구현
- [x] Drag/Throw 화면 경계 최소 24px 복구 영역과 최대 3초 종료 구현
- [x] 이동 5개·던지기 5개 프런트 테스트 통과
- [x] Dragged 4프레임, Thrown 6프레임, Landing 4프레임 추가 이미지 생성
- [x] 추가 이미지를 192×208 투명 PNG로 정규화하고 chroma despill·육안 접촉 시트 검수 완료
- [x] 사용자 제공 ‘땅에 박힌 감자봇’ 이미지를 투명 Hard Impact 프레임으로 정리
- [x] Dragged·Thrown·Landing 전용 이미지와 1,400px/s 이상 바닥 충돌 Hard Impact 상태 연결
- [x] 던지기 바닥 경계를 걷기와 같은 완전 표시 최하단으로 통일해 Hard Impact 화면 밖 잘림 수정
- [x] Hard Impact에서 네모 캐릭터·삽을 제거하고 감자봇 단독 박힘 장면으로 교체, 표시 크기·접지점 재조정
- [x] Hard Impact 흙더미의 셀 하단 투명 여백을 0으로 조정해 작업표시줄 바로 위에 밀착
- [x] 기존 Rust PomodoroMachine을 스레드 안전 서비스와 Tauri 명령 6개에 연결
- [x] 앱 내부 1초 ticker로 타이머 창을 숨겨도 Focus/Break 전환 유지
- [x] 타이머 창에 상태·남은 시간·완료 횟수와 시작/일시정지/재개/건너뛰기/중지 UI 구현
- [x] 긴급 중지 시 실행 중 타이머를 일시정지하도록 연결
- [x] 360×280 타이머 창 내부 레이아웃을 재배치하고 문서 스크롤 제거
- [x] 타이머 상태별 사용 가능한 버튼만 노출하도록 제어 배열 정리
- [x] 방해 규칙 이름·활성화·프로세스 파일명·창 제목·유예·재감지 대기 편집 UI 구현
- [x] 규칙 추가·삭제와 개입 명시적 opt-in을 설정 저장에 연결
- [x] 규칙 조건·프로세스 경로 금지·유예 1~600초·재감지 대기 5~3,600초 검증 추가
- [x] `ForegroundWindowSource` 추상화, fake와 Win32 전경 창 snapshot 구현
- [x] Focus 중에만 1초 전경 창 polling하고 실제 제목·경로를 이벤트나 로그에 노출하지 않는 감지 서비스 연결
- [x] 설정 창에 비민감 일치 상태와 규칙 이름 표시
- [x] 사용자 제공 그림에서 네모 캐릭터 단독 투명 발차기 자산 생성·프로젝트 포함
- [x] 화면 왼쪽 바깥에서 대상 창 중앙으로 760ms 비행하는 투명 Kick 창 구현
- [x] 동일 hwnd·rule의 grace 유지와 intervention ID 기반 pending 상태 구현
- [x] 충돌 순간 Focus·긴급 중지·설정·fresh foreground·동일 hwnd·규칙 일치를 재검증한 뒤 `SW_MINIMIZE` 1회 호출
- [x] 대상 변경·Focus 종료·긴급 중지에서 pending Kick 취소
- [x] 앱 자체 PID, 읽을 수 없는 창, 핵심 Windows 프로세스와 전체 화면 창 보호
- [x] 성공/실패 후 동일 hwnd·rule cooldown 적용
- [x] `draw-picture`의 표시용 사진 4장을 사진 배달 자산으로 정리
- [x] 기존 감자봇 선화 분위기의 힘주는 4자세를 900ms 주기로 반복하고 몸 기울기·사진 흔들림 추가
- [x] 18초 동안 전진·미끄러짐·버팀을 반복하는 Desktop Goose식 구간 이동 구현
- [x] 사진 외곽 제목·테두리·여백을 제거하고 원본 이미지만 300~520px 범위로 확대 표시
- [x] 작업 영역의 바닥이 아닌 전체 영역에서 안전 여백 32px를 둔 무작위 목적지 선택
- [x] 중앙 배치를 제외하고 좌·우 화면 가장자리 32~122px 범위에만 사진을 놓도록 목적지 제한
- [x] 왼쪽 목적지는 왼쪽 화면 밖, 오른쪽 목적지는 오른쪽 화면 밖에서 출발하도록 진입 방향 일치
- [x] 왼쪽 진입에서는 사진·펫 순서와 감자펫 방향을 반전해 안쪽으로 끌어오는 모습 유지
- [x] 방향별 DOM 표시 순서를 `order`로 고정해 왼쪽은 사진–펫, 오른쪽은 펫–사진 배치 보장
- [x] 배달 시작과 목적지의 Y 좌표를 동일하게 고정해 이동 중 위아래로 흐르지 않는 수평 경로 보장
- [x] 눈에 보이는 원형 X를 제거하고 사진 우측 상단 46×46px을 투명 닫기 영역으로 변경
- [x] 사진을 놓은 뒤 감자펫만 3.5초 동안 퇴장하고 사진 창은 사용자 `X` 입력 전까지 유지
- [x] 배달 완료 시 사진의 실제 위치·크기로 창을 축소해 뒤쪽 앱 입력을 방해하지 않도록 처리
- [x] 2~4분 무작위 자동 배달과 우클릭 `사진 배달 테스트` 명령 추가
- [x] 집중·휴식·일시정지와 긴급 중지 중 배달 차단, 연출 중 원래 펫 숨김·종료 후 복원
- [x] 전체 화면 투명 레이어의 마우스 입력 통과와 작업표시줄 제외 영역 적용
- [x] 타이머·설정 창을 WinDbg 분위기의 메뉴·리본·도킹 패널·파란 상태바 UI로 재디자인
- [x] 타이머 360×280 무스크롤 조건과 상태별 버튼 배열 유지
- [x] `pack/manifest.json`의 기본 3종을 제외한 156종 코스튬을 GAMCHA 후보로 연결
- [x] 자연 집중 완료에만 티켓 1장을 지급하고 Skip/Stop 보상을 차단
- [x] 일반 60%·레어 25%·에픽 10%·전설 4%·스페셜 1% 확률과 등급 내 중복 방지 구현
- [x] 티켓·누적 뽑기·컬렉션을 앱 데이터 `gamcha.json`에 원자적으로 저장·복원
- [x] 펫 위 GAMCHA 말풍선, 무지개 로고, 룰렛 감속, 등급별 빛·회전·공개 연출 구현
- [x] 펫 우클릭과 트레이에 `GAMCHA!` 열기 메뉴 추가
- [x] 타이머 UI polling이 먼저 단계 전환할 때 티켓이 누락되던 경쟁 조건 수정 및 추첨 전 빈 이미지 숨김
- [x] 집중 완료 시 전체 GAMCHA 창 대신 펫 위 클릭형 보상 말풍선만 표시하도록 2단계 진입 구조로 변경
- [x] 말풍선 클릭 후 펫 모니터 전체화면에서 32개 아이템 이중 궤도·회전 광선·56개 색종이·24프레임 셔플 연출 구현
- [x] 불투명 전체화면 배경을 제거하고 기존 화면 위 투명 오버레이로 변경, 아이템을 모니터 네 변의 직사각형 경로로 양방향 회전
- [x] 타이머 초기 IPC 실패 시 긴 오류 문장이 작은 창에 잘리던 문제를 자동 재연결 가능한 소형 상태로 교체
- [x] GAMCHA 중앙 결과의 사각 방사 배경·이중 테두리를 제거하고 무경계 원형 광원으로 변경, 뽑기 버튼을 소형 단색+무지개 선으로 정리
- [x] GAMCHA 보유 코스튬 옷장, 착용·해제, 영구 저장과 펫 실시간 오버레이 구현
- [x] 256×256 코스튬을 128×128로 축소하고 96×104 펫 셀 중심에 `left -16px`, `top -12px` 공통 정렬
- [x] CPU·MEM 트레이 표시, 부하 5구간 달리기 16프레임과 시스템 반응 연속 이동 구현
- [x] 투두리스트·뽀모도로 연동 추가 기능 명세와 완료 게이트 확정
- [x] TodoItem·TodoState CRUD, 선택, 전체 완료 잠금·재발동 도메인 구현
- [x] todo.json 원자 저장·손상 파일 보존과 Tauri command·이벤트 연결
- [x] Focus 시작 snapshot과 정상 종료 완료·계속·다음 집중 선택 구현
- [x] 펫 우클릭 메뉴에서 여는 심플한 독립 투두 창과 500ms 지연 정렬 구현
- [x] 독립 투두 창을 설정·우클릭 메뉴와 같은 WinDbg 리본·명령줄·각진 패널·파란 상태바 디자인으로 통일
- [x] 기본 펫 점프·광원 축하와 재발동 방지 구현

## 다음 작업

1. Windows에서 펫 우클릭 `투두리스트`로 독립 창 열기와 스크롤·키보드 조작 확인
2. 할 일 CRUD·선택·재시작 복원과 정상 Focus 종료 3개 선택지 수동 확인
3. Skip·Stop·삭제·빈 목록에서 축하가 잘못 실행되지 않는지 확인
4. 중앙 안전 이동·말풍선·색종이·효과음과 움직임 줄이기 설정 구현
5. 긴급 중지 시 실행 중 축하 즉시 취소 연결

## 차단 요소

| ID | 문제 | 영향 | 대응 | 상태 |
|---|---|---|---|---|
| B-001 | Rust/Cargo를 현재 환경에서 찾을 수 없음 | Rust 테스트·Tauri 실행 불가 | 프로젝트 내부 Rust stable MSVC 설치 | 닫힘 |
| B-002 | Codex 샌드박스가 Windows GUI 창 생성을 거부 | 자동 실행 smoke test 불가 | 일반 사용자 PowerShell에서 수동 실행 | 열림 |
| B-003 | 샌드박스 네트워크가 WiX 다운로드를 차단 | MSI 번들 생성 불가 | `tauri build --no-bundle`로 release exe 검증; 설치파일은 네트워크 가능한 환경에서 생성 | 열림 |

## 발견된 버그

| ID | 심각도 | 현상 | 재현 | 담당 | 상태 |
|---|---|---|---|---|---|
| BUG-001 |  |  |  |  |  |
| BUG-002 | S1 | Windows에서 Vite가 잠긴 Rust `.exe`를 감시해 EBUSY 종료 | `npm run tauri -- dev` | Codex | 수정 완료 — `src-tauri/target`, `.tools` 감시 제외 |

심각도:

- S0: 데이터/시스템 안전 문제, 즉시 중단
- S1: 핵심 경로 실패
- S2: 우회 가능한 기능 문제
- S3: 시각/문구 문제

## 테스트 기록

| 2026-08-24 | 자동 사진 배달 ON/OFF·규칙 시간 하한 변경 후 전체 검사 | 통과 | 프런트 25개·Rust 43개, production build, rustfmt, Clippy 통과; Windows UI 수동 확인 필요 |
| 2026-08-24 | 창 등반 로프 투척·밀착 보정 후 전체 검사 | 통과 | 로프 투척/등반 RGBA 4프레임, 클릭 통과 투명 로프 창, 프런트 42개·Rust 45개·typecheck·production/release build·rustfmt·Clippy 통과 |
| 2026-08-24 | 로프 곡선 투척·실제 등반 모션·간격 재보정 | 통과 | 포물선 SVG 로프와 회전 갈고리, v2 투척/교대 등반 4프레임, 몸 겹침 49%→32%, 프레임 여백 11% 보정; 프런트 43개·Rust 45개·typecheck·production/release build·rustfmt·Clippy 통과 |
| 2026-08-24 | 로프 중복·하단 돌출·등반 종료 높이 수정 | 통과 | SVG 로프를 윗손에서 종료, J형 갈고리와 얇은 외곽선 적용, 윗손이 모서리에 도착하면 pull-up으로 전환; 프런트 44개·typecheck·별도 production build 통과 |
| 2026-08-24 | 손이 창 테두리를 잡던 로프 가로 좌표 수정 | 통과 | 펫을 로프 쪽으로 창 너비의 11% 이동, 로프 상단은 창 모서리까지 곡선 연결; 프런트 44개·typecheck·별도 production build 통과 |
| 2026-08-24 | 갈고리 상단 위치·로프 연속성 수정 | 통과 | 동일 벽의 가장 높은 실제 창 우선, 화면 상단 보행 위치 클램프, 로프 웹뷰 resize 후 재렌더링; 프런트 45개·typecheck·별도 production build 통과 |
| 2026-08-24 | 로프-손 연결부 실화면 미세 조정 | 통과 | 긴 줄 끝을 손 방향 16px·아래 6px 보정해 내부 줄과 연속 연결; 프런트 45개·typecheck·별도 production build 통과 |
| 2026-08-24 | 등반 프레임별 로프 틈 제거 | 통과 | SVG 줄을 펫 높이 60%까지 내려 내부 줄과 아래 손까지 중첩; 프런트 45개·typecheck·별도 production build 통과 |
| 2026-08-24 | 창 오르기를 느린 포물선 점프로 교체 | 통과 | 로프 경로 우회, 높이별 1.1~2.2초 점프, 창 위 보행·창 소멸 낙하 유지; 프런트 46개·typecheck·별도 production build 통과 |
| 2026-08-24 | 창 위 착지 후 철퍼덕 넘어짐 추가 | 통과 | 착지 4프레임과 약 980ms 회전·눕기·일어나기 연출, 지지 창 유지 후 보행 재개; 프런트 46개·typecheck·별도 production build 통과 |

| 시각 | 명령/검사 | 결과 | 메모 |
|---|---|---|---|
| 2026-08-23 | `npm run typecheck` | 통과 | TypeScript 오류 없음 |
| 2026-08-23 | `npm run build` | 통과 | Vite production build 성공 |
| 2026-08-23 | `npm test` | 통과 | 프런트 테스트 파일은 아직 없음 |
| 2026-08-23 | Rust/Cargo 확인 | 차단 | 실행 파일을 찾지 못함 |
| 2026-08-23 | 감자봇 atlas deterministic validation | 통과 | 1536×2288, 8×11, 오류·경고 없음, despill `ok: true` |
| 2026-08-23 | `npm test` | 통과 | 펫 work area·clamp·target·이동 순수 함수 4개 |
| 2026-08-23 | `npm run typecheck` | 통과 | 감자봇 렌더러와 Tauri 이동 adapter 포함 |
| 2026-08-23 | `cargo test` | 통과 | Rust 16개 테스트 |
| 2026-08-23 | `cargo clippy --all-targets -- -D warnings` | 통과 | 오류 없음 |
| 2026-08-23 | `npm run tauri -- build --no-bundle` | 통과 | release exe 생성, 감자봇 WebP 번들 포함 |
| 2026-08-23 | `npm run tauri -- build` | 부분 통과 | release exe 생성 후 WiX 네트워크 다운로드만 차단 |
| 2026-08-23 | 50% 크기 변경 후 `npm test`, `npm run build` | 통과 | 128×128 창, 96×104 스프라이트 production build 확인 |
| 2026-08-23 | `tauri build --debug --no-bundle` | 실행 파일 잠금 | 실행 중인 dev 앱이 `target/debug/desktop-pet-mvp.exe`를 사용 중; 앱 종료 후 재검증 가능 |
| 2026-08-23 | Drag/Throw 구현 후 `npm test` | 통과 | 이동 5개, 포인터 속도·중력·반동·3초 제한 5개, 총 10개 |
| 2026-08-23 | Drag/Throw 구현 후 `npm run typecheck`, `npm run build` | 통과 | TypeScript와 production asset 빌드 성공 |
| 2026-08-23 | Drag/Throw 구현 후 `tauri build --no-bundle` | 통과 | release exe 생성 |
| 2026-08-23 | Rust toolchain 설치 | 통과 | 프로젝트 `.tools`에 rustc 1.98.0 MSVC 설치 |
| 2026-08-23 | `cargo test` | 통과 | 16개 테스트 통과 |
| 2026-08-23 | `cargo fmt --check`, `cargo clippy -D warnings` | 통과 | linker 현지화 메시지는 허용 |
| 2026-08-23 | `npm run tauri -- build --no-bundle` | 통과 | release 실행 파일 생성 |
| 2026-08-23 | release 실행 smoke test | 차단 | 샌드박스가 Tauri GUI 창 생성 시 access denied 반환 |
| 2026-08-23 | Vite watcher 설정 | 수정 | Rust 빌드 결과와 프로젝트 도구 폴더 감시 제외 |
| 2026-08-23 | 추가 동작 이미지 deterministic QA | 통과 | Dragged 4장, Thrown 6장, Landing 4장 모두 192×208 RGBA, 투명 배경, despill 완료 |
| 2026-08-23 | Hard Impact 연결 후 `npm test`, `npm run typecheck`, `npm run build` | 통과 | 총 11개 테스트, 추가 PNG 15장 production asset 포함 |
| 2026-08-23 | 바닥 경계 정렬 수정 후 `npm test`, `npm run typecheck`, `npm run build` | 통과 | 걷기·바닥 반동·Hard Impact가 동일한 완전 표시 바닥선 사용 |
| 2026-08-23 | Hard Impact 단독 캐릭터 자산 QA | 통과 | 감자봇과 연결된 흙더미만 표시, 192×208 RGBA, 실제 투명 배경, 캐릭터 크기 정렬 |
| 2026-08-23 | Hard Impact 하단 접지 QA | 통과 | 불투명 영역 bbox 하단 208px로 셀 최하단에 정확히 밀착 |
| 2026-08-23 | Pomodoro 구현 후 `cargo test` | 통과 | Rust 20개 테스트, 서비스 상태·설정 반영 포함 |
| 2026-08-23 | Pomodoro 구현 후 `npm test` | 통과 | 프런트 16개 테스트, 타이머 표시·제어 상태 포함 |
| 2026-08-23 | Pomodoro 구현 후 typecheck/build/Clippy | 통과 | TypeScript production build와 Rust `-D warnings` 통과 |
| 2026-08-23 | Pomodoro 구현 후 `tauri build --no-bundle` | 통과 | release 실행 파일 생성 |
| 2026-08-23 | 타이머 창 무스크롤 레이아웃 | 수정 | 축소 여백, 단일 제어 행, timer 문서 overflow 차단 |
| 2026-08-23 | 타이머 버튼 배열 개선 | 수정 | 대기 1개, 실행 중 3개, 일시정지 2개만 균등 표시 |
| 2026-08-23 | 전경 창·규칙 구현 후 `cargo test` | 통과 | Rust 24개 테스트, Focus 외 source 미호출과 비민감 일치 결과 포함 |
| 2026-08-23 | 전경 창·규칙 구현 후 `npm test`, `npm run build` | 통과 | 프런트 16개 테스트와 TypeScript production build 통과 |
| 2026-08-23 | 전경 창·규칙 구현 후 fmt/Clippy | 통과 | Rust format과 `-D warnings` 통과 |
| 2026-08-23 | Kick 투명 자산 QA | 통과 | 1536×1024 RGBA, corner alpha 0, 네모 캐릭터 단독 발차기 |
| 2026-08-23 | 안전 개입 구현 후 `cargo test` | 통과 | Rust 24개 테스트, grace·fresh 재검증·긴급 중지 취소 포함 |
| 2026-08-23 | 안전 개입 구현 후 `npm test`, `npm run build` | 통과 | 프런트 16개 테스트, Kick PNG production asset 포함 |
| 2026-08-23 | 안전 개입 구현 후 Clippy | 통과 | `cargo clippy --all-targets -- -D warnings` 통과 |
| 2026-08-23 | WinDbg UI 적용 후 `npm test`, `npm run build` | 통과 | 프런트 16개 테스트와 production build 통과 |
| 2026-08-23 | WinDbg raw UI 조정 후 `npm test`, `npm run build` | 통과 | 명령줄·고전 Win32 경계·회색 버튼·고밀도 패널 적용, 프런트 16개 테스트 통과 |
| 2026-08-23 | 펫 우클릭 메뉴·타이머 말풍선 연결 후 전체 검사 | 통과 | 네이티브 우클릭 메뉴, 펫 추적 말풍선 위치, 프런트 16개·Rust 24개·Clippy·production build 통과 |
| 2026-08-23 | 집중 모드·초소형 타이머 적용 후 `npm test`, `npm run build` | 통과 | 집중 중 이동 정지, 컴퓨터 작업 RGBA 자산, 156×76 표시 전용 말풍선 연결 |
| 2026-08-23 | Chrome 감지·Kick 포커스 수정 후 Rust 검사 | 통과 | ToolHelp 프로세스명 fallback, 비포커스 Kick 창, 250ms 감지 주기 적용 |
| 2026-08-23 | GAMCHA 구현 후 `npm test`, `npm run build` | 통과 | 프런트 18개 테스트, 156종 후보 production asset 포함 |
| 2026-08-23 | GAMCHA 구현 후 Rust 검사 | 통과 | Rust 32개 테스트, fmt, Clippy `-D warnings` 통과 |
| 2026-08-23 | GAMCHA 구현 후 `tauri build --no-bundle` | 통과 | release 실행 파일 생성 |
| 2026-08-23 | GAMCHA 티켓 경쟁 조건 수정 후 전체 검사 | 통과 | 모든 Tick 경로에서 동일 보상 처리, 프런트 18개·Rust 32개·Clippy·build 통과 |
| 2026-08-23 | GAMCHA 2단계 전체화면 연출 후 전체 검사 | 통과 | `gamcha-notice` 창, 전체화면 전환, 프런트 18개·Rust 32개·Clippy·release build 통과 |
| 2026-08-23 | GAMCHA 투명 사각 궤도 수정 후 전체 검사 | 통과 | 기존 화면 유지, 중앙 결과 카드, 프런트 18개·Rust 32개·Clippy·build 통과 |
| 2026-08-23 | 코스튬 착용 구현 후 전체 검사 | 통과 | 옷장·해제·저장·보유 검증·펫 오버레이, 프런트 18개·Rust 33개·Clippy·release build 통과 |
| 2026-08-23 | 코스튬 정렬·집중 감시 복구 수정 | 통과 | 슬롯별 착용 기준점, Tick 일시 오류 후 감시 지속, 프런트 18개·Rust 33개·임시 경로 production build 통과 |
| 2026-08-23 | 코스튬별 수동 보정 기반 구현 | 통과 | 옷장 X·Y·크기 조절/초기화, 코스튬별 영구 저장, 프런트 20개·Rust 34개·Clippy·production build 통과 |
| 2026-08-23 | CPU·메모리 반응형 펫 구현 | 통과 | CPU/메모리/통합/끔 선택, 실시간 사용률, 속도·대기·바쁨·실패 동작 연결, 프런트 23개·Rust 36개·Clippy·production build 통과 |
| 2026-08-23 | WinDbg 펫 우클릭 팝업 구현 | 통과 | 네이티브 메뉴를 상태 패널·명령 버튼·화면 경계 보정 전용 창으로 교체, 프런트 23개·Rust 36개·production build 통과 |
| 2026-08-23 | CPU·MEM 감자봇 트레이 표시 구현 | 통과 | CPU 파랑·MEM 빨강 2개 아이콘, 10단계 게이지·4단계 표정·실시간 툴팁, 프런트 23개·Rust 38개·Clippy·production build 통과 |
| 2026-08-23 | CPU·MEM 트레이 가독성 개선 | 통과 | 방사형 게이지를 전폭 하단 막대로 교체하고 얼굴을 약 40% 확대, Rust 38개·Clippy 통과 |
| 2026-08-23 | 부하 구간별 달리기 연결 | 통과 | 0~19 기본 걷기, 20~39 alert, 40~59 medium, 60~79 fast, 80~100 extreme 각 4프레임·좌우 방향·단계별 속도 연결, 프런트 24개·typecheck·production build 통과 |
| 2026-08-23 | 시스템 반응 연속 달리기 | 통과 | CPU/MEM/통합 모드에서는 목적지 도착 즉시 다음 목적지를 선택해 대기 없이 계속 이동, 사용 안 함에서만 기존 휴식 유지, 프런트 25개·typecheck·production build 통과 |
| 2026-08-23 | 시스템 반응 기준 UI 정렬 | 수정 | 둥근 기본 select를 크기 입력과 동일한 각진 WinDbg 테두리·높이·Consolas 글꼴·포커스 표시로 통일 |
| 2026-08-23 | 사진 배달 구현 후 전체 검사 | 통과 | 프런트 25개, Rust 38개, typecheck, production build, rustfmt, Clippy `-D warnings` 통과 |
| 2026-08-23 | 사진 배달 속도·잔류 방식 수정 | 통과 | 프레임 반복 제거, 12초 진입·5초 퇴장·X 수동 닫기 적용 후 전체 검사 재통과 |
| 2026-08-23 | Desktop Goose식 사진 배달 재작업 | 통과 | 힘주는 4자세, 구간 이동, 원본 사진만 표시, 무작위 화면 위치 적용 후 전체 검사 재통과 |
| 2026-08-23 | 사진 사이드 배치·투명 닫기 | 수정 | 중앙 배치 제외, 좌우 가장자리 전용 목적지와 보이지 않는 우측 상단 닫기 영역 적용 |
| 2026-08-23 | 사진 배달 진입 방향 일치 | 수정 | 왼쪽 배치는 왼쪽 출발·캐릭터 반전, 오른쪽 배치는 오른쪽 출발 적용 |
| 2026-08-23 | 사진·펫 좌우 순서 안정화 | 수정 | flex 반전 의존 제거, 방향별 명시적 order로 끄는 쪽에 펫이 항상 위치하도록 고정 |
| 2026-08-23 | 사진 배달 수평 이동 고정 | 수정 | 시작·도착 Y를 동일하게 사용해 힘겨운 전진·밀림은 유지하면서 세로 이동 제거 |
| 2026-08-23 | Windows 앱 아이콘 교체 | 통과 | 제공 이미지의 숫자·바깥 여백 제거, 투명 512px 원본·다중 크기 ICO 생성과 release 실행 파일 포함 확인 |
| 2026-08-23 | 개발 앱 아이콘·설정 복구 | 통과 | 실행 중 잠겨 있던 구형 debug 산출물을 정리하고 최신 설정 계약과 감자봇 아이콘을 포함해 완전 재빌드 |
| 2026-08-23 | GAMCHA 인벤토리 탭 분리 | 통과 | 화면 하단 OUTFIT 바 제거, 보유 카드 목록·착용 상태·상세 미리보기·개별 위치 조절을 별도 탭으로 이동; 프런트 25개·typecheck·build 통과 |
| 2026-08-23 | 인벤토리 착용 미리보기 | 통과 | 오른쪽 상세에서 실제 Idle 감자펫과 선택 코스튬을 합성하고 X·Y·크기 입력을 저장 전 즉시 반영; 전체 프런트 검사 통과 |
| 2026-08-23 | 개발 재시작 AppState 경쟁 수정 | 통과 | `state not managed`에 한해 100ms 간격 최대 3초 재시도하고 설정·펫·타이머·GAMCHA·우클릭 초기 조회에 공통 적용; 프런트 25개·typecheck·build 통과 |
| 2026-08-23 | GAMCHA 작업표시줄 침범 수정 | 통과 | 모니터 전체 해상도 대신 펫이 있는 모니터의 작업 영역 위치·크기를 사용하도록 변경; Rust 38개·fmt·Clippy 통과 |
| 2026-08-23 | GAMCHA 버튼 겹침·글꼴 수정 | 통과 | 하단 궤도와 버튼 사이 안전 간격 확보, 버튼 z-index 분리와 Segoe UI·맑은 고딕 폰트 적용 |
| 2026-08-23 | GAMCHA 중앙 추첨 단순화 | 통과 | 외곽 아이템 DOM·회전 제거, 중앙 코스튬만 교체하며 80~94% 축소 펄스 적용; 프런트 25개·typecheck·build 통과 |
| 2026-08-23 | GAMCHA 중앙 UI 밀집 배치 | 통과 | 분산된 고정 좌표를 중앙 draw shell로 통합하고 로고·스테이지·아이템 축소, reveal transform 충돌 제거; 프런트 25개·typecheck·build 통과 |
| 2026-08-23 | GAMCHA 툴바·결과 라벨 정리 | 통과 | 화면 모서리의 티켓·탭·닫기를 중앙 툴바로 통합하고 등급은 좌측, NEW는 우측에 고정해 겹침 방지; 프런트 25개·typecheck·build 통과 |
| 2026-08-24 | 사진 배달 1% 희귀 이벤트 | 통과 | 리얼 허거덩스 사진을 정확히 1%로 분기, X 제거·사진 5회 클릭 시 닫힘과 작업 영역 전체 감자봇 비 연결; 배달 자산 준비 후 원래 펫을 숨겨 빈 구간 제거, 프런트 47개·Rust 45개·typecheck·fmt·Clippy·production/release build 통과 |
| 2026-08-24 | 창 겹침 시 펫 가림 방지 | 통과 | 다른 창의 테두리에서 펫이 잘린 것이 아니라 Z-order 뒤로 내려간 상태를 수정; 실행 중 400ms마다 비활성 최상단을 재확인하고 긴급 중지·사진 배달 복원 때도 최상단 속성을 먼저 복구, 프런트 47개·Rust 45개·typecheck·fmt·Clippy·production/release build 통과 |
| 2026-08-24 | 창 위 넘어짐 자체 clipping 수정 | 통과 | 발 근처 58%·92% 회전축 때문에 82도 회전 시 몸이 128px WebView 밖으로 벗어나던 원인을 수정; 몸 중앙 회전축과 넘어지는 구간 76% 축소로 사방 여유 확보, 프런트 47개·typecheck·production build 통과 |
| 2026-08-24 | 저전력 배터리 배달 이벤트 | 통과 | Windows 배터리 20% 이하·비충전 상태를 감지해 가까운 화면 옆으로 퇴장한 뒤 배터리를 들고 천천히 복귀·제시; 25% 이상 또는 충전 시 재무장, 우클릭 수동 테스트, 신규 3×2 투명 스프라이트 연결; 프런트 53개·Rust 48개·production build 통과 |
| 2026-08-24 | 배터리 운반 프레임 우측 잘림 수정 | 코드·테스트 통과 | 128px 배터리 셀을 96px 기본 펫 영역에서 표시해 생긴 clipping을 확인하고 배터리 동작 중 표시 영역을 128×128로 확장; 실행 중 앱의 dist 잠금으로 release 재빌드는 앱 종료 후 필요 |

| 2026-08-24 | v0.1.1 최종 릴리스 | 통과 | 버전·README 다운로드 링크 동기화, 프런트 53개·Rust 48개·typecheck·production/NSIS release build·fmt·Clippy·main CI 통과, Windows x64 설치 파일 게시 |
| 2026-08-24 | 사진 배달 캐릭터 CSP 수정·v0.1.2 준비 | 로컬 통과 | `img-src`에 `blob:` 허용, 회귀 테스트 Red→Green, 프런트 53개·Rust 49개·typecheck·production build·fmt·Clippy·Windows x64 MSI/NSIS build 통과 |

## 시간 예산

| 구분 | 계획 | 실제 | 차이 |
|---|---:|---:|---:|
| 환경·scaffold·앱 셸 | 4.5h |  |  |
| 설정 | 1.5h |  |  |
| 펫 이동·상호작용 | 3.5h |  |  |
| 타이머·규칙 UI | 3h |  |  |
| 감지·개입·긴급 중지 | 6h |  |  |
| 테스트·릴리스 | 5.5h |  |  |

## 마지막 인수인계

- Chrome의 보이는 최상위 창 중 실행 파일이 `chrome.exe`이고 제목에 `YouTube Music`이 포함된 창을 750ms마다 감지한다. 감지 중에는 일반 이동을 멈추고 기존 `pack/dance` 6프레임을 재생하며, 128×128 펫 창 안에 조명·음표·발광 바닥 무대를 표시한다.
- 집중 타이머와 드래그가 음악 반응보다 우선한다. 집중이 끝났을 때 YouTube Music 창이 남아 있으면 다시 춤 상태로 복귀하며, 창을 닫으면 기존 대기·이동 행동으로 돌아간다.
- YouTube Music 반응 구현 후 프런트 50개·Rust 46개 테스트, TypeScript, production build, rustfmt와 Clippy를 통과했다.
- 음악 무대를 128×128 내부 효과에서 280×220 확장 창으로 키웠다. 확장·복원 시 기존 펫 위치의 하단 중앙을 고정해 작업표시줄이나 창 위 접지 위치가 움직이지 않는다. 기존 춤 대신 마이크를 들고 노래하며 뛰는 신규 투명 3×2·6프레임 시트를 연결했고 음악 모드에서는 코스튬을 숨겨 포즈가 온전히 보이게 했다.
- 확장 무대·신규 노래 춤 적용 후 프런트 50개·Rust 47개 테스트, TypeScript, production/release build, rustfmt와 Clippy를 통과했다.

```text
현재 상태: 창 위 착지 후 넘어질 때 펫 WebView 자체 경계에서 잘리던 회전 애니메이션 수정 완료, Windows 수동 확인 전
마지막 성공 검사: 2026-08-24 프런트 47개·Rust 45개·typecheck·fmt·Clippy·production build 통과; 실행 중 앱이 `dist`와 release target lock을 보유해 최신 CSS의 release 갱신은 앱 종료 후 필요
완료한 기능: 최상단 Z-order 유지에 더해 `window-tumble` 회전축을 발끝에서 몸 중앙으로 옮기고, 82도 누운 구간만 76%로 축소해 128×128 펫 창 안에 여유를 확보함
다음으로 할 일: 앱을 완전히 재시작하고 창 위 착지 직후 넘어지는 몸과 현재 코스튬이 사방에서 잘리지 않는지 확인
알려진 위험: 시스템 자체 보안 화면이나 Windows가 강제로 우선하는 특수 최상단 창은 일반 앱과 달리 펫보다 앞에 표시될 수 있음
실행/테스트 방법: `. .\scripts\use-project-rust.ps1` 후 README 명령 실행
```

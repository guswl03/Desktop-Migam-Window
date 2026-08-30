const helpText = {
  petSize: "화면에 표시되는 펫 크기입니다. 기본값은 100이며, 50~200 사이의 숫자를 입력하세요.",
  resourceResponse: "CPU나 메모리 사용량이 높을 때 펫의 표정과 움직임을 바꿉니다. 잘 모르겠다면 ‘CPU와 메모리 중 높은 값’을 선택하세요.",
  automaticPhotoDelivery: "펫이 약 20~40분 간격으로 컴퓨터 관련 사진을 자동으로 가져옵니다.",
  windowClimbing: "펫이 이동 중 창을 만나면 창 위로 올라갑니다. 끄면 새로운 창을 만나도 올라가지 않습니다.",
  focusMinutes: "한 번 집중할 시간을 분 단위로 입력하세요. 예: 25",
  shortBreakMinutes: "집중을 한 번 마친 뒤 쉬는 시간을 분 단위로 입력하세요. 예: 5",
  longBreakMinutes: "여러 번 집중한 뒤 길게 쉬는 시간을 분 단위로 입력하세요. 예: 15",
  longBreakCycle: "집중을 몇 번 완료한 뒤 긴 휴식을 시작할지 입력하세요. 예: 4",
  intervention: "집중 타이머가 진행되는 동안 아래에 등록한 앱이나 사이트가 열렸는지 확인합니다.",
  ruleName: "이 규칙을 알아보기 쉬운 이름으로 적으세요. 예: 유튜브 차단",
  processName: "차단할 프로그램의 실행 파일명을 적으세요. 예: chrome.exe 또는 Discord.exe",
  windowTitle: "차단할 웹사이트나 창 제목에 들어가는 단어를 적으세요. 예: YouTube 또는 Instagram",
  graceSeconds: "방해 앱을 발견한 뒤 창을 최소화하기 전 기다릴 시간을 초 단위로 입력하세요. 예: 3",
  cooldownSeconds: "같은 앱을 다시 검사하기까지 기다릴 시간을 초 단위로 입력하세요. 예: 30",
} as const;

export type SettingsHelpKey = keyof typeof helpText;

function escapeAttribute(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function settingsHelp(key: SettingsHelpKey): string {
  const description = escapeAttribute(helpText[key]);
  return `<span class="settings-help" tabindex="0" role="note" aria-label="도움말: ${description}" data-tooltip="${description}">!</span>`;
}

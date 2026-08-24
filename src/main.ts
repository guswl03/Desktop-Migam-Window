import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type {
  BootstrapState,
  DetectionState,
  DistractionRule,
  Settings,
  SystemMetricsState,
  ResourceResponseMode,
} from "./contracts";
import { mountKick } from "./intervention/kick-view";
import { mountGamcha, mountGamchaNotice } from "./gamcha/gamcha-view";
import { costumeById } from "./costumes/catalog";
import { resolveCostumeAlignment, type CostumeAlignment } from "./costumes/alignment";
import { attachPetContextMenu } from "./pet/context-menu";
import { mountPetContextMenu } from "./pet/context-menu-view";
import { mountPhotoDelivery, startPhotoDeliveryScheduler } from "./pet/photo-delivery-view";
import { mountClimbRope } from "./pet/climb-rope-view";
import { startPetMotion } from "./pet/tauri-motion-runtime";
import { createPetSprite } from "./pet/sprite";
import { mountTimer } from "./timer/timer-view";
import { mountTodo } from "./todo/todo-view";
import { invokeWhenReady } from "./tauri/invoke-when-ready";
import { settingsHelp } from "./settings-help";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("The application root is missing.");
}

const windowLabel = getCurrentWindow().label;
document.body.dataset.window = windowLabel;
document.documentElement.dataset.window = windowLabel;

function renderPet(): void {
  const shell = document.createElement("main");
  shell.className = "pet-shell";
  const sprite = createPetSprite();
  shell.append(sprite.element);
  app!.replaceChildren(shell);

  if (windowLabel === "pet") {
    type CostumeSnapshot = {
      equippedCostumeId: string | null;
      costumeAlignments: Record<string, CostumeAlignment>;
    };
    const applyCostume = (snapshot: CostumeSnapshot): void => {
      const costume = snapshot.equippedCostumeId
        ? (costumeById.get(snapshot.equippedCostumeId) ?? null)
        : null;
      sprite.setCostume(costume ? {
        url: costume.url,
        slot: costume.slot,
        alignment: resolveCostumeAlignment(costume.slot, snapshot.costumeAlignments[costume.id]),
      } : null);
    };
    void invokeWhenReady<CostumeSnapshot>("get_gamcha_state")
      .then(applyCostume)
      .catch(() => sprite.setCostume(null));
    void listen<CostumeSnapshot>("gamcha://equipped", ({ payload }) =>
      applyCostume(payload),
    ).then((unlisten) => window.addEventListener("pagehide", unlisten, { once: true }));
    const stopMotion = startPetMotion(sprite);
    window.addEventListener("pagehide", stopMotion, { once: true });
    const stopPhotoDeliveryScheduler = startPhotoDeliveryScheduler();
    window.addEventListener("pagehide", stopPhotoDeliveryScheduler, { once: true });
    void attachPetContextMenu(sprite.element).then((cleanup) => {
      window.addEventListener("pagehide", cleanup, { once: true });
    });
  }
}

function renderTimer(): void {
  void mountTimer(app!)
    .then((cleanup) => {
      window.addEventListener("pagehide", cleanup, { once: true });
    })
    .catch(() => {
      app!.innerHTML = `<main class="timer-panel"><section class="timer-bubble"><div class="timer-readout"><p class="timer-phase">재연결</p><p class="timer-remaining">--:--</p></div><span class="timer-error">앱을 다시 시작해 주세요.</span></section></main>`;
    });
}

function renderKick(): void {
  void mountKick(app!).then((cleanup) => {
    window.addEventListener("pagehide", cleanup, { once: true });
  });
}

function renderGamcha(): void {
  void mountGamcha(app!)
    .then((cleanup) => window.addEventListener("pagehide", cleanup, { once: true }))
    .catch(() => {
      app!.innerHTML = `<main class="gamcha-panel"><section class="gamcha-bubble"><p class="gamcha-error">GAMCHA를 불러오지 못했습니다.</p></section></main>`;
    });
}

function renderGamchaNotice(): void {
  void mountGamchaNotice(app!)
    .then((cleanup) => window.addEventListener("pagehide", cleanup, { once: true }))
    .catch(() => undefined);
}

function numberValue(form: FormData, name: string): number {
  return Number(form.get(name));
}

function escaped(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function optionalValue(form: FormData, name: string): string | undefined {
  const value = String(form.get(name) ?? "").trim();
  return value || undefined;
}

function createRule(index: number): DistractionRule {
  return {
    id: crypto.randomUUID(),
    name: `규칙 ${index + 1}`,
    enabled: true,
    graceSeconds: 5,
    cooldownSeconds: 30,
  };
}

function ruleRows(rules: DistractionRule[]): string {
  if (rules.length === 0) {
    return '<p class="empty-rules">등록된 규칙이 없습니다.</p>';
  }
  return rules
    .map(
      (rule, index) => `
        <article class="rule-card" data-rule-id="${escaped(rule.id)}">
          <div class="rule-heading">
            <label class="checkbox-row"><input name="rule-${index}-enabled" type="checkbox" ${rule.enabled ? "checked" : ""} /> 사용</label>
            <button class="danger-text" type="button" data-remove-rule="${escaped(rule.id)}">삭제</button>
          </div>
          <label><span class="setting-label-text">규칙 이름 ${settingsHelp("ruleName")}</span><input name="rule-${index}-name" type="text" maxlength="60" value="${escaped(rule.name)}" required /></label>
          <label><span class="setting-label-text">앱 실행 파일 ${settingsHelp("processName")}</span><input name="rule-${index}-process" type="text" maxlength="120" placeholder="chrome.exe" value="${escaped(rule.processName ?? "")}" /></label>
          <label class="wide-field"><span class="setting-label-text">웹사이트 또는 창 이름 ${settingsHelp("windowTitle")}</span><input name="rule-${index}-title" type="text" maxlength="200" placeholder="YouTube" value="${escaped(rule.windowTitle ?? "")}" /></label>
          <label><span class="setting-label-text">차단 전 대기 (초) ${settingsHelp("graceSeconds")}</span><input name="rule-${index}-grace" type="number" min="1" max="600" value="${rule.graceSeconds}" required /></label>
          <label><span class="setting-label-text">다시 검사 (초) ${settingsHelp("cooldownSeconds")}</span><input name="rule-${index}-cooldown" type="number" min="5" max="3600" value="${rule.cooldownSeconds}" required /></label>
        </article>`,
    )
    .join("");
}

function readRules(form: FormData, rules: DistractionRule[]): DistractionRule[] {
  return rules.map((rule, index) => ({
    id: rule.id,
    name: String(form.get(`rule-${index}-name`) ?? "").trim(),
    enabled: form.has(`rule-${index}-enabled`),
    processName: optionalValue(form, `rule-${index}-process`),
    windowTitle: optionalValue(form, `rule-${index}-title`),
    graceSeconds: numberValue(form, `rule-${index}-grace`),
    cooldownSeconds: numberValue(form, `rule-${index}-cooldown`),
  }));
}

function renderSettings(
  settings: Settings,
  emergencyShortcutAvailable: boolean,
  trayAvailable: boolean,
): void {
  let rules = settings.focusGuard.rules.map((rule) => ({ ...rule }));
  app!.innerHTML = `
    <main class="panel settings-panel">
      <section class="debug-document">
        <div class="debug-pane-title"><span>MigamDesktop.Settings</span><span aria-hidden="true">×</span></div>
        <div class="debug-command-line" aria-hidden="true"><span>0:000&gt;</span><span>.settings /local /schema:${settings.schemaVersion}</span><span class="debug-caret">_</span></div>
        <div class="settings-heading"><div><p class="eyebrow">MIGAM DESKTOP CONFIGURATION</p><h1>설정</h1></div><span class="debug-build">LOCAL · SCHEMA ${settings.schemaVersion}</span></div>
        ${emergencyShortcutAvailable ? "" : '<p class="warning" role="alert">Ctrl+Shift+F12 긴급 중지 단축키를 등록하지 못했습니다. 트레이의 긴급 중지 메뉴를 사용해 주세요.</p>'}
        ${trayAvailable ? "" : '<p class="warning" role="alert">시스템 트레이를 사용할 수 없습니다. 앱 창을 닫으면 복구 메뉴에 접근하지 못할 수 있습니다.</p>'}
        <form id="settings-form">
        <fieldset>
          <legend>펫</legend>
          <label><span class="setting-label-text">펫 크기 (%) ${settingsHelp("petSize")}</span><input name="visualScalePercent" type="number" min="50" max="200" value="${settings.pet.visualScalePercent}" /></label>
          <label><span class="setting-label-text">컴퓨터 상태에 따른 펫 반응 ${settingsHelp("resourceResponse")}</span>
            <select name="resourceResponseMode">
              <option value="off" ${settings.pet.resourceResponseMode === "off" ? "selected" : ""}>사용 안 함</option>
              <option value="cpu" ${settings.pet.resourceResponseMode === "cpu" ? "selected" : ""}>CPU 사용량</option>
              <option value="memory" ${settings.pet.resourceResponseMode === "memory" ? "selected" : ""}>메모리 사용량</option>
              <option value="combined" ${settings.pet.resourceResponseMode === "combined" ? "selected" : ""}>CPU와 메모리 중 높은 값</option>
            </select>
          </label>
          <p id="resource-status" class="detection-status" role="status">CPU --% · 메모리 --%</p>
          <label class="checkbox-row"><input name="automaticPhotoDeliveryEnabled" type="checkbox" ${settings.pet.automaticPhotoDeliveryEnabled ? "checked" : ""} /> <span class="setting-label-text">자동 사진 배달 ${settingsHelp("automaticPhotoDelivery")}</span></label>
        </fieldset>
        <fieldset>
          <legend>뽀모도로</legend>
          <label><span class="setting-label-text">집중 시간 (분) ${settingsHelp("focusMinutes")}</span><input name="focusMinutes" type="number" min="1" max="120" value="${settings.pomodoro.focusMinutes}" /></label>
          <label><span class="setting-label-text">짧은 휴식 (분) ${settingsHelp("shortBreakMinutes")}</span><input name="shortBreakMinutes" type="number" min="1" max="60" value="${settings.pomodoro.shortBreakMinutes}" /></label>
          <label><span class="setting-label-text">긴 휴식 (분) ${settingsHelp("longBreakMinutes")}</span><input name="longBreakMinutes" type="number" min="1" max="90" value="${settings.pomodoro.longBreakMinutes}" /></label>
          <label><span class="setting-label-text">긴 휴식 주기 (회) ${settingsHelp("longBreakCycle")}</span><input name="sessionsBeforeLongBreak" type="number" min="1" max="12" value="${settings.pomodoro.sessionsBeforeLongBreak}" /></label>
        </fieldset>
        <fieldset>
          <legend>집중 보호</legend>
          <label class="checkbox-row"><input name="interventionEnabled" type="checkbox" ${settings.focusGuard.interventionEnabled ? "checked" : ""} ${rules.length === 0 ? "disabled" : ""} /> <span class="setting-label-text">집중 중 방해 앱 감지 ${settingsHelp("intervention")}</span></label>
          <p class="muted">일치 상태가 유예 시간 동안 유지되면 왼쪽에서 네모 캐릭터가 날아와 창을 최소화합니다. 브라우저 사이트는 창 제목 문자열만 확인합니다.</p>
          <p id="detection-status" class="detection-status" role="status">집중 시작 전 · 감지 대기</p>
        </fieldset>
        <section class="rules-section" aria-labelledby="rules-heading">
          <div class="section-heading"><h2 id="rules-heading">방해 규칙</h2><button id="add-rule" class="secondary" type="button">규칙 추가</button></div>
          <div id="rule-list" class="rule-list">${ruleRows(rules)}</div>
          <p class="muted">앱 실행 파일과 웹사이트 또는 창 이름 중 하나 이상을 입력하세요. 둘 다 입력하면 두 조건이 모두 맞아야 합니다.</p>
        </section>
          <div class="actions"><button type="submit">설정 적용</button><span id="save-status" role="status"></span></div>
        </form>
      </section>
      <div class="debug-statusbar"><span>Configuration ready</span><span>Ctrl+Shift+F12 · EMERGENCY STOP</span></div>
    </main>
  `;

  const form = document.querySelector<HTMLFormElement>("#settings-form");
  const status = document.querySelector<HTMLSpanElement>("#save-status");
  const ruleList = document.querySelector<HTMLDivElement>("#rule-list");
  const intervention = form?.elements.namedItem("interventionEnabled") as HTMLInputElement | null;
  const redrawRules = (): void => {
    if (ruleList) ruleList.innerHTML = ruleRows(rules);
    if (intervention) {
      intervention.disabled = rules.length === 0;
      if (rules.length === 0) intervention.checked = false;
    }
  };
  document.querySelector("#add-rule")?.addEventListener("click", () => {
    if (form) rules = readRules(new FormData(form), rules);
    rules.push(createRule(rules.length));
    redrawRules();
  });
  ruleList?.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-remove-rule]");
    if (!button) return;
    if (form) rules = readRules(new FormData(form), rules);
    rules = rules.filter((rule) => rule.id !== button.dataset.removeRule);
    redrawRules();
  });
  const detectionStatus = document.querySelector<HTMLParagraphElement>("#detection-status");
  const resourceStatus = document.querySelector<HTMLParagraphElement>("#resource-status");
  const updateResourceStatus = (): void => {
    void invoke<SystemMetricsState>("get_system_metrics").then((metrics) => {
      if (resourceStatus) {
        resourceStatus.textContent = `CPU ${metrics.cpuPercent}% · 메모리 ${metrics.memoryPercent}%`;
      }
    }).catch(() => {
      if (resourceStatus) resourceStatus.textContent = "시스템 사용량을 읽지 못했습니다";
    });
  };
  updateResourceStatus();
  const resourceStatusTimer = window.setInterval(updateResourceStatus, 1_000);
  window.addEventListener("pagehide", () => window.clearInterval(resourceStatusTimer), { once: true });
  const showDetection = (detection: DetectionState): void => {
    if (!detectionStatus) return;
    const rule = rules.find((candidate) => candidate.id === detection.ruleId);
    detectionStatus.textContent = detection.matched
      ? `일치 감지됨${rule ? ` · ${rule.name}` : ""}`
      : "일치하는 전경 창 없음";
    detectionStatus.classList.toggle("matched", detection.matched);
  };
  void invoke<DetectionState>("get_detection_state").then(showDetection).catch(() => undefined);
  void listen<DetectionState>("focus://detection", (event) => showDetection(event.payload)).then(
    (unlisten) => window.addEventListener("pagehide", unlisten, { once: true }),
  );
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(form);
    rules = readRules(values, rules);
    const next: Settings = {
      ...settings,
      pet: {
        visualScalePercent: numberValue(values, "visualScalePercent"),
        resourceResponseMode: String(values.get("resourceResponseMode")) as ResourceResponseMode,
        automaticPhotoDeliveryEnabled: values.has("automaticPhotoDeliveryEnabled"),
      },
      pomodoro: {
        focusMinutes: numberValue(values, "focusMinutes"),
        shortBreakMinutes: numberValue(values, "shortBreakMinutes"),
        longBreakMinutes: numberValue(values, "longBreakMinutes"),
        sessionsBeforeLongBreak: numberValue(values, "sessionsBeforeLongBreak"),
      },
      focusGuard: {
        interventionEnabled: values.has("interventionEnabled") && rules.length > 0,
        rules,
      },
    };
    try {
      settings = await invoke<Settings>("save_settings", { settings: next });
      if (status) status.textContent = "저장했습니다.";
    } catch {
      if (status) status.textContent = "저장하지 못했습니다. 입력값을 확인해 주세요.";
    }
  });
}

async function start(): Promise<void> {
  if (windowLabel === "pet") {
    renderPet();
    return;
  }
  if (windowLabel === "card") {
    renderKick();
    return;
  }
  if (windowLabel === "timer") {
    renderTimer();
    return;
  }
  if (windowLabel === "todo") {
    void mountTodo(app!).then((cleanup) => {
      window.addEventListener("pagehide", cleanup, { once: true });
    });
    return;
  }
  if (windowLabel === "gamcha") {
    renderGamcha();
    return;
  }
  if (windowLabel === "gamcha-notice") {
    renderGamchaNotice();
    return;
  }
  if (windowLabel === "pet-menu") {
    void mountPetContextMenu(app!).then((cleanup) => {
      window.addEventListener("pagehide", cleanup, { once: true });
    });
    return;
  }
  if (windowLabel === "photo-delivery") {
    void mountPhotoDelivery(app!).then((cleanup) => {
      window.addEventListener("pagehide", cleanup, { once: true });
    });
    return;
  }
  if (windowLabel === "climb-rope") {
    mountClimbRope(app!);
    return;
  }
  let bootstrap: BootstrapState;
  try {
    bootstrap = await invokeWhenReady<BootstrapState>("get_bootstrap_state");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Failed to load desktop pet settings", error);
    app!.innerHTML = `<main class="panel"><h1>설정을 불러오지 못했습니다.</h1><p class="muted">설정 데이터 요청 실패: ${escaped(detail)}</p></main>`;
    return;
  }
  try {
    renderSettings(
      bootstrap.settings,
      bootstrap.emergencyShortcutAvailable,
      bootstrap.trayAvailable,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Failed to render desktop pet settings", error);
    app!.innerHTML = `<main class="panel"><h1>설정을 불러오지 못했습니다.</h1><p class="muted">설정 화면 생성 실패: ${escaped(detail)}</p></main>`;
  }
}

void start();

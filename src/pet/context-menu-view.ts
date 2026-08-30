import { invoke } from "@tauri-apps/api/core";
import {
  contextUtilityCommand,
  developmentTestFeatures,
  showUtilityThenHideMenu,
} from "./context-menu-actions";
import { invokeWhenReady } from "../tauri/invoke-when-ready";
import { listen } from "@tauri-apps/api/event";
import type { SystemMetricsState } from "../contracts";
import { formatRemaining, timerControls, type TimerState } from "../timer/timer-view";

interface GamchaState { tickets: number; }

const phaseLabels: Record<TimerState["phase"], string> = {
  stopped: "READY",
  focus: "FOCUS",
  shortBreak: "BREAK",
  longBreak: "LONG BREAK",
  paused: "PAUSED",
};

export async function mountPetContextMenu(container: HTMLElement): Promise<() => void> {
  const testCommandMarkup = developmentTestFeatures(import.meta.env.DEV).contextMenu
    .map(({ action, shortcut, label, detail }) =>
      `<button type="button" data-action="${action}"><kbd>${shortcut}</kbd><span>${label}</span><small>${detail}</small></button>`,
    )
    .join("");
  container.innerHTML = `
    <main class="pet-command" aria-label="감자봇 명령 메뉴">
      <header class="pet-command-title"><span>MigamDesktop.Command</span><button type="button" data-close aria-label="닫기">×</button></header>
      <div class="pet-command-tabs" aria-hidden="true"><span class="active">Home</span><span>Focus</span><span>System</span></div>
      <section class="pet-command-status" aria-label="현재 상태">
        <div><small>TIMER</small><strong id="command-timer">READY --:--</strong></div>
        <div><small>SYSTEM</small><strong id="command-system">CPU --% · MEM --%</strong></div>
        <div><small>GAMCHA</small><strong id="command-ticket">TICKET 0</strong></div>
      </section>
      <div class="pet-command-line"><span>0:000&gt;</span><span>select command_</span></div>
      <nav class="pet-command-list" aria-label="명령">
        <button type="button" data-action="gamcha"><kbd>G</kbd><span>GAMCHA!</span><small>보상·옷장</small></button>
        ${testCommandMarkup}
        <button type="button" data-action="timer"><kbd>T</kbd><span>타이머 표시</span><small>SHOW</small></button>
        <button type="button" data-action="todo"><kbd>✓</kbd><span>투두리스트</span><small>TODAY</small></button>
        <button type="button" data-action="start"><kbd>F5</kbd><span>집중 시작</span><small>RUN</small></button>
        <button type="button" data-action="pause"><kbd>F6</kbd><span>일시정지</span><small>BREAK</small></button>
        <button type="button" data-action="resume"><kbd>F7</kbd><span>재개</span><small>CONTINUE</small></button>
        <button type="button" data-action="stop"><kbd>■</kbd><span>타이머 중지</span><small>STOP</small></button>
        <div class="pet-command-separator"></div>
        <button type="button" data-action="settings"><kbd>⚙</kbd><span>설정</span><small>CONFIG</small></button>
        <button type="button" data-action="emergency" class="danger"><kbd>!</kbd><span>긴급 중지</span><small>CTRL+SHIFT+F12</small></button>
        <button type="button" data-action="restart"><kbd>↻</kbd><span>펫 다시 시작</span><small>RESET</small></button>
        <div class="pet-command-separator"></div>
        <button type="button" data-action="quit"><kbd>×</kbd><span>종료</span><small>EXIT</small></button>
      </nav>
      <footer><span id="command-footer">Command ready</span><span>LOCAL</span></footer>
    </main>`;

  const timerStatus = container.querySelector<HTMLElement>("#command-timer")!;
  const systemStatus = container.querySelector<HTMLElement>("#command-system")!;
  const ticketStatus = container.querySelector<HTMLElement>("#command-ticket")!;
  const footer = container.querySelector<HTMLElement>("#command-footer")!;
  let disposed = false;

  const hide = (): Promise<unknown> => invoke("hide_utility_window", { label: "pet-menu" });
  const renderTimer = (state: TimerState): void => {
    timerStatus.textContent = `${phaseLabels[state.phase]} ${formatRemaining(state.remainingSeconds)}`;
    const controls = timerControls(state.phase);
    const availability: Record<string, boolean> = {
      start: controls.start,
      pause: controls.pause,
      resume: controls.resume,
      stop: controls.stop,
    };
    for (const [action, enabled] of Object.entries(availability)) {
      const button = container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (button) button.disabled = !enabled;
    }
  };
  const pollMetrics = (): void => {
    void invoke<SystemMetricsState>("get_system_metrics").then((state) => {
      if (!disposed) systemStatus.textContent = `CPU ${state.cpuPercent}% · MEM ${state.memoryPercent}%`;
    }).catch(() => {
      if (!disposed) systemStatus.textContent = "CPU --% · MEM --%";
    });
  };
  const runAction = async (action: string): Promise<void> => {
    footer.textContent = `Executing ${action}...`;
    const utility = contextUtilityCommand(action);
    if (utility) {
      await showUtilityThenHideMenu(
        action,
        async () => {
          if (utility.command === "toggle_timer_bubble") {
            await invoke(utility.command);
          } else {
            await invoke(utility.command, { label: utility.label });
          }
        },
        async () => { await hide(); },
      );
      return;
    }
    await hide().catch(() => undefined);
    if (action === "start") {
      await invoke("start_focus");
      await invoke("show_utility_window", { label: "timer" });
    } else if (action === "pause") await invoke("pause_timer");
    else if (action === "resume") await invoke("resume_timer");
    else if (action === "stop") await invoke("stop_timer");
    else if (action === "emergency") await invoke("emergency_stop");
    else if (action === "restart") await invoke("resume_pet");
    else if (action === "quit") await invoke("quit_application");
  };

  container.addEventListener("click", (event) => {
    if ((event.target as Element).closest("[data-close]")) {
      void hide();
      return;
    }
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-action]");
    if (button && !button.disabled) {
      void runAction(button.dataset.action ?? "").catch(() => { footer.textContent = "Command failed"; });
    }
  });
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") void hide(); });
  window.addEventListener("contextmenu", (event) => event.preventDefault());

  const [initialTimer, initialGamcha] = await Promise.all([
    invokeWhenReady<TimerState>("get_timer_state"),
    invokeWhenReady<GamchaState>("get_gamcha_state"),
  ]);
  renderTimer(initialTimer);
  ticketStatus.textContent = `TICKET ${initialGamcha.tickets}`;
  pollMetrics();
  const metricTimer = window.setInterval(pollMetrics, 1_000);
  const unlistenTimer = await listen<TimerState>("timer://state", ({ payload }) => renderTimer(payload));
  const unlistenGamcha = await listen<GamchaState>("gamcha://ticket-earned", ({ payload }) => {
    ticketStatus.textContent = `TICKET ${payload.tickets}`;
  });
  return () => {
    disposed = true;
    window.clearInterval(metricTimer);
    unlistenTimer();
    unlistenGamcha();
  };
}

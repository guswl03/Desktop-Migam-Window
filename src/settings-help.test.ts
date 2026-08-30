import { describe, expect, it } from "vitest";
import { settingsHelp } from "./settings-help";

describe("settings help", () => {
  it("renders an accessible hover and focus explanation", () => {
    const markup = settingsHelp("petSize");
    expect(markup).toContain('class="settings-help"');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain("기본값은 100");
  });

  it("explains what users should enter for distraction rules", () => {
    expect(settingsHelp("processName")).toContain("chrome.exe");
    expect(settingsHelp("windowTitle")).toContain("YouTube");
    expect(settingsHelp("graceSeconds")).toContain("최소화하기 전");
  });

  it("explains the window climbing switch in user-facing terms", () => {
    let markup = "";

    expect(() => {
      markup = settingsHelp("windowClimbing" as Parameters<typeof settingsHelp>[0]);
    }).not.toThrow();
    expect(markup).toContain("창을 만나면");
    expect(markup).toContain("위로 올라");
  });
});

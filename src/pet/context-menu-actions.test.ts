import { describe, expect, it, vi } from "vitest";
import * as contextMenuActions from "./context-menu-actions";
import { contextUtilityCommand, showUtilityThenHideMenu } from "./context-menu-actions";

describe("pet context menu utility actions", () => {
  it("exposes test controls only in development builds", () => {
    const developmentTestFeatures = Reflect.get(
      contextMenuActions,
      "developmentTestFeatures",
    );

    expect(developmentTestFeatures).toBeTypeOf("function");
    expect(developmentTestFeatures(true)).toEqual({
      contextMenu: [
        { action: "photo", shortcut: "P", label: "사진 배달 테스트", detail: "DELIVER" },
        { action: "battery", shortcut: "B", label: "저전력 이벤트 테스트", detail: "20%" },
      ],
      settings: [
        { action: "rare-photo", label: "희귀 사진 이스터에그 테스트" },
      ],
    });
    expect(developmentTestFeatures(false)).toEqual({
      contextMenu: [],
      settings: [],
    });
  });

  it("shows the requested window before hiding the command menu", async () => {
    const calls: string[] = [];
    const show = vi.fn(async (label: string) => { calls.push(`show:${label}`); });
    const hide = vi.fn(async () => { calls.push("hide"); });

    await showUtilityThenHideMenu("settings", show, hide);

    expect(calls).toEqual(["show:settings", "hide"]);
  });

  it("keeps the command menu visible when opening the window fails", async () => {
    const show = vi.fn(async () => { throw new Error("show failed"); });
    const hide = vi.fn(async () => undefined);

    await expect(showUtilityThenHideMenu("settings", show, hide)).rejects.toThrow("show failed");
    expect(hide).not.toHaveBeenCalled();
  });
  it("toggles the timer bubble instead of always showing it", () => {
    expect(contextUtilityCommand("timer")).toEqual({ command: "toggle_timer_bubble" });
    expect(contextUtilityCommand("settings")).toEqual({ command: "show_utility_window", label: "settings" });
  });
});

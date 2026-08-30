import { describe, expect, it, vi } from "vitest";
import * as contextMenuActions from "./context-menu-actions";
import { contextUtilityCommand, showUtilityThenHideMenu } from "./context-menu-actions";

describe("pet context menu utility actions", () => {
  it("does not expose test controls in any build", () => {
    const developmentTestFeatures = Reflect.get(
      contextMenuActions,
      "developmentTestFeatures",
    );

    expect(developmentTestFeatures).toBeTypeOf("function");
    expect(developmentTestFeatures(true)).toEqual({
      contextMenu: [],
      settings: [],
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

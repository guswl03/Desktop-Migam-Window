export type ContextUtilityCommand =
  | { command: "toggle_timer_bubble" }
  | { command: "show_utility_window"; label: string };

export interface DevelopmentTestFeatures {
  contextMenu: Array<{
    action: "photo" | "battery";
    shortcut: string;
    label: string;
    detail: string;
  }>;
  settings: Array<{
    action: "rare-photo";
    label: string;
  }>;
}

export function developmentTestFeatures(isDevelopment: boolean): DevelopmentTestFeatures {
  void isDevelopment;
  return { contextMenu: [], settings: [] };
}

export function contextUtilityCommand(action: string): ContextUtilityCommand | null {
  if (action === "timer") return { command: "toggle_timer_bubble" };
  if (["gamcha", "todo", "settings"].includes(action)) {
    return { command: "show_utility_window", label: action };
  }
  return null;
}
export async function showUtilityThenHideMenu(
  label: string,
  showUtility: (label: string) => Promise<void>,
  hideMenu: () => Promise<void>,
): Promise<void> {
  await showUtility(label);
  await hideMenu().catch(() => undefined);
}

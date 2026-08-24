import type { BatteryState } from "../contracts";

export const LOW_BATTERY_TRIGGER_PERCENT = 20;
export const LOW_BATTERY_REARM_PERCENT = 25;

export function shouldTriggerLowBatteryEvent(state: BatteryState, armed: boolean): boolean {
  return armed
    && state.present
    && !state.charging
    && state.percent !== undefined
    && state.percent <= LOW_BATTERY_TRIGGER_PERCENT;
}

export function shouldRearmLowBatteryEvent(state: BatteryState): boolean {
  return state.charging
    || state.percent === undefined
    || state.percent >= LOW_BATTERY_REARM_PERCENT;
}

export function nearestScreenSide(
  petCenterX: number,
  workAreaCenterX: number,
): "left" | "right" {
  return petCenterX <= workAreaCenterX ? "left" : "right";
}

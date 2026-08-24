import { describe, expect, it } from "vitest";
import {
  nearestScreenSide,
  shouldRearmLowBatteryEvent,
  shouldTriggerLowBatteryEvent,
} from "./battery-event";

describe("low battery event", () => {
  it("triggers once at 20 percent or below while discharging", () => {
    expect(shouldTriggerLowBatteryEvent({ present: true, percent: 20, charging: false }, true)).toBe(true);
    expect(shouldTriggerLowBatteryEvent({ present: true, percent: 19, charging: true }, true)).toBe(false);
    expect(shouldTriggerLowBatteryEvent({ present: false, charging: false }, true)).toBe(false);
    expect(shouldTriggerLowBatteryEvent({ present: true, percent: 10, charging: false }, false)).toBe(false);
  });

  it("rearms after charging or recovering to 25 percent", () => {
    expect(shouldRearmLowBatteryEvent({ present: true, percent: 21, charging: false })).toBe(false);
    expect(shouldRearmLowBatteryEvent({ present: true, percent: 25, charging: false })).toBe(true);
    expect(shouldRearmLowBatteryEvent({ present: true, percent: 12, charging: true })).toBe(true);
  });

  it("chooses the nearest work-area edge", () => {
    expect(nearestScreenSide(200, 960)).toBe("left");
    expect(nearestScreenSide(1_400, 960)).toBe("right");
  });
});

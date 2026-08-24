import { describe, expect, it } from "vitest";
import { resolveMusicReaction } from "./music-stage";

describe("YouTube Music stage", () => {
  it("enters while YouTube Music is open in Chrome", () => {
    expect(resolveMusicReaction(true, false, "idle")).toBe("enter");
  });

  it("does not interrupt focus or dragging", () => {
    expect(resolveMusicReaction(true, true, "timer")).toBe("hold");
    expect(resolveMusicReaction(true, false, "dragged")).toBe("hold");
    expect(resolveMusicReaction(true, false, "battery-trip")).toBe("hold");
  });

  it("leaves when music closes or a timer takes priority", () => {
    expect(resolveMusicReaction(false, false, "music")).toBe("leave");
    expect(resolveMusicReaction(true, true, "music")).toBe("leave");
  });
});

import { describe, expect, it } from "vitest";
import {
  advanceToward,
  clampPosition,
  getPositionBounds,
  getVisiblePositionBounds,
  pickHorizontalTarget,
  isPetMotionLocked,
  findClimbCollision,
  getSurfaceWalkingBounds,
  getClimbRopeGeometry,
  getClimbApproachY,
  getWindowJumpDuration,
  getWindowJumpPosition,
  getClimbContactX,
} from "./motion";

describe("pet motion", () => {
  it("keeps a normal pet window fully inside a work area", () => {
    const bounds = getPositionBounds(
      { x: -1920, y: 0, width: 1920, height: 1040 },
      { width: 256, height: 256 },
    );

    expect(bounds).toEqual({ minX: -1920, maxX: -256, minY: 0, maxY: 784 });
    expect(clampPosition({ x: -2500, y: 900 }, bounds)).toEqual({
      x: -1920,
      y: 784,
    });
  });

  it("keeps at least 24 pixels visible when a window is larger than the work area", () => {
    const bounds = getPositionBounds(
      { x: 0, y: 0, width: 100, height: 80 },
      { width: 200, height: 120 },
    );

    expect(bounds).toEqual({ minX: -176, maxX: 76, minY: -96, maxY: 56 });
  });

  it("allows dragging to an edge while preserving a 24 pixel recovery area", () => {
    const bounds = getVisiblePositionBounds(
      { x: 100, y: 50, width: 800, height: 600 },
      { width: 128, height: 128 },
    );

    expect(bounds).toEqual({ minX: -4, maxX: 876, minY: -54, maxY: 626 });
  });

  it("uses the fully visible floor line for walking, bouncing, and impact", () => {
    const bounds = getPositionBounds(
      { x: 0, y: 0, width: 1920, height: 1040 },
      { width: 128, height: 128 },
    );

    expect(bounds.maxY).toBe(912);
  });

  it("selects a far edge when a random target would barely move", () => {
    const target = pickHorizontalTarget(
      500,
      { minX: 0, maxX: 1000, minY: 0, maxY: 500 },
      0.52,
      96,
    );

    expect(target).toBe(1000);
  });

  it("does not overshoot a walking destination", () => {
    expect(advanceToward(10, 20, 100, 0.2)).toBe(20);
    expect(advanceToward(20, 0, 50, 0.1)).toBe(15);
  });

  it("locks pet activity only during focus or a paused focus", () => {
    expect(isPetMotionLocked("focus")).toBe(true);
    expect(isPetMotionLocked("paused")).toBe(true);
    expect(isPetMotionLocked("shortBreak")).toBe(false);
    expect(isPetMotionLocked("longBreak")).toBe(false);
    expect(isPetMotionLocked("stopped")).toBe(false);
  });

  it("moves a window jump along a slow raised arc", () => {
    expect(getWindowJumpDuration(800, 300)).toBe(1_650);
    expect(getWindowJumpDuration(800, 790)).toBe(1_111);
    expect(getWindowJumpPosition(
      { x: 100, y: 800 },
      { x: 240, y: 300 },
      0.5,
      80,
    )).toEqual({ x: 170, y: 470 });
  });

  it("detects a window wall crossed while walking to the right", () => {
    const collision = findClimbCollision(
      600,
      608,
      912,
      { width: 128, height: 128 },
      { x: 0, y: 0, width: 1920, height: 1040 },
      [{ windowId: "editor", x: 734, y: 300, width: 800, height: 740 }],
    );

    expect(collision?.surface.windowId).toBe("editor");
    expect(collision?.side).toBe("right");
  });

  it("detects the opposite wall while walking to the left", () => {
    const collision = findClimbCollision(
      900,
      892,
      912,
      { width: 128, height: 128 },
      { x: 0, y: 0, width: 1920, height: 1040 },
      [{ windowId: "browser", x: 200, y: 320, width: 698, height: 720 }],
    );

    expect(collision?.surface.windowId).toBe("browser");
    expect(collision?.side).toBe("left");
  });

  it("uses the highest window edge when multiple surfaces share the same wall", () => {
    const collision = findClimbCollision(
      600,
      608,
      912,
      { width: 128, height: 128 },
      { x: 0, y: 0, width: 1920, height: 1040 },
      [
        { windowId: "lower-overlay", x: 734, y: 328, width: 800, height: 712 },
        { windowId: "main-window", x: 734, y: 52, width: 800, height: 988 },
      ],
    );

    expect(collision?.surface.windowId).toBe("main-window");
    expect(collision?.surface.y).toBe(52);
  });

  it("ignores maximized and too-narrow surfaces", () => {
    expect(
      findClimbCollision(
        600,
        608,
        912,
        { width: 128, height: 128 },
        { x: 0, y: 0, width: 1920, height: 1040 },
        [
          { windowId: "maximized", x: 734, y: 0, width: 1186, height: 1040 },
          { windowId: "narrow", x: 734, y: 500, width: 100, height: 540 },
        ],
      ),
    ).toBeNull();
  });

  it("anchors walking bounds to the top of a supporting window", () => {
    expect(
      getSurfaceWalkingBounds(
        { windowId: "editor", x: 300, y: 420, width: 700, height: 500 },
        { width: 128, height: 128 },
      ),
    ).toEqual({ minX: 300, maxX: 872, minY: 292, maxY: 292 });
  });

  it("anchors a rope just outside either side of a window", () => {
    const surface = { windowId: "editor", x: 300, y: 420, width: 700, height: 500 };
    expect(getClimbRopeGeometry(surface, "right", 800, { width: 128, height: 128 }))
      .toEqual({ x: 286, top: 424, bottom: 877 });
    expect(getClimbRopeGeometry(surface, "left", 800, { width: 128, height: 128 }))
      .toEqual({ x: 1014, top: 424, bottom: 877 });
  });

  it("keeps the character hand aligned with the rope at different DPI sizes", () => {
    const surface = { windowId: "editor", x: 300, y: 420, width: 700, height: 500 };
    expect(getClimbContactX(surface, "right", { width: 128, height: 128 })).toBe(199);
    expect(getClimbContactX(surface, "right", { width: 160, height: 160 })).toBe(173);
    expect(getClimbContactX(surface, "left", { width: 160, height: 160 })).toBe(967);
  });

  it("finishes rope climbing when the upper hand reaches the window hook", () => {
    const surface = { windowId: "editor", x: 300, y: 420, width: 700, height: 500 };
    expect(getClimbApproachY(surface, { width: 128, height: 128 })).toBe(347);
    expect(getClimbRopeGeometry(surface, "right", 292, { width: 128, height: 128 }))
      .toEqual({ x: 286, top: 424, bottom: 448 });
  });
});

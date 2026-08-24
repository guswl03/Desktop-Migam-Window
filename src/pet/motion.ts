import type { WindowSurface } from "../contracts";
export type { WindowSurface } from "../contracts";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WorkArea extends Point, Size {}

export type ClimbSide = "left" | "right";

export interface ClimbCollision {
  surface: WindowSurface;
  side: ClimbSide;
}

export interface ClimbRopeGeometry {
  x: number;
  top: number;
  bottom: number;
}

export interface PositionBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function getPositionBounds(
  workArea: WorkArea,
  windowSize: Size,
  minimumVisiblePixels = 24,
): PositionBounds {
  const fitsHorizontally = windowSize.width <= workArea.width;
  const fitsVertically = windowSize.height <= workArea.height;

  return {
    minX: fitsHorizontally
      ? workArea.x
      : workArea.x - windowSize.width + minimumVisiblePixels,
    maxX: fitsHorizontally
      ? workArea.x + workArea.width - windowSize.width
      : workArea.x + workArea.width - minimumVisiblePixels,
    minY: fitsVertically
      ? workArea.y
      : workArea.y - windowSize.height + minimumVisiblePixels,
    maxY: fitsVertically
      ? workArea.y + workArea.height - windowSize.height
      : workArea.y + workArea.height - minimumVisiblePixels,
  };
}

export function getVisiblePositionBounds(
  workArea: WorkArea,
  windowSize: Size,
  minimumVisiblePixels = 24,
): PositionBounds {
  return {
    minX: workArea.x - windowSize.width + minimumVisiblePixels,
    maxX: workArea.x + workArea.width - minimumVisiblePixels,
    minY: workArea.y - windowSize.height + minimumVisiblePixels,
    maxY: workArea.y + workArea.height - minimumVisiblePixels,
  };
}

export function clampPosition(position: Point, bounds: PositionBounds): Point {
  return {
    x: clamp(position.x, bounds.minX, bounds.maxX),
    y: clamp(position.y, bounds.minY, bounds.maxY),
  };
}

export function pickHorizontalTarget(
  currentX: number,
  bounds: PositionBounds,
  randomValue: number,
  minimumTravelPixels = 96,
): number {
  const normalizedRandom = clamp(randomValue, 0, 1);
  const candidate = bounds.minX + (bounds.maxX - bounds.minX) * normalizedRandom;

  if (Math.abs(candidate - currentX) >= minimumTravelPixels) {
    return candidate;
  }

  const distanceToLeft = Math.abs(currentX - bounds.minX);
  const distanceToRight = Math.abs(bounds.maxX - currentX);
  return distanceToLeft > distanceToRight ? bounds.minX : bounds.maxX;
}

export function advanceToward(
  current: number,
  target: number,
  speedPixelsPerSecond: number,
  deltaSeconds: number,
): number {
  const distance = target - current;
  const maximumStep = Math.max(0, speedPixelsPerSecond * deltaSeconds);

  if (Math.abs(distance) <= maximumStep) {
    return target;
  }

  return current + Math.sign(distance) * maximumStep;
}

export function getWindowJumpDuration(startY: number, targetY: number): number {
  return Math.min(2_200, Math.max(1_100, 1_100 + Math.abs(targetY - startY) * 1.1));
}

export function getWindowJumpPosition(
  start: Point,
  target: Point,
  progress: number,
  arcHeight: number,
): Point {
  const normalized = Math.min(Math.max(progress, 0), 1);
  const eased = normalized * normalized * (3 - 2 * normalized);
  return {
    x: start.x + (target.x - start.x) * eased,
    y:
      start.y +
      (target.y - start.y) * eased -
      Math.sin(Math.PI * normalized) * arcHeight,
  };
}

export function getSurfaceWalkingBounds(
  surface: WindowSurface,
  windowSize: Size,
  workArea?: WorkArea,
): PositionBounds | null {
  const minimumX = Math.max(surface.x, workArea?.x ?? surface.x);
  const surfaceRight = surface.x + surface.width;
  const workAreaRight = workArea ? workArea.x + workArea.width : surfaceRight;
  const maximumX = Math.min(surfaceRight, workAreaRight) - windowSize.width;
  const surfaceY = Math.max(
    surface.y - windowSize.height,
    workArea?.y ?? surface.y - windowSize.height,
  );
  if (maximumX < minimumX) return null;
  if (workArea && surfaceY > workArea.y + workArea.height) {
    return null;
  }
  return {
    minX: minimumX,
    maxX: maximumX,
    minY: surfaceY,
    maxY: surfaceY,
  };
}

export function getClimbRopeGeometry(
  surface: WindowSurface,
  side: ClimbSide,
  petY: number,
  windowSize: Size,
): ClimbRopeGeometry {
  const frameInset = Math.round(windowSize.width * 0.11);
  return {
    x: side === "right"
      ? surface.x - frameInset
      : surface.x + surface.width + frameInset,
    top: surface.y + 4,
    // Overlap the sprite's own short rope through the lower hand. Its first
    // visible rope pixel moves between animation frames, so ending at only the
    // upper hand can expose a gap while climbing.
    bottom: Math.max(
      surface.y + 28,
      petY + Math.round(windowSize.height * 0.6),
    ),
  };
}

export function getClimbApproachY(surface: WindowSurface, windowSize: Size): number {
  return surface.y + 4 - Math.round(windowSize.height * 0.6);
}

export function getClimbContactX(
  surface: WindowSurface,
  side: ClimbSide,
  windowSize: Size,
): number {
  const wallOverlap = Math.round(windowSize.width * 0.32);
  const ropeGap = Math.round(windowSize.width * 0.11);
  return side === "right"
    ? surface.x - windowSize.width + wallOverlap - ropeGap
    : surface.x + surface.width - wallOverlap + ropeGap;
}

export function findClimbCollision(
  currentX: number,
  nextX: number,
  walkingY: number,
  windowSize: Size,
  workArea: WorkArea,
  surfaces: WindowSurface[],
  supportWindowId: string | null = null,
): ClimbCollision | null {
  const direction = Math.sign(nextX - currentX);
  if (direction === 0) return null;

  const petBottom = walkingY + windowSize.height;
  const minimumWallBottom = walkingY + 24;
  const minimumClimbHeight = 32;
  const candidates = surfaces.filter((surface) => {
    if (surface.windowId === supportWindowId) return false;
    if (surface.width < windowSize.width + 16) return false;
    if (surface.y <= workArea.y + 4) return false;
    if (surface.y > petBottom - minimumClimbHeight) return false;
    if (surface.y + surface.height < minimumWallBottom) return false;
    if (surface.x + surface.width <= workArea.x) return false;
    if (surface.x >= workArea.x + workArea.width) return false;

    if (direction > 0) {
      const currentRight = currentX + windowSize.width;
      const nextRight = nextX + windowSize.width;
      return currentRight <= surface.x + 6 && nextRight >= surface.x - 6;
    }

    const surfaceRight = surface.x + surface.width;
    return currentX >= surfaceRight - 6 && nextX <= surfaceRight + 6;
  });

  if (candidates.length === 0) return null;
  if (direction > 0) {
    candidates.sort((left, right) => left.x - right.x || left.y - right.y);
    return { surface: candidates[0], side: "right" };
  }
  candidates.sort(
    (left, right) =>
      right.x + right.width - (left.x + left.width) || left.y - right.y,
  );
  return { surface: candidates[0], side: "left" };
}
export type PetTimerPhase = "stopped" | "focus" | "shortBreak" | "longBreak" | "paused";

export function isPetMotionLocked(phase: PetTimerPhase): boolean {
  return phase === "focus" || phase === "paused";
}

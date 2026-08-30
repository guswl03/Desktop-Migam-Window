import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import {
  availableMonitors,
  currentMonitor,
  cursorPosition,
  getCurrentWindow,
  monitorFromPoint,
  PhysicalPosition,
  primaryMonitor,
  type Monitor,
  type PhysicalSize,
} from "@tauri-apps/api/window";
import {
  advanceToward,
  clampPosition,
  findClimbCollision,
  getClimbApproachY,
  getPositionBounds,
  getClimbRopeGeometry,
  getClimbContactX,
  getSurfaceDeparture,
  getSurfaceStayDuration,
  getWindowJumpDuration,
  getWindowJumpPosition,
  getSurfaceWalkingBounds,
  getVisiblePositionBounds,
  isPetMotionLocked,
  pickHorizontalTarget,
  type Point,
  type PositionBounds,
  type ClimbSide,
  type WindowSurface,
  type WorkArea,
} from "./motion";
import {
  estimateThrowVelocity,
  isHardFloorImpact,
  stepThrow,
  type PointerSample,
  type ThrowState,
} from "./physics";
import type { PetAnimation, PetSprite } from "./sprite";
import { resolveMusicReaction } from "./music-stage";
import type {
  BatteryState,
  BootstrapState,
  Settings,
  SystemMetricsState,
} from "../contracts";
import { invokeWhenReady } from "../tauri/invoke-when-ready";
import {
  nearestScreenSide,
  shouldRearmLowBatteryEvent,
  shouldTriggerLowBatteryEvent,
} from "./battery-event";
import {
  resourceIdleAnimation,
  resourceMovementAnimation,
  resourceSpeedMultiplier as speedForMetrics,
  shouldRunContinuously,
} from "./resource-response";

const MOVEMENT_FPS = 30;
const WALK_SPEED_PIXELS_PER_SECOND = 92;
const ARRIVAL_TOLERANCE_PIXELS = 1;
const IDLE_MINIMUM_MILLISECONDS = 1_800;
const IDLE_RANGE_MILLISECONDS = 2_800;
const POINTER_SAMPLE_RETENTION_MILLISECONDS = 140;
const LANDING_ANIMATION_MILLISECONDS = 480;
const WINDOW_TUMBLE_ANIMATION_MILLISECONDS = 980;
const HARD_IMPACT_ANIMATION_MILLISECONDS = 1_000;
const CLIMB_SPEED_PIXELS_PER_SECOND = 118;
const PULL_UP_ANIMATION_MILLISECONDS = 760;
const SURFACE_REFRESH_MILLISECONDS = 220;
const ROPE_THROW_ANIMATION_MILLISECONDS = 600;
const ROPE_SYNC_MILLISECONDS = 70;
const BATTERY_POLL_MILLISECONDS = 5_000;
const BATTERY_ALERT_MILLISECONDS = 650;
const BATTERY_RETRIEVE_MILLISECONDS = 620;
const BATTERY_PRESENT_MILLISECONDS = 2_400;
const BATTERY_EXIT_SPEED = 330;
const BATTERY_RETURN_SPEED = 105;

interface IdleMode {
  kind: "idle";
  untilMilliseconds: number;
  supportWindowId: string | null;
}

interface WalkingMode {
  kind: "walking";
  x: number;
  targetX: number;
  groundY: number;
  bounds: PositionBounds;
  floorBounds: PositionBounds;
  windowSize: PhysicalSize;
  workArea: WorkArea;
  supportWindowId: string | null;
  surfaceExitSide: ClimbSide | null;
}

interface ClimbingMode {
  kind: "climbing";
  surfaceWindowId: string;
  side: ClimbSide;
  x: number;
  y: number;
  targetY: number;
  floorBounds: PositionBounds;
  windowSize: PhysicalSize;
  workArea: WorkArea;
}

interface RopeThrowMode {
  kind: "rope-throw";
  surfaceWindowId: string;
  side: ClimbSide;
  startedAtMilliseconds: number;
  x: number;
  y: number;
  targetY: number;
  floorBounds: PositionBounds;
  windowSize: PhysicalSize;
  workArea: WorkArea;
}

interface PullUpMode {
  kind: "pull-up";
  surfaceWindowId: string;
  side: ClimbSide;
  startedAtMilliseconds: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  durationMilliseconds?: number;
  arcHeight?: number;
  floorBounds: PositionBounds;
  windowSize: PhysicalSize;
  workArea: WorkArea;
}

interface DraggedMode {
  kind: "dragged";
  pointerId: number;
  interactionId: number;
  anchorCursor: Point | null;
  anchorWindow: Point | null;
  samples: PointerSample[];
}

interface ThrownMode {
  kind: "thrown";
  throwState: ThrowState;
  bounds: PositionBounds;
}

interface RecoveryMode {
  kind: "landing" | "hard-impact";
  untilMilliseconds: number;
  supportWindowId?: string | null;
}

interface TimerMode {
  kind: "timer";
  phase: "focus" | "shortBreak" | "longBreak" | "paused";
  supportWindowId: string | null;
}

interface MusicMode {
  kind: "music";
  supportWindowId: string | null;
}

interface BatteryTripMode {
  kind: "battery-trip";
  phase: "alert" | "exit" | "retrieve" | "return" | "present";
  side: "left" | "right";
  x: number;
  y: number;
  edgeX: number;
  returnX: number;
  phaseUntilMilliseconds: number;
  floorBounds: PositionBounds;
}

interface TimerSnapshot {
  phase: "stopped" | TimerMode["phase"];
}

type RuntimeMode =
  | IdleMode
  | WalkingMode
  | RopeThrowMode
  | ClimbingMode
  | PullUpMode
  | DraggedMode
  | ThrownMode
  | RecoveryMode
  | TimerMode
  | MusicMode
  | BatteryTripMode;

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function idleMode(
  nowMilliseconds = performance.now(),
  supportWindowId: string | null = null,
): IdleMode {
  return {
    kind: "idle",
    untilMilliseconds:
      nowMilliseconds +
      IDLE_MINIMUM_MILLISECONDS +
      Math.random() * IDLE_RANGE_MILLISECONDS,
    supportWindowId,
  };
}

function toWorkArea(monitor: Monitor): WorkArea {
  return {
    x: monitor.workArea.position.x,
    y: monitor.workArea.position.y,
    width: monitor.workArea.size.width,
    height: monitor.workArea.size.height,
  };
}

async function resolveMonitor(): Promise<Monitor | null> {
  const activeMonitor = await currentMonitor();
  if (activeMonitor) return activeMonitor;

  const preferredMonitor = await primaryMonitor();
  if (preferredMonitor) return preferredMonitor;

  return (await availableMonitors())[0] ?? null;
}

function appendPointerSample(
  samples: PointerSample[],
  point: Point,
  timeMilliseconds: number,
): void {
  samples.push({ ...point, timeMilliseconds });
  const oldestAllowedTime = timeMilliseconds - POINTER_SAMPLE_RETENTION_MILLISECONDS;
  while (samples.length > 2 && samples[0].timeMilliseconds < oldestAllowedTime) {
    samples.shift();
  }
}

export function startPetMotion(sprite: PetSprite): () => void {
  const petWindow = getCurrentWindow();
  let active = true;
  let mode: RuntimeMode = idleMode();
  let interactionId = 0;
  let timerActive = false;
  let youtubeMusicActive = false;
  let unlistenTimer: (() => void) | null = null;
  let unlistenTodo: (() => void) | null = null;
  let unlistenBatteryTest: (() => void) | null = null;
  let unlistenSettings: (() => void) | null = null;
  let celebrationTimer: number | undefined;
  let resourceSpeedMultiplier = 1;
  let latestSystemMetrics: SystemMetricsState = {
    cpuPercent: 0,
    memoryPercent: 0,
    mode: "off",
  };
  let climbableSurfaces: WindowSurface[] = [];
  let windowClimbingEnabled = true;
  let surfaceStay: {
    windowId: string;
    leaveAtMilliseconds: number;
  } | null = null;
  let lastAnimationFrameAt = performance.now();
  let lastRopeSyncAt = 0;
  let lastRopeGeometry = "";
  let musicStageExpanded = false;
  let lowBatteryArmed = true;
  let batteryEventPending = false;

  const keepPetAboveDesktopWindows = (): void => {
    void petWindow.setAlwaysOnTop(true).catch(() => undefined);
  };
  keepPetAboveDesktopWindows();
  const topmostTimer = window.setInterval(keepPetAboveDesktopWindows, 400);

  const animationTimer = window.setInterval(() => {
    const now = performance.now();
    const frameMilliseconds = mode.kind === "rope-throw"
      ? 150
      : mode.kind === "climbing"
        ? 135
        : 120 / resourceSpeedMultiplier;
    if (now - lastAnimationFrameAt >= frameMilliseconds) {
      sprite.advanceFrame();
      lastAnimationFrameAt = now;
    }
  }, 30);

  const hideClimbRope = (): void => {
    lastRopeGeometry = "";
    void invoke("hide_climb_rope").catch(() => undefined);
  };

  const setMode = (nextMode: RuntimeMode, animation: PetAnimation): void => {
    if (nextMode.kind !== "rope-throw" && nextMode.kind !== "climbing") {
      hideClimbRope();
    }
    mode = nextMode;
    const showMusicStage = nextMode.kind === "music";
    if (showMusicStage !== musicStageExpanded) {
      musicStageExpanded = showMusicStage;
      void invoke("set_music_stage_expanded", { expanded: showMusicStage })
        .catch(() => undefined);
    }
    sprite.element.parentElement?.classList.toggle(
      "youtube-music-stage",
      showMusicStage,
    );
    sprite.element.dataset.interaction = nextMode.kind;
    sprite.setAnimation(animation);
  };

  const findSurface = (windowId: string): WindowSurface | null =>
    climbableSurfaces.find((surface) => surface.windowId === windowId) ?? null;

  const syncClimbRope = (
    surface: WindowSurface,
    side: ClimbSide,
    petY: number,
    windowSize: PhysicalSize,
    revealProgress = 1,
    nowMilliseconds = performance.now(),
  ): void => {
    if (nowMilliseconds - lastRopeSyncAt < ROPE_SYNC_MILLISECONDS && revealProgress >= 1) {
      return;
    }
    const geometry = getClimbRopeGeometry(surface, side, petY, windowSize);
    const top = Math.round(geometry.top);
    const normalizedProgress = Math.min(Math.max(revealProgress, 0), 1);
    const key = `${Math.round(geometry.x)}:${top}:${Math.round(geometry.bottom)}:${Math.round(normalizedProgress * 100)}`;
    if (key === lastRopeGeometry) return;
    lastRopeSyncAt = nowMilliseconds;
    lastRopeGeometry = key;
    void invoke("show_climb_rope", {
      x: Math.round(geometry.x),
      top,
      bottom: Math.round(geometry.bottom),
      progress: normalizedProgress,
      side,
    }).catch(() => undefined);
  };

  const beginSurfaceFall = (
    position: Point,
    floorBounds: PositionBounds,
    horizontalVelocity = 0,
  ): void => {
    surfaceStay = null;
    setMode(
      {
        kind: "thrown",
        throwState: {
          position,
          velocity: { x: horizontalVelocity, y: 120 },
          elapsedSeconds: 0,
        },
        bounds: floorBounds,
      },
      "falling",
    );
  };

  const setDragBubbleVisibility = (dragging: boolean): void => {
    void emit("pet://drag-state", { dragging });
  };

  const beginDrag = async (event: PointerEvent): Promise<void> => {
    if (event.button !== 0 || timerActive || mode.kind === "battery-trip") return;
    event.preventDefault();
    surfaceStay = null;
    sprite.element.setPointerCapture(event.pointerId);

    const nextInteractionId = ++interactionId;
    const draggedMode: DraggedMode = {
      kind: "dragged",
      pointerId: event.pointerId,
      interactionId: nextInteractionId,
      anchorCursor: null,
      anchorWindow: null,
      samples: [],
    };
    setMode(draggedMode, "dragged");
    setDragBubbleVisibility(true);

    const [cursor, windowPosition] = await Promise.all([
      cursorPosition(),
      petWindow.outerPosition(),
    ]);
    if (mode !== draggedMode || draggedMode.interactionId !== interactionId) return;

    draggedMode.anchorCursor = cursor;
    draggedMode.anchorWindow = windowPosition;
    appendPointerSample(draggedMode.samples, cursor, performance.now());
  };

  const finishDrag = async (event: PointerEvent): Promise<void> => {
    if (mode.kind !== "dragged" || event.pointerId !== mode.pointerId) return;
    event.preventDefault();
    setDragBubbleVisibility(false);
    if (sprite.element.hasPointerCapture(event.pointerId)) {
      sprite.element.releasePointerCapture(event.pointerId);
    }

    const draggedMode = mode;
    const finishingInteractionId = draggedMode.interactionId;
    const cursor = await cursorPosition();
    appendPointerSample(draggedMode.samples, cursor, performance.now());
    if (
      mode !== draggedMode ||
      finishingInteractionId !== interactionId ||
      !active
    ) {
      return;
    }

    const velocity = estimateThrowVelocity(draggedMode.samples);
    if (!velocity) {
      setMode(idleMode(), "idle");
      return;
    }

    const [windowPosition, windowSize, monitor] = await Promise.all([
      petWindow.outerPosition(),
      petWindow.outerSize(),
      monitorFromPoint(cursor.x, cursor.y),
    ]);
    if (mode !== draggedMode || finishingInteractionId !== interactionId) return;

    const fallbackMonitor = monitor ?? (await resolveMonitor());
    if (!fallbackMonitor) {
      setMode(idleMode(), "idle");
      return;
    }

    setMode(
      {
        kind: "thrown",
        throwState: {
          position: windowPosition,
          velocity,
          elapsedSeconds: 0,
        },
        bounds: getPositionBounds(toWorkArea(fallbackMonitor), windowSize),
      },
      "thrown",
    );
  };

  const updateIdle = async (idle: IdleMode, nowMilliseconds: number): Promise<void> => {
    const surfaceStayExpired = Boolean(
      idle.supportWindowId &&
      surfaceStay?.windowId === idle.supportWindowId &&
      nowMilliseconds >= surfaceStay.leaveAtMilliseconds,
    );
    if (nowMilliseconds < idle.untilMilliseconds && !surfaceStayExpired) return;

    const monitor = await resolveMonitor();
    if (!monitor || mode !== idle) return;

    const [windowSize, windowPosition] = await Promise.all([
      petWindow.outerSize(),
      petWindow.outerPosition(),
    ]);
    if (mode !== idle) return;

    const workArea = toWorkArea(monitor);
    const floorBounds = getPositionBounds(workArea, windowSize);
    let bounds = floorBounds;
    let supportWindowId: string | null = null;
    if (idle.supportWindowId) {
      const surface = findSurface(idle.supportWindowId);
      const surfaceBounds = surface
        ? getSurfaceWalkingBounds(surface, windowSize, workArea)
        : null;
      if (!surface || !surfaceBounds) {
        beginSurfaceFall(windowPosition, floorBounds);
        return;
      }
      bounds = surfaceBounds;
      supportWindowId = surface.windowId;
    }

    const safePosition = clampPosition(windowPosition, bounds);
    const groundY = bounds.maxY;
    const departure = supportWindowId && surfaceStay?.windowId === supportWindowId
      ? getSurfaceDeparture(
          nowMilliseconds,
          surfaceStay.leaveAtMilliseconds,
          safePosition.x,
          bounds,
        )
      : null;
    const targetX = departure?.targetX ??
      pickHorizontalTarget(safePosition.x, bounds, Math.random(), 48);
    await petWindow.setPosition(
      new PhysicalPosition(Math.round(safePosition.x), Math.round(groundY)),
    );
    if (mode !== idle) return;

    const direction = targetX < safePosition.x ? "left" : "right";
    setMode(
      {
        kind: "walking",
        x: safePosition.x,
        targetX,
        groundY,
        bounds,
        floorBounds,
        windowSize,
        workArea,
        supportWindowId,
        surfaceExitSide: departure?.side ?? null,
      },
      resourceMovementAnimation(latestSystemMetrics, direction),
    );
  };

  const updateWalking = async (
    walking: WalkingMode,
    deltaSeconds: number,
  ): Promise<void> => {
    if (walking.supportWindowId) {
      const surface = findSurface(walking.supportWindowId);
      const surfaceBounds = surface
        ? getSurfaceWalkingBounds(surface, walking.windowSize, walking.workArea)
        : null;
      if (!surface || !surfaceBounds) {
        beginSurfaceFall(
          { x: walking.x, y: walking.groundY },
          walking.floorBounds,
        );
        return;
      }
      walking.bounds = surfaceBounds;
      walking.groundY = surfaceBounds.maxY;
      walking.x = Math.min(Math.max(walking.x, surfaceBounds.minX), surfaceBounds.maxX);
      walking.targetX = Math.min(
        Math.max(walking.targetX, surfaceBounds.minX),
        surfaceBounds.maxX,
      );
      if (walking.surfaceExitSide) {
        walking.targetX = walking.surfaceExitSide === "left"
          ? surfaceBounds.minX
          : surfaceBounds.maxX;
      } else if (surfaceStay?.windowId === walking.supportWindowId) {
        const departure = getSurfaceDeparture(
          performance.now(),
          surfaceStay.leaveAtMilliseconds,
          walking.x,
          surfaceBounds,
        );
        if (departure) {
          walking.surfaceExitSide = departure.side;
          walking.targetX = departure.targetX;
        }
      }
    }

    const nextX = advanceToward(
      walking.x,
      walking.targetX,
      WALK_SPEED_PIXELS_PER_SECOND,
      deltaSeconds * resourceSpeedMultiplier,
    );
    if (mode !== walking) return;

    const collision = findClimbCollision(
      walking.x,
      nextX,
      walking.groundY,
      walking.windowSize,
      walking.workArea,
      climbableSurfaces,
      walking.supportWindowId,
      windowClimbingEnabled && walking.surfaceExitSide === null,
    );
    if (collision) {
      const surfaceBounds = getSurfaceWalkingBounds(
        collision.surface,
        walking.windowSize,
        walking.workArea,
      );
      if (!surfaceBounds) return;
      const targetX = collision.side === "right"
        ? Math.min(surfaceBounds.maxX, surfaceBounds.minX + 8)
        : Math.max(surfaceBounds.minX, surfaceBounds.maxX - 8);
      const targetY = surfaceBounds.maxY;
      const verticalDistance = Math.abs(targetY - walking.groundY);
      const windowJump: PullUpMode = {
        kind: "pull-up",
        surfaceWindowId: collision.surface.windowId,
        side: collision.side,
        startedAtMilliseconds: performance.now(),
        startX: walking.x,
        startY: walking.groundY,
        targetX,
        targetY,
        durationMilliseconds: getWindowJumpDuration(walking.groundY, targetY),
        arcHeight: Math.min(120, Math.max(44, walking.windowSize.height * 0.32 + verticalDistance * 0.06)),
        floorBounds: walking.floorBounds,
        windowSize: walking.windowSize,
        workArea: walking.workArea,
      };
      setMode(windowJump, "jumping");
      return;
    }

    walking.x = nextX;

    await petWindow.setPosition(
      new PhysicalPosition(Math.round(walking.x), Math.round(walking.groundY)),
    );
    if (mode !== walking) return;

    if (Math.abs(walking.targetX - walking.x) <= ARRIVAL_TOLERANCE_PIXELS) {
      if (walking.surfaceExitSide) {
        const horizontalVelocity = walking.surfaceExitSide === "left"
          ? -WALK_SPEED_PIXELS_PER_SECOND
          : WALK_SPEED_PIXELS_PER_SECOND;
        beginSurfaceFall(
          { x: walking.x, y: walking.groundY },
          walking.floorBounds,
          horizontalVelocity,
        );
        return;
      }
      if (shouldRunContinuously(latestSystemMetrics)) {
        walking.targetX = pickHorizontalTarget(
          walking.x,
          walking.bounds,
          Math.random(),
          walking.supportWindowId ? 48 : 96,
        );
        const direction = walking.targetX < walking.x ? "left" : "right";
        sprite.setAnimation(resourceMovementAnimation(latestSystemMetrics, direction));
      } else {
        setMode(
          idleMode(performance.now(), walking.supportWindowId),
          resourceIdleAnimation(latestSystemMetrics),
        );
      }
    }
  };

  const updateRopeThrow = async (
    ropeThrow: RopeThrowMode,
    nowMilliseconds: number,
  ): Promise<void> => {
    const surface = findSurface(ropeThrow.surfaceWindowId);
    const surfaceBounds = surface
      ? getSurfaceWalkingBounds(surface, ropeThrow.windowSize, ropeThrow.workArea)
      : null;
    if (!surface || !surfaceBounds) {
      beginSurfaceFall({ x: ropeThrow.x, y: ropeThrow.y }, ropeThrow.floorBounds);
      return;
    }

    ropeThrow.x = getClimbContactX(surface, ropeThrow.side, ropeThrow.windowSize);
    ropeThrow.targetY = getClimbApproachY(surface, ropeThrow.windowSize);
    const progress = Math.min(
      1,
      (nowMilliseconds - ropeThrow.startedAtMilliseconds) /
        ROPE_THROW_ANIMATION_MILLISECONDS,
    );
    await petWindow.setPosition(
      new PhysicalPosition(Math.round(ropeThrow.x), Math.round(ropeThrow.y)),
    );
    if (mode !== ropeThrow) return;
    syncClimbRope(
      surface,
      ropeThrow.side,
      ropeThrow.y,
      ropeThrow.windowSize,
      progress,
      nowMilliseconds,
    );

    if (progress >= 1) {
      const climbing: ClimbingMode = {
        kind: "climbing",
        surfaceWindowId: ropeThrow.surfaceWindowId,
        side: ropeThrow.side,
        x: ropeThrow.x,
        y: ropeThrow.y,
        targetY: ropeThrow.targetY,
        floorBounds: ropeThrow.floorBounds,
        windowSize: ropeThrow.windowSize,
        workArea: ropeThrow.workArea,
      };
      setMode(
        climbing,
        climbing.side === "right" ? "climbing-right" : "climbing-left",
      );
    }
  };

  const updateClimbing = async (
    climbing: ClimbingMode,
    deltaSeconds: number,
  ): Promise<void> => {
    const surface = findSurface(climbing.surfaceWindowId);
    const surfaceBounds = surface
      ? getSurfaceWalkingBounds(surface, climbing.windowSize, climbing.workArea)
      : null;
    if (!surface || !surfaceBounds) {
      beginSurfaceFall(
        { x: climbing.x, y: climbing.y },
        climbing.floorBounds,
      );
      return;
    }

    climbing.x = getClimbContactX(surface, climbing.side, climbing.windowSize);
    climbing.targetY = getClimbApproachY(surface, climbing.windowSize);
    climbing.y = advanceToward(
      climbing.y,
      climbing.targetY,
      CLIMB_SPEED_PIXELS_PER_SECOND,
      deltaSeconds,
    );
    await petWindow.setPosition(
      new PhysicalPosition(Math.round(climbing.x), Math.round(climbing.y)),
    );
    if (mode !== climbing) return;
    syncClimbRope(surface, climbing.side, climbing.y, climbing.windowSize);

    if (Math.abs(climbing.y - climbing.targetY) <= ARRIVAL_TOLERANCE_PIXELS) {
      const targetX =
        climbing.side === "right"
          ? Math.min(surfaceBounds.maxX, surfaceBounds.minX + 8)
          : Math.max(surfaceBounds.minX, surfaceBounds.maxX - 8);
      const pullUp: PullUpMode = {
        kind: "pull-up",
        surfaceWindowId: surface.windowId,
        side: climbing.side,
        startedAtMilliseconds: performance.now(),
        startX: climbing.x,
        startY: climbing.y,
        targetX,
        targetY: surfaceBounds.maxY,
        floorBounds: climbing.floorBounds,
        windowSize: climbing.windowSize,
        workArea: climbing.workArea,
      };
      setMode(
        pullUp,
        climbing.side === "right" ? "pull-up-right" : "pull-up-left",
      );
    }
  };

  const updatePullUp = async (
    pullUp: PullUpMode,
    nowMilliseconds: number,
  ): Promise<void> => {
    const surface = findSurface(pullUp.surfaceWindowId);
    const surfaceBounds = surface
      ? getSurfaceWalkingBounds(surface, pullUp.windowSize, pullUp.workArea)
      : null;
    if (!surface || !surfaceBounds) {
      beginSurfaceFall(
        { x: pullUp.startX, y: pullUp.startY },
        pullUp.floorBounds,
      );
      return;
    }

    pullUp.targetX =
      pullUp.side === "right"
        ? Math.min(surfaceBounds.maxX, surfaceBounds.minX + 8)
        : Math.max(surfaceBounds.minX, surfaceBounds.maxX - 8);
    pullUp.targetY = surfaceBounds.maxY;
    const progress = Math.min(
      1,
      (nowMilliseconds - pullUp.startedAtMilliseconds) /
        (pullUp.durationMilliseconds ?? PULL_UP_ANIMATION_MILLISECONDS),
    );
    const position = getWindowJumpPosition(
      { x: pullUp.startX, y: pullUp.startY },
      { x: pullUp.targetX, y: pullUp.targetY },
      progress,
      pullUp.arcHeight ?? 0,
    );
    await petWindow.setPosition(
      new PhysicalPosition(Math.round(position.x), Math.round(position.y)),
    );
    if (mode !== pullUp) return;

    if (progress >= 1) {
      surfaceStay = {
        windowId: surface.windowId,
        leaveAtMilliseconds:
          performance.now() + getSurfaceStayDuration(Math.random()),
      };
      setMode(
        {
          kind: "landing",
          untilMilliseconds:
            performance.now() + WINDOW_TUMBLE_ANIMATION_MILLISECONDS,
          supportWindowId: surface.windowId,
        },
        "window-tumble",
      );
    }
  };

  const updateDragged = async (dragged: DraggedMode): Promise<void> => {
    if (!dragged.anchorCursor || !dragged.anchorWindow) return;

    const cursor = await cursorPosition();
    if (mode !== dragged) return;
    appendPointerSample(dragged.samples, cursor, performance.now());

    const monitor = (await monitorFromPoint(cursor.x, cursor.y)) ?? (await resolveMonitor());
    if (!monitor || mode !== dragged) return;

    const windowSize: PhysicalSize = await petWindow.outerSize();
    if (mode !== dragged) return;

    const desiredPosition = {
      x: dragged.anchorWindow.x + cursor.x - dragged.anchorCursor.x,
      y: dragged.anchorWindow.y + cursor.y - dragged.anchorCursor.y,
    };
    const safePosition = clampPosition(
      desiredPosition,
      getVisiblePositionBounds(toWorkArea(monitor), windowSize),
    );
    await petWindow.setPosition(
      new PhysicalPosition(Math.round(safePosition.x), Math.round(safePosition.y)),
    );
  };

  const updateThrown = async (thrown: ThrownMode, deltaSeconds: number): Promise<void> => {
    const result = stepThrow(thrown.throwState, deltaSeconds, thrown.bounds);
    thrown.throwState = result.state;
    if (mode !== thrown) return;

    await petWindow.setPosition(
      new PhysicalPosition(
        Math.round(result.state.position.x),
        Math.round(result.state.position.y),
      ),
    );
    if (mode !== thrown) return;

    if (isHardFloorImpact(result.floorImpactSpeed)) {
      setMode(
        {
          kind: "hard-impact",
          untilMilliseconds: performance.now() + HARD_IMPACT_ANIMATION_MILLISECONDS,
        },
        "hard-impact",
      );
      return;
    }

    if (result.complete) {
      setMode(
        {
          kind: "landing",
          untilMilliseconds: performance.now() + LANDING_ANIMATION_MILLISECONDS,
        },
        "landing",
      );
    }
  };

  const updateRecovery = (recovery: RecoveryMode, nowMilliseconds: number): void => {
    if (nowMilliseconds >= recovery.untilMilliseconds) {
      setMode(idleMode(nowMilliseconds, recovery.supportWindowId ?? null), "idle");
    }
  };

  const finishBatteryTrip = (trip: BatteryTripMode): void => {
    if (trip.y < trip.floorBounds.maxY - 1) {
      beginSurfaceFall({ x: trip.x, y: trip.y }, trip.floorBounds);
    } else if (youtubeMusicActive) {
      setMode({ kind: "music", supportWindowId: null }, "dancing");
    } else {
      setMode(idleMode(), "idle");
    }
  };

  const updateBatteryTrip = async (
    trip: BatteryTripMode,
    nowMilliseconds: number,
    deltaSeconds: number,
  ): Promise<void> => {
    if (trip.phase === "alert") {
      if (nowMilliseconds < trip.phaseUntilMilliseconds) return;
      trip.phase = "exit";
      sprite.setAnimation(trip.side === "left" ? "running-left" : "running-right");
    }

    if (trip.phase === "exit") {
      trip.x = advanceToward(trip.x, trip.edgeX, BATTERY_EXIT_SPEED, deltaSeconds);
      await petWindow.setPosition(new PhysicalPosition(Math.round(trip.x), Math.round(trip.y)));
      if (mode !== trip) return;
      if (Math.abs(trip.x - trip.edgeX) <= ARRIVAL_TOLERANCE_PIXELS) {
        trip.phase = "retrieve";
        trip.phaseUntilMilliseconds = nowMilliseconds + BATTERY_RETRIEVE_MILLISECONDS;
        sprite.setAnimation("battery-lift");
      }
      return;
    }

    if (trip.phase === "retrieve") {
      if (nowMilliseconds < trip.phaseUntilMilliseconds) return;
      trip.phase = "return";
      sprite.setAnimation("battery-carry");
    }

    if (trip.phase === "return") {
      trip.x = advanceToward(trip.x, trip.returnX, BATTERY_RETURN_SPEED, deltaSeconds);
      await petWindow.setPosition(new PhysicalPosition(Math.round(trip.x), Math.round(trip.y)));
      if (mode !== trip) return;
      if (Math.abs(trip.x - trip.returnX) <= ARRIVAL_TOLERANCE_PIXELS) {
        trip.phase = "present";
        trip.phaseUntilMilliseconds = nowMilliseconds + BATTERY_PRESENT_MILLISECONDS;
        sprite.setAnimation("battery-present");
      }
      return;
    }

    if (trip.phase === "present" && nowMilliseconds >= trip.phaseUntilMilliseconds) {
      finishBatteryTrip(trip);
    }
  };

  const startPendingBatteryEvent = async (): Promise<void> => {
    if (!batteryEventPending || timerActive) return;
    if (mode.kind !== "idle" && mode.kind !== "walking" && mode.kind !== "music") return;

    if (mode.kind === "music") {
      setMode(idleMode(), "idle");
      await delay(160);
    }
    if (!active || timerActive || (mode.kind !== "idle" && mode.kind !== "walking")) return;

    const [monitor, windowSize, position] = await Promise.all([
      resolveMonitor(),
      petWindow.outerSize(),
      petWindow.outerPosition(),
    ]);
    if (!monitor || !active || timerActive) return;
    if (mode.kind !== "idle" && mode.kind !== "walking") return;

    const workArea = toWorkArea(monitor);
    const side = nearestScreenSide(
      position.x + windowSize.width / 2,
      workArea.x + workArea.width / 2,
    );
    const floorBounds = getPositionBounds(workArea, windowSize);
    const edgeX = side === "left"
      ? workArea.x - windowSize.width + 18
      : workArea.x + workArea.width - 18;
    const returnX = side === "left"
      ? workArea.x + 92
      : workArea.x + workArea.width - windowSize.width - 92;
    batteryEventPending = false;
    interactionId += 1;
    setMode(
      {
        kind: "battery-trip",
        phase: "alert",
        side,
        x: position.x,
        y: position.y,
        edgeX,
        returnX,
        phaseUntilMilliseconds: performance.now() + BATTERY_ALERT_MILLISECONDS,
        floorBounds,
      },
      "battery-alert",
    );
  };

  const run = async (): Promise<void> => {
    let previousTime = performance.now();

    while (active) {
      const frameStartedAt = performance.now();
      const deltaSeconds = Math.min((frameStartedAt - previousTime) / 1_000, 0.1);
      previousTime = frameStartedAt;
      const currentMode = mode;

      if (currentMode.kind === "idle") {
        await updateIdle(currentMode, frameStartedAt);
      } else if (currentMode.kind === "walking") {
        await updateWalking(currentMode, deltaSeconds);
      } else if (currentMode.kind === "rope-throw") {
        await updateRopeThrow(currentMode, frameStartedAt);
      } else if (currentMode.kind === "climbing") {
        await updateClimbing(currentMode, deltaSeconds);
      } else if (currentMode.kind === "pull-up") {
        await updatePullUp(currentMode, frameStartedAt);
      } else if (currentMode.kind === "dragged") {
        await updateDragged(currentMode);
      } else if (currentMode.kind === "thrown") {
        await updateThrown(currentMode, deltaSeconds);
      } else if (currentMode.kind === "landing" || currentMode.kind === "hard-impact") {
        updateRecovery(currentMode, frameStartedAt);
      } else if (currentMode.kind === "battery-trip") {
        await updateBatteryTrip(currentMode, frameStartedAt, deltaSeconds);
      }

      const frameBudget = 1_000 / MOVEMENT_FPS;
      await delay(Math.max(0, frameBudget - (performance.now() - frameStartedAt)));
    }
  };

  const cancelDrag = (event: PointerEvent): void => {
    if (mode.kind === "dragged" && event.pointerId === mode.pointerId) {
      interactionId += 1;
      setDragBubbleVisibility(false);
      setMode(idleMode(), "idle");
    }
  };

  sprite.element.addEventListener("pointerdown", (event) => void beginDrag(event));
  sprite.element.addEventListener("pointerup", (event) => void finishDrag(event));
  sprite.element.addEventListener("pointercancel", cancelDrag);

  const supportWindowIdForMode = (currentMode: RuntimeMode): string | null => {
    if (currentMode.kind === "idle" || currentMode.kind === "walking") {
      return currentMode.supportWindowId;
    }
    if (
      currentMode.kind === "rope-throw" ||
      currentMode.kind === "climbing" ||
      currentMode.kind === "pull-up"
    ) {
      return currentMode.surfaceWindowId;
    }
    if (currentMode.kind === "landing" || currentMode.kind === "hard-impact") {
      return currentMode.supportWindowId ?? null;
    }
    if (currentMode.kind === "timer") return currentMode.supportWindowId;
    if (currentMode.kind === "music") return currentMode.supportWindowId;
    return null;
  };

  const applyTimerState = (state: TimerSnapshot): void => {
    const active = isPetMotionLocked(state.phase);
    timerActive = active;
    if (active) {
      if (mode.kind === "battery-trip") batteryEventPending = true;
      if (mode.kind === "dragged") setDragBubbleVisibility(false);
      interactionId += 1;
      const phase = state.phase as TimerMode["phase"];
      setMode(
        { kind: "timer", phase, supportWindowId: supportWindowIdForMode(mode) },
        phase === "focus" ? "focused" : "idle",
      );
    } else if (mode.kind === "timer") {
      if (youtubeMusicActive) {
        setMode({ kind: "music", supportWindowId: mode.supportWindowId }, "dancing");
      } else {
        setMode(idleMode(performance.now(), mode.supportWindowId), "idle");
      }
      void startPendingBatteryEvent();
    }
  };

  const applyMusicActivity = (musicActive: boolean): void => {
    youtubeMusicActive = musicActive;
    const reaction = resolveMusicReaction(musicActive, timerActive, mode.kind);
    if (reaction === "enter") {
      interactionId += 1;
      setMode(
        { kind: "music", supportWindowId: supportWindowIdForMode(mode) },
        "dancing",
      );
    } else if (reaction === "leave" && mode.kind === "music") {
      setMode(idleMode(performance.now(), mode.supportWindowId), "idle");
    }
  };

  const pollMusicActivity = (): void => {
    void invoke<boolean>("is_youtube_music_active")
      .then(applyMusicActivity)
      .catch(() => applyMusicActivity(false));
  };

  const applyBatteryState = (state: BatteryState): void => {
    if (shouldRearmLowBatteryEvent(state)) lowBatteryArmed = true;
    if (shouldTriggerLowBatteryEvent(state, lowBatteryArmed)) {
      lowBatteryArmed = false;
      batteryEventPending = true;
    }
    if (batteryEventPending) void startPendingBatteryEvent();
  };

  const pollBatteryState = (): void => {
    void invoke<BatteryState>("get_battery_state")
      .then(applyBatteryState)
      .catch(() => undefined);
  };

  const applySystemMetrics = (metrics: SystemMetricsState): void => {
    latestSystemMetrics = metrics;
    resourceSpeedMultiplier = speedForMetrics(metrics);

    if (timerActive) return;
    if (mode.kind === "walking") {
      const direction = mode.targetX < mode.x ? "left" : "right";
      sprite.setAnimation(resourceMovementAnimation(metrics, direction));
    } else if (mode.kind === "idle") {
      if (shouldRunContinuously(metrics)) {
        mode.untilMilliseconds = performance.now();
      }
      sprite.setAnimation(resourceIdleAnimation(metrics));
    }
  };

  const pollSystemMetrics = (): void => {
    void invoke<SystemMetricsState>("get_system_metrics")
      .then(applySystemMetrics)
      .catch(() => {
        resourceSpeedMultiplier = 1;
      });
  };

  const pollClimbableSurfaces = (): void => {
    void invoke<WindowSurface[]>("get_climbable_windows")
      .then((surfaces) => {
        climbableSurfaces = surfaces;
      })
      .catch(() => {
        climbableSurfaces = [];
      });
  };

  const applyPetSettings = (settings: Settings): void => {
    windowClimbingEnabled = settings.pet.windowClimbingEnabled;
  };

  void invoke<TimerSnapshot>("get_timer_state").then(applyTimerState).catch(() => undefined);
  void invokeWhenReady<BootstrapState>("get_bootstrap_state")
    .then(({ settings }) => applyPetSettings(settings))
    .catch(() => undefined);
  void listen<Settings>("settings://saved", ({ payload }) => applyPetSettings(payload)).then(
    (unlisten) => {
      if (active) unlistenSettings = unlisten;
      else unlisten();
    },
  );
  void listen<TimerSnapshot>("timer://state", ({ payload }) => applyTimerState(payload)).then(
    (unlisten) => {
      if (active) unlistenTimer = unlisten;
      else unlisten();
    },
  );
  void listen("todo://all-completed", () => {
    interactionId += 1;
    sprite.element.classList.add("todo-celebrating");
    setMode(
      {
        kind: "timer",
        phase: "shortBreak",
        supportWindowId: supportWindowIdForMode(mode),
      },
      "jumping",
    );
    window.clearTimeout(celebrationTimer);
    celebrationTimer = window.setTimeout(() => {
      sprite.element.classList.remove("todo-celebrating");
      void invoke<TimerSnapshot>("get_timer_state").then(applyTimerState).catch(() => {
        setMode(idleMode(), "idle");
      });
    }, 4_500);
  }).then((unlisten) => {
    if (active) unlistenTodo = unlisten;
    else unlisten();
  });
  pollSystemMetrics();
  pollClimbableSurfaces();
  pollMusicActivity();
  pollBatteryState();
  const systemMetricsTimer = window.setInterval(pollSystemMetrics, 1_000);
  const surfaceTimer = window.setInterval(
    pollClimbableSurfaces,
    SURFACE_REFRESH_MILLISECONDS,
  );
  const musicActivityTimer = window.setInterval(pollMusicActivity, 750);
  const batteryTimer = window.setInterval(pollBatteryState, BATTERY_POLL_MILLISECONDS);
  void listen("battery://test", () => {
    batteryEventPending = true;
    void startPendingBatteryEvent();
  }).then((unlisten) => {
    if (active) unlistenBatteryTest = unlisten;
    else unlisten();
  });

  void run().catch((error: unknown) => {
    setMode(idleMode(), "idle");
    console.warn("Pet motion stopped because the window could not be moved.", error);
  });

  return () => {
    active = false;
    window.clearInterval(topmostTimer);
    interactionId += 1;
    setDragBubbleVisibility(false);
    window.clearInterval(animationTimer);
    window.clearInterval(systemMetricsTimer);
    window.clearInterval(surfaceTimer);
    window.clearInterval(musicActivityTimer);
    window.clearInterval(batteryTimer);
    window.clearTimeout(celebrationTimer);
    unlistenTimer?.();
    unlistenTodo?.();
    unlistenBatteryTest?.();
    unlistenSettings?.();
    if (musicStageExpanded) {
      void invoke("set_music_stage_expanded", { expanded: false }).catch(() => undefined);
    }
    hideClimbRope();
  };
}

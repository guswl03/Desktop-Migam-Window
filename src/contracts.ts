export interface DistractionRule {
  id: string;
  name: string;
  enabled: boolean;
  processName?: string;
  windowTitle?: string;
  graceSeconds: number;
  cooldownSeconds: number;
}

export interface DetectionState {
  matched: boolean;
  ruleId?: string;
}

export interface InterventionRequest {
  interventionId: number;
  startX: number;
  impactX: number;
  y: number;
}

export interface Settings {
  schemaVersion: number;
  pet: {
    visualScalePercent: number;
    resourceResponseMode: ResourceResponseMode;
    automaticPhotoDeliveryEnabled: boolean;
  };
  pomodoro: {
    focusMinutes: number;
    shortBreakMinutes: number;
    longBreakMinutes: number;
    sessionsBeforeLongBreak: number;
  };
  focusGuard: {
    interventionEnabled: boolean;
    rules: DistractionRule[];
  };
}

export type ResourceResponseMode = "off" | "cpu" | "memory" | "combined";

export interface SystemMetricsState {
  cpuPercent: number;
  memoryPercent: number;
  mode: ResourceResponseMode;
}

export interface BatteryState {
  present: boolean;
  percent?: number;
  charging: boolean;
}

export interface WindowSurface {
  windowId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BootstrapState {
  settings: Settings;
  emergencyStopped: boolean;
  emergencyShortcutAvailable: boolean;
  trayAvailable: boolean;
}

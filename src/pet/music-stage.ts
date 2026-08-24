export type MusicReaction = "enter" | "leave" | "hold";

export function resolveMusicReaction(
  youtubeMusicActive: boolean,
  timerActive: boolean,
  mode: string,
): MusicReaction {
  if (timerActive) return mode === "music" ? "leave" : "hold";
  if (youtubeMusicActive && (mode === "idle" || mode === "walking")) return "enter";
  if (!youtubeMusicActive && mode === "music") return "leave";
  return "hold";
}

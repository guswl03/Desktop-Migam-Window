import type { CostumeSlot } from "./catalog";

export interface CostumeAlignment {
  x: number;
  y: number;
  size: number;
}

const defaults: Record<CostumeSlot, CostumeAlignment> = {
  head: { x: -4, y: -30, size: 104 },
  face: { x: -4, y: -8, size: 104 },
  neck: { x: -4, y: 12, size: 104 },
  body: { x: -4, y: 17, size: 104 },
  full: { x: -8, y: -8, size: 112 },
};

export function defaultCostumeAlignment(slot: CostumeSlot): CostumeAlignment {
  return { ...defaults[slot] };
}

export function resolveCostumeAlignment(
  slot: CostumeSlot,
  itemDefault: CostumeAlignment | undefined,
  saved: CostumeAlignment | undefined,
): CostumeAlignment {
  return { ...(saved ?? itemDefault ?? defaults[slot]) };
}

const PREFERRED_SIDE_INSET = 12;
const PET_CARD_OVERLAP_WIDTH = 123;
const AUTOMATIC_DELIVERY_MINIMUM_MILLISECONDS = 20 * 60_000;
const AUTOMATIC_DELIVERY_RANGE_MILLISECONDS = 20 * 60_000;
const RARE_PHOTO_PROBABILITY = 0.01;

export type PhotoDeliveryRarity = "normal" | "real-heogeodeongseu";

export function photoDeliveryRarity(randomValue: number): PhotoDeliveryRarity {
  return randomValue >= 0 && randomValue < RARE_PHOTO_PROBABILITY
    ? "real-heogeodeongseu"
    : "normal";
}

export function photoDeliveryDelayMilliseconds(randomValue: number): number {
  return AUTOMATIC_DELIVERY_MINIMUM_MILLISECONDS
    + randomValue * AUTOMATIC_DELIVERY_RANGE_MILLISECONDS;
}

export interface PhotoDeliveryLayout {
  photoX: number;
  y: number;
  targetX: number;
  startX: number;
}

export function calculatePhotoDeliveryLayout(
  viewportWidth: number,
  viewportHeight: number,
  photoWidth: number,
  photoHeight: number,
  comesFromLeft: boolean,
): PhotoDeliveryLayout {
  const sideInset = Math.min(
    PREFERRED_SIDE_INSET,
    Math.max(0, (viewportWidth - photoWidth) / 2),
  );
  const photoX = comesFromLeft
    ? sideInset
    : viewportWidth - photoWidth - sideInset;
  const y = Math.max(0, (viewportHeight - photoHeight) / 2);
  const targetX = comesFromLeft ? photoX : photoX - PET_CARD_OVERLAP_WIDTH;
  const rigWidth = photoWidth + PET_CARD_OVERLAP_WIDTH;
  const startX = comesFromLeft ? -rigWidth - sideInset : viewportWidth + sideInset;

  return { photoX, y, targetX, startX };
}

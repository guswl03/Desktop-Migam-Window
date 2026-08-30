const PREFERRED_SIDE_INSET = 12;
const PET_CARD_OVERLAP_WIDTH = 123;
const PHOTO_DELIVERY_MAXIMUM_WIDTH = 430;
const PHOTO_DELIVERY_MAXIMUM_HEIGHT = 350;
const PHOTO_DELIVERY_MINIMUM_WIDTH = 260;
const PHOTO_DELIVERY_MINIMUM_HEIGHT = 208;
const PHOTO_DELIVERY_PULL_DURATION_MILLISECONDS = 6_000;
const RARE_PHOTO_PRESENTATION_SCALE = 0.85;
const AUTOMATIC_DELIVERY_MINIMUM_MILLISECONDS = 20 * 60_000;
const AUTOMATIC_DELIVERY_RANGE_MILLISECONDS = 20 * 60_000;
const RARE_PHOTO_PROBABILITY = 0.01;

export type PhotoDeliveryRarity = "normal" | "real-heogeodeongseu";

export function photoDeliveryRarity(
  randomValue: number,
  forceSpecialPhoto = false,
): PhotoDeliveryRarity {
  if (forceSpecialPhoto) return "real-heogeodeongseu";
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

export interface PhotoDeliveryPresentation {
  photoWidth: number;
  photoHeight: number;
  pullDurationMilliseconds: number;
}

export function calculatePhotoDeliveryPresentation(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  rarity: PhotoDeliveryRarity = "normal",
): PhotoDeliveryPresentation {
  const maximumWidth = Math.min(PHOTO_DELIVERY_MAXIMUM_WIDTH, viewportWidth * 0.52);
  const maximumHeight = Math.min(PHOTO_DELIVERY_MAXIMUM_HEIGHT, viewportHeight * 0.58);
  const scale = Math.min(maximumWidth / naturalWidth, maximumHeight / naturalHeight);
  const photoWidth = Math.max(
    PHOTO_DELIVERY_MINIMUM_WIDTH,
    Math.round(naturalWidth * scale),
  );
  const photoHeight = Math.max(
    PHOTO_DELIVERY_MINIMUM_HEIGHT,
    Math.round(naturalHeight * scale),
  );
  const presentationScale = rarity === "real-heogeodeongseu"
    ? RARE_PHOTO_PRESENTATION_SCALE
    : 1;

  return {
    photoWidth: Math.round(photoWidth * presentationScale),
    photoHeight: Math.round(photoHeight * presentationScale),
    pullDurationMilliseconds: PHOTO_DELIVERY_PULL_DURATION_MILLISECONDS,
  };
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

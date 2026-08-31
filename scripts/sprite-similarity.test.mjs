import assert from "node:assert/strict";
import test from "node:test";
import {
  findNearDuplicateSprites,
  silhouetteFingerprint,
} from "./lib/sprite-similarity.mjs";

function rgbaSprite(points, { width = 10, height = 10 } = {}) {
  const pixels = new Uint8Array(width * height * 4);
  for (const [x, y, red, green, blue, alpha] of points) {
    const offset = (y * width + x) * 4;
    pixels.set([red, green, blue, alpha], offset);
  }
  return { width, height, pixels };
}

function notchedBlock({ deepNotch = false, smallNotch = false } = {}) {
  const width = 32;
  const height = 32;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 4; y <= 27; y += 1) {
    for (let x = 4; x <= 27; x += 1) {
      const removedByDeepNotch = deepNotch && x <= 9 && y >= 10 && y <= 21;
      const removedBySmallNotch = smallNotch && x <= 5 && y >= 14 && y <= 17;
      if (removedByDeepNotch || removedBySmallNotch) continue;
      pixels[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { width, height, pixels };
}

test("finds identical silhouettes even when RGB colors differ", () => {
  const red = rgbaSprite([
    [4, 4, 255, 0, 0, 255],
    [5, 4, 255, 0, 0, 255],
  ]);
  const blue = rgbaSprite([
    [4, 4, 0, 0, 255, 255],
    [5, 4, 0, 0, 255, 255],
  ]);

  const pairs = findNearDuplicateSprites([
    { id: "a", png: red },
    { id: "b", png: blue },
  ]);

  assert.deepEqual(
    pairs.map(({ left, right }) => [left, right]),
    [["a", "b"]],
  );
});

test("keeps orthogonal silhouettes distinct after bounds normalization", () => {
  const horizontal = rgbaSprite(Array.from({ length: 8 }, (_, x) => [
    x + 1, 4, 255, 255, 255, 255,
  ]));
  const vertical = rgbaSprite(Array.from({ length: 8 }, (_, y) => [
    4, y + 1, 255, 255, 255, 255,
  ]));

  assert.notDeepEqual(
    silhouetteFingerprint(horizontal),
    silhouetteFingerprint(vertical),
  );
  assert.deepEqual(findNearDuplicateSprites([
    { id: "horizontal", png: horizontal },
    { id: "vertical", png: vertical },
  ]), []);
});

test("flags a small boundary mutation as a near duplicate", () => {
  const pairs = findNearDuplicateSprites([
    { id: "original", png: notchedBlock() },
    { id: "minor-edge-loss", png: notchedBlock({ smallNotch: true }) },
  ]);

  assert.deepEqual(
    pairs.map(({ left, right }) => [left, right]),
    [["original", "minor-edge-loss"]],
  );
});

test("does not conflate silhouettes with a deep asymmetric shoulder cut", () => {
  assert.deepEqual(findNearDuplicateSprites([
    { id: "solid", png: notchedBlock() },
    { id: "shoulder-cut", png: notchedBlock({ deepNotch: true }) },
  ]), []);
});

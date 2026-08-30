import test from "node:test";
import assert from "node:assert/strict";
import { analyzePngSemantics } from "./lib/png-rgba.mjs";

function rgba(width, height, pixels) {
  const rgbaPixels = new Uint8Array(width * height * 4);
  for (const [x, y, alpha] of pixels) {
    rgbaPixels[(y * width + x) * 4 + 3] = alpha;
  }
  return { width, height, pixels: rgbaPixels };
}

test("flags opaque pixels touching the canvas edge", () => {
  const metrics = analyzePngSemantics(rgba(8, 8, [[0, 3, 255]]));
  assert.ok(metrics.warnings.includes("edge-contact"));
});

test("flags an item whose occupied bounds are too small", () => {
  const metrics = analyzePngSemantics(rgba(256, 256, [[128, 128, 255]]));
  assert.ok(metrics.warnings.includes("undersized"));
});

test("reports isolated low-alpha dust separately", () => {
  const metrics = analyzePngSemantics(rgba(16, 16, [
    [7, 7, 255],
    [7, 8, 255],
    [8, 7, 255],
    [8, 8, 255],
    [15, 15, 12],
  ]));
  assert.equal(metrics.lowAlphaPixels, 1);
  assert.ok(metrics.warnings.includes("alpha-dust"));
});

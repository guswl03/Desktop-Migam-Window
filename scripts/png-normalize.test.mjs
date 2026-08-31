import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { normalizeRgbaSprite, encodePngRgba } from "./lib/png-normalize.mjs";
import { readPngRgba, visibleBounds } from "./lib/png-rgba.mjs";

test("generated sprites are centered in a padded 256 square", () => {
  const pixels = new Uint8Array(8 * 4);
  for (const index of [1, 2, 5, 6]) {
    pixels.set([220, 40, 30, 255], index * 4);
  }

  const normalized = normalizeRgbaSprite({ width: 4, height: 2, pixels });
  const bounds = visibleBounds(normalized.pixels, normalized.width, normalized.height);

  assert.deepEqual([normalized.width, normalized.height], [256, 256]);
  assert.ok(bounds);
  assert.ok(bounds.right - bounds.left + 1 <= 224);
  assert.ok(bounds.bottom - bounds.top + 1 <= 224);
  assert.ok(Math.abs((bounds.left + bounds.right) / 2 - 127.5) <= 1);
  assert.ok(Math.abs((bounds.top + bounds.bottom) / 2 - 127.5) <= 1);
});

test("encoded normalized sprites round-trip as RGBA PNG", async () => {
  const pixels = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]);
  const png = encodePngRgba({ width: 2, height: 1, pixels });
  const directory = await mkdtemp(join(tmpdir(), "migam-png-"));
  const path = join(directory, "sprite.png");
  try {
    await writeFile(path, png);
    const decoded = await readPngRgba(path);
    assert.deepEqual([decoded.width, decoded.height], [2, 1]);
    assert.deepEqual([...decoded.pixels], [...pixels]);
  } finally {
    await rm(directory, { recursive: true });
  }
});

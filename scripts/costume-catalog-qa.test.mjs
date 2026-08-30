import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildSheetRows } from "./costume-catalog-qa.mjs";
import { readPngRgba } from "./lib/png-rgba.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  await readFile(resolve(repositoryRoot, "pack/manifest.json"), "utf8"),
);
const drawCandidates = manifest.costumes.filter(({ rarity }) => rarity !== "default");

test("production costume PNGs are 256 square RGBA with transparent pixels", async () => {
  for (const costume of drawCandidates) {
    const png = await readPngRgba(resolve(repositoryRoot, "pack", costume.file));
    assert.deepEqual([png.width, png.height], [256, 256], costume.id);
    assert.equal(png.pixels.length, 256 * 256 * 4, costume.id);
    assert.ok(
      png.pixels.some((value, index) => index % 4 === 3 && value === 0),
      `${costume.id} has no transparent pixel`,
    );
  }
});

test("contact-sheet rows cover every candidate exactly once", () => {
  const rows = buildSheetRows(manifest.costumes);
  assert.equal(rows.length, 156);
  assert.equal(new Set(rows.map(({ id }) => id)).size, 156);
  assert.deepEqual(
    rows.map(({ id }) => id),
    drawCandidates.map(({ id }) => id),
  );
});

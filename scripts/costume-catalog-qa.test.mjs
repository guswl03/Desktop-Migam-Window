import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { loadBlueprint } from "./costume-blueprint.mjs";
import { analyzePlacement, buildSheetRows } from "./costume-catalog-qa.mjs";
import { readPngRgba, visibleBounds } from "./lib/png-rgba.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const execFileAsync = promisify(execFile);
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

test("complete worn placements have no clipping or slot-position warnings", async () => {
  for (const costume of drawCandidates) {
    const png = await readPngRgba(resolve(repositoryRoot, "pack", costume.file));
    const bounds = visibleBounds(png.pixels, png.width, png.height);
    assert.deepEqual(analyzePlacement(costume, bounds).warnings, [], costume.id);
  }
});

test("contact-sheet rows cover every blueprint-backed candidate in manifest order", async () => {
  const blueprint = await loadBlueprint(repositoryRoot);
  const rows = buildSheetRows(manifest.costumes, blueprint);
  assert.equal(rows.length, 185);
  assert.equal(new Set(rows.map(({ id }) => id)).size, 185);
  assert.deepEqual(
    rows.map(({ id }) => id),
    drawCandidates.map(({ id }) => id),
  );
  assert.deepEqual(
    rows.map(({ qaState }) => qaState),
    Array.from({ length: 185 }, () => "accepted"),
  );
  assert.equal(rows[0].theme, blueprint[0].theme);
});

test("placement analysis reports source and worn bounds with clipping warnings", () => {
  assert.deepEqual(
    analyzePlacement(
      {
        id: "fixture",
        slot: "body",
        defaultAlignment: { x: -20, y: -10, size: 128 },
      },
      { left: 0, top: 0, right: 255, bottom: 255 },
    ),
    {
      sourceBounds: { left: 0, top: 0, right: 255, bottom: 255 },
      wornBounds: { left: -20, top: -10, right: 108, bottom: 118 },
      warnings: ["clipped-left", "clipped-bottom", "body-outside-cell"],
    },
  );
});

test("accepted blueprint placements are applied to the production manifest", async () => {
  const blueprint = await loadBlueprint(repositoryRoot);
  const costumesById = new Map(drawCandidates.map((costume) => [costume.id, costume]));

  for (const item of blueprint) {
    const costume = costumesById.get(item.id);
    assert.equal(item.qaState, "accepted", item.id);
    assert.deepEqual(
      { slot: costume.slot, defaultAlignment: costume.defaultAlignment },
      { slot: item.slot, defaultAlignment: item.defaultAlignment },
      item.id,
    );
  }
});

test("asset validation reports the full 185-item rarity totals", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/costume-catalog-qa.mjs", "validate"],
    { cwd: repositoryRoot },
  );
  assert.equal(
    stdout.trim(),
    "common=80 rare=57 epic=31 legendary=12 special=5 total=185",
  );
});

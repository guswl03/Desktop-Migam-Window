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
const rarities = ["common", "rare", "epic", "legendary", "special"];

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
  const placementsWithWarnings = [];
  for (const costume of drawCandidates) {
    const png = await readPngRgba(resolve(repositoryRoot, "pack", costume.file));
    const bounds = visibleBounds(png.pixels, png.width, png.height);
    const placement = analyzePlacement(costume, bounds);
    if (placement.warnings.length > 0) {
      placementsWithWarnings.push({
        id: costume.id,
        wornBounds: placement.wornBounds,
        warnings: placement.warnings,
      });
    }
  }
  assert.deepEqual(placementsWithWarnings, []);
});

test("contact-sheet rows cover every blueprint-backed candidate", async () => {
  const blueprint = await loadBlueprint(repositoryRoot);
  const rows = buildSheetRows(manifest.costumes, blueprint);
  assert.equal(rows.length, 185);
  assert.equal(new Set(rows.map(({ id }) => id)).size, 185);
  assert.deepEqual(
    rows.map(({ qaState }) => qaState),
    Array.from({ length: 185 }, () => "accepted"),
  );
  assert.equal(rows[0].theme, blueprint[0].theme);
});

test("generated SVG sheet data IDs follow rarity-filtered manifest order", async () => {
  await execFileAsync(
    process.execPath,
    ["scripts/costume-catalog-qa.mjs", "sheets"],
    { cwd: repositoryRoot },
  );

  let generatedItems = 0;
  for (const rarity of rarities) {
    const svg = await readFile(
      resolve(repositoryRoot, "pack/qa/generated/final", `${rarity}.svg`),
      "utf8",
    );
    const actualIds = Array.from(
      svg.matchAll(/<g class="costume-cell" data-id="([^"]+)"/g),
      (match) => match[1],
    );
    const expectedIds = drawCandidates
      .filter((costume) => costume.rarity === rarity)
      .map((costume) => costume.id);
    assert.deepEqual(actualIds, expectedIds, rarity);
    generatedItems += actualIds.length;
  }
  assert.equal(generatedItems, 185);
});

test("placement analysis uses raw fractional bounds for boundary decisions", () => {
  const fixtures = [
    {
      name: "top below -24",
      costume: {
        slot: "fixture",
        defaultAlignment: { x: 0, y: -25, size: 58 },
      },
      sourceBounds: { left: 0, top: 4, right: 0, bottom: 4 },
      expectedBounds: {
        left: 0,
        top: -24.09375,
        right: 0.2265625,
        bottom: -23.8671875,
      },
      warnings: ["clipped-top"],
    },
    {
      name: "head bottom above 24",
      costume: {
        slot: "head",
        defaultAlignment: { x: 0, y: 0, size: 78 },
      },
      sourceBounds: { left: 0, top: 0, right: 0, bottom: 79 },
      expectedBounds: {
        left: 0,
        top: 0,
        right: 0.3046875,
        bottom: 24.375,
      },
      warnings: ["head-overlaps-face"],
    },
    {
      name: "neck top below 60",
      costume: {
        slot: "neck",
        defaultAlignment: { x: 0, y: 59, size: 80 },
      },
      sourceBounds: { left: 0, top: 2, right: 0, bottom: 2 },
      expectedBounds: {
        left: 0,
        top: 59.625,
        right: 0.3125,
        bottom: 59.9375,
      },
      warnings: ["neck-above-mouth"],
    },
    {
      name: "body bottom above 104",
      costume: {
        slot: "body",
        defaultAlignment: { x: 0, y: 80, size: 78 },
      },
      sourceBounds: { left: 0, top: 0, right: 0, bottom: 79 },
      expectedBounds: {
        left: 0,
        top: 80,
        right: 0.3046875,
        bottom: 104.375,
      },
      warnings: ["clipped-bottom", "body-outside-cell"],
    },
  ];

  for (const fixture of fixtures) {
    const result = analyzePlacement(fixture.costume, fixture.sourceBounds);
    assert.deepEqual(result.wornBounds, fixture.expectedBounds, fixture.name);
    assert.deepEqual(result.warnings, fixture.warnings, fixture.name);
  }
});

test("face placement rejects horizontal escape from the eye region", () => {
  const sourceBounds = { left: 0, top: 0, right: 9, bottom: 9 };
  for (const [name, x] of [["left", -10], ["right", 96]]) {
    const result = analyzePlacement(
      {
        slot: "face",
        defaultAlignment: { x, y: 30, size: 256 },
      },
      sourceBounds,
    );
    assert.deepEqual(result.warnings, ["face-off-eye-line"], name);
  }
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

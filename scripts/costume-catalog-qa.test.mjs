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

test("catalog audit classifies every candidate exactly once", async () => {
  const audit = JSON.parse(
    await readFile(resolve(repositoryRoot, "pack/qa/catalog-audit.json"), "utf8"),
  );
  const validStates = new Set(["keep", "realign", "redraw"]);

  assert.equal(audit.length, drawCandidates.length);
  assert.equal(new Set(audit.map(({ id }) => id)).size, drawCandidates.length);
  assert.deepEqual(
    audit.map(({ id }) => id),
    drawCandidates.map(({ id }) => id),
  );

  for (const entry of audit) {
    assert.ok(validStates.has(entry.state), `${entry.id}: invalid state`);
    assert.ok(entry.reason.trim().length > 0, `${entry.id}: missing reason`);
  }
});

test("reviewed placement corrections are applied to the manifest", async () => {
  const audit = JSON.parse(
    await readFile(resolve(repositoryRoot, "pack/qa/catalog-audit.json"), "utf8"),
  );
  const costumesById = new Map(drawCandidates.map((costume) => [costume.id, costume]));

  for (const entry of audit.filter(({ state }) => state !== "keep")) {
    const costume = costumesById.get(entry.id);
    assert.deepEqual(
      { slot: costume.slot, defaultAlignment: costume.defaultAlignment },
      entry.placement,
      entry.id,
    );
  }
});

import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  acceptedCandidatePath,
  normalizeCandidate,
  validateCandidate,
} from "./costume-normalize-candidates.mjs";
import { encodePngRgba } from "./lib/png-normalize.mjs";
import { expectedCatalogIds } from "./costume-blueprint.mjs";
import { applyPromotion, planPromotion } from "./costume-promote-candidates.mjs";

function item(id, rarity = "common", qaState = "accepted") {
  return { id, rarity, qaState };
}

function sprite({
  width = 256,
  height = 256,
  left = 16,
  top = 16,
  right = 79,
  bottom = 79,
  dust = false,
} = {}) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const index = (y * width + x) * 4;
      pixels[index] = 30;
      pixels[index + 1] = 40;
      pixels[index + 2] = 50;
      pixels[index + 3] = 255;
    }
  }
  if (dust) pixels[(240 * width + 240) * 4 + 3] = 12;
  return { width, height, pixels };
}

function acceptedBlueprint() {
  return [...expectedCatalogIds()].map(([id, rarity]) => item(id, rarity));
}

function acceptedPngs(blueprint) {
  return new Map(blueprint.map(({ id }) => [id, encodePngRgba(sprite())]));
}

test("normalizes candidates into rarity directories", () => {
  assert.equal(
    acceptedCandidatePath({ id: "epic_004", rarity: "epic" }),
    resolve(fileURLToPath(new URL("..", import.meta.url)), "pack/qa/accepted/epic/epic_004.png"),
  );
});

test("candidate validation reports dimensions, margins, edge contact, and alpha dust", () => {
  assert.ok(validateCandidate(item("common_001"), sprite({ width: 255, height: 256 }))
    .includes("common_001: expected 256x256 RGBA candidate, got 255x256"));
  assert.ok(validateCandidate(item("common_001"), sprite({ left: 11 }))
    .includes("common_001: requires at least 12 transparent pixels on the left margin (got 11)"));
  assert.ok(validateCandidate(item("common_001"), sprite({ left: 0 }))
    .includes("common_001: visible pixels touch a canvas edge"));
  assert.ok(validateCandidate(item("common_001"), sprite({ dust: true }))
    .includes("common_001: alpha-dust warning"));
});

test("candidate validation requires both transparency and a visible 64px span", () => {
  const opaque = sprite({ left: 0, top: 0, right: 255, bottom: 255 });
  assert.ok(validateCandidate(item("common_001"), opaque)
    .includes("common_001: candidate has no transparent pixels"));
  assert.ok(validateCandidate(item("common_001"), sprite({ right: 40, bottom: 40 }))
    .includes("common_001: visible span must be at least 64 pixels wide or tall (got 25x25)"));
});

test("accepted candidate paths reject traversal and unapproved rarity-ID pairs", () => {
  assert.throws(() => acceptedCandidatePath(item("../common_001")), /unapproved candidate ID/);
  assert.throws(() => acceptedCandidatePath(item("common_001", "rare")), /rarity-ID mismatch/);
});

test("normalization preserves prior accepted output when validation fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-candidate-"));
  const candidate = item("common_001");
  const rawPath = join(root, "raw.png");
  const acceptedPath = acceptedCandidatePath(candidate, root);
  const existing = Buffer.from("known-good-output");
  await mkdir(join(root, "pack", "qa", "accepted", "common"), { recursive: true });
  await writeFile(acceptedPath, existing);
  await writeFile(rawPath, encodePngRgba(sprite({ dust: true })));

  try {
    await assert.rejects(
      normalizeCandidate(candidate, { root, rawPath, normalize: false }),
      /common_001: alpha-dust warning/,
    );
    assert.deepEqual(await readFile(acceptedPath), existing);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects an incomplete candidate set before promotion", async () => {
  const blueprint = acceptedBlueprint();
  const result = await planPromotion(blueprint, new Map([["common_001", Buffer.from("png")]]));
  assert.ok(result.errors.includes("expected 185 accepted candidates, got 1"));
});

test("promotion requires exact accepted qa states and rejects extra or rarity-mismatched candidates", async () => {
  const blueprint = acceptedBlueprint();
  blueprint[0].qaState = "candidate";
  const pngs = acceptedPngs(blueprint);
  pngs.set("common_002", { bytes: pngs.get("common_002"), rarity: "rare" });
  pngs.set("unexpected_001", Buffer.from("png"));
  const result = await planPromotion(blueprint, pngs);

  assert.ok(result.errors.includes("common_001: qaState must be accepted (got candidate)"));
  assert.ok(result.errors.includes("common_002: accepted candidate rarity mismatch (got rare, expected common)"));
  assert.ok(result.errors.includes("unexpected_001: unexpected accepted candidate"));
  assert.equal(result.copies.length, 0);
});

test("promotion exposes all copies only after the complete dry run is clean", async () => {
  const blueprint = acceptedBlueprint();
  const pngs = acceptedPngs(blueprint);
  const result = await planPromotion(blueprint, pngs);

  assert.deepEqual(result.errors, []);
  assert.equal(result.copies.length, 185);
  assert.match(result.copies[0].targetPath, /pack[\\/]common[\\/]common_001\.png$/);
});

test("apply promotion makes no writes when the plan contains errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-"));
  const blueprint = acceptedBlueprint();
  const result = await planPromotion(blueprint, new Map(), { root });

  try {
    await assert.rejects(applyPromotion(result), /promotion plan contains errors/);
    await assert.rejects(access(join(root, "pack", "common", "common_001.png")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("apply promotion writes the complete clean plan to its planned destination root", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-clean-"));
  const blueprint = acceptedBlueprint();
  const pngs = acceptedPngs(blueprint);
  const plan = await planPromotion(blueprint, pngs, { root });
  await Promise.all([...expectedCatalogIds()].map(([, rarity]) =>
    mkdir(join(root, "pack", rarity), { recursive: true })));

  try {
    assert.equal(await applyPromotion(plan), 185);
    assert.deepEqual(
      await readFile(join(root, "pack", "common", "common_001.png")),
      pngs.get("common_001"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

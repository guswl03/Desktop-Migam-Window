import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
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
import {
  applyPromotion,
  assertPathInside,
  assertWindowsPathInside,
  authorizeDirectoryChain,
  authorizePromotionRoot,
  loadAcceptedCandidates,
  planPromotion,
} from "./costume-promote-candidates.mjs";

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
  return new Map(blueprint.map(({ id }) => [id, {
    bytes: encodePngRgba(sprite()),
    decoded: sprite(),
  }]));
}

async function prepareAuthoritativePromotion(root, { override = new Map() } = {}) {
  const blueprint = acceptedBlueprint();
  const blueprintDirectory = join(root, "pack", "catalog-blueprint");
  await mkdir(blueprintDirectory, { recursive: true });
  await Promise.all(["common", "rare", "epic", "legendary", "special"].map(async (rarity) => {
    await writeFile(
      join(blueprintDirectory, `${rarity}.json`),
      JSON.stringify(blueprint.filter((item) => item.rarity === rarity)),
    );
  }));
  for (const candidate of blueprint) {
    const acceptedPath = acceptedCandidatePath(candidate, root);
    const destination = join(root, "pack", candidate.rarity, `${candidate.id}.png`);
    await mkdir(join(root, "pack", "qa", "accepted", candidate.rarity), { recursive: true });
    await mkdir(join(root, "pack", candidate.rarity), { recursive: true });
    await writeFile(acceptedPath, override.get(candidate.id) ?? encodePngRgba(sprite()));
    await writeFile(destination, Buffer.from(`original-${candidate.id}`));
  }
  return blueprint;
}

async function assertOriginalCatalog(root) {
  for (const [id, rarity] of expectedCatalogIds()) {
    assert.deepEqual(
      await readFile(join(root, "pack", rarity, `${id}.png`)),
      Buffer.from(`original-${id}`),
      id,
    );
  }
}

async function assertNoPromotionArtifacts(root) {
  for (const rarity of ["common", "rare", "epic", "legendary", "special"]) {
    const leftovers = (await readdir(join(root, "pack", rarity)))
      .filter((name) => /\.promote\.(tmp|bak)$/.test(name));
    assert.deepEqual(leftovers, [], rarity);
  }
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

test("candidate validation accepts exact 12px margins and 64px spans but rejects every 11px boundary", () => {
  assert.deepEqual(validateCandidate(item("common_001"), sprite({ left: 12, top: 12, right: 75, bottom: 75 })), []);
  for (const [side, values] of Object.entries({
    left: { left: 11 }, top: { top: 11 }, right: { right: 244 }, bottom: { bottom: 244 },
  })) {
    assert.ok(validateCandidate(item("common_001"), sprite(values))
      .some((error) => error.includes(`the ${side} margin (got 11)`)), side);
  }
  assert.deepEqual(validateCandidate(item("common_001"), sprite({ right: 79, bottom: 20 })), []);
  assert.ok(validateCandidate(item("common_001"), sprite({ right: 78, bottom: 20 }))
    .some((error) => error.includes("got 63x5")));
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
    await assert.rejects(applyPromotion(result), /caller-supplied plan/);
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
    await assert.rejects(applyPromotion(plan), /caller-supplied plan/);
    await prepareAuthoritativePromotion(root);
    assert.equal(await applyPromotion({ root }), 185);
    assert.deepEqual(
      await readFile(join(root, "pack", "common", "common_001.png")),
      pngs.get("common_001").bytes,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("promotion dry-run decodes every accepted source and rejects corrupt or invalid geometry", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-validate-"));
  const blueprint = await prepareAuthoritativePromotion(root, {
    override: new Map([
      ["common_001", Buffer.from("not a PNG")],
      ["common_002", encodePngRgba(sprite({ left: 0 }))],
      ["common_003", encodePngRgba(sprite({ dust: true }))],
    ]),
  });
  try {
    const plan = await planPromotion(blueprint, await loadAcceptedCandidates(root), { root });
    assert.ok(plan.errors.some((error) => error.startsWith("common_001: invalid accepted candidate PNG:")));
    assert.ok(plan.errors.includes("common_002: visible pixels touch a canvas edge"));
    assert.ok(plan.errors.includes("common_003: alpha-dust warning"));
    assert.equal(plan.copies.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("apply promotion rejects an arbitrary caller plan with zero writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-untrusted-"));
  await mkdir(join(root, "outside"), { recursive: true });
  try {
    await assert.rejects(applyPromotion({
      root,
      errors: [],
      copies: [{ id: "common_001", rarity: "../../outside", targetPath: join(root, "outside", "owned.png") }],
    }), /caller-supplied plan/);
    await assert.rejects(access(join(root, "outside", "owned.png")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function assertRollbackForPhase(phase) {
  const root = await mkdtemp(join(tmpdir(), `costume-promotion-${phase}-`));
  await prepareAuthoritativePromotion(root);
  try {
    await assert.rejects(
      applyPromotion({ root, failureHook: ({ currentPhase, index }) => {
        if (currentPhase === phase && index === 2) throw new Error(`injected ${phase} failure`);
      } }),
      new RegExp(`injected ${phase} failure`),
    );
    await assertOriginalCatalog(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("promotion rolls back every original when staging fails", async () => {
  await assertRollbackForPhase("stage");
});

test("promotion rolls back every original before a commit rename", async () => {
  await assertRollbackForPhase("before-commit-rename");
});

test("promotion rolls back every original after a commit rename", async () => {
  await assertRollbackForPhase("after-commit-rename");
});

test("after-backup hook failure restores originals with no promotion artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-after-backup-"));
  await prepareAuthoritativePromotion(root);
  try {
    await assert.rejects(
      applyPromotion({ root, failureHook: ({ currentPhase, index }) => {
        if (currentPhase === "after-backup-rename" && index === 2) throw new Error("injected after backup failure");
      } }),
      /injected after backup failure/,
    );
    await assertOriginalCatalog(root);
    await assertNoPromotionArtifacts(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("after-commit hook failure restores originals with no promotion artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-after-commit-"));
  await prepareAuthoritativePromotion(root);
  try {
    await assert.rejects(
      applyPromotion({ root, failureHook: ({ currentPhase, index }) => {
        if (currentPhase === "after-commit-rename" && index === 2) throw new Error("injected after commit failure");
      } }),
      /injected after commit failure/,
    );
    await assertOriginalCatalog(root);
    await assertNoPromotionArtifacts(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("after-restore hook reports restored state without a null backup path", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-after-restore-"));
  await prepareAuthoritativePromotion(root);
  try {
    await assert.rejects(
      applyPromotion({ root, failureHook: ({ currentPhase, index }) => {
        if (currentPhase === "before-commit-rename" && index === 2) throw new Error("injected commit failure");
        if (currentPhase === "after-restore-rename" && index === 1) throw new Error("injected after restore failure");
      } }),
      (error) => error instanceof AggregateError
        && error.errors.some((entry) => /original was restored and no backup remains.*after restore failure/.test(entry.message))
        && !error.errors.some((entry) => entry.message.includes("null") || entry.message.includes("backup preserved")),
    );
    await assertOriginalCatalog(root);
    await assertNoPromotionArtifacts(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("after-backup-cleanup hook reports completed cleanup without a null backup path", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-after-cleanup-"));
  await prepareAuthoritativePromotion(root);
  try {
    await assert.rejects(
      applyPromotion({ root, failureHook: ({ currentPhase, index }) => {
        if (currentPhase === "after-backup-cleanup" && index === 2) throw new Error("injected after cleanup failure");
      } }),
      (error) => error instanceof AggregateError
        && error.errors.some((entry) => /backup cleanup completed but after-hook failed.*after cleanup failure/.test(entry.message))
        && !error.errors.some((entry) => entry.message.includes("null") || entry.message.includes("backup cleanup incomplete")),
    );
    assert.notDeepEqual(await readFile(join(root, "pack", "common", "common_001.png")), Buffer.from("original-common_001"));
    await assertNoPromotionArtifacts(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("lexical path containment rejects drive-relative, absolute, and parent escapes", () => {
  assert.equal(assertPathInside("C:\\catalog\\pack", "C:\\catalog\\pack\\common\\common_001.png"), "C:\\catalog\\pack\\common\\common_001.png");
  for (const path of ["C:\\catalog\\outside\\item.png", "D:\\catalog\\pack\\item.png", "\\\\server\\share\\item.png", "..\\outside\\item.png"]) {
    assert.throws(() => assertPathInside("C:\\catalog\\pack", path), /(escapes|must be absolute|network)/);
  }
});

test("Windows containment requires absolute same-volume roots and candidates", () => {
  assert.equal(
    assertWindowsPathInside("C:\\catalog\\pack", "C:\\catalog\\pack\\common\\common_001.png"),
    "C:\\catalog\\pack\\common\\common_001.png",
  );
  for (const [root, candidate] of [
    ["C:catalog\\pack", "C:\\catalog\\pack\\common\\item.png"],
    ["C:\\catalog\\pack", "C:relative\\item.png"],
    ["C:\\catalog\\pack", "D:\\catalog\\pack\\item.png"],
    ["C:\\catalog\\pack", "\\\\server\\share\\item.png"],
    ["C:\\catalog\\pack", "C:\\catalog\\pack"],
    ["C:\\catalog\\pack", "C:\\catalog\\pack\\..\\outside\\item.png"],
    ["\\\\server\\share\\catalog", "\\\\server\\share\\catalog\\common\\item.png"],
    ["\\\\?\\C:\\catalog\\pack", "\\\\?\\C:\\catalog\\pack\\common\\item.png"],
    ["C:\\catalog\\pack", "\\\\.\\C:\\catalog\\pack\\common\\item.png"],
  ]) {
    assert.throws(() => assertWindowsPathInside(root, candidate), /escapes|absolute|network/);
  }
});

test("ancestor authorizer rejects deterministic root and intermediate canonical redirects", async () => {
  const root = resolve(tmpdir(), "promotion-authorizer", "nested");
  const operations = {
    lstat: async () => ({ isDirectory: () => true, isSymbolicLink: () => false }),
    realpath: async (path) => path,
  };
  await assert.rejects(
    authorizeDirectoryChain(root, { ...operations, realpath: async (path) => path === root ? `${path}-redirected` : path }),
    /redirected ancestor/,
  );
  const intermediate = resolve(root, "..");
  await assert.rejects(
    authorizeDirectoryChain(root, { ...operations, realpath: async (path) => path === intermediate ? `${path}-redirected` : path }),
    /redirected ancestor/,
  );
});

test("root authorization rejects relative and absent roots before planning", async () => {
  await assert.rejects(authorizePromotionRoot("relative-root"), /absolute/);
  await assert.rejects(authorizePromotionRoot(join(tmpdir(), "missing-promotion-root")), /existing/);
});

test("backup rename failure leaves every original and no backup or temp", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-backup-failure-"));
  await prepareAuthoritativePromotion(root);
  try {
    await assert.rejects(
      applyPromotion({ root, failureHook: ({ currentPhase, index }) => {
        if (currentPhase === "before-backup-rename" && index === 2) throw new Error("injected backup failure");
      } }),
      /injected backup failure/,
    );
    await assertOriginalCatalog(root);
    for (const rarity of ["common", "rare", "epic", "legendary", "special"]) {
      const leftovers = (await readdir(join(root, "pack", rarity))).filter((name) => /\.promote\.(tmp|bak)$/.test(name));
      assert.deepEqual(leftovers, [], rarity);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restore failure preserves the exact backup path and reports aggregate rollback errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-restore-failure-"));
  await prepareAuthoritativePromotion(root);
  try {
    await assert.rejects(
      applyPromotion({ root, failureHook: ({ currentPhase, index }) => {
        if (currentPhase === "before-commit-rename" && index === 2) throw new Error("injected commit failure");
        if (currentPhase === "before-restore-rename" && index === 1) throw new Error("injected restore failure");
      } }),
      (error) => error instanceof AggregateError
        && error.errors.some((entry) => entry.message.includes("backup preserved at")),
    );
    const files = await readdir(join(root, "pack", "common"));
    assert.ok(files.some((name) => name.startsWith(".common_002.") && name.endsWith(".promote.bak")));
    assert.deepEqual(await readFile(join(root, "pack", "common", "common_001.png")), Buffer.from("original-common_001"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("backup cleanup failure surfaces committed-but-incomplete state without rollback", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-cleanup-failure-"));
  await prepareAuthoritativePromotion(root);
  try {
    await assert.rejects(
      applyPromotion({ root, failureHook: ({ currentPhase, index }) => {
        if (currentPhase === "before-backup-cleanup" && index === 2) throw new Error("injected cleanup failure");
      } }),
      (error) => error instanceof AggregateError
        && error.message.includes("cleanup incomplete")
        && error.errors.some((entry) => entry.message.includes("common_003")),
    );
    assert.notDeepEqual(await readFile(join(root, "pack", "common", "common_001.png")), Buffer.from("original-common_001"));
    const files = await readdir(join(root, "pack", "common"));
    assert.ok(files.some((name) => name.startsWith(".common_003.") && name.endsWith(".promote.bak")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dry-run rejects accepted and destination symlinks when the host permits them", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "costume-promotion-symlink-"));
  const blueprint = await prepareAuthoritativePromotion(root);
  const accepted = acceptedCandidatePath(blueprint[0], root);
  const destination = join(root, "pack", "common", "common_001.png");
  const outside = join(root, "outside.png");
  await writeFile(outside, encodePngRgba(sprite()));
  try {
    await rm(accepted);
    await symlink(outside, accepted, "file");
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    if (["EPERM", "EACCES", "UNKNOWN"].includes(error?.code)) t.skip("host forbids test symlinks");
    throw error;
  }
  try {
    const plan = await planPromotion(blueprint, await loadAcceptedCandidates(root), { root });
    assert.ok(plan.errors.some((error) => error.includes("unexpected accepted candidate path")));
    await rm(accepted);
    await writeFile(accepted, encodePngRgba(sprite()));
    await rm(destination);
    await symlink(outside, destination, "file");
    const secondPlan = await planPromotion(blueprint, await loadAcceptedCandidates(root), { root });
    assert.ok(secondPlan.errors.some((error) => error.includes("invalid promotion destination")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

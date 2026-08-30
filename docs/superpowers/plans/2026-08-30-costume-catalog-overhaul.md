# Costume Catalog Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 156 drawable costumes map correctly from card to preview to equipped pet, give each item an explicit default placement, and redraw every audited low-detail original without changing item identity or saved ownership.

**Architecture:** Extend the existing manifest as the single source of truth for slot and alignment, then make both catalog UI and pet renderer consume the same validated `Costume` object. Add a dependency-free Node QA pipeline that validates PNGs and produces rarity-grouped SVG contact sheets, use those sheets for the 156-item audit, and stage AI-generated redraws before replacing any existing asset.

**Tech Stack:** TypeScript 5.9, Vite 7, Vitest 3, browser DOM/Image APIs, Node.js built-ins (`fs`, `path`, `zlib`, `node:test`), Tauri 2, Rust 2021, PNG/SVG assets.

**Spec:** `docs/superpowers/specs/2026-08-30-costume-catalog-overhaul-design.md`

## Global Constraints

- Preserve all existing costume IDs, names, rarities, file paths, draw eligibility, draw probabilities, ownership, and saved per-item alignment overrides.
- Keep all production costume PNGs at 256 x 256 RGBA with real transparency.
- Add no production dependency and do not introduce multi-layer or multi-slot equipment.
- Keep the current thick black, slightly uneven hand-drawn Gamjabot style and each item's main colors and concept.
- Built-in draw candidates must have explicit metadata; slot inference remains only in the one-time metadata seeder and runtime fallback remains only for malformed external packs.
- A generated candidate must never overwrite a production asset before visual QA accepts it.
- Work only in `feat/costume-catalog-overhaul`; do not alter the separate photo-delivery working tree.

---

## File Structure

- `pack/manifest.json`: authoritative item identity plus explicit `slot` and `defaultAlignment` for all 156 draw candidates.
- `pack/qa/catalog-audit.json`: one reviewed `keep`, `realign`, or `redraw` decision per draw candidate.
- `pack/qa/generated/*.svg`: deterministic isolated/worn contact sheets grouped by rarity.
- `pack/qa/candidates/`: temporary redraw candidates; ignored and never referenced by runtime code.
- `scripts/costume-metadata-seed.mjs`: idempotent explicit-metadata seeder preserving current placement as the initial baseline.
- `scripts/costume-catalog-qa.mjs`: manifest/PNG/audit validator and SVG contact-sheet command.
- `scripts/lib/png-rgba.mjs`: dependency-free PNG decode, alpha-boundary inspection, normalization, and encode helpers.
- `scripts/costume-catalog-qa.test.mjs`: Node tests for PNG parsing and complete sheet/audit output.
- `src/costumes/catalog.ts`: strict manifest-to-runtime catalog parsing and URL resolution.
- `src/costumes/catalog.test.ts`: metadata coverage, identity snapshot, and invalid-entry tests.
- `src/costumes/alignment.ts`: saved > item default > slot fallback resolution.
- `src/costumes/alignment.test.ts`: alignment precedence tests.
- `src/costumes/latest-asset-loader.ts`: last-selection-wins asynchronous decode guard.
- `src/costumes/latest-asset-loader.test.ts`: controlled race tests.
- `src/pet/sprite.ts`: clears stale costume art, decodes a new URL, and applies only the latest selection.
- `src/gamcha/gamcha-view.ts`: passes item defaults through every preview/alignment path.
- `src/main.ts`: passes item defaults to the desktop pet.
- `package.json`: QA and asset-test commands.
- `docs/13-progress-board.md`, `docs/17-session-handoff.md`: verified completion and next-action records.

### Task 1: Seed and Validate Explicit Manifest Metadata

**Files:**
- Create: `scripts/costume-metadata-seed.mjs`
- Create: `src/costumes/catalog.test.ts`
- Modify: `pack/manifest.json`

**Interfaces:**
- Consumes: existing manifest fields `id`, `name`, `rarity`, `file`, `collection`, `source`, `sourceSlot`.
- Produces: every non-default entry has `slot: CostumeSlot` and `defaultAlignment: { x: number; y: number; size: number }`.

- [ ] **Step 1: Write the failing 156-entry coverage test**

```ts
import { describe, expect, it } from "vitest";
import manifest from "../../pack/manifest.json";

const drawCandidates = manifest.costumes.filter(({ rarity }) => rarity !== "default");

describe("costume manifest metadata", () => {
  it("covers all 156 draw candidates with explicit placement", () => {
    expect(drawCandidates).toHaveLength(156);
    expect(new Set(drawCandidates.map(({ id }) => id)).size).toBe(156);
    for (const costume of drawCandidates) {
      expect(["head", "face", "neck", "body", "full"]).toContain(costume.slot);
      expect(costume.defaultAlignment).toEqual({
        x: expect.any(Number),
        y: expect.any(Number),
        size: expect.any(Number),
      });
    }
  });
});
```

- [ ] **Step 2: Run the test and verify the schema is missing**

Run: `npm test -- src/costumes/catalog.test.ts`

Expected: FAIL because current manifest entries have no `slot` or `defaultAlignment`.

- [ ] **Step 3: Add the idempotent metadata seeder**

```js
const defaults = {
  head: { x: -4, y: -30, size: 104 },
  face: { x: -4, y: -8, size: 104 },
  neck: { x: -4, y: 12, size: 104 },
  body: { x: -4, y: 17, size: 104 },
  full: { x: -8, y: -8, size: 112 },
};

export function inferLegacySlot(name) {
  if (/(안경|선글라스|안대|모노클|바이저|가면)/.test(name)) return "face";
  if (/(넥타이|나비넥타이|목도리|스카프|넥워머|목걸이|칼라)/.test(name)) return "neck";
  if (/(앞치마|멜빵|조끼|카디건|벨트|백팩|가방|망토|케이프)/.test(name)) return "body";
  if (/(세트|갑주)/.test(name)) return "full";
  return "head";
}

export function seedCostumeMetadata(costume) {
  if (costume.rarity === "default") return costume;
  const slot = costume.slot ?? inferLegacySlot(costume.name);
  return { ...costume, slot, defaultAlignment: costume.defaultAlignment ?? defaults[slot] };
}
```

The CLI must require `--write`, update only missing fields, preserve manifest ordering/indentation, and report `seeded=156 defaults=3` on the first run and `seeded=0 defaults=3` on the second.

- [ ] **Step 4: Run the seeder twice and inspect the manifest diff**

Run: `node scripts/costume-metadata-seed.mjs --write`

Run again: `node scripts/costume-metadata-seed.mjs --write`

Expected: the second run produces no Git diff; no ID/name/rarity/file/source field changes.

- [ ] **Step 5: Run the focused test**

Run: `npm test -- src/costumes/catalog.test.ts`

Expected: PASS with exactly 156 draw candidates.

- [ ] **Step 6: Commit the metadata baseline**

```powershell
git add -- scripts/costume-metadata-seed.mjs src/costumes/catalog.test.ts pack/manifest.json
git commit -m "feat: add explicit costume placement metadata"
```

### Task 2: Make Runtime Catalog and Alignment Use Item Defaults

**Files:**
- Modify: `src/costumes/catalog.ts`
- Modify: `src/costumes/catalog.test.ts`
- Modify: `src/costumes/alignment.ts`
- Modify: `src/costumes/alignment.test.ts`
- Modify: `src/gamcha/gamcha-view.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: manifest `slot` and `defaultAlignment` from Task 1.
- Produces: `Costume.defaultAlignment: CostumeAlignment` and `resolveCostumeAlignment(slot, itemDefault, saved): CostumeAlignment`.

- [ ] **Step 1: Add failing parser and precedence tests**

```ts
it("uses explicit metadata instead of the Korean display name", () => {
  expect(costumeById.get("legendary_003")?.slot).toBe("full");
  expect(costumeById.get("legendary_003")?.defaultAlignment).toEqual(
    expect.objectContaining({ x: expect.any(Number), y: expect.any(Number), size: expect.any(Number) }),
  );
});
```

```ts
it("resolves saved, item, then slot fallback alignment", () => {
  const item = { x: 2, y: -24, size: 116 };
  const saved = { x: 7, y: -18, size: 91 };
  expect(resolveCostumeAlignment("head", item, saved)).toEqual(saved);
  expect(resolveCostumeAlignment("head", item, undefined)).toEqual(item);
  expect(resolveCostumeAlignment("head", undefined, undefined)).toEqual({ x: -4, y: -30, size: 104 });
});
```

- [ ] **Step 2: Verify both focused tests fail**

Run: `npm test -- src/costumes/catalog.test.ts src/costumes/alignment.test.ts`

Expected: FAIL because `Costume` has no `defaultAlignment` and `resolveCostumeAlignment` accepts only two arguments.

- [ ] **Step 3: Replace name inference with strict built-in metadata parsing**

```ts
interface ManifestCostume {
  id: string;
  name: string;
  rarity: string;
  file: string;
  slot?: CostumeSlot;
  defaultAlignment?: CostumeAlignment;
}

function hasPlacement(value: ManifestCostume): value is ManifestCostume & {
  slot: CostumeSlot;
  defaultAlignment: CostumeAlignment;
} {
  return ["head", "face", "neck", "body", "full"].includes(value.slot ?? "")
    && Number.isInteger(value.defaultAlignment?.x)
    && Number.isInteger(value.defaultAlignment?.y)
    && Number.isInteger(value.defaultAlignment?.size);
}
```

Throw an error containing the item ID for a built-in draw candidate with invalid placement. Map `slot` and a cloned `defaultAlignment` directly into `Costume`; delete runtime `costumeSlot(name)` inference.

- [ ] **Step 4: Implement alignment precedence**

```ts
export function resolveCostumeAlignment(
  slot: CostumeSlot,
  itemDefault: CostumeAlignment | undefined,
  saved: CostumeAlignment | undefined,
): CostumeAlignment {
  return { ...(saved ?? itemDefault ?? defaults[slot]) };
}
```

Update every call in `src/gamcha/gamcha-view.ts` and `src/main.ts` to pass `costume.defaultAlignment` before saved alignment.

- [ ] **Step 5: Run catalog, alignment, and full TypeScript tests**

Run: `npm test -- src/costumes/catalog.test.ts src/costumes/alignment.test.ts`

Run: `npm test`

Expected: both commands PASS.

- [ ] **Step 6: Commit runtime metadata consumption**

```powershell
git add -- src/costumes/catalog.ts src/costumes/catalog.test.ts src/costumes/alignment.ts src/costumes/alignment.test.ts src/gamcha/gamcha-view.ts src/main.ts
git commit -m "fix: use per-item costume alignment defaults"
```

### Task 3: Guarantee Last-Selection-Wins Costume Loading

**Files:**
- Create: `src/costumes/latest-asset-loader.ts`
- Create: `src/costumes/latest-asset-loader.test.ts`
- Modify: `src/pet/sprite.ts`

**Interfaces:**
- Consumes: `{ url, slot, alignment }` passed to `PetSprite.setCostume`.
- Produces: `createLatestAssetLoader<T>().load(value, decode, apply)` and `.invalidate()`.

- [ ] **Step 1: Write a controlled race test**

```ts
it("applies only the latest decoded selection", async () => {
  let resolveFirst!: () => void;
  let resolveSecond!: () => void;
  const first = new Promise<void>((resolve) => { resolveFirst = resolve; });
  const second = new Promise<void>((resolve) => { resolveSecond = resolve; });
  const applied: string[] = [];
  const loader = createLatestAssetLoader<string>();
  const firstLoad = loader.load("rare_003", () => first, (id) => applied.push(id));
  const secondLoad = loader.load("legendary_003", () => second, (id) => applied.push(id));
  resolveSecond();
  await secondLoad;
  resolveFirst();
  await firstLoad;
  expect(applied).toEqual(["legendary_003"]);
});
```

Add a second test proving `invalidate()` prevents an in-flight image from reappearing after selecting the default pet.

- [ ] **Step 2: Run the race test and verify it fails**

Run: `npm test -- src/costumes/latest-asset-loader.test.ts`

Expected: FAIL because the loader module does not exist.

- [ ] **Step 3: Implement the revision guard**

```ts
export function createLatestAssetLoader<T>() {
  let revision = 0;
  return {
    async load(value: T, decode: () => Promise<void>, apply: (value: T) => void): Promise<void> {
      const requestedRevision = ++revision;
      await decode();
      if (requestedRevision === revision) apply(value);
    },
    invalidate(): void {
      revision += 1;
    },
  };
}
```

- [ ] **Step 4: Integrate decoding into `createPetSprite` without alignment flicker**

When URL changes, invalidate, hide the existing `<img>`, preload with `new Image()`, await `decode()`, then set `src`, slot, and CSS variables only if current. When the URL is unchanged, update only slot/alignment CSS synchronously. When `null`, invalidate and clear immediately.

```ts
const preloaded = new Image();
preloaded.src = nextCostume.url;
void assetLoader.load(nextCostume, () => preloaded.decode(), applyCostume).catch(() => {
  if (preloaded.src === nextCostume.url) clearCostume();
});
```

- [ ] **Step 5: Run the race and full tests**

Run: `npm test -- src/costumes/latest-asset-loader.test.ts`

Run: `npm test`

Expected: PASS; rapid selection can no longer apply `rare_003` after `legendary_003`.

- [ ] **Step 6: Commit preview safety**

```powershell
git add -- src/costumes/latest-asset-loader.ts src/costumes/latest-asset-loader.test.ts src/pet/sprite.ts
git commit -m "fix: prevent stale costume previews"
```

### Task 4: Build the Dependency-Free Asset Validator and Contact Sheets

**Files:**
- Create: `scripts/lib/png-rgba.mjs`
- Create: `scripts/costume-catalog-qa.mjs`
- Create: `scripts/costume-catalog-qa.test.mjs`
- Create: `pack/qa/generated/.gitkeep`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `pack/manifest.json`, production PNGs, audit JSON when present, and the canonical idle atlas.
- Produces: `readPngRgba(path) -> { width, height, pixels }`, `visibleBounds(pixels, width, height)`, and five SVG sheets under `pack/qa/generated`.

- [ ] **Step 1: Write failing Node tests for RGBA and output completeness**

```js
test("production costume PNGs are 256 square RGBA with transparent pixels", () => {
  for (const costume of drawCandidates) {
    const png = readPngRgba(resolve("pack", costume.file));
    assert.deepEqual([png.width, png.height], [256, 256], costume.id);
    assert.ok(png.pixels.some((_, index) => index % 4 === 3 && png.pixels[index] === 0), costume.id);
  }
});
```

```js
test("contact-sheet rows cover every candidate exactly once", () => {
  const rows = buildSheetRows(manifest.costumes);
  assert.equal(rows.length, 156);
  assert.equal(new Set(rows.map(({ id }) => id)).size, 156);
});
```

- [ ] **Step 2: Run the Node tests and verify missing modules fail**

Run: `node --test scripts/costume-catalog-qa.test.mjs`

Expected: FAIL because PNG and sheet helpers do not exist.

- [ ] **Step 3: Implement PNG decoding and bounds inspection**

Parse the PNG signature and IHDR, concatenate IDAT chunks, use `inflateSync`, reverse filters 0-4 per scanline, and return RGBA bytes only for color type 6/bit depth 8. Reject interlaced, indexed, RGB-only, truncated, or CRC-invalid files with the asset path in the error.

```js
export function visibleBounds(pixels, width, height) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (pixels[(y * width + x) * 4 + 3] === 0) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
  return right < 0 ? null : { left, top, right, bottom };
}
```

- [ ] **Step 4: Generate runtime-faithful SVG sheets**

Each rarity sheet uses 240 x 340 cells. Place the isolated asset in the top 128 x 128 checkerboard and the canonical idle frame plus runtime overlay in the second 128 x 128 area. Apply `x`, `y`, and `size` exactly as CSS does; label each cell with ID, Korean name, rarity, slot, and alignment.

The command modes are exact:

```text
node scripts/costume-catalog-qa.mjs validate
node scripts/costume-catalog-qa.mjs sheets
node scripts/costume-catalog-qa.mjs normalize pack/qa/candidates/common_001.png pack/common/common_001.png
node scripts/costume-catalog-qa.mjs normalize-redraws
node scripts/costume-catalog-qa.mjs validate-candidates
```

- [ ] **Step 5: Add package commands and candidate ignore rule**

```json
"test:assets": "node --test scripts/costume-catalog-qa.test.mjs",
"costumes:validate": "node scripts/costume-catalog-qa.mjs validate",
"costumes:sheets": "node scripts/costume-catalog-qa.mjs sheets"
```

Add only `pack/qa/candidates/` to `.gitignore`; generated SVG sheets and audit JSON remain tracked.

- [ ] **Step 6: Run asset tests, validation, and sheet generation**

Run: `npm run test:assets`

Run: `npm run costumes:validate`

Run: `npm run costumes:sheets`

Expected: five rarity sheets, exactly 156 labeled rows, and no missing/invalid PNG.

- [ ] **Step 7: Commit QA tooling**

```powershell
git add -- scripts package.json .gitignore pack/qa/generated
git commit -m "test: add complete costume catalog QA"
```

### Task 5: Audit and Realign All 156 Items

**Files:**
- Create: `pack/qa/catalog-audit.json`
- Modify: `pack/manifest.json`
- Regenerate: `pack/qa/generated/common.svg`
- Regenerate: `pack/qa/generated/rare.svg`
- Regenerate: `pack/qa/generated/epic.svg`
- Regenerate: `pack/qa/generated/legendary.svg`
- Regenerate: `pack/qa/generated/special.svg`
- Modify: `scripts/costume-catalog-qa.test.mjs`

**Interfaces:**
- Consumes: Task 4 isolated/worn sheets.
- Produces: one final audit decision and reviewed default alignment per draw candidate.

- [ ] **Step 1: Add a failing complete-audit test**

```js
test("audit has one final decision for each draw candidate", () => {
  assert.equal(audit.items.length, 156);
  assert.deepEqual(new Set(audit.items.map(({ id }) => id)), new Set(drawCandidates.map(({ id }) => id)));
  for (const item of audit.items) {
    assert.ok(["keep", "realign", "redraw"].includes(item.state), item.id);
    assert.ok(item.reason.trim().length >= 8, item.id);
  }
});
```

- [ ] **Step 2: Review all five sheets in manifest order**

For every cell, compare isolated art, worn composition, ID/name, and rarity. Apply exactly one decision:

```json
{
  "id": "legendary_003",
  "state": "realign",
  "reason": "수정룡 갑주가 머리 장식으로만 보이지 않도록 전신 중심과 크기를 조정"
}
```

Use `keep` only when art and placement are both acceptable, `realign` when only manifest X/Y/size changes are needed, and `redraw` when the original is sparse, clipped, unclear, mismatched to its name, or inconsistent with the style.

- [ ] **Step 3: Tune explicit manifest alignment for each reviewed item**

Adjust only integer `x`, `y`, and `size`. Keep `x/y` within -80..80 and `size` within 48..180 so defaults remain inside existing user-control ranges. Regenerate the affected rarity sheet after each group of at most 12 changes.

- [ ] **Step 4: Run complete audit validation**

Run: `npm run test:assets`

Run: `npm run costumes:validate`

Expected: PASS with counts `common=72 rare=48 epic=24 legendary=9 special=3 total=156`; no unreviewed item.

- [ ] **Step 5: Commit the complete audit and realignment**

```powershell
git add -- pack/manifest.json pack/qa/catalog-audit.json pack/qa/generated scripts/costume-catalog-qa.test.mjs
git commit -m "fix: align and audit all costume items"
```

### Task 6: Redraw Every Item Marked `redraw`

**Files:**
- Modify: the exact existing production PNG paths selected by `pack/qa/catalog-audit.json`
- Modify: matching audit reasons/status details in `pack/qa/catalog-audit.json`
- Regenerate: the matching rarity SVGs under `pack/qa/generated`

**Interfaces:**
- Consumes: final Task 5 `redraw` IDs, current asset, canonical pet, and representative accepted style references.
- Produces: reviewed 256 x 256 RGBA replacements at unchanged production paths.

- [ ] **Step 1: Read and apply the `imagegen` skill before generating any candidate**

Use the current production item, canonical idle pet, and 2-3 accepted same-rarity assets as referenced images. Process batches in this order: common, rare, epic, legendary, special; no batch exceeds six items.

- [ ] **Step 2: Generate a staged candidate for each `redraw` item**

Construct the prompt directly from each reviewed manifest object so no name, ID, rarity, or slot is copied by hand:

```js
const prompt = `Redraw the attached costume overlay for Gamjabot. Item: ${costume.name}, ID: ${costume.id}, rarity: ${costume.rarity}. Preserve the original concept, main colors, and recognizable motifs, but add readable material details and a stronger silhouette. Match the attached Gamjabot references: thick black, slightly uneven hand-drawn outlines, simple cel shading, playful Windows desktop-pet proportions. Draw costume parts only—no pet body, no text, no checkerboard, no shadow outside the item. Center the intended attachment around slot ${costume.slot}, keep safe transparent margins, and compose for legibility when worn at 128 pixels. Output a square image with a transparent background.`;
```

Save each result only to `pack/qa/candidates/${costume.id}.png`; never write directly to the production path in `costume.file`.

- [ ] **Step 3: Normalize and validate each candidate**

Run: `node scripts/costume-catalog-qa.mjs normalize-redraws`

Run: `node scripts/costume-catalog-qa.mjs validate-candidates`

Expected: `256x256 rgba transparency=yes edge-touch=no`.

- [ ] **Step 4: Visually compare isolated and worn candidates**

Generate a temporary comparison sheet containing original isolated, candidate isolated, original worn, and candidate worn. Reject the candidate if it includes a baked pet body, changes the named concept/colors, loses thick outlines at 128 pixels, covers unrelated body regions, or touches an unintended canvas edge.

- [ ] **Step 5: Replace only accepted originals and regenerate the rarity sheet**

Copy the accepted normalized candidate over its exact existing path, then run:

Run: `npm run costumes:validate`

Run: `npm run costumes:sheets`

Expected: the ID/name/path are unchanged and the accepted candidate appears in both isolated and worn views.

- [ ] **Step 6: Commit each accepted rarity batch**

```powershell
git add -- pack/common pack/qa/catalog-audit.json pack/qa/generated/common.svg
git commit -m "art: redraw reviewed common costumes"
```

Repeat with the exact rarity directory and sheet for rare, epic, legendary, and special. Skip a rarity commit if its audit has zero redraws.

### Task 7: Final Regression and Documentation

**Files:**
- Modify: `docs/13-progress-board.md`
- Modify: `docs/17-session-handoff.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a verified, reviewable branch with complete catalog evidence.

- [ ] **Step 1: Run every automated check**

Run: `npm test`

Run: `npm run test:assets`

Run: `npm run costumes:validate`

Run: `npm run build`

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: all commands exit 0; asset validation reports exactly 156 reviewed draw candidates.

- [ ] **Step 2: Perform final visual review**

Open all five generated SVGs at 100% and confirm every label maps to the same isolated and worn asset, no image is clipped, and no prior item remains visible during rapid catalog selection. Manually rapid-click at least 20 mixed-rarity cards and finish on `legendary_003`; the preview must show `legendary_003` after all decoding settles.

- [ ] **Step 3: Verify compatibility snapshots**

Compare pre-change and post-change arrays of `{ id, name, rarity, file }`; they must be byte-for-byte equal. Load a saved `gamcha.json` with a manual alignment and confirm the saved alignment overrides the new built-in default.

- [ ] **Step 4: Update project records**

Record the exact redraw count, rarity breakdown, commands and outputs, contact-sheet paths, branch name, and any remaining rejected candidate IDs in `docs/13-progress-board.md` and `docs/17-session-handoff.md`.

- [ ] **Step 5: Commit verification records**

```powershell
git add -- docs/13-progress-board.md docs/17-session-handoff.md
git commit -m "docs: record costume catalog verification"
```

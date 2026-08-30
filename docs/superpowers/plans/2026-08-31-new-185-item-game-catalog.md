# New 185-Item Game Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every drawable costume with one of 185 original, individually wearable, cozy indie pixel-RPG items while preserving IDs, rarity rates, ownership, and single-item equipment.

**Architecture:** Five rarity blueprint files define all names, concepts, prompts, slots, and placements before image generation. Deterministic validators enforce quotas and uniqueness; generated images remain in a candidate workflow until all 185 pass format, semantic, visual, and worn-preview review, then one promotion step rewrites the production manifest and assets together.

**Tech Stack:** TypeScript/Vite/Vitest, Node.js ESM test runner, Rust/Tauri/Serde, 256×256 RGBA PNG assets, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-08-31-new-185-item-game-catalog-design.md`

## Global Constraints

- Drawable count is exactly 185: Common 80, Rare 57, Epic 31, Legendary 12, Special 5.
- Keep the existing 185 ID ranges and each ID's rarity; preserve tickets, draw count, ownership IDs, and single-item equipment.
- Use only `head`, `face`, `neck`, and `body`; they control placement and do not enable simultaneous equipment.
- Every item has a unique Korean name, silhouette, palette, material treatment, and signature detail; recolors and upgraded repeats are forbidden.
- One PNG contains exactly one wearable object and no character anatomy, text, background, checkerboard, shadow plate, duplicate, or clipped remnant.
- Every production asset is a 256×256 RGBA PNG with real transparency, safe padding, and a readable 96px worn silhouette.
- Use the approved cozy indie pixel-RPG style: crisp pixel-like outline, large readable forms, restrained shading, warm hand-crafted pixel clusters.
- Use built-in image generation once per distinct item; do not use the previous images as edit targets.
- Do not modify photo delivery, Pomodoro behavior, window climbing, settings, the right-click test window, or unrelated pet behavior.
- Preserve unrelated user changes and the content-identical `src-tauri/Cargo.toml` working-tree refresh.

---

### Task 1: Reconcile the abandoned split workflow and add blueprint infrastructure

**Files:**
- Create: `scripts/costume-blueprint.mjs`
- Create: `scripts/costume-blueprint.test.mjs`
- Modify: `.gitignore`
- Modify: `package.json`
- Restore only generated split changes in: `pack/manifest.json`
- Restore only generated split migration changes in: `src-tauri/src/application/gamcha_service.rs`
- Remove abandoned untracked files after exact-path verification: `scripts/costume-component-apply.mjs`, `scripts/costume-component-apply.test.mjs`

**Interfaces:**
- Produces: `expectedCatalogIds(): Map<string, string>` mapping each approved ID to rarity.
- Produces: `validateBlueprint(items: BlueprintItem[]): string[]`.
- Produces: `loadBlueprint(root?): Promise<BlueprintItem[]>`.
- Produces: `buildImagePrompt(item: BlueprintItem, styleLock?): string`.
- `BlueprintItem` shape:

```ts
type BlueprintItem = {
  id: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "special";
  name: string;
  slot: "head" | "face" | "neck" | "body";
  theme: string;
  silhouette: string;
  palette: { primary: string; secondary: string; accent: string };
  material: string;
  signatureDetail: string;
  prompt: string;
  defaultAlignment: { x: number; y: number; size: number };
  qaState: "planned" | "candidate" | "accepted" | "rejected";
};
```

- [ ] **Step 1: Verify the pivot targets before changing them**

Run:

```powershell
git status --short
git diff -- pack/manifest.json src-tauri/src/application/gamcha_service.rs
git hash-object src-tauri/Cargo.toml
git rev-parse :src-tauri/Cargo.toml
```

Expected: only the old generated component expansion is present in the manifest, only schema-2 derived-component migration is present in the service, and the two Cargo hashes match.

- [ ] **Step 2: Write failing blueprint ID and validation tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { expectedCatalogIds, validateBlueprint } from "./costume-blueprint.mjs";

test("declares exactly the approved 185 rarity IDs", () => {
  const ids = expectedCatalogIds();
  assert.equal(ids.size, 185);
  assert.equal([...ids.values()].filter((value) => value === "common").length, 80);
  assert.equal([...ids.values()].filter((value) => value === "rare").length, 57);
  assert.equal([...ids.values()].filter((value) => value === "epic").length, 31);
  assert.equal([...ids.values()].filter((value) => value === "legendary").length, 12);
  assert.equal([...ids.values()].filter((value) => value === "special").length, 5);
});

test("rejects duplicate concepts and non-independent slots", () => {
  const item = {
    id: "common_001", rarity: "common", name: "새벽 우편모", slot: "full",
    theme: "생활 도구", silhouette: "짧은 챙과 봉인 단추", palette: {
      primary: "남색", secondary: "갈색", accent: "금색",
    }, material: "천과 가죽", signatureDetail: "밀랍 봉인 단추",
    prompt: "남색 우편모 한 개", defaultAlignment: { x: -4, y: -30, size: 104 },
    qaState: "planned",
  };
  const errors = validateBlueprint([item, { ...item, id: "common_002" }]);
  assert.ok(errors.some((error) => error.includes("slot")));
  assert.ok(errors.some((error) => error.includes("duplicate name")));
  assert.ok(errors.some((error) => error.includes("duplicate silhouette")));
});
```

- [ ] **Step 3: Run the test and verify RED**

Run: `node --test scripts/costume-blueprint.test.mjs`

Expected: FAIL because `costume-blueprint.mjs` does not exist.

- [ ] **Step 4: Implement expected IDs, schema validation, loading, and prompt assembly**

```js
const rarityCounts = { common: 80, rare: 57, epic: 31, legendary: 12, special: 5 };
const blueprintFiles = ["common.json", "rare.json", "epic.json", "legendary.json", "special.json"];

export function expectedCatalogIds() {
  return new Map(Object.entries(rarityCounts).flatMap(([rarity, count]) =>
    Array.from({ length: count }, (_, index) => [
      `${rarity}_${String(index + 1).padStart(3, "0")}`,
      rarity,
    ]),
  ));
}

export function buildImagePrompt(item, styleLock = APPROVED_STYLE) {
  return [
    "Use case: stylized-concept",
    `Asset type: standalone ${item.rarity} desktop-pet costume icon`,
    `Subject: one ${item.name}; ${item.silhouette}`,
    `Palette: ${item.palette.primary}, ${item.palette.secondary}, ${item.palette.accent}`,
    `Materials: ${item.material}`,
    `Signature detail: ${item.signatureDetail}`,
    `Style: ${styleLock}`,
    `Item instruction: ${item.prompt}`,
    "Composition: one full uncropped item centered with generous transparent padding",
    "Constraints: square true-transparent PNG; no character anatomy; no second item; no text; no background; no checkerboard; no shadow plate; no border; no stray pixels",
  ].join("\n");
}
```

Validation must report exact IDs for missing fields, wrong rarity, duplicate name, duplicate normalized silhouette, duplicate normalized palette triplet, duplicate signature detail, unsupported slot, non-integer placement, and invalid `qaState`.

- [ ] **Step 5: Retire only the abandoned uncommitted split work**

After re-reading the diff, reverse only the old manifest expansion and service migration hunks. Remove the two untracked `costume-component-apply` files using explicit resolved paths inside this worktree. Add `/.superpowers/` to `.gitignore`; do not delete persisted brainstorming state or touch `src-tauri/Cargo.toml`.

- [ ] **Step 6: Add blueprint commands and verify GREEN**

Add:

```json
"test:assets": "node --test scripts/costume-blueprint.test.mjs scripts/costume-catalog-qa.test.mjs scripts/png-normalize.test.mjs scripts/png-semantic-analysis.test.mjs",
"costumes:blueprint": "node scripts/costume-blueprint.mjs validate"
```

Run:

```powershell
node --test scripts/costume-blueprint.test.mjs
cargo test --manifest-path src-tauri/Cargo.toml application::gamcha_service
git diff --check
```

Expected: blueprint unit tests pass, all existing GAMCHA persistence tests pass at schema 1, and no whitespace errors are reported.

- [ ] **Step 7: Commit**

```powershell
git add -- .gitignore package.json scripts/costume-blueprint.mjs scripts/costume-blueprint.test.mjs pack/manifest.json src-tauri/src/application/gamcha_service.rs
git commit -m "feat: add new catalog blueprint workflow"
```

---

### Task 2: Author the 80 Common blueprints

**Files:**
- Create: `pack/catalog-blueprint/common.json`
- Modify: `scripts/costume-blueprint.test.mjs`

**Interfaces:**
- Consumes: `BlueprintItem` and `validateBlueprint` from Task 1.
- Produces: IDs `common_001` through `common_080` with exactly 44 head, 12 face, 10 neck, and 14 body items.

- [ ] **Step 1: Add a failing Common quota test**

```js
test("common blueprint covers its approved themes and slots", async () => {
  const common = JSON.parse(await readFile(new URL("../pack/catalog-blueprint/common.json", import.meta.url)));
  assert.deepEqual(countBy(common, "theme"), {
    "생활 도구": 20, "직업 장비": 20, "여행 장비": 20, "취미·공예 장비": 20,
  });
  assert.deepEqual(countBy(common, "slot"), { head: 44, face: 12, neck: 10, body: 14 });
  assert.deepEqual(common.map(({ id }) => id), expectedIds("common", 80));
  assert.deepEqual(validateBlueprint(common), []);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test --test-name-pattern="common blueprint" scripts/costume-blueprint.test.mjs`

Expected: FAIL because `common.json` does not exist.

- [ ] **Step 3: Write 생활 도구 and 직업 장비 rows**

Create 40 rows for `common_001`–`common_040`, twenty per theme. Use familiar cloth, leather, wood, ceramic, and simple metal. Every silhouette sentence must describe a different large outer contour; every prompt must explicitly request only that item.

Example row shape:

```json
{
  "id": "common_001",
  "rarity": "common",
  "name": "새벽 우편모",
  "slot": "head",
  "theme": "생활 도구",
  "silhouette": "낮은 둥근 크라운과 짧은 사각 챙",
  "palette": { "primary": "먹남색", "secondary": "밤갈색", "accent": "밀랍금색" },
  "material": "두꺼운 천과 낡은 가죽",
  "signatureDetail": "챙 중앙의 작은 밀랍 봉인 단추",
  "prompt": "새벽 편지를 나르는 이가 쓰는 낮고 단정한 우편모 한 개",
  "defaultAlignment": { "x": -4, "y": -30, "size": 104 },
  "qaState": "planned"
}
```

- [ ] **Step 4: Write 여행 장비 and 취미·공예 장비 rows**

Create 40 rows for `common_041`–`common_080`, twenty per theme. Do not reuse the first 40 rows' headwear type, bag outline, eyewear frame, scarf knot, palette triplet, or signature detail.

- [ ] **Step 5: Run validation and correct only listed duplicates**

Run:

```powershell
node --test --test-name-pattern="common blueprint" scripts/costume-blueprint.test.mjs
node scripts/costume-blueprint.mjs validate --rarity common
```

Expected: `common=80 missing=0 duplicate=0 slot=head:44,face:12,neck:10,body:14` and a passing focused test.

- [ ] **Step 6: Commit**

```powershell
git add -- pack/catalog-blueprint/common.json scripts/costume-blueprint.test.mjs
git commit -m "content: design 80 common catalog items"
```

---

### Task 3: Author the 57 Rare blueprints

**Files:**
- Create: `pack/catalog-blueprint/rare.json`
- Modify: `scripts/costume-blueprint.test.mjs`

**Interfaces:**
- Produces: IDs `rare_001` through `rare_057` with exactly 31 head, 8 face, 6 neck, and 12 body items.

- [ ] **Step 1: Add and run a failing Rare quota test**

```js
test("rare blueprint covers its approved themes and slots", async () => {
  const rare = await loadRarityBlueprint("rare");
  assert.deepEqual(countBy(rare, "theme"), {
    "탐험가 장비": 15, "생물 영감 장비": 14, "소형 기계 장비": 14, "가상 지역 장비": 14,
  });
  assert.deepEqual(countBy(rare, "slot"), { head: 31, face: 8, neck: 6, body: 12 });
  assert.deepEqual(rare.map(({ id }) => id), expectedIds("rare", 57));
});
```

Run: `node --test --test-name-pattern="rare blueprint" scripts/costume-blueprint.test.mjs`

Expected: FAIL because `rare.json` does not exist.

- [ ] **Step 2: Write 15 탐험가 and 14 생물 영감 rows**

Use moving structures, field instruments, creature-inspired contours, and stronger material contrast. Creature inspiration may influence ears, fins, shells, feathers, or antennae, but no creature face or wearer anatomy may be baked into an item.

- [ ] **Step 3: Write 14 소형 기계 and 14 가상 지역 rows**

Mechanical rows use one readable mechanism each. Regional rows describe fictional places and avoid copying real sacred objects, military insignia, or cultural stereotypes.

- [ ] **Step 4: Validate against Common as well as Rare**

Run:

```powershell
node scripts/costume-blueprint.mjs validate --rarity rare
node scripts/costume-blueprint.mjs validate
```

Expected: Rare reports 57 valid rows; aggregate validation reports only the still-missing Epic, Legendary, and Special files, with no Common/Rare duplicate.

- [ ] **Step 5: Commit**

```powershell
git add -- pack/catalog-blueprint/rare.json scripts/costume-blueprint.test.mjs
git commit -m "content: design 57 rare catalog items"
```

---

### Task 4: Author the 31 Epic blueprints

**Files:**
- Create: `pack/catalog-blueprint/epic.json`
- Modify: `scripts/costume-blueprint.test.mjs`

**Interfaces:**
- Produces: IDs `epic_001` through `epic_031` with exactly 16 head, 5 face, 4 neck, and 6 body items.

- [ ] **Step 1: Add and run a failing Epic quota test**

```js
test("epic blueprint covers its approved themes and slots", async () => {
  const epic = await loadRarityBlueprint("epic");
  assert.deepEqual(countBy(epic, "theme"), {
    "마법 학파 장비": 8, "원소 장비": 8, "신비 조직 장비": 8, "꿈·차원 장비": 7,
  });
  assert.deepEqual(countBy(epic, "slot"), { head: 16, face: 5, neck: 4, body: 6 });
});
```

Run: `node --test --test-name-pattern="epic blueprint" scripts/costume-blueprint.test.mjs`

Expected: FAIL because `epic.json` does not exist.

- [ ] **Step 2: Write 8 마법 학파 and 8 원소 rows**

Each row uses one dominant symbol and one unusual material. Keep glowing runes, crystals, flames, water, wind, stone, lightning, frost, and plant energy distinguishable by outer contour rather than color alone.

- [ ] **Step 3: Write 8 신비 조직 and 7 꿈·차원 rows**

Give each fictional organization a unique emblem shape used once. Dream and dimension items may bend geometry but must remain a single connected wearable silhouette.

- [ ] **Step 4: Validate all authored rarities and commit**

Run: `node scripts/costume-blueprint.mjs validate`

Expected: 168 authored rows pass uniqueness checks; only Legendary and Special are reported missing.

```powershell
git add -- pack/catalog-blueprint/epic.json scripts/costume-blueprint.test.mjs
git commit -m "content: design 31 epic catalog items"
```

---

### Task 5: Author Legendary and Special blueprints and lock all 185 concepts

**Files:**
- Create: `pack/catalog-blueprint/legendary.json`
- Create: `pack/catalog-blueprint/special.json`
- Modify: `scripts/costume-blueprint.test.mjs`

**Interfaces:**
- Produces: `legendary_001`–`legendary_012` with slots 6/2/1/3.
- Produces: `special_001`–`special_005` with slots 2/1/1/1.
- Completes the 185-row input consumed by candidate and manifest tasks.

- [ ] **Step 1: Add failing final-count, Legendary, and Special tests**

```js
test("complete blueprint contains 185 unique original items", async () => {
  const items = await loadBlueprint();
  assert.equal(items.length, 185);
  assert.equal(new Set(items.map(({ id }) => id)).size, 185);
  assert.equal(new Set(items.map(({ name }) => name)).size, 185);
  assert.deepEqual(validateBlueprint(items), []);
});

test("legendary and special quotas are exact", async () => {
  assert.deepEqual(countBy(await loadRarityBlueprint("legendary"), "theme"), {
    "천체 장비": 3, "고대 군주 장비": 3, "세계수·거대 생물 장비": 3, "우주 현상 장비": 3,
  });
  assert.deepEqual(countBy(await loadRarityBlueprint("special"), "slot"), {
    head: 2, face: 1, neck: 1, body: 1,
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test scripts/costume-blueprint.test.mjs`

Expected: FAIL because both files are missing.

- [ ] **Step 3: Write 12 Legendary rows**

Create three items for each approved Legendary theme. Every item must introduce a silhouette category absent from Epic; use no more than one crown-shaped item and no more than one hood-shaped item across all twelve.

- [ ] **Step 4: Write the five exact Special concepts**

Create one item each for photo delivery (`body`), focus timer (`head`), window climbing (`neck`), GAMCHA (`face`), and Migam identity (`head`). Use fantasy metaphors without UI text or test commands.

- [ ] **Step 5: Validate the complete design table**

Run:

```powershell
node --test scripts/costume-blueprint.test.mjs
npm run costumes:blueprint
```

Expected: `items=185 missing=0 duplicateName=0 duplicateSilhouette=0 duplicatePalette=0 duplicateDetail=0` and all Node tests pass.

- [ ] **Step 6: Commit**

```powershell
git add -- pack/catalog-blueprint/legendary.json pack/catalog-blueprint/special.json scripts/costume-blueprint.test.mjs
git commit -m "content: complete 185-item catalog blueprint"
```

---

### Task 6: Build a 185-item candidate validation and promotion pipeline

**Files:**
- Modify: `scripts/costume-normalize-candidates.mjs`
- Modify: `scripts/costume-promote-candidates.mjs`
- Create: `scripts/costume-candidate-pipeline.test.mjs`
- Create: `pack/qa/new-catalog-style-lock.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `validateCandidate(item, decoded): string[]`.
- Produces: `acceptedCandidatePath(item): string` at `pack/qa/accepted/<rarity>/<id>.png`.
- Produces CLI: `node scripts/costume-normalize-candidates.mjs --blueprint <id...>`.
- Produces CLI: `node scripts/costume-promote-candidates.mjs [--apply]` that requires 185 accepted items.

- [ ] **Step 1: Write failing pipeline tests**

```js
test("rejects an incomplete candidate set before promotion", async () => {
  const result = await planPromotion(blueprint, new Map([["common_001", pngBytes]]));
  assert.ok(result.errors.includes("expected 185 accepted candidates, got 1"));
});

test("normalizes candidates into rarity directories", async () => {
  assert.equal(
    acceptedCandidatePath({ id: "epic_004", rarity: "epic" }),
    resolve(repositoryRoot, "pack/qa/accepted/epic/epic_004.png"),
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test scripts/costume-candidate-pipeline.test.mjs`

Expected: FAIL because the new exports and accepted-directory flow do not exist.

- [ ] **Step 3: Implement validation and normalization**

Each candidate must be 256×256 RGBA, contain transparent pixels and visible pixels, retain at least 12 transparent pixels of margin on every side, span at least 64 pixels in width or height, have no alpha-dust warning, and have no visible pixels touching an edge. Write normalized output under `pack/qa/accepted/<rarity>/` only after validation succeeds.

- [ ] **Step 4: Rewrite promotion to use the blueprint instead of the old repair audit**

Dry-run promotion checks all 185 blueprint rows have `qaState: "accepted"`, all accepted files exist, IDs and rarities match, and destination paths remain inside `pack/<rarity>/`. `--apply` copies files only after the entire dry run is error-free.

- [ ] **Step 5: Save the approved style lock**

```json
{
  "name": "cozy-indie-pixel-rpg",
  "required": [
    "crisp pixel-like dark outline",
    "large readable silhouette",
    "restrained shading",
    "warm hand-crafted pixel clusters",
    "readable at 96px",
    "one centered wearable on true transparency"
  ],
  "forbidden": [
    "character anatomy", "second item", "text", "background", "checkerboard",
    "shadow plate", "border", "duplicate", "cropped edge", "stray pixels"
  ]
}
```

- [ ] **Step 6: Update scripts, verify, and commit**

Add `costumes:normalize`, `costumes:validate-candidates`, and `costumes:promote-candidates` commands using the rewritten scripts.

Run:

```powershell
node --test scripts/costume-candidate-pipeline.test.mjs
npm run costumes:validate-candidates
```

Expected: tests pass; dry-run fails safely with an exact list of 185 missing accepted candidates.

```powershell
git add -- package.json scripts/costume-normalize-candidates.mjs scripts/costume-promote-candidates.mjs scripts/costume-candidate-pipeline.test.mjs pack/qa/new-catalog-style-lock.json
git commit -m "feat: add full-catalog candidate pipeline"
```

---

### Task 7: Generate and approve one style-lock pilot per rarity

**Files:**
- Create through built-in generation and normalization: `pack/qa/accepted/common/common_001.png`
- Create: `pack/qa/accepted/rare/rare_001.png`
- Create: `pack/qa/accepted/epic/epic_001.png`
- Create: `pack/qa/accepted/legendary/legendary_001.png`
- Create: `pack/qa/accepted/special/special_001.png`
- Modify: five matching rows across `pack/catalog-blueprint/*.json`
- Generate: `pack/qa/generated/pilots.svg`

**Interfaces:**
- Consumes: `buildImagePrompt` and the style lock.
- Produces: five `qaState: "accepted"` pilot rows that become the visual reference for all remaining calls.

- [ ] **Step 1: Generate five pilot images with separate built-in calls**

Call built-in image generation once for each of `common_001`, `rare_001`, `epic_001`, `legendary_001`, and `special_001`. Use the exact prompt returned by `buildImagePrompt`; omit reference images so old artwork cannot influence the result.

- [ ] **Step 2: Copy generated outputs into raw candidate paths and normalize**

Copy each selected default generated-image output into `pack/qa/candidates/raw/<rarity>/<id>.png`, leaving the generated original in place. Then run:

```powershell
node scripts/costume-normalize-candidates.mjs --blueprint common_001 rare_001 epic_001 legendary_001 special_001
```

- [ ] **Step 3: Generate and inspect the pilot sheet**

The sheet shows each isolated icon at 4× logical scale and worn at 96px. Reject a pilot if it has style drift, more than one object, an opaque face opening where transparency is expected, a clipped contour, unreadable details, or anatomy.

- [ ] **Step 4: Iterate with one correction per rejected pilot**

Regenerate only the failed ID, naming the single defect in the prompt. Repeat normalization and sheet review until all five pass.

- [ ] **Step 5: Mark the five rows accepted and verify**

Run:

```powershell
node scripts/costume-blueprint.mjs validate
node --test scripts/costume-candidate-pipeline.test.mjs
```

Expected: all blueprint tests pass and promotion reports exactly 180 candidates still missing.

- [ ] **Step 6: Commit pilot assets and decisions**

```powershell
git add -f -- pack/qa/accepted/common/common_001.png pack/qa/accepted/rare/rare_001.png pack/qa/accepted/epic/epic_001.png pack/qa/accepted/legendary/legendary_001.png pack/qa/accepted/special/special_001.png
git add -- pack/catalog-blueprint pack/qa/generated/pilots.svg
git commit -m "art: approve new catalog style pilots"
```

---

### Task 8: Generate and approve the remaining 79 Common items

**Files:**
- Create: `pack/qa/accepted/common/common_002.png` through `common_080.png`
- Modify: `pack/catalog-blueprint/common.json`
- Generate: `pack/qa/generated/new-common.svg`

**Interfaces:**
- Produces: all 80 Common rows at `qaState: "accepted"`.

- [ ] **Step 1: Generate Common IDs 002–020 individually**

Use one built-in call per item with `buildImagePrompt`. Copy selected results to matching raw candidate paths, normalize, and generate the Common contact sheet.

- [ ] **Step 2: Inspect 002–020 and correct exact failures**

Review at 4× and 96px. Also compare every new silhouette against accepted Common items; regenerate any recolor-like or structurally repeated item.

- [ ] **Step 3: Repeat the same loop for IDs 021–040**

Do not begin the next range until all rows in this range are accepted.

- [ ] **Step 4: Repeat the same loop for IDs 041–060**

Confirm the second half does not reuse headwear, eyewear frame, knot, bag outline, or signature detail from IDs 001–040.

- [ ] **Step 5: Repeat the same loop for IDs 061–080**

Complete the approved slot totals 44/12/10/14 and mark all eighty rows accepted.

- [ ] **Step 6: Validate and commit Common assets**

Run:

```powershell
node scripts/costume-blueprint.mjs validate --rarity common
node scripts/costume-promote-candidates.mjs
```

Expected: Common reports 80 accepted; full promotion reports 105 non-Common candidates missing.

```powershell
git add -f -- pack/qa/accepted/common
git add -- pack/catalog-blueprint/common.json pack/qa/generated/new-common.svg
git commit -m "art: create 80 original common items"
```

---

### Task 9: Generate and approve the remaining 56 Rare items

**Files:**
- Create: `pack/qa/accepted/rare/rare_002.png` through `rare_057.png`
- Modify: `pack/catalog-blueprint/rare.json`
- Generate: `pack/qa/generated/new-rare.svg`

**Interfaces:**
- Produces: all 57 Rare rows at `qaState: "accepted"`.

- [ ] **Step 1: Generate and review IDs 002–015**

Use separate built-in calls and the fixed style lock. Creature-inspired items must contain wearable contours only, not eyes, mouths, limbs, or a full creature.

- [ ] **Step 2: Generate and review IDs 016–029**

Reject any mechanical item with unreadable miniature machinery or more than one independent device.

- [ ] **Step 3: Generate and review IDs 030–043**

Confirm fictional regional items do not copy real sacred or military symbols.

- [ ] **Step 4: Generate and review IDs 044–057**

Complete slot totals 31/8/6/12 and compare silhouettes against all Common and Rare accepted assets.

- [ ] **Step 5: Validate and commit Rare assets**

Run: `node scripts/costume-blueprint.mjs validate --rarity rare`

Expected: `rare=57 accepted=57 duplicate=0`.

```powershell
git add -f -- pack/qa/accepted/rare
git add -- pack/catalog-blueprint/rare.json pack/qa/generated/new-rare.svg
git commit -m "art: create 57 original rare items"
```

---

### Task 10: Generate and approve the remaining 30 Epic items

**Files:**
- Create: `pack/qa/accepted/epic/epic_002.png` through `epic_031.png`
- Modify: `pack/catalog-blueprint/epic.json`
- Generate: `pack/qa/generated/new-epic.svg`

**Interfaces:**
- Produces: all 31 Epic rows at `qaState: "accepted"`.

- [ ] **Step 1: Generate and review IDs 002–009**

Limit every item to one dominant magical symbol; reject dense micro-runes that disappear at 96px.

- [ ] **Step 2: Generate and review IDs 010–017**

Confirm element identity comes from silhouette and material, not color alone.

- [ ] **Step 3: Generate and review IDs 018–025**

Use each fictional organization emblem only once.

- [ ] **Step 4: Generate and review IDs 026–031**

Dream and dimension items remain one connected wearable object with safe padding.

- [ ] **Step 5: Validate and commit Epic assets**

Run: `node scripts/costume-blueprint.mjs validate --rarity epic`

Expected: `epic=31 accepted=31 duplicate=0`.

```powershell
git add -f -- pack/qa/accepted/epic
git add -- pack/catalog-blueprint/epic.json pack/qa/generated/new-epic.svg
git commit -m "art: create 31 original epic items"
```

---

### Task 11: Generate and approve Legendary and Special items

**Files:**
- Create: `pack/qa/accepted/legendary/legendary_002.png` through `legendary_012.png`
- Create: `pack/qa/accepted/special/special_002.png` through `special_005.png`
- Modify: `pack/catalog-blueprint/legendary.json`
- Modify: `pack/catalog-blueprint/special.json`
- Generate: `pack/qa/generated/new-legendary.svg`
- Generate: `pack/qa/generated/new-special.svg`

**Interfaces:**
- Produces: all 12 Legendary and all 5 Special rows at `qaState: "accepted"`.

- [ ] **Step 1: Generate and review Legendary IDs 002–006**

Compare each against Epic; reject any item that looks like an Epic design with more gold or extra decoration.

- [ ] **Step 2: Generate and review Legendary IDs 007–012**

Enforce no more than one crown and one hood among all twelve Legendary silhouettes.

- [ ] **Step 3: Generate and review Special IDs 002–005**

Confirm the five app-feature metaphors are recognizable from their names and shapes without text, logos, screenshots, or test-menu content.

- [ ] **Step 4: Validate the full accepted candidate set**

Run:

```powershell
node scripts/costume-blueprint.mjs validate
npm run costumes:validate-candidates
```

Expected: `items=185 accepted=185 missingCandidate=0 invalidCandidate=0`.

- [ ] **Step 5: Commit**

```powershell
git add -f -- pack/qa/accepted/legendary pack/qa/accepted/special
git add -- pack/catalog-blueprint/legendary.json pack/catalog-blueprint/special.json pack/qa/generated/new-legendary.svg pack/qa/generated/new-special.svg
git commit -m "art: complete legendary and special catalog"
```

---

### Task 12: Promote all 185 assets and apply the blueprint to production

**Files:**
- Modify: `pack/manifest.json`
- Replace: `pack/common/*.png`, `pack/rare/*.png`, `pack/epic/*.png`, `pack/legendary/*.png`, `pack/special/*.png`
- Modify: `src/costumes/catalog.ts`
- Modify: `src/costumes/catalog.test.ts`
- Modify: `src/costumes/alignment.ts`
- Modify: `src/costumes/alignment.test.ts`
- Modify: `src-tauri/src/domain/costume_catalog.rs`
- Remove obsolete repair-only files: `scripts/costume-semantic-audit.mjs`, `scripts/costume-semantic-audit.test.mjs`, `scripts/costume-semantic-review-decisions.mjs`, `pack/qa/catalog-semantic-audit.json`, `pack/qa/generated/raw/`, `pack/qa/generated/worn/`

**Interfaces:**
- Produces: `applyBlueprint(manifest, items): Manifest` with 185 drawables and three unchanged defaults.
- Runtime `CostumeSlot` becomes `"head" | "face" | "neck" | "body"`.
- Rust catalog keeps dynamic rarity pools but removes old `parentSetId`/derived-component support.

- [ ] **Step 1: Write failing manifest application tests**

```js
test("applies exactly 185 blueprint rows while preserving defaults", async () => {
  const result = applyBlueprint(baseManifest, blueprint);
  const drawables = result.costumes.filter(({ rarity }) => rarity !== "default");
  assert.equal(drawables.length, 185);
  assert.equal(result.costumes.filter(({ rarity }) => rarity === "default").length, 3);
  assert.equal(result.count, 188);
  assert.ok(drawables.every((row) => !("parentSetId" in row) && !("source" in row)));
});
```

Update the Vitest expectation to 185 and assert no runtime row uses `full`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```powershell
node --test scripts/costume-blueprint.test.mjs
npm test -- --run src/costumes/catalog.test.ts src/costumes/alignment.test.ts
```

Expected: FAIL because production manifest and runtime slot type still describe the old catalog.

- [ ] **Step 3: Implement deterministic manifest application**

For every blueprint item write only `id`, `name`, `rarity`, `collection` (equal to `theme`), `file`, `slot`, and `defaultAlignment`. Preserve the manifest canvas metadata and the three default rows. File paths are `<rarity>/<id>.png`; count is 188.

- [ ] **Step 4: Dry-run then atomically promote all accepted images**

Run:

```powershell
npm run costumes:validate-candidates
npm run costumes:promote-candidates
```

The first command must report 185 ready replacements before the second applies them. Promotion must not begin if any candidate is missing.

- [ ] **Step 5: Remove old split provenance and repair-only workflow**

Remove `full` from front-end types/defaults. Remove `parentSetId`, `components_by_parent`, and `derived_components` from the Rust catalog, retaining only manifest-derived rarity pools. Delete the listed repair-only scripts, ledger, and sheets after confirming the new blueprint and contact sheets cover all 185 IDs.

- [ ] **Step 6: Run focused runtime tests**

Run:

```powershell
node --test scripts/costume-blueprint.test.mjs scripts/costume-candidate-pipeline.test.mjs
npm test -- --run src/costumes/catalog.test.ts src/costumes/alignment.test.ts src/costumes/latest-asset-loader.test.ts
cargo test --manifest-path src-tauri/Cargo.toml domain::costume_catalog
cargo test --manifest-path src-tauri/Cargo.toml domain::gamcha
```

Expected: all focused tests pass with 185 drawables.

- [ ] **Step 7: Commit production replacement**

```powershell
git add -- pack/manifest.json pack/common pack/rare pack/epic pack/legendary pack/special src/costumes src-tauri/src/domain/costume_catalog.rs scripts pack/qa
git commit -m "feat: replace catalog with 185 original game items"
```

---

### Task 13: Tune per-item placement from complete worn sheets

**Files:**
- Modify: `pack/catalog-blueprint/*.json`
- Modify: `pack/manifest.json`
- Modify: `scripts/costume-catalog-qa.mjs`
- Generate: `pack/qa/generated/final/{common,rare,epic,legendary,special}.svg`

**Interfaces:**
- Consumes: all 185 production PNGs and `defaultAlignment`.
- Produces: final item-specific `x`, `y`, and `size` values mirrored in blueprint and manifest.

- [ ] **Step 1: Update sheet generation for 185 blueprint-backed rows**

Each cell must show isolated art at 4×, worn art at 96px, ID, Korean name, rarity, slot, placement, visible bounds, and candidate warnings.

- [ ] **Step 2: Generate all five final sheets**

Run: `npm run costumes:sheets`

Expected: five SVGs and 185 total cells in manifest order.

- [ ] **Step 3: Review Common and Rare in manifest order**

Adjust only blueprint and manifest alignment values. Head items must clear the face, face items align with the eyes, neck items sit below the mouth, and body items remain inside the 96×104 pet cell.

- [ ] **Step 4: Review Epic, Legendary, and Special in manifest order**

Re-check all larger silhouettes at the actual pet window scale; reduce size rather than clipping ornate edges.

- [ ] **Step 5: Add representative alignment regressions**

```ts
it("keeps representative new-catalog placements inside supported ranges", () => {
  for (const id of ["common_001", "rare_001", "epic_001", "legendary_001", "special_001"]) {
    const alignment = costumeById.get(id)!.defaultAlignment;
    expect(alignment.x).toBeGreaterThanOrEqual(-80);
    expect(alignment.y).toBeGreaterThanOrEqual(-80);
    expect(alignment.size).toBeGreaterThanOrEqual(48);
    expect(alignment.size).toBeLessThanOrEqual(180);
  }
});
```

- [ ] **Step 6: Verify and commit placement**

Run: `npm test -- --run src/costumes/alignment.test.ts src/costumes/catalog.test.ts`

```powershell
git add -- pack/catalog-blueprint pack/manifest.json pack/qa/generated/final scripts/costume-catalog-qa.mjs src/costumes/alignment.test.ts
git commit -m "fix: tune placement for new catalog items"
```

---

### Task 14: Enforce final image uniqueness and semantic QA

**Files:**
- Modify: `scripts/costume-catalog-qa.mjs`
- Modify: `scripts/costume-catalog-qa.test.mjs`
- Create: `scripts/lib/sprite-similarity.mjs`
- Create: `scripts/sprite-similarity.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `silhouetteFingerprint(decoded, size = 16): Uint8Array`.
- Produces: `findNearDuplicateSprites(entries, threshold?): Array<{ left, right, distance }>`.
- Final validator combines blueprint, manifest, format, semantic, and near-duplicate checks.

- [ ] **Step 1: Write failing exact and recolor duplicate tests**

```js
test("finds identical silhouettes even when RGB colors differ", () => {
  const red = rgbaSprite([[4, 4, 255, 0, 0, 255], [5, 4, 255, 0, 0, 255]]);
  const blue = rgbaSprite([[4, 4, 0, 0, 255, 255], [5, 4, 0, 0, 255, 255]]);
  const pairs = findNearDuplicateSprites([{ id: "a", png: red }, { id: "b", png: blue }]);
  assert.deepEqual(pairs.map(({ left, right }) => [left, right]), [["a", "b"]]);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test scripts/sprite-similarity.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement alpha-silhouette fingerprints and distance**

Downsample visible alpha into a 16×16 occupancy grid after normalizing bounds, compare occupancy and edge transitions, and report suspicious pairs with IDs and numeric distance. The final threshold must flag the synthetic recolor test while not flagging the five approved pilots.

- [ ] **Step 4: Strengthen final catalog validation**

Assert exact rarity/slot counts, blueprint-to-manifest field equality, file existence, 256×256 RGBA, transparency, safe margins, minimum span, no alpha dust, no edge contact, unique file hashes, and zero near-duplicate pairs. Human-only single-object and anatomy checks remain represented by all 185 `qaState: "accepted"` rows and the final contact sheets.

- [ ] **Step 5: Run all asset validation**

Run:

```powershell
npm run test:assets
npm run costumes:blueprint
npm run costumes:validate
git diff --check
```

Expected: zero failures, `total=185`, and no suspicious pair output.

- [ ] **Step 6: Commit**

```powershell
git add -- package.json scripts/costume-catalog-qa.mjs scripts/costume-catalog-qa.test.mjs scripts/lib/sprite-similarity.mjs scripts/sprite-similarity.test.mjs
git commit -m "test: enforce new catalog image quality"
```

---

### Task 15: Run full verification and record the handoff

**Files:**
- Modify: `docs/13-progress-board.md`
- Modify: `docs/17-session-handoff.md`

**Interfaces:**
- Produces: verified Windows manual-test instructions and final catalog totals.

- [ ] **Step 1: Run the full front-end and asset suite**

```powershell
npm run test:assets
npm run costumes:validate
npm test
npm run build
```

Expected: zero failures and a successful production build.

- [ ] **Step 2: Run the full Rust suite and static checks**

```powershell
cargo test --manifest-path .\src-tauri\Cargo.toml
cargo fmt --manifest-path .\src-tauri\Cargo.toml --check
cargo clippy --manifest-path .\src-tauri\Cargo.toml --all-targets -- -D warnings
```

Expected: all tests pass, format is clean, and Clippy reports no warnings.

- [ ] **Step 3: Launch the development app for manual checks**

Run: `npm run tauri -- dev`

Verify representative Common, Rare, Epic, Legendary, and Special items can be drawn, appear with new names and art, retain existing owned IDs, equip one at a time, and render without clipping. Confirm photo delivery, Pomodoro, window climbing, and settings still behave as before.

- [ ] **Step 4: Record exact results**

Document 185 drawable items, rarity counts 80/57/31/12/5, slot counts 99/28/22/36, generated sheet counts, automated test totals, build result, and any remaining Windows-only observation.

- [ ] **Step 5: Verify final status and commit documentation**

```powershell
git add -- docs/13-progress-board.md docs/17-session-handoff.md
git commit -m "docs: record new catalog verification"
git status --short
git diff --check main...HEAD
```

Expected: no project changes remain except a possible content-identical `src-tauri/Cargo.toml` working-tree refresh whose working and index hashes match.

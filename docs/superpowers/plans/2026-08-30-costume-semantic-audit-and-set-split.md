# Costume Semantic Audit and Set Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inspect every production costume as an isolated asset, split every composite outfit into individually collectible components, redraw all clipped/noisy/undersized assets, and preserve existing GAMCHA ownership.

**Architecture:** A semantic audit ledger becomes the source of truth for manual decisions, while PNG analysis supplies deterministic warnings for edge contact, tiny occupancy, and alpha noise. The Rust draw pool is derived from the manifest instead of fixed counts, and GAMCHA schema migration grants every derived component to owners of a legacy composite ID. Project-bound image generation uses one built-in image edit per component or deficient asset, followed by normalization, promotion, and two-pass visual QA.

**Tech Stack:** TypeScript/Vite/Vitest, Node.js ESM test runner, Rust/Tauri/Serde, 256×256 RGBA PNG assets, built-in image generation.

**Spec:** `docs/superpowers/specs/2026-08-30-costume-semantic-audit-and-set-split-design.md`

## Global Constraints

- Judge defects from `pack/<rarity>/*.png`, not from the worn screenshot's Gamjabot body.
- Inspect every existing non-default manifest item exactly once before promoting replacements.
- Split the 19 explicit set names and every additional image that combines independent wearable components.
- Keep each legacy composite ID on its primary component; allocate additional IDs after the current maximum number in that rarity.
- A legacy owner receives every component whose `parentSetId` equals the owned legacy ID.
- Only one component is equipped at a time; multi-layer equipment is outside this change.
- Every production asset remains a 256×256 RGBA PNG with real transparency.
- Use built-in image generation, one call per distinct project asset, and promote only reviewed candidates.
- Do not alter photo delivery, window climbing, unrelated pet behavior, release metadata, or the user's unrelated worktree changes.

---

### Task 1: Add semantic PNG analysis

**Files:**
- Modify: `scripts/lib/png-rgba.mjs`
- Create: `scripts/png-semantic-analysis.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `readPngRgba(path): { width, height, pixels }`
- Produces: `analyzePngSemantics(decoded, options?): SemanticMetrics`
- `SemanticMetrics` shape: `{ bounds, edgeMargins, opaqueRatio, lowAlphaPixels, isolatedComponents, warnings }`

- [ ] **Step 1: Write failing tests for edge contact, tiny occupancy, and alpha dust**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { analyzePngSemantics } from "./lib/png-rgba.mjs";

function rgba(width, height, pixels) {
  const rgbaPixels = new Uint8Array(width * height * 4);
  for (const [x, y, alpha] of pixels) rgbaPixels[(y * width + x) * 4 + 3] = alpha;
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
    [7, 7, 255], [7, 8, 255], [8, 7, 255], [8, 8, 255], [15, 15, 12],
  ]));
  assert.equal(metrics.lowAlphaPixels, 1);
  assert.ok(metrics.warnings.includes("alpha-dust"));
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test scripts/png-semantic-analysis.test.mjs`

Expected: FAIL because `analyzePngSemantics` is not exported.

- [ ] **Step 3: Implement connected-component and bound analysis**

```js
export function analyzePngSemantics(
  { width, height, pixels },
  { visibleAlpha = 16, dustAlpha = 32, minimumSpan = 56 } = {},
) {
  // Walk 8-connected visible-alpha pixels, calculate the union bounds,
  // edge margins, component sizes, low-alpha dust, and stable warning slugs.
}
```

The implementation must emit only these warning slugs: `empty`, `edge-contact`, `undersized`, `alpha-dust`, `isolated-specks`. Components of at least 16 pixels are retained as intentional candidates; smaller components are reported without deleting pixels.

- [ ] **Step 4: Add the new test to `test:assets` and verify GREEN**

Run: `npm run test:assets`

Expected: all existing asset tests plus the three semantic-analysis tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- package.json scripts/lib/png-rgba.mjs scripts/png-semantic-analysis.test.mjs
git commit -m "test: add semantic costume image analysis"
```

---

### Task 2: Define the semantic audit ledger and dual review sheets

**Files:**
- Create: `scripts/costume-semantic-audit.mjs`
- Create: `scripts/costume-semantic-audit.test.mjs`
- Create: `pack/qa/catalog-semantic-audit.json`
- Create: `pack/qa/generated/raw/`
- Create: `pack/qa/generated/worn/`
- Modify: `package.json`

**Interfaces:**
- Produces: `loadSemanticAudit(path, manifest): SemanticAuditRow[]`
- Produces: `validateSemanticAudit(rows, manifest): string[]`
- Produces: `renderRawSheet(rarity, rows): string`
- Produces: `renderWornSheet(rarity, rows): string`
- Audit row shape:

```ts
type SemanticAuditRow = {
  id: string;
  state: "keep" | "realign" | "split" | "redraw";
  observations: string[];
  warnings: string[];
  components: Array<{
    name: string;
    slot: "head" | "face" | "neck" | "body";
    primary: boolean;
  }>;
};
```

- [ ] **Step 1: Write failing ledger coverage tests**

```js
test("requires one concrete audit row per drawable manifest item", async () => {
  const errors = validateSemanticAudit(audit, manifest);
  assert.deepEqual(errors, []);
  assert.equal(new Set(audit.map((row) => row.id)).size, drawable.length);
});

test("rejects generic observations and invalid split rows", () => {
  const errors = validateSemanticAudit([{
    id: "rare_007",
    state: "split",
    observations: ["원본 디테일과 착용 위치가 적절함."],
    warnings: [],
    components: [{ name: "해적 모자", slot: "head", primary: true }],
  }], manifest);
  assert.ok(errors.some((error) => error.includes("concrete observation")));
  assert.ok(errors.some((error) => error.includes("two components")));
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test scripts/costume-semantic-audit.test.mjs`

Expected: FAIL because the module and ledger do not exist.

- [ ] **Step 3: Implement strict ledger parsing and sheet generation**

Raw sheets must show the isolated PNG at 4× logical scale with ID, name, slot, alpha bounds, warnings, and decision. Worn sheets must show the same item composited on the idle Gamjabot using the manifest alignment, without changing the source PNG.

- [ ] **Step 4: Seed all current entries as unreviewed concrete rows**

Run: `node scripts/costume-semantic-audit.mjs seed`

Expected: the ledger contains every current drawable ID exactly once and validation intentionally reports every row whose `observations` is empty.

- [ ] **Step 5: Generate both sheet families**

Run: `node scripts/costume-semantic-audit.mjs sheets`

Expected: five raw SVG sheets and five worn SVG sheets under the two generated directories.

- [ ] **Step 6: Commit the QA framework and unreviewed ledger**

```powershell
git add -- package.json scripts/costume-semantic-audit.mjs scripts/costume-semantic-audit.test.mjs pack/qa/catalog-semantic-audit.json pack/qa/generated/raw pack/qa/generated/worn
git commit -m "feat: add semantic costume audit workflow"
```

---

### Task 3: Complete the 156-item manual semantic audit

**Files:**
- Modify: `pack/qa/catalog-semantic-audit.json`
- Regenerate: `pack/qa/generated/raw/*.svg`
- Regenerate: `pack/qa/generated/worn/*.svg`

**Interfaces:**
- Consumes: Task 2 ledger and sheet commands.
- Produces: a validated row for every original drawable ID with concrete observations and component names.

- [ ] **Step 1: Review common IDs 001–072 in manifest order**

For every row, record visible edge clipping, duplicated remnants, low-alpha dust, card readability, component count, and alignment. Do not reuse the previous generic `keep` reason.

- [ ] **Step 2: Review rare IDs 001–048 in manifest order**

Explicitly re-check the user-reported `rare_003`, `rare_007`, `rare_012`, `rare_017`, `rare_046` and every row named `세트`.

- [ ] **Step 3: Review epic IDs 001–024, legendary IDs 001–009, and special IDs 001–003**

Explicitly re-check `legendary_003` for tiny occupancy and horizontal noise and `legendary_009` for card readability.

- [ ] **Step 4: Mark all combined components regardless of the word `세트`**

`common_071` must be split into `필름 사진가 베레모`, `필름 사진가 카메라`, and `필름 사진가 넥타이` if all three remain visible in its raw image. Apply the same rule to every other composite found in the sheets.

- [ ] **Step 5: Validate the completed ledger**

Run: `node scripts/costume-semantic-audit.mjs validate`

Expected: `reviewed=156 missing=0 duplicate=0 generic=0`, followed by counts for keep, realign, split, and redraw.

- [ ] **Step 6: Commit the human audit separately**

```powershell
git add -- pack/qa/catalog-semantic-audit.json pack/qa/generated/raw pack/qa/generated/worn
git commit -m "docs: complete semantic audit of costume catalog"
```

---

### Task 4: Derive GAMCHA draw pools from the manifest

**Files:**
- Create: `src-tauri/src/domain/costume_catalog.rs`
- Modify: `src-tauri/src/domain/mod.rs`
- Modify: `src-tauri/src/domain/gamcha.rs`
- Modify: `src-tauri/src/application/gamcha_service.rs`

**Interfaces:**
- Produces: `pub fn costume_ids_for(rarity: GamchaRarity) -> &'static [String]`
- Produces: `pub fn derived_components(parent_set_id: &str) -> &'static [String]`
- Consumes manifest fields `id`, `rarity`, and optional `parentSetId`.

- [ ] **Step 1: Write failing tests for non-hardcoded pools**

```rust
#[test]
fn draw_pools_match_every_manifest_entry_without_fixed_counts() {
    let total = [
        GamchaRarity::Common,
        GamchaRarity::Rare,
        GamchaRarity::Epic,
        GamchaRarity::Legendary,
        GamchaRarity::Special,
    ]
    .into_iter()
    .map(|rarity| costume_ids_for(rarity).len())
    .sum::<usize>();
    assert_eq!(total, drawable_manifest_count());
}
```

- [ ] **Step 2: Run the focused Rust test and verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml draw_pools_match_every_manifest_entry_without_fixed_counts`

Expected: FAIL because `costume_catalog` does not exist.

- [ ] **Step 3: Parse the embedded manifest once with `OnceLock`**

```rust
#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
pub enum GamchaRarity {
    Common,
    Rare,
    Epic,
    Legendary,
    Special,
}

static CATALOG: OnceLock<CostumeCatalog> = OnceLock::new();

pub fn costume_ids_for(rarity: GamchaRarity) -> &'static [String] {
    CATALOG.get_or_init(CostumeCatalog::from_embedded_manifest)
        .ids_by_rarity
        .get(&rarity)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}
```

Sort IDs by numeric suffix and reject duplicate IDs during initialization. Replace `GamchaRarity::count` and `costume_id` use in draws with the returned slice.

- [ ] **Step 4: Run Rust tests and verify GREEN**

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::gamcha application::gamcha_service`

Expected: all GAMCHA domain and service tests pass with current 156 entries.

- [ ] **Step 5: Commit**

```powershell
git add -- src-tauri/src/domain/costume_catalog.rs src-tauri/src/domain/mod.rs src-tauri/src/domain/gamcha.rs src-tauri/src/application/gamcha_service.rs
git commit -m "refactor: derive gamcha pools from costume manifest"
```

---

### Task 5: Implement legacy set ownership migration

**Files:**
- Modify: `src-tauri/src/application/gamcha_service.rs`
- Test: `src-tauri/src/application/gamcha_service.rs`

**Interfaces:**
- Consumes: `derived_components(parent_set_id)` from Task 4.
- Produces: `fn migrate_progress(progress: GamchaProgress) -> Result<GamchaProgress, String>`.

- [ ] **Step 1: Write a failing schema-one migration test**

```rust
#[test]
fn legacy_set_owner_receives_every_derived_component() {
    let progress: GamchaProgress = serde_json::from_str(r#"{
      "schemaVersion": 1,
      "tickets": 4,
      "totalDraws": 9,
      "ownedCostumeIds": ["common_071"],
      "equippedCostumeId": "common_071",
      "costumeAlignments": {"common_071": {"x": 2, "y": -3, "size": 104}}
    }"#).unwrap();
    let migrated = GamchaService::migrate_progress(progress).unwrap();
    assert!(derived_components("common_071")
        .iter()
        .all(|id| migrated.owned_costume_ids.contains(id)));
    assert_eq!(migrated.equipped_costume_id.as_deref(), Some("common_071"));
    assert_eq!(migrated.tickets, 4);
    assert_eq!(migrated.total_draws, 9);
}
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cargo test --manifest-path src-tauri/Cargo.toml legacy_set_owner_receives_every_derived_component`

Expected: FAIL because schema version 1 is not migrated.

- [ ] **Step 3: Raise GAMCHA schema to 2 and migrate before validation**

Migration inserts all derived IDs for each owned legacy parent, preserves the primary ID as equipped, retains its alignment, and saves the migrated file on the next successful mutation.

- [ ] **Step 4: Add tests for unowned sets and unrelated progress**

Verify that a user without a legacy set gains nothing, a version-2 file is idempotent, tickets and draws remain unchanged, and unknown future schema versions are still rejected.

- [ ] **Step 5: Run service tests and commit**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml application::gamcha_service
git add -- src-tauri/src/application/gamcha_service.rs
git commit -m "feat: migrate legacy set ownership to components"
```

---

### Task 6: Allocate component IDs and update the manifest

**Files:**
- Create: `scripts/costume-component-apply.mjs`
- Create: `scripts/costume-component-apply.test.mjs`
- Modify: `pack/manifest.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: completed `catalog-semantic-audit.json`.
- Produces: deterministic manifest rows with `parentSetId`, unique numeric IDs, individual names, slots, and default alignments.

- [ ] **Step 1: Write failing deterministic allocation tests**

```js
test("keeps the parent id on the primary component and appends others", () => {
  const result = applyComponents(manifest, [{
    id: "common_071",
    state: "split",
    components: [
      { name: "필름 사진가 베레모", slot: "head", primary: true },
      { name: "필름 사진가 카메라", slot: "neck", primary: false },
      { name: "필름 사진가 넥타이", slot: "neck", primary: false },
    ],
  }]);
  assert.equal(result.find((row) => row.name === "필름 사진가 베레모").id, "common_071");
  assert.deepEqual(
    result.filter((row) => row.parentSetId === "common_071").map((row) => row.name),
    ["필름 사진가 베레모", "필름 사진가 카메라", "필름 사진가 넥타이"],
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test scripts/costume-component-apply.test.mjs`

Expected: FAIL because `applyComponents` does not exist.

- [ ] **Step 3: Implement numeric ID allocation and dry-run output**

For each rarity, start after the highest existing numeric suffix. Preserve the primary file path and allocate `<rarity>/<new-id>.png` paths for added components. Copy source provenance and set `parentSetId` on every member, including the primary.

- [ ] **Step 4: Apply the completed audit to the manifest**

Run: `node scripts/costume-component-apply.mjs --apply`

Expected: manifest count increases by exactly `sum(componentCount - 1)`; all IDs, names, and files are unique.

- [ ] **Step 5: Run catalog tests and commit metadata**

```powershell
npm test -- --run src/costumes/catalog.test.ts
node --test scripts/costume-component-apply.test.mjs
git add -- package.json scripts/costume-component-apply.mjs scripts/costume-component-apply.test.mjs pack/manifest.json
git commit -m "feat: split composite costumes in catalog metadata"
```

---

### Task 7: Generate and promote individual component assets

**Files:**
- Create candidates: `pack/qa/candidates/<rarity>/<id>.png`
- Modify production: `pack/common/*.png`, `pack/rare/*.png`, `pack/epic/*.png`, `pack/legendary/*.png`, `pack/special/*.png`
- Modify: `pack/qa/catalog-semantic-audit.json`

**Interfaces:**
- Consumes: Task 3 decisions and Task 6 IDs.
- Produces: one reviewed 256×256 transparent PNG per manifest row.

- [ ] **Step 1: Build one prompt per split component and redraw row**

Use the current raw item as the reference image. Each prompt must name one component, preserve its palette/material/pattern, request the existing 2D outlined costume style, require full uncropped silhouette and transparent background, and forbid other components, text, checkerboards, and stray pixels.

- [ ] **Step 2: Generate each candidate with built-in image generation**

Issue one built-in call per distinct component or redraw asset. Do not batch different component prompts into variants of one call.

- [ ] **Step 3: Inspect every output before moving it**

Reject any candidate with another component, missing edge detail, background, text, malformed transparency, or style drift. Iterate with one targeted correction per rejection.

- [ ] **Step 4: Normalize accepted candidates**

Run: `node scripts/costume-normalize-candidates.mjs`

Expected: every accepted candidate becomes a centered 256×256 RGBA PNG with preserved alpha and safe padding.

- [ ] **Step 5: Validate candidates, then promote**

```powershell
npm run costumes:validate-candidates
npm run costumes:promote-candidates
```

Expected: the promotion command updates only IDs listed as `split` or `redraw` in the semantic ledger.

- [ ] **Step 6: Commit promoted assets**

```powershell
git add -- pack/common pack/rare pack/epic pack/legendary pack/special pack/qa/catalog-semantic-audit.json
git commit -m "feat: add isolated costume component artwork"
```

---

### Task 8: Apply per-component placement and verify previews

**Files:**
- Modify: `pack/manifest.json`
- Modify: `pack/qa/catalog-semantic-audit.json`
- Modify if required by a failing test: `src/costumes/alignment.ts`
- Test: `src/costumes/alignment.test.ts`
- Test: `src/costumes/catalog.test.ts`

**Interfaces:**
- Consumes: individual component PNGs and slots.
- Produces: default placement that is natural in both raw and worn sheets.

- [ ] **Step 1: Generate raw and worn sheets for the expanded catalog**

Run: `node scripts/costume-semantic-audit.mjs sheets`

- [ ] **Step 2: Review every new or changed component at full sheet scale**

Record final `x`, `y`, and `size` in the manifest and a concrete placement observation in the ledger. Confirm head, face, neck, and body components do not clip the 96×104 pet cell.

- [ ] **Step 3: Add regression cases for representative component slots**

```ts
it("uses independent placement for components from the same legacy set", () => {
  const hat = costumeById.get("common_071")!;
  const camera = costumes.find((item) => item.parentSetId === "common_071" && item.slot === "neck")!;
  expect(hat.defaultAlignment).not.toEqual(camera.defaultAlignment);
});
```

Expose optional `parentSetId` on `ManifestCostume` and `Costume` so the test and inventory can reason about provenance.

- [ ] **Step 4: Run focused front-end tests**

Run: `npm test -- --run src/costumes/alignment.test.ts src/costumes/catalog.test.ts src/costumes/latest-asset-loader.test.ts`

Expected: all placement, expanded-catalog, and stale-preview tests pass.

- [ ] **Step 5: Commit**

```powershell
git add -- pack/manifest.json pack/qa/catalog-semantic-audit.json src/costumes/catalog.ts src/costumes/catalog.test.ts src/costumes/alignment.ts src/costumes/alignment.test.ts
git commit -m "fix: align isolated costume components"
```

---

### Task 9: Enforce final catalog QA

**Files:**
- Modify: `scripts/costume-catalog-qa.mjs`
- Modify: `scripts/costume-catalog-qa.test.mjs`
- Modify: `scripts/costume-semantic-audit.test.mjs`
- Regenerate: `pack/qa/generated/raw/*.svg`
- Regenerate: `pack/qa/generated/worn/*.svg`

**Interfaces:**
- Consumes: expanded manifest, semantic ledger, and production PNGs.
- Produces: a zero-error validation report and complete contact sheets.

- [ ] **Step 1: Add failing final-invariant tests**

Assert all manifest files exist, all assets pass format checks, every manifest item has one semantic row, every split parent has at least two children unless the audit explicitly reclassified the misleading set name, and no production item retains warnings without an observation explaining an intentional exception.

- [ ] **Step 2: Run asset tests and verify RED on unresolved entries**

Run: `npm run test:assets`

Expected: FAIL listing exact unresolved IDs rather than a generic count.

- [ ] **Step 3: Correct only the listed assets or audit mistakes**

For each failure, fix the source PNG, component metadata, or specific intentional-warning explanation. Do not weaken thresholds to make a defective item pass.

- [ ] **Step 4: Regenerate and inspect all ten sheets**

Run: `npm run costumes:sheets && node scripts/costume-semantic-audit.mjs sheets`

Review the complete expanded catalog from the first common item through the last special item, then re-review every changed row.

- [ ] **Step 5: Verify all asset commands pass**

```powershell
npm run test:assets
npm run costumes:validate
node scripts/costume-semantic-audit.mjs validate
git diff --check
```

- [ ] **Step 6: Commit**

```powershell
git add -- scripts/costume-catalog-qa.mjs scripts/costume-catalog-qa.test.mjs scripts/costume-semantic-audit.test.mjs pack/qa/generated
git commit -m "test: enforce semantic costume catalog quality"
```

---

### Task 10: Full verification and handoff

**Files:**
- Modify: `docs/13-progress-board.md`
- Modify: `docs/17-session-handoff.md`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a clean, tested branch and exact Windows manual-test instructions.

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

Expected: zero test failures, no format diff, no Clippy warnings.

- [ ] **Step 3: Launch the development app for manual checks**

```powershell
npm run tauri -- dev
```

Confirm representative split items can be drawn, appear as individual cards, preserve legacy ownership, equip one at a time, and display without clipping or noise.

- [ ] **Step 4: Record exact totals and remaining manual risks**

Update both project documents with the final catalog count, number of split parents, number of newly created components, redraw count, test counts, and any Windows-only observation that cannot be automated.

- [ ] **Step 5: Commit documentation and verify clean status**

```powershell
git add -- docs/13-progress-board.md docs/17-session-handoff.md
git commit -m "docs: record semantic costume catalog verification"
git status --short
git diff --check main...HEAD
```

Expected: no uncommitted project changes except a possible content-identical `src-tauri/Cargo.toml` stat refresh caused by the running Tauri command; its working hash must equal the index hash before treating it as clean.

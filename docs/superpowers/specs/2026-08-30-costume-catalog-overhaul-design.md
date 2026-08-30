# Costume Catalog Overhaul Design

## Goal

Make every one of the 156 drawable costume items reliably preview and equip as the item the user selected, with item-specific placement and enough visual detail to read clearly in the catalog. Preserve the existing Gamjabot hand-drawn style, item identities, rarities, colors, ownership, and draw probabilities.

The work also includes the already-approved small desktop-pet controls after the catalog work is stable: slightly smaller and very slightly faster photo delivery, development-only test controls, a development-only rare-photo Easter-egg trigger, and a user setting for window climbing.

## Current Problems

1. The catalog card and large preview can temporarily show different assets when selections change quickly. The preview assigns an image URL directly and has no last-selection-wins guard around asynchronous image loading.
2. Costume slots are inferred from Korean name keywords. Items whose names do not contain one of the expected words can be attached to the wrong body region.
3. Placement defaults exist only for five broad slots. There is no built-in per-item X, Y, or size metadata, so visually different hats, armor sets, masks, and accessories share unsuitable offsets.
4. Asset detail and silhouette quality vary. Some originals are too sparse, too small in their canvas, clipped, or do not communicate the named concept when worn.
5. There is no single QA artifact that shows all 156 items on the same canonical pet pose, making omissions and mismatches difficult to detect.

## Scope

### Included

- All 156 non-default draw candidates in `pack/manifest.json`.
- Exact card-to-preview-to-equipped-asset consistency.
- Explicit slot and item-level default alignment metadata.
- A repeatable inventory audit and contact-sheet generator.
- Selective redraw of every original judged too low-detail or visually unsuitable after the full audit.
- Verification of every replacement in both isolated-asset and worn-on-pet views.
- The previously approved photo-delivery and climbing-control changes, implemented as a separate phase after the costume subsystem is stable.

### Excluded

- New items, renamed items, rarity changes, or probability changes.
- Changing existing costume IDs or file paths.
- Multi-layer or multi-slot costume stacking.
- Animation-specific costume variants.
- Store, trading, or network features.
- The previously discussed general pet-to-photo spacing adjustment; it is not part of the approved request.

## Data and Compatibility

Each draw-candidate costume entry will declare:

- `slot`: one of `head`, `face`, `neck`, `body`, or `full`.
- `defaultAlignment`: integer `x`, `y`, and `size` values for the canonical 128-pixel pet canvas.

The item ID, name, rarity, image path, draw eligibility, and probability remain unchanged. Existing save data remains valid.

Alignment resolution order will be:

1. The user's saved per-item alignment override.
2. The item's built-in `defaultAlignment`.
3. The existing slot-level fallback, retained only for older or malformed external packs.

This keeps current user adjustments authoritative while improving every item that has never been manually adjusted.

## Runtime Design

### Catalog Metadata

`src/costumes/catalog.ts` will read and validate explicit metadata instead of deriving the slot from the Korean display name. The 156 built-in draw candidates must all have valid metadata; missing built-in metadata is a test failure rather than a silent inference.

The three default appearance entries remain compatible and do not participate in random draws or the 156-item audit.

### Preview Consistency

The large preview will use a monotonic selection token:

1. Increment the token whenever the selected costume changes.
2. Preload and decode the selected asset.
3. Apply the decoded asset only if its token still matches the latest selection.
4. Clear or show a neutral loading state instead of leaving the previous costume visible while the new asset loads.

The equipped pet uses the same catalog object and URL as the selected card. No second path lookup or name-based mapping is allowed.

### Alignment Application

The sprite renderer receives the resolved item alignment and continues to expose the existing user adjustment controls. Built-in defaults establish the initial position; user adjustments are stored exactly as they are now.

Complex named sets remain one transparent overlay image. This avoids a new layered-equipment system and keeps saved ownership and equip behavior unchanged.

## Full-Catalog QA Pipeline

The repository will include a deterministic QA generator that reads the manifest and produces paged contact sheets for all 156 draw candidates. Each item appears twice:

- the isolated 256 x 256 transparent asset on a checkerboard;
- the same asset composited on the canonical idle Gamjabot pose using its runtime slot and alignment.

Every cell includes the ID, Korean name, and rarity. Sheets are grouped by rarity so no item is silently omitted. The generator also writes a machine-readable audit report with one of these states:

- `keep`: art is adequate; metadata/alignment may still be adjusted;
- `realign`: art is adequate but default placement needs correction;
- `redraw`: the original art is low-detail, clipped, unclear, or inconsistent with the named concept.

Automated checks will verify:

- 156 unique draw-candidate IDs;
- every referenced PNG exists and decodes;
- every built-in item has a valid slot and alignment;
- every asset is 256 x 256 RGBA with transparency;
- visible pixels do not touch the canvas edge unexpectedly;
- every item appears exactly once in the audit and contact sheets.

Visual review remains required because concept clarity and style quality cannot be proven by pixel checks alone.

## Redraw Rules

Only assets marked `redraw` after the complete 156-item audit are replaced. Every replacement must:

- retain the existing file path, ID, name, rarity, main colors, and concept;
- use the current Gamjabot thick black, slightly uneven hand-drawn outline style;
- be readable at catalog-card and 128-pixel worn sizes;
- contain costume parts only, with no baked-in pet body, text, checkerboard, or opaque background;
- fit inside a transparent 256 x 256 RGBA canvas with a safe margin;
- align to the canonical idle pet without covering unrelated body regions unless the item is intentionally a full set.

Generation will use the current item plus representative high-quality pack assets and the canonical pet as style references. Generated images will be normalized to the exact canvas and color mode before replacing the existing file. Each batch is accepted only after new isolated and worn contact sheets are reviewed.

Redraws will be processed in small rarity-based batches—common, rare, epic, legendary, then special—so mapping or style drift can be caught before the next batch.

## Previously Approved Desktop-Pet Controls

These changes are isolated from the costume pipeline and implemented after catalog behavior is verified:

1. Photo delivery presentation: maximum 480 x 390, minimum 280 x 224, and pull duration 17,500 ms.
2. Development test controls: `사진 배달 테스트` and `저전력 이벤트 테스트` remain available in development builds and are absent from production/release builds.
3. Rare-photo test: a development-only Settings button directly requests the existing rare photo Easter egg. It does not change the natural 1% probability and rejects a request while another delivery is active.
4. Window climbing: a persisted setting, enabled by default, controls whether new window-climb interactions may start. Turning it off does not corrupt the current pet state; any active transition finishes safely and no later climb starts until re-enabled.

## Implementation Phases

1. **Preview safety and QA foundation**
   - Add last-selection-wins asset loading.
   - Add manifest validation and the contact-sheet/audit generator.
2. **Metadata coverage**
   - Classify all 156 items by slot.
   - Assign and tune per-item default X, Y, and size values.
   - Generate and review the first complete worn catalog.
3. **Art audit and redraw**
   - Mark every item `keep`, `realign`, or `redraw` with a reason.
   - Replace all `redraw` originals in small batches.
   - Regenerate and review sheets after every batch.
4. **Desktop-pet controls**
   - Finish the approved photo size/speed, release gating, rare-photo test button, and climbing toggle changes without mixing them into costume code.
5. **Final verification**
   - Run TypeScript tests, Rust tests, production build, asset validation, and final visual review of all 156 items.

## Testing

Automated coverage will include:

- manifest schema and exact 156-item metadata coverage;
- stable ID/path/name/rarity/probability snapshots;
- alignment precedence: saved override over item default over slot fallback;
- preview race behavior proving the last selection wins;
- asset dimensions, alpha channel, decodability, and contact-sheet completeness;
- development controls present in development and absent in production;
- forced rare-photo behavior without changing natural rarity;
- climbing disabled/enabled behavior and persisted default migration.

The standard verification commands are `npm test`, `npm run build`, and the repository's Rust test command. Generated contact sheets are reviewed manually at 100% scale in addition to automated checks.

## Acceptance Criteria

- Selecting any of the 156 cards always shows and equips that exact asset, even during rapid selection.
- All 156 built-in items have explicit, tested slot and default alignment metadata.
- Every item is visibly attached to its intended region on the canonical idle pet without unintended clipping.
- Every original flagged as low-detail or unsuitable is redrawn and passes the same visual review.
- IDs, paths, names, rarities, draw probabilities, ownership, and existing saved adjustments are preserved.
- Production builds contain no right-click or Settings test controls.
- The rare-photo button works only in development, and the climbing setting works and persists.
- All automated tests and the production build pass, and the final complete contact sheets contain exactly 156 reviewed items.

## Failure Handling

- Missing built-in metadata or missing assets fail validation immediately.
- A failed image generation never overwrites the current asset; candidates are staged and reviewed first.
- A failed image decode leaves the neutral preview state and reports the item ID for diagnosis instead of showing a stale different costume.
- If a replacement fails visual QA, the existing original remains in place and the audit entry stays `redraw` until a suitable candidate is approved.

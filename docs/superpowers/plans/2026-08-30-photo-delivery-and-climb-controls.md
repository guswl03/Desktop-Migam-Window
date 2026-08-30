# Photo Delivery and Climb Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the approved smaller/faster photo delivery, development-only test controls, forced rare-photo test, and persisted window-climbing ON/OFF setting without altering unrelated pet behavior.

**Architecture:** Keep photo sizing and rarity decisions in pure TypeScript helpers, gate all test UI from one `import.meta.env.DEV` feature description, and persist climbing through the existing Rust Settings schema. Pass the initial climb preference into the motion runtime and update it from `settings://saved`; the flag gates only new climb collisions so an active transition finishes safely.

**Tech Stack:** TypeScript 5.9, Vitest 3, Tauri 2 events/commands, Rust 2021 with Serde, existing DOM settings form.

**Spec:** `docs/superpowers/specs/2026-08-30-costume-catalog-overhaul-design.md` section “Previously Approved Desktop-Pet Controls”.

## Global Constraints

- Keep photo delivery maximum 480 x 390, minimum 280 x 224, and pull duration exactly 17,500 ms.
- Preserve natural rare-photo probability at exactly 1%; force-special applies only to an explicit development test request.
- Production/release builds contain neither right-click test items nor the Settings rare-photo test button.
- Window climbing defaults ON for old and new settings, persists OFF, and gates only new climbs.
- Do not change the general pet-to-photo overlap/spacing value.
- Preserve unrelated existing work in `feat/photo-delivery-climb-controls`; stage and commit only listed files.

---

## File Structure

- `src/pet/photo-delivery-motion.ts`: pure presentation and rarity policy.
- `src/pet/photo-delivery-motion.test.ts`: exact size, speed, natural rarity, and forced rarity tests.
- `src/pet/photo-delivery-view.ts`: consumes the delivery payload and pure presentation.
- `src/pet/context-menu-actions.ts`: single development-test feature description.
- `src/pet/context-menu-actions.test.ts`: development/production gating tests.
- `src/pet/context-menu-view.ts`: renders test menu items only from the gated description.
- `src/main.ts`: Settings test button, climb checkbox, save payload, initial pet preference.
- `src/contracts.ts`: camelCase `windowClimbingEnabled` contract.
- `src/settings-help.ts`, `src/settings-help.test.ts`: climb-setting explanation.
- `src/pet/motion.ts`, `src/pet/motion.test.ts`: pure new-climb gate.
- `src/pet/tauri-motion-runtime.ts`: live climb preference and `settings://saved` listener.
- `src-tauri/src/domain/settings.rs`: persisted default-true setting and migration tests.
- `src-tauri/src/presentation/commands.rs`: forced-photo payload with overlap rejection unchanged.
- `docs/13-progress-board.md`, `docs/17-session-handoff.md`: verification records.

### Task 1: Finish Photo Presentation and Forced Rare Delivery

**Files:**
- Modify: `src/pet/photo-delivery-motion.test.ts`
- Modify: `src/pet/photo-delivery-motion.ts`
- Modify: `src/pet/photo-delivery-view.ts`
- Modify: `src-tauri/src/presentation/commands.rs`

**Interfaces:**
- Produces: `calculatePhotoDeliveryPresentation(naturalWidth, naturalHeight, viewportWidth, viewportHeight)` and `photoDeliveryRarity(randomValue, forceSpecialPhoto = false)`.
- Emits: `photo://deliver` payload `{ forceSpecialPhoto: boolean }`.

- [ ] **Step 1: Keep exact failing tests for presentation and force-special**

```ts
expect(calculatePhotoDeliveryPresentation(1600, 1200, 1920, 1040)).toEqual({
  photoWidth: 480,
  photoHeight: 360,
  pullDurationMilliseconds: 17_500,
});
expect(photoDeliveryRarity(0.5, true)).toBe("real-heogeodeongseu");
expect(photoDeliveryRarity(0.005, false)).toBe("real-heogeodeongseu");
expect(photoDeliveryRarity(0.01, false)).toBe("normal");
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- src/pet/photo-delivery-motion.test.ts`

Expected before completing implementation: FAIL on missing presentation or forced rarity behavior.

- [ ] **Step 3: Implement exact constants and payload consumption**

```ts
const PHOTO_DELIVERY_MAXIMUM_WIDTH = 480;
const PHOTO_DELIVERY_MAXIMUM_HEIGHT = 390;
const PHOTO_DELIVERY_MINIMUM_WIDTH = 280;
const PHOTO_DELIVERY_MINIMUM_HEIGHT = 224;
const PHOTO_DELIVERY_PULL_DURATION_MILLISECONDS = 17_500;
```

`mountPhotoDelivery` must listen as `listen<{ forceSpecialPhoto: boolean }>("photo://deliver", ...)`, default missing payload fields to false for compatibility, and pass the flag only to `photoDeliveryRarity`.

- [ ] **Step 4: Preserve overlap rejection in Rust**

`start_photo_delivery` accepts `force_special_photo: Option<bool>` but keeps the existing visibility check before emitting. It returns `Ok(false)` when delivery is active; it never restarts or replaces the current image.

- [ ] **Step 5: Run focused TS and Rust tests**

Run: `npm test -- src/pet/photo-delivery-motion.test.ts`

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 6: Commit photo presentation and payload**

```powershell
git add -- src/pet/photo-delivery-motion.ts src/pet/photo-delivery-motion.test.ts src/pet/photo-delivery-view.ts src-tauri/src/presentation/commands.rs
git commit -m "feat: refine and test photo delivery"
```

### Task 2: Gate All Test UI to Development Builds

**Files:**
- Modify: `src/pet/context-menu-actions.ts`
- Modify: `src/pet/context-menu-actions.test.ts`
- Modify: `src/pet/context-menu-view.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Produces: `developmentTestFeatures(isDevelopment): { contextMenu, settings }`.
- Consumes: `import.meta.env.DEV`; Settings invokes `start_photo_delivery({ forceSpecialPhoto: true })`.

- [ ] **Step 1: Keep the exact dev/release descriptor test**

```ts
expect(developmentTestFeatures(true).contextMenu.map(({ action }) => action)).toEqual(["photo", "battery"]);
expect(developmentTestFeatures(true).settings).toEqual([
  { action: "rare-photo", label: "희귀 사진 이스터에그 테스트" },
]);
expect(developmentTestFeatures(false)).toEqual({ contextMenu: [], settings: [] });
```

- [ ] **Step 2: Run the focused test**

Run: `npm test -- src/pet/context-menu-actions.test.ts`

Expected before implementation: FAIL because production descriptors still exist or the function is missing.

- [ ] **Step 3: Render both locations exclusively from the descriptor**

Do not leave hard-coded photo/battery buttons in `context-menu-view.ts`. In `main.ts`, insert the rare-photo button only from `.settings`; attach the handler with optional query selection so production has no inert element.

- [ ] **Step 4: Verify the rare-photo button status paths**

The handler reports: starting, started, already active, or failed. It calls:

```ts
invoke<boolean>("start_photo_delivery", { forceSpecialPhoto: true });
```

- [ ] **Step 5: Run tests and production build**

Run: `npm test -- src/pet/context-menu-actions.test.ts`

Run: `npm run build`

Expected: PASS; search in generated JS/HTML must find no rendered production button markup for the two context actions or rare-photo Settings action.

- [ ] **Step 6: Commit development-only controls**

```powershell
git add -- src/pet/context-menu-actions.ts src/pet/context-menu-actions.test.ts src/pet/context-menu-view.ts src/main.ts
git commit -m "feat: hide pet test controls in production"
```

### Task 3: Persist and Apply Window Climbing ON/OFF

**Files:**
- Modify: `src-tauri/src/domain/settings.rs`
- Modify: `src/contracts.ts`
- Modify: `src/settings-help.ts`
- Modify: `src/settings-help.test.ts`
- Modify: `src/main.ts`
- Modify: `src/pet/motion.ts`
- Modify: `src/pet/motion.test.ts`
- Modify: `src/pet/tauri-motion-runtime.ts`

**Interfaces:**
- Produces: `Settings.pet.windowClimbingEnabled: boolean` / Rust `window_climbing_enabled: bool` with `#[serde(default = "default_true")]`.
- Changes: `startPetMotion(sprite, initialWindowClimbingEnabled)` and `findClimbCollision(..., supportWindowId, windowClimbingEnabled)`.

- [ ] **Step 1: Keep Rust migration tests and add TS gate/help tests**

```rust
assert_eq!(serde_json::to_value(Settings::default()).unwrap()["pet"]["windowClimbingEnabled"], true);
assert!(!Settings::from_json(current_json_with_false).unwrap().pet.window_climbing_enabled);
assert!(Settings::from_json(legacy_json_without_field).unwrap().pet.window_climbing_enabled);
```

```ts
expect(findClimbCollision(600, 608, 912, size, workArea, surfaces, null, false)).toBeNull();
expect(settingsHelp("windowClimbing")).toContain("창 위로 올라가는 동작");
```

- [ ] **Step 2: Run focused TS and Rust tests**

Run: `npm test -- src/pet/motion.test.ts src/settings-help.test.ts`

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::settings::tests`

Expected before implementation is complete: FAIL on missing TS contract/help/runtime wiring.

- [ ] **Step 3: Add the persisted schema and frontend contract**

```rust
#[serde(default = "default_true")]
pub window_climbing_enabled: bool,
```

```ts
pet: {
  visualScalePercent: number;
  resourceResponseMode: ResourceResponseMode;
  automaticPhotoDeliveryEnabled: boolean;
  windowClimbingEnabled: boolean;
};
```

- [ ] **Step 4: Add the Settings checkbox and save field**

```html
<label class="checkbox-row"><input name="windowClimbingEnabled" type="checkbox" /> <span class="setting-label-text">창 위로 올라가기</span></label>
```

Render `checked` from settings, include `settingsHelp("windowClimbing")`, and save `windowClimbingEnabled: values.has("windowClimbingEnabled")` without dropping the other three pet fields.

- [ ] **Step 5: Gate only new climb collisions**

Pass the live boolean as the final `findClimbCollision` argument and return `null` immediately when false. Do not add the flag to `advanceClimbing`, rope throw, pull-up, or fall transitions; this is what lets an already active interaction finish safely.

- [ ] **Step 6: Initialize and update the runtime preference**

Before rendering the pet, load `BootstrapState`, call `startPetMotion(sprite, bootstrap.settings.pet.windowClimbingEnabled)`, and inside the runtime listen for:

```ts
listen<Settings>("settings://saved", ({ payload }) => {
  windowClimbingEnabled = payload.pet.windowClimbingEnabled;
});
```

Store and invoke the unlisten callback during runtime cleanup.

- [ ] **Step 7: Run all focused tests and build**

Run: `npm test -- src/pet/motion.test.ts src/settings-help.test.ts`

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::settings::tests`

Run: `npm run build`

Expected: PASS; legacy settings default ON, explicit OFF persists, and an OFF setting produces no new collision.

- [ ] **Step 8: Commit climbing preference**

```powershell
git add -- src-tauri/src/domain/settings.rs src/contracts.ts src/settings-help.ts src/settings-help.test.ts src/main.ts src/pet/motion.ts src/pet/motion.test.ts src/pet/tauri-motion-runtime.ts
git commit -m "feat: add window climbing preference"
```

### Task 4: Final Regression and Release-Surface Verification

**Files:**
- Modify: `docs/13-progress-board.md`
- Modify: `docs/17-session-handoff.md`

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: verified development and release behavior.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Run: `npm run build`

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: all commands exit 0.

- [ ] **Step 2: Verify development behavior manually**

In a development build, confirm both right-click test rows are visible, the Settings rare-photo button opens the existing rare photo, a second click reports that delivery is active, photo size is slightly smaller, and the pull finishes in 17.5 seconds.

- [ ] **Step 3: Verify climbing behavior manually**

Save OFF, let an already-started climb finish, then walk the pet into another window and confirm no new climb begins. Restart the app and confirm OFF persists. Save ON and confirm a later wall contact can climb.

- [ ] **Step 4: Verify production behavior manually**

Run the production bundle and confirm `사진 배달 테스트`, `저전력 이벤트 테스트`, and `희귀 사진 이스터에그 테스트` do not appear. Normal automatic photo delivery and natural 1% rarity remain enabled according to user settings.

- [ ] **Step 5: Update project records and commit**

Record exact command outputs and manual checks in both project documents.

```powershell
git add -- docs/13-progress-board.md docs/17-session-handoff.md
git commit -m "docs: record pet control verification"
```


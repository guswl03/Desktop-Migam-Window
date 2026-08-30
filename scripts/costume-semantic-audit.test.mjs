import assert from "node:assert/strict";
import test from "node:test";
import {
  renderRawSheet,
  renderWornSheet,
  validateSemanticAudit,
} from "./costume-semantic-audit.mjs";

const manifest = {
  costumes: [
    {
      id: "default_idle",
      name: "기본 모습",
      rarity: "default",
      file: "default/default_idle.png",
    },
    {
      id: "rare_007",
      name: "해적 선장 세트",
      rarity: "rare",
      file: "rare/rare_007.png",
      slot: "full",
      defaultAlignment: { x: -8, y: -8, size: 112 },
    },
  ],
};

test("requires one concrete audit row per drawable manifest item", () => {
  const audit = [{
    id: "rare_007",
    state: "redraw",
    observations: ["완성된 해적 모자 아래에 같은 모자의 잘린 복제 잔상이 남아 있음."],
    warnings: ["edge-contact"],
    components: [],
  }];

  assert.deepEqual(validateSemanticAudit(audit, manifest), []);
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

test("renders separate raw and worn review sheets", () => {
  const rows = [{
    ...manifest.costumes[1],
    state: "redraw",
    observations: ["아래쪽에 잘린 복제 모자 잔상이 있음."],
    warnings: ["edge-contact"],
    bounds: { left: 20, top: 12, right: 230, bottom: 255 },
  }];

  const raw = renderRawSheet("rare", rows, "pack/qa/generated/raw/rare.svg");
  const worn = renderWornSheet("rare", rows, "pack/qa/generated/worn/rare.svg");

  assert.match(raw, /RAW · 4X/);
  assert.match(raw, /edge-contact/);
  assert.doesNotMatch(raw, /base-spritesheet-extended/);
  assert.match(worn, /WORN/);
  assert.match(worn, /base-spritesheet-extended/);
});

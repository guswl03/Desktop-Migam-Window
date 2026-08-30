import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildImagePrompt,
  expectedCatalogIds,
  loadBlueprint,
  validateBlueprint,
} from "./costume-blueprint.mjs";

const validItem = {
  id: "common_001", rarity: "common", name: "새벽 우편모", slot: "head",
  theme: "생활 도구", silhouette: "짧은 챙과 봉인 단추", palette: {
    primary: "남색", secondary: "갈색", accent: "금색",
  }, material: "천과 가죽", signatureDetail: "밀랍 봉인 단추",
  prompt: "남색 우편모 한 개", defaultAlignment: { x: -4, y: -30, size: 104 },
  qaState: "planned",
};

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
  const item = { ...validItem, slot: "full" };
  const errors = validateBlueprint([item, { ...item, id: "common_002" }]);
  assert.ok(errors.some((error) => error.includes("slot")));
  assert.ok(errors.some((error) => error.includes("duplicate name")));
  assert.ok(errors.some((error) => error.includes("duplicate silhouette")));
});

test("reports each invalid schema property with its exact item ID", () => {
  const item = {
    ...validItem,
    rarity: "rare",
    name: "",
    slot: "cape",
    silhouette: "  SHORT BRIM AND SEAL BUTTON  ",
    palette: { primary: "남색", secondary: "갈색", accent: "금색" },
    signatureDetail: "",
    defaultAlignment: { x: -4.5, y: -30, size: 104 },
    qaState: "draft",
  };
  const errors = validateBlueprint([validItem, item]);
  assert.ok(errors.every((error) => error.startsWith("common_001:")));
  assert.ok(errors.some((error) => error.includes("wrong rarity")));
  assert.ok(errors.some((error) => error.includes("missing name")));
  assert.ok(errors.some((error) => error.includes("unsupported slot")));
  assert.ok(errors.some((error) => error.includes("duplicate normalized palette")));
  assert.ok(errors.some((error) => error.includes("missing signature detail")));
  assert.ok(errors.some((error) => error.includes("non-integer placement")));
  assert.ok(errors.some((error) => error.includes("invalid qaState")));
});

test("loads every rarity file from a supplied blueprint root", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-blueprint-"));
  const directory = join(root, "pack", "blueprint");
  await mkdir(directory, { recursive: true });
  const files = ["common", "rare", "epic", "legendary", "special"];
  await Promise.all(files.map((rarity) => writeFile(
    join(directory, `${rarity}.json`),
    JSON.stringify([{ ...validItem, id: `${rarity}_001`, rarity }]),
  )));

  try {
    const items = await loadBlueprint(root);
    assert.equal(items.length, files.length);
    assert.deepEqual(items.map(({ rarity }) => rarity), files);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("assembles a standalone transparent image prompt", () => {
  const prompt = buildImagePrompt(validItem, "approved style lock");
  assert.match(prompt, /Asset type: standalone common desktop-pet costume icon/);
  assert.match(prompt, /Subject: one 새벽 우편모; 짧은 챙과 봉인 단추/);
  assert.match(prompt, /Style: approved style lock/);
  assert.match(prompt, /square true-transparent PNG/);
});

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  buildImagePrompt,
  expectedCatalogIds,
  isAbsentBlueprintEntry,
  loadBlueprint,
  validateBlueprint,
} from "./costume-blueprint.mjs";

const execFileAsync = promisify(execFile);

function countBy(items, field) {
  return items.reduce((counts, item) => {
    counts[item[field]] = (counts[item[field]] ?? 0) + 1;
    return counts;
  }, {});
}

function expectedIds(rarity, count) {
  return Array.from(
    { length: count },
    (_, index) => `${rarity}_${String(index + 1).padStart(3, "0")}`,
  );
}

const validItem = {
  id: "common_001", rarity: "common", name: "새벽 우편모", slot: "head",
  theme: "생활 도구", silhouette: "짧은 챙과 봉인 단추", palette: {
    primary: "남색", secondary: "갈색", accent: "금색",
  }, material: "천과 가죽", signatureDetail: "밀랍 봉인 단추",
  prompt: "남색 우편모 한 개", defaultAlignment: { x: -4, y: -30, size: 104 },
  qaState: "planned",
};

const slotsByRarity = {
  common: { head: 44, face: 12, neck: 10, body: 14 },
  rare: { head: 31, face: 8, neck: 6, body: 12 },
  epic: { head: 16, face: 5, neck: 4, body: 6 },
  legendary: { head: 6, face: 2, neck: 1, body: 3 },
  special: { head: 2, face: 1, neck: 1, body: 1 },
};

function completeBlueprint() {
  const slots = Object.fromEntries(Object.entries(slotsByRarity).map(([rarity, counts]) => [
    rarity,
    Object.entries(counts).flatMap(([slot, count]) => Array(count).fill(slot)),
  ]));
  const nextSlot = Object.fromEntries(Object.keys(slots).map((rarity) => [rarity, 0]));

  return [...expectedCatalogIds()].map(([id, rarity]) => {
    const index = nextSlot[rarity]++;
    return {
      ...validItem,
      id,
      rarity,
      name: `아이템 ${id}`,
      silhouette: `실루엣 ${id}`,
      palette: { primary: `주색 ${id}`, secondary: `보조색 ${id}`, accent: `강조색 ${id}` },
      signatureDetail: `서명 ${id}`,
      prompt: `아이템 ${id} 하나`,
      slot: slots[rarity][index],
    };
  });
}

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

test("accepts a complete catalog with the approved rarity and slot totals", () => {
  assert.deepEqual(validateBlueprint(completeBlueprint()), []);
});

test("an incomplete common subset still requires all 80 approved Common IDs", () => {
  const errors = validateBlueprint([validItem], { rarity: "common" });
  assert.ok(errors.includes("catalog: expected 80 items, got 1"));
  assert.ok(errors.includes("missing catalog ID common_080"));
  assert.ok(!errors.includes("missing catalog ID rare_001"));
});

test("reports missing and duplicate catalog IDs", () => {
  const items = completeBlueprint();
  const missing = items.filter(({ id }) => id !== "common_080");
  const duplicate = [...missing, { ...items[0] }];

  assert.ok(validateBlueprint(missing).some((error) => error.includes("missing catalog ID common_080")));
  const duplicateErrors = validateBlueprint(duplicate);
  assert.ok(duplicateErrors.some((error) => error.includes("common_001: duplicate ID")));
  assert.ok(duplicateErrors.some((error) => error.includes("missing catalog ID common_080")));
});

test("reports item rarity and per-rarity slot count violations", () => {
  const items = completeBlueprint();
  const rare = items.find((item) => item.id === "rare_001");
  rare.rarity = "common";
  const common = items.find((item) => item.id === "common_001");
  common.slot = "face";

  const errors = validateBlueprint(items);
  assert.ok(errors.some((error) => error.includes("rare_001: wrong rarity")));
  assert.ok(errors.some((error) => error.includes("common: expected slots head=44 face=12 neck=10 body=14")));
  assert.ok(errors.some((error) => error.includes("rare: expected slots head=31 face=8 neck=6 body=12")));
});

test("reports duplicate signature details with the duplicate item ID", () => {
  const items = completeBlueprint();
  items[1].signatureDetail = items[0].signatureDetail;
  assert.ok(validateBlueprint(items).some((error) => error.includes("common_002: duplicate signature detail")));
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
  const itemErrors = errors.filter((error) => error.startsWith("common_001:"));
  assert.ok(itemErrors.length > 0);
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
  const directory = join(root, "pack", "catalog-blueprint");
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

test("aggregate loading treats absent canonical rarity files as empty planned rarities", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-blueprint-missing-rarities-"));
  const directory = join(root, "pack", "catalog-blueprint");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "common.json"), JSON.stringify([validItem]));

  try {
    const items = await loadBlueprint(root);
    assert.deepEqual(items, [validItem]);
    const errors = validateBlueprint(items);
    assert.ok(errors.includes("missing catalog ID rare_001"));
    assert.ok(errors.includes("missing catalog ID special_005"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing-entry decision rejects dangling canonical entries", () => {
  const enoent = { code: "ENOENT" };
  assert.equal(
    isAbsentBlueprintEntry(enoent, enoent),
    true,
  );
  assert.equal(isAbsentBlueprintEntry(enoent, null), false);
  assert.equal(isAbsentBlueprintEntry({ code: "EACCES" }, enoent), false);
});

test("aggregate loading still rejects malformed existing rarity files", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-blueprint-malformed-rarity-"));
  const directory = join(root, "pack", "catalog-blueprint");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "common.json"), JSON.stringify([validItem]));
  await writeFile(join(directory, "rare.json"), "not-json");

  try {
    await assert.rejects(loadBlueprint(root), SyntaxError);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("aggregate loading still rejects unreadable existing rarity paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-blueprint-unreadable-rarity-"));
  const directory = join(root, "pack", "catalog-blueprint");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "common.json"), JSON.stringify([validItem]));
  await mkdir(join(directory, "rare.json"));

  try {
    await assert.rejects(loadBlueprint(root), (error) => error?.code !== "ENOENT");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("default validation stays full-catalog when non-Common rarity files are empty", async () => {
  const root = await mkdtemp(join(tmpdir(), "costume-blueprint-full-scope-"));
  const directory = join(root, "pack", "catalog-blueprint");
  await mkdir(directory, { recursive: true });
  const common = completeBlueprint().filter(({ rarity }) => rarity === "common");
  await writeFile(join(directory, "common.json"), JSON.stringify(common));
  await Promise.all(["rare", "epic", "legendary", "special"].map((rarity) =>
    writeFile(join(directory, `${rarity}.json`), "[]")));

  try {
    const items = await loadBlueprint(root);
    const errors = validateBlueprint(items);
    assert.ok(errors.includes("catalog: expected 185 items, got 80"));
    assert.ok(errors.includes("missing catalog ID rare_001"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("common blueprint covers its approved themes and slots", async () => {
  const common = JSON.parse(await readFile(
    new URL("../pack/catalog-blueprint/common.json", import.meta.url),
  ));
  assert.deepEqual(countBy(common, "theme"), {
    "생활 도구": 20,
    "직업 장비": 20,
    "여행 장비": 20,
    "취미·공예 장비": 20,
  });
  assert.deepEqual(countBy(common, "slot"), { head: 44, face: 12, neck: 10, body: 14 });
  assert.deepEqual(common.map(({ id }) => id), expectedIds("common", 80));
  assert.deepEqual(validateBlueprint(common, { rarity: "common" }), []);
});

test("common blueprint later headwear types do not reuse first-half form labels", async () => {
  const common = JSON.parse(await readFile(
    new URL("../pack/catalog-blueprint/common.json", import.meta.url),
  ));
  const laterHeadwear = common.slice(40).filter(({ slot }) => slot === "head");
  const reused = laterHeadwear
    .filter(({ name }) => ["보닛", "두건", "후드", "캡"].some((form) => name.includes(form)))
    .map(({ id, name }) => `${id} ${name}`);
  assert.deepEqual(reused, []);
});

test("common blueprint CLI validates only the Common document", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/costume-blueprint.mjs", "validate", "--rarity", "common"],
    { cwd: new URL("..", import.meta.url) },
  );
  assert.equal(
    stdout.trim(),
    "common=80 missing=0 duplicate=0 slot=head:44,face:12,neck:10,body:14",
  );
});

test("rare blueprint covers its approved themes and slots", async () => {
  const rare = JSON.parse(await readFile(
    new URL("../pack/catalog-blueprint/rare.json", import.meta.url),
  ));
  assert.deepEqual(countBy(rare, "theme"), {
    "탐험가 장비": 15,
    "생물 영감 장비": 14,
    "소형 기계 장비": 14,
    "가상 지역 장비": 14,
  });
  assert.deepEqual(countBy(rare, "slot"), { head: 31, face: 8, neck: 6, body: 12 });
  assert.deepEqual(rare.map(({ id }) => id), expectedIds("rare", 57));
  assert.deepEqual(validateBlueprint(rare, { rarity: "rare" }), []);
});

test("assembles a standalone transparent image prompt", () => {
  const prompt = buildImagePrompt(validItem, "approved style lock");
  assert.match(prompt, /Asset type: standalone common desktop-pet costume icon/);
  assert.match(prompt, /Subject: one 새벽 우편모; 짧은 챙과 봉인 단추/);
  assert.match(prompt, /Style: approved style lock/);
  assert.match(prompt, /square true-transparent PNG/);
});

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

async function loadRarityBlueprint(rarity) {
  return JSON.parse(await readFile(
    new URL(`../pack/catalog-blueprint/${rarity}.json`, import.meta.url),
  ));
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
  const fixtureCenterShapes = [
    "둥근 삼각", "비대칭 사다리꼴", "가로 타원", "뾰족 오각",
    "넓은 육각", "기운 반원", "세로 마름모",
  ];
  const fixtureEdgeShapes = [
    "두 갈래 굽은", "세 단 계단", "한쪽 둥근홈", "쌍봉우리",
    "굵은 갈고리", "깊은 V홈", "비대칭 물결",
  ];
  let rankedShapeIndex = 0;

  return [...expectedCatalogIds()].map(([id, rarity]) => {
    const index = nextSlot[rarity]++;
    const hasOuterShape = ["epic", "legendary"].includes(rarity);
    const shapeIndex = hasOuterShape ? rankedShapeIndex++ : -1;
    const centerShape = fixtureCenterShapes[shapeIndex % fixtureCenterShapes.length];
    const edgeShape = fixtureEdgeShapes[Math.floor(shapeIndex / fixtureCenterShapes.length)];
    const silhouette = hasOuterShape
      ? `${centerShape} 중심판이 ${edgeShape} 밑단과 끊김 없이 이어진 구조 윤곽`
      : `실루엣 ${id}`;
    return {
      ...validItem,
      id,
      rarity,
      name: `아이템 ${id}`,
      silhouette,
      palette: { primary: `주색 ${id}`, secondary: `보조색 ${id}`, accent: `강조색 ${id}` },
      signatureDetail: `서명 ${id}`,
      prompt: `아이템 ${id} 하나`,
      slot: slots[rarity][index],
      outerShape: hasOuterShape ? {
        class: "other",
        evidence: [`${centerShape} 중심판`, `${edgeShape} 밑단`],
      } : undefined,
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
  const common = await loadRarityBlueprint("common");
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
  const rare = await loadRarityBlueprint("rare");
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

test("epic blueprint covers its approved themes and slots", async () => {
  const epic = await loadRarityBlueprint("epic");
  assert.deepEqual(countBy(epic, "theme"), {
    "마법 학파 장비": 8,
    "원소 장비": 8,
    "신비 조직 장비": 8,
    "꿈·차원 장비": 7,
  });
  assert.deepEqual(countBy(epic, "slot"), { head: 16, face: 5, neck: 4, body: 6 });
  assert.deepEqual(epic.map(({ id }) => id), expectedIds("epic", 31));
  assert.deepEqual(validateBlueprint(epic, { rarity: "epic" }), []);
});

test("epic organization emblems keep distinct topologies and unambiguous fold copy", async () => {
  const epic = await loadRarityBlueprint("epic");
  const organizationSignatures = epic
    .filter(({ theme }) => theme === "신비 조직 장비")
    .map(({ signatureDetail }) => signatureDetail);
  const ambiguousCopyIds = epic
    .filter((item) => /안접힌|한쪽녹은마름틀/.test(JSON.stringify(item)))
    .map(({ id }) => id);

  assert.deepEqual({
    returnLoopEmblems: organizationSignatures.filter(
      (signature) => /막다른되돌이고리|한굽돌아옴고리/.test(signature),
    ).length,
    splitQuadrilateralEmblems: organizationSignatures.filter(
      (signature) => /사선분할사각창|비껴쪼갠마름/.test(signature),
    ).length,
    ambiguousCopyIds,
  }, {
    returnLoopEmblems: 1,
    splitQuadrilateralEmblems: 1,
    ambiguousCopyIds: [],
  });
});

test("complete blueprint contains 185 unique original items", async () => {
  const items = await loadBlueprint();
  assert.equal(items.length, 185);
  assert.equal(new Set(items.map(({ id }) => id)).size, 185);
  assert.equal(new Set(items.map(({ name }) => name)).size, 185);
  assert.deepEqual(validateBlueprint(items), []);
});

test("legendary and special quotas are exact", async () => {
  const legendary = await loadRarityBlueprint("legendary");
  const special = await loadRarityBlueprint("special");

  assert.deepEqual(legendary.map(({ id }) => id), expectedIds("legendary", 12));
  assert.deepEqual(countBy(legendary, "theme"), {
    "천체 장비": 3,
    "고대 군주 장비": 3,
    "세계수·거대 생물 장비": 3,
    "우주 현상 장비": 3,
  });
  assert.deepEqual(countBy(legendary, "slot"), { head: 6, face: 2, neck: 1, body: 3 });
  assert.deepEqual(validateBlueprint(legendary, { rarity: "legendary" }), []);

  assert.deepEqual(special.map(({ id }) => id), expectedIds("special", 5));
  assert.deepEqual(special.map(({ theme, slot }) => ({ theme, slot })), [
    { theme: "사진 배달", slot: "body" },
    { theme: "집중 타이머", slot: "head" },
    { theme: "창 오르기", slot: "neck" },
    { theme: "GAMCHA", slot: "face" },
    { theme: "미감이 정체성", slot: "head" },
  ]);
  assert.deepEqual(validateBlueprint(special, { rarity: "special" }), []);
});

test("legendary outer shapes use silhouette evidence, stay Epic-disjoint, and limit crown-hood forms", async () => {
  const epic = await loadRarityBlueprint("epic");
  const legendary = await loadRarityBlueprint("legendary");
  const issues = [];

  for (const item of [...epic, ...legendary]) {
    const shape = item.outerShape;
    if (!shape) {
      issues.push(`${item.id}: missing outerShape`);
      continue;
    }
    if ("family" in shape) issues.push(`${item.id}: free-form shape family remains`);
    if ((shape.evidence ?? []).length < 2) {
      issues.push(`${item.id}: insufficient shape evidence`);
    }
    const copy = item.silhouette.normalize("NFC");
    for (const evidence of shape.evidence ?? []) {
      if (!copy.includes(evidence.normalize("NFC"))) {
        issues.push(`${item.id}: missing shape evidence ${evidence}`);
      }
    }
  }
  assert.deepEqual(issues, []);
  assert.ok(legendary.filter(({ outerShape }) => outerShape?.class === "crown").length <= 1);
  assert.ok(legendary.filter(({ outerShape }) => outerShape?.class === "hood").length <= 1);
});

test("a fresh arbitrary label cannot hide reused Epic silhouette evidence", () => {
  const items = completeBlueprint();
  const epic = items.find(({ id }) => id === "epic_001");
  const legendary = items.filter(({ rarity }) => rarity === "legendary");
  legendary[0].silhouette = epic.silhouette;
  legendary[0].outerShape.evidence = [...epic.outerShape.evidence];
  legendary[0].outerShape.family = "brand-new-arbitrary-label";

  const errors = validateBlueprint(items);
  assert.ok(errors.some((error) =>
    error.includes("legendary_001: duplicate outer shape fingerprint with epic_001")));
});

test("outer-shape evidence rejects IDs, generic placeholders, and prompt-only copy", () => {
  const items = completeBlueprint();
  const ranked = items.filter(({ rarity }) => ["epic", "legendary"].includes(rarity));
  ranked[0].silhouette += ` ${ranked[0].id}`;
  ranked[0].outerShape.evidence = [ranked[0].id, ranked[0].outerShape.evidence[1]];
  ranked[1].outerShape.evidence = ["윤곽", ranked[1].outerShape.evidence[1]];
  ranked[2].prompt += " 프롬프트 전용 삼각판과 프롬프트 전용 물결밑단";
  ranked[2].outerShape.evidence = ["프롬프트 전용 삼각판", "프롬프트 전용 물결밑단"];
  ranked[3].outerShape.evidence = [ranked[3].outerShape.evidence[0]];
  ranked[4].silhouette += " fixture-shape";
  ranked[4].outerShape.evidence = ["fixture-shape", ranked[4].outerShape.evidence[1]];
  ranked[5].silhouette += " 단일 구조 윤곽";
  ranked[5].outerShape.evidence = ["단일 구조 윤곽", ranked[5].outerShape.evidence[1]];
  ranked[6].silhouette += " OuTeR-SiLhOuEtTe";
  ranked[6].outerShape.evidence = ["OuTeR-SiLhOuEtTe", ranked[6].outerShape.evidence[1]];

  const errors = validateBlueprint(items);
  assert.ok(errors.includes("epic_001: invalid ID-like outer shape evidence: epic_001"));
  assert.ok(errors.includes("epic_002: generic outer shape evidence: 윤곽"));
  assert.ok(errors.includes(
    "epic_003: outer shape evidence not found in silhouette: 프롬프트 전용 삼각판",
  ));
  assert.ok(errors.includes("epic_004: expected at least two outer shape evidence phrases"));
  assert.ok(errors.includes("epic_005: generic outer shape evidence: fixture-shape"));
  assert.ok(errors.includes("epic_006: generic outer shape evidence: 단일 구조 윤곽"));
  assert.ok(errors.includes("epic_007: generic outer shape evidence: OuTeR-SiLhOuEtTe"));
});

test("outer-shape fingerprints fold ASCII case and order without locale-sensitive hooks", () => {
  const items = completeBlueprint();
  const epic = items.find(({ id }) => id === "epic_001");
  const legendary = items.find(({ id }) => id === "legendary_001");
  epic.silhouette += " RIDGED ARCH와 FORKED BASE";
  epic.outerShape.evidence = ["RIDGED ARCH", "FORKED BASE"];
  legendary.silhouette += " forked base와 ridged arch";
  legendary.outerShape.evidence = ["forked base", "ridged arch"];

  const originalLocaleLowerCase = String.prototype.toLocaleLowerCase;
  String.prototype.toLocaleLowerCase = function localeDependentIdentity() {
    return String(this);
  };
  let errors;
  try {
    errors = validateBlueprint(items);
  } finally {
    String.prototype.toLocaleLowerCase = originalLocaleLowerCase;
  }

  assert.ok(errors.some((error) =>
    error.includes("legendary_001: duplicate outer shape fingerprint with epic_001")));
});

test("Korean generic evidence normalizes only approved modifier and particle variants", () => {
  const items = completeBlueprint();
  const ranked = items.filter(({ rarity }) => ["epic", "legendary"].includes(rarity));
  const genericPhrases = [
    "단일 구조 윤곽의",
    "단일한 구조 윤곽",
    "기본적인 구조적인 외곽으로",
  ];
  genericPhrases.forEach((phrase, index) => {
    ranked[index].silhouette += ` ${phrase}`;
    ranked[index].outerShape.evidence = [phrase, ranked[index].outerShape.evidence[1]];
  });
  const legitimatePhrase = "단일고리와 외곽선";
  ranked[3].silhouette += ` ${legitimatePhrase}`;
  ranked[3].outerShape.evidence = [
    legitimatePhrase,
    ranked[3].outerShape.evidence[1],
  ];

  const errors = validateBlueprint(items);
  assert.ok(errors.includes("epic_001: generic outer shape evidence: 단일 구조 윤곽의"));
  assert.ok(errors.includes("epic_002: generic outer shape evidence: 단일한 구조 윤곽"));
  assert.ok(errors.includes(
    "epic_003: generic outer shape evidence: 기본적인 구조적인 외곽으로",
  ));
  assert.ok(!errors.includes(
    "epic_004: generic outer shape evidence: 단일고리와 외곽선",
  ));
});

test("validator still rejects excess crown or hood classes and copy-class conflicts", () => {
  const items = completeBlueprint();
  const legendary = items.filter(({ rarity }) => rarity === "legendary");
  legendary[0].outerShape.class = "crown";
  legendary[1].outerShape.class = "crown";
  legendary[2].outerShape.class = "hood";
  legendary[3].outerShape.class = "hood";
  legendary[5].silhouette += " 왕관형 외곽";
  legendary[6].silhouette += " 후드형 외곽";

  const errors = validateBlueprint(items);
  assert.ok(errors.includes("legendary: expected at most one crown-shaped outer form, got 2"));
  assert.ok(errors.includes("legendary: expected at most one hood-shaped outer form, got 2"));
  assert.ok(errors.includes("legendary_006: outer shape class other conflicts with crown copy"));
  assert.ok(errors.includes("legendary_007: outer shape class other conflicts with hood copy"));
});

test("ancient-ruler Legendary rows do not split one throne concept or reuse the Epic open-jaw collar", async () => {
  const legendary = await loadRarityBlueprint("legendary");
  const ancientRuler = legendary.filter(({ theme }) => theme === "고대 군주 장비");
  const throneRows = ancientRuler.filter((item) =>
    /왕좌|빈좌|의자|좌석/.test(`${item.name} ${item.silhouette} ${item.signatureDetail} ${item.prompt}`));
  const neckCopy = ancientRuler
    .filter(({ slot }) => slot === "neck")
    .map((item) => `${item.name} ${item.silhouette} ${item.prompt}`)
    .join(" ");

  assert.ok(throneRows.length <= 1, throneRows.map(({ id }) => id).join(", "));
  assert.doesNotMatch(neckCopy, /말굽|열린 고리|C자|한쪽 끝|직사각 버팀/);
});

test("photo-delivery Special uses one wearable metaphor without a literal panel composition", async () => {
  const special = await loadRarityBlueprint("special");
  const photoDelivery = special.find(({ id }) => id === "special_001");
  const copy = `${photoDelivery.name} ${photoDelivery.silhouette} ${photoDelivery.signatureDetail} ${photoDelivery.prompt}`;

  assert.doesNotMatch(copy, /패널|화면|프레임|사진판|빛그림판/);
  assert.match(photoDelivery.prompt, /한 개/);
});

test("complete blueprint CLI reports the concept-lock summary", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["scripts/costume-blueprint.mjs", "validate"],
    { cwd: new URL("..", import.meta.url) },
  );
  assert.equal(
    stdout.trim(),
    "items=185 missing=0 duplicateName=0 duplicateSilhouette=0 duplicatePalette=0 duplicateDetail=0",
  );
});

test("assembles a standalone transparent image prompt", () => {
  const prompt = buildImagePrompt(validItem, "approved style lock");
  assert.match(prompt, /Asset type: standalone common desktop-pet costume icon/);
  assert.match(prompt, /Subject: one 새벽 우편모; 짧은 챙과 봉인 단추/);
  assert.match(prompt, /Style: approved style lock/);
  assert.match(prompt, /square true-transparent PNG/);
});

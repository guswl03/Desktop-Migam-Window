import { lstat, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rarityCounts = { common: 80, rare: 57, epic: 31, legendary: 12, special: 5 };
const slotCountsByRarity = {
  common: { head: 44, face: 12, neck: 10, body: 14 },
  rare: { head: 31, face: 8, neck: 6, body: 12 },
  epic: { head: 16, face: 5, neck: 4, body: 6 },
  legendary: { head: 6, face: 2, neck: 1, body: 3 },
  special: { head: 2, face: 1, neck: 1, body: 1 },
};
const overallSlotCounts = { head: 99, face: 28, neck: 22, body: 36 };
const blueprintFiles = ["common.json", "rare.json", "epic.json", "legendary.json", "special.json"];
const allowedRarities = new Set(Object.keys(rarityCounts));
const allowedSlots = new Set(Object.keys(overallSlotCounts));
const allowedQaStates = new Set(["planned", "candidate", "accepted", "rejected"]);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const APPROVED_STYLE = "polished stylized desktop-pet game icon, friendly toy-like proportions, clean readable silhouette, crisp edges";

function normalized(value) {
  return typeof value === "string"
    ? value.normalize("NFC").trim().replaceAll(/\s+/g, " ").toLocaleLowerCase()
    : "";
}

export function isAbsentBlueprintEntry(readError, entryError) {
  return readError?.code === "ENOENT" && entryError?.code === "ENOENT";
}

function itemId(item, index) {
  return typeof item?.id === "string" && item.id.trim() ? item.id : `<item ${index + 1}>`;
}

function countByKeys(keys) {
  return Object.fromEntries(keys.map((key) => [key, 0]));
}

function countDescription(counts) {
  return Object.entries(counts).map(([key, count]) => `${key}=${count}`).join(" ");
}

function addDuplicateErrors(items, errors, label, valueFor) {
  const seen = new Map();
  items.forEach((item, index) => {
    const value = valueFor(item);
    if (!value) return;
    const currentId = itemId(item, index);
    const firstId = seen.get(value);
    if (firstId) {
      errors.push(`${currentId}: duplicate ${label} with ${firstId}`);
      return;
    }
    seen.set(value, currentId);
  });
}

export function expectedCatalogIds(scopeRarity = null) {
  const counts = scopeRarity
    ? [[scopeRarity, rarityCounts[scopeRarity]]]
    : Object.entries(rarityCounts);
  return new Map(counts.flatMap(([rarity, count]) =>
    Array.from({ length: count }, (_, index) => [
      `${rarity}_${String(index + 1).padStart(3, "0")}`,
      rarity,
    ]),
  ));
}

export function validateBlueprint(items, { rarity: scopeRarity = null } = {}) {
  if (!Array.isArray(items)) return ["blueprint: items must be an array"];
  if (scopeRarity !== null && !allowedRarities.has(scopeRarity)) {
    return [`blueprint: unsupported validation rarity ${scopeRarity}`];
  }

  const errors = [];
  const expectedIds = expectedCatalogIds(scopeRarity);
  const expectedRarityCounts = scopeRarity
    ? { [scopeRarity]: rarityCounts[scopeRarity] }
    : rarityCounts;
  const expectedOverallSlotCounts = scopeRarity
    ? slotCountsByRarity[scopeRarity]
    : overallSlotCounts;
  const checkedRarities = scopeRarity ? [scopeRarity] : [...allowedRarities];
  const requiredTextFields = [
    ["name", "name"],
    ["theme", "theme"],
    ["silhouette", "silhouette"],
    ["material", "material"],
    ["signatureDetail", "signature detail"],
    ["prompt", "prompt"],
  ];
  const actualRarityCounts = countByKeys([...allowedRarities]);
  const actualSlotCounts = countByKeys([...allowedSlots]);
  const actualSlotsByRarity = Object.fromEntries(
    [...allowedRarities].map((rarity) => [rarity, countByKeys([...allowedSlots])]),
  );
  const seenIds = new Map();

  if (items.length !== expectedIds.size) {
    errors.push(`catalog: expected ${expectedIds.size} items, got ${items.length}`);
  }

  items.forEach((item, index) => {
    const id = itemId(item, index);
    const hasId = Boolean(normalized(item?.id));
    if (!hasId) {
      errors.push(`${id}: missing id`);
    } else if (!expectedIds.has(item.id)) {
      errors.push(`${id}: unexpected catalog ID`);
    } else if (seenIds.has(item.id)) {
      errors.push(`${id}: duplicate ID (first declared at item ${seenIds.get(item.id) + 1})`);
    } else {
      seenIds.set(item.id, index);
    }

    for (const [field, label] of requiredTextFields) {
      if (!normalized(item?.[field])) errors.push(`${id}: missing ${label}`);
    }

    const expectedRarity = expectedIds.get(item?.id);
    if (!allowedRarities.has(item?.rarity)) {
      errors.push(`${id}: wrong rarity`);
    } else {
      actualRarityCounts[item.rarity] += 1;
      if (expectedRarity && item.rarity !== expectedRarity) {
        errors.push(`${id}: wrong rarity (expected ${expectedRarity}, got ${item.rarity})`);
      }
    }

    if (!allowedSlots.has(item?.slot)) {
      errors.push(`${id}: unsupported slot`);
    } else {
      actualSlotCounts[item.slot] += 1;
      if (allowedRarities.has(item?.rarity)) actualSlotsByRarity[item.rarity][item.slot] += 1;
    }

    const palette = item?.palette;
    if (!palette || typeof palette !== "object") {
      errors.push(`${id}: missing palette`);
    } else {
      for (const field of ["primary", "secondary", "accent"]) {
        if (!normalized(palette[field])) errors.push(`${id}: missing palette ${field}`);
      }
    }

    const alignment = item?.defaultAlignment;
    if (!alignment || ![alignment.x, alignment.y, alignment.size].every(Number.isInteger)) {
      errors.push(`${id}: non-integer placement`);
    }

    if (!allowedQaStates.has(item?.qaState)) errors.push(`${id}: invalid qaState`);
  });

  for (const id of expectedIds.keys()) {
    if (!seenIds.has(id)) errors.push(`missing catalog ID ${id}`);
  }

  const scopedActualRarityCounts = Object.fromEntries(
    checkedRarities.map((rarity) => [rarity, actualRarityCounts[rarity]]),
  );
  if (countDescription(scopedActualRarityCounts) !== countDescription(expectedRarityCounts)) {
    errors.push(
      `catalog: expected rarities ${countDescription(expectedRarityCounts)}, got ${countDescription(scopedActualRarityCounts)}`,
    );
  }

  for (const rarity of checkedRarities) {
    const expectedSlots = slotCountsByRarity[rarity];
    const actualSlots = actualSlotsByRarity[rarity];
    if (countDescription(actualSlots) !== countDescription(expectedSlots)) {
      errors.push(
        `${rarity}: expected slots ${countDescription(expectedSlots)}, got ${countDescription(actualSlots)}`,
      );
    }
  }

  if (countDescription(actualSlotCounts) !== countDescription(expectedOverallSlotCounts)) {
    errors.push(
      `catalog: expected overall slots ${countDescription(expectedOverallSlotCounts)}, got ${countDescription(actualSlotCounts)}`,
    );
  }

  addDuplicateErrors(items, errors, "name", (item) => normalized(item?.name));
  addDuplicateErrors(items, errors, "silhouette", (item) => normalized(item?.silhouette));
  addDuplicateErrors(items, errors, "normalized palette", (item) => {
    const palette = item?.palette;
    if (!palette || typeof palette !== "object") return "";
    const values = [palette.primary, palette.secondary, palette.accent].map(normalized);
    return values.every(Boolean) ? values.join("\u0000") : "";
  });
  addDuplicateErrors(items, errors, "signature detail", (item) => normalized(item?.signatureDetail));

  return errors;
}

export async function loadBlueprint(root = repositoryRoot, rarity = null) {
  if (rarity !== null && !allowedRarities.has(rarity)) {
    throw new Error(`unsupported rarity: ${rarity}`);
  }
  const directory = resolve(root, "pack", "catalog-blueprint");
  const files = rarity === null ? blueprintFiles : [`${rarity}.json`];
  const documents = await Promise.all(files.map(async (file) => {
    const path = resolve(directory, file);
    let source;
    try {
      source = await readFile(path, "utf8");
    } catch (error) {
      if (rarity === null && error?.code === "ENOENT") {
        let entryError = null;
        try {
          await lstat(path);
        } catch (candidateError) {
          entryError = candidateError;
        }
        if (isAbsentBlueprintEntry(error, entryError)) return [];
      }
      throw error;
    }
    const items = JSON.parse(source);
    if (!Array.isArray(items)) throw new Error(`${file}: blueprint file must contain an array`);
    return items;
  }));
  return documents.flat();
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

async function main() {
  if (process.argv[2] !== "validate") {
    throw new Error("usage: node scripts/costume-blueprint.mjs validate [--rarity <rarity>]");
  }
  const rarity = process.argv[3] === "--rarity" ? process.argv[4] : null;
  if ((process.argv.length > 3 && !rarity) || process.argv.length > (rarity ? 5 : 3)) {
    throw new Error("usage: node scripts/costume-blueprint.mjs validate [--rarity <rarity>]");
  }
  const items = await loadBlueprint(repositoryRoot, rarity);
  const errors = validateBlueprint(items, { rarity });
  if (errors.length) throw new Error(errors.join("\n"));
  if (rarity) {
    const slotCounts = countByKeys([...allowedSlots]);
    for (const item of items) slotCounts[item.slot] += 1;
    console.log(
      `${rarity}=${items.length} missing=0 duplicate=0 slot=`
      + `head:${slotCounts.head},face:${slotCounts.face},neck:${slotCounts.neck},body:${slotCounts.body}`,
    );
    return;
  }
  console.log(
    `items=${items.length} missing=0 duplicateName=0 duplicateSilhouette=0 duplicatePalette=0 duplicateDetail=0`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

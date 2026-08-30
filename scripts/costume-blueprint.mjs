import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rarityCounts = { common: 80, rare: 57, epic: 31, legendary: 12, special: 5 };
const blueprintFiles = ["common.json", "rare.json", "epic.json", "legendary.json", "special.json"];
const allowedRarities = new Set(Object.keys(rarityCounts));
const allowedSlots = new Set(["head", "face", "neck", "body"]);
const allowedQaStates = new Set(["planned", "candidate", "accepted", "rejected"]);
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const APPROVED_STYLE = "polished stylized desktop-pet game icon, friendly toy-like proportions, clean readable silhouette, crisp edges";

function normalized(value) {
  return typeof value === "string"
    ? value.normalize("NFC").trim().replaceAll(/\s+/g, " ").toLocaleLowerCase()
    : "";
}

function itemId(item, index) {
  return typeof item?.id === "string" && item.id.trim() ? item.id : `<item ${index + 1}>`;
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

export function expectedCatalogIds() {
  return new Map(Object.entries(rarityCounts).flatMap(([rarity, count]) =>
    Array.from({ length: count }, (_, index) => [
      `${rarity}_${String(index + 1).padStart(3, "0")}`,
      rarity,
    ]),
  ));
}

export function validateBlueprint(items) {
  const errors = [];
  const expectedIds = expectedCatalogIds();
  const requiredTextFields = [["name", "name"], ["theme", "theme"], ["silhouette", "silhouette"], ["material", "material"], ["signatureDetail", "signature detail"], ["prompt", "prompt"]];

  if (!Array.isArray(items)) return ["blueprint: items must be an array"];

  items.forEach((item, index) => {
    const id = itemId(item, index);
    if (!normalized(item?.id)) errors.push(`${id}: missing id`);

    for (const [field, label] of requiredTextFields) {
      if (!normalized(item?.[field])) errors.push(`${id}: missing ${label}`);
    }

    const expectedRarity = expectedIds.get(item?.id);
    if (!allowedRarities.has(item?.rarity)) {
      errors.push(`${id}: wrong rarity`);
    } else if (expectedRarity && item.rarity !== expectedRarity) {
      errors.push(`${id}: wrong rarity (expected ${expectedRarity}, got ${item.rarity})`);
    } else if (!expectedRarity) {
      errors.push(`${id}: unknown catalog ID`);
    }

    if (!allowedSlots.has(item?.slot)) errors.push(`${id}: unsupported slot`);

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

export async function loadBlueprint(root = repositoryRoot) {
  const directory = resolve(root, "pack", "blueprint");
  const documents = await Promise.all(blueprintFiles.map(async (file) => {
    const source = await readFile(resolve(directory, file), "utf8");
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
    throw new Error("usage: node scripts/costume-blueprint.mjs validate");
  }
  const items = await loadBlueprint();
  const errors = validateBlueprint(items);
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`blueprint valid: ${items.length} items`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

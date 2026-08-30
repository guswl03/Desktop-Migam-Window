import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { expectedCatalogIds, loadBlueprint } from "./costume-blueprint.mjs";
import { acceptedCandidatePath } from "./costume-normalize-candidates.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const rarities = ["common", "rare", "epic", "legendary", "special"];

function safePathInside(root, path, label) {
  const relativePath = relative(root, path);
  if (relativePath === "" || relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`${label}: path escapes its approved directory`);
  }
  return path;
}

function candidateRecord(key, entry) {
  if (entry && typeof entry === "object" && !(entry instanceof Uint8Array)) {
    return {
      id: entry.id ?? key,
      rarity: entry.rarity,
      sourcePath: entry.sourcePath,
      bytes: entry.bytes,
      invalid: entry.invalid,
    };
  }
  return { id: key, bytes: entry };
}

export async function loadAcceptedCandidates(root = repositoryRoot) {
  const acceptedRoot = resolve(root, "pack", "qa", "accepted");
  const candidates = new Map();
  let rarityEntries;
  try {
    rarityEntries = await readdir(acceptedRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return candidates;
    throw error;
  }

  for (const directory of rarityEntries) {
    if (!directory.isDirectory() || !rarities.includes(directory.name)) {
      candidates.set(`__accepted_path_${directory.name}`, {
        id: directory.name,
        invalid: `unexpected accepted path ${directory.name}`,
      });
      continue;
    }
    const rarity = directory.name;
    const directoryPath = resolve(acceptedRoot, rarity);
    safePathInside(acceptedRoot, directoryPath, rarity);
    const files = await readdir(directoryPath, { withFileTypes: true });
    for (const file of files) {
      const sourcePath = resolve(directoryPath, file.name);
      safePathInside(directoryPath, sourcePath, file.name);
      if (!file.isFile() || extname(file.name).toLowerCase() !== ".png") {
        candidates.set(`__accepted_path_${rarity}_${file.name}`, {
          id: `${rarity}/${file.name}`,
          invalid: `unexpected accepted candidate path ${rarity}/${file.name}`,
        });
        continue;
      }
      const id = file.name.slice(0, -4);
      const key = candidates.has(id) ? `${id}#duplicate-${rarity}` : id;
      candidates.set(key, {
        id,
        rarity,
        sourcePath,
        bytes: await readFile(sourcePath),
      });
    }
  }
  return candidates;
}

export async function planPromotion(blueprint, acceptedCandidates, { root = repositoryRoot } = {}) {
  const errors = [];
  const expected = expectedCatalogIds();
  const blueprintById = new Map();
  if (!Array.isArray(blueprint)) {
    errors.push("blueprint: expected an array of 185 rows");
  } else {
    if (blueprint.length !== expected.size) {
      errors.push(`expected 185 blueprint rows, got ${blueprint.length}`);
    }
    for (const item of blueprint) {
      const id = typeof item?.id === "string" ? item.id : "<blueprint row>";
      if (blueprintById.has(id)) {
        errors.push(`${id}: duplicate blueprint row`);
        continue;
      }
      blueprintById.set(id, item);
      const expectedRarity = expected.get(id);
      if (!expectedRarity) {
        errors.push(`${id}: unexpected blueprint ID`);
        continue;
      }
      if (item.rarity !== expectedRarity) {
        errors.push(`${id}: blueprint rarity mismatch (got ${item.rarity}, expected ${expectedRarity})`);
      }
      if (item.qaState !== "accepted") {
        errors.push(`${id}: qaState must be accepted (got ${item.qaState})`);
      }
    }
    for (const id of expected.keys()) {
      if (!blueprintById.has(id)) errors.push(`${id}: missing blueprint row`);
    }
  }

  if (!(acceptedCandidates instanceof Map)) {
    errors.push("accepted candidates: expected a Map keyed by costume ID");
  }
  const candidates = acceptedCandidates instanceof Map ? acceptedCandidates : new Map();
  if (candidates.size !== expected.size) {
    errors.push(`expected 185 accepted candidates, got ${candidates.size}`);
  }
  const candidateIds = new Set();
  for (const [key, entry] of candidates) {
    const candidate = candidateRecord(key, entry);
    const id = candidate.id;
    if (candidate.invalid) {
      errors.push(`${id}: ${candidate.invalid}`);
      continue;
    }
    if (candidateIds.has(id)) {
      errors.push(`${id}: duplicate accepted candidate`);
      continue;
    }
    candidateIds.add(id);
    if (key !== id) errors.push(`${key}: accepted candidate key mismatch for ${id}`);
    const expectedRarity = expected.get(id);
    if (!expectedRarity) {
      errors.push(`${id}: unexpected accepted candidate`);
      continue;
    }
    if (candidate.rarity && candidate.rarity !== expectedRarity) {
      errors.push(`${id}: accepted candidate rarity mismatch (got ${candidate.rarity}, expected ${expectedRarity})`);
    }
    if (!(candidate.bytes instanceof Uint8Array) || candidate.bytes.length === 0) {
      errors.push(`${id}: accepted candidate PNG is missing or empty`);
    }
    if (candidate.sourcePath) {
      const expectedSource = acceptedCandidatePath({ id, rarity: expectedRarity }, root);
      if (resolve(candidate.sourcePath) !== expectedSource) {
        errors.push(`${id}: accepted candidate path does not match its approved rarity directory`);
      }
    }
  }

  for (const [id, rarity] of expected) {
    const item = blueprintById.get(id);
    if (item?.qaState === "accepted" && !candidateIds.has(id)) {
      errors.push(`${id}: missing accepted candidate`);
    }
    if (item?.rarity === rarity && item?.qaState === "accepted" && candidateIds.has(id)) {
      const targetRoot = resolve(root, "pack", rarity);
      safePathInside(targetRoot, resolve(targetRoot, `${id}.png`), id);
    }
  }

  if (errors.length) return { root, errors, copies: [] };
  const copies = [...expected].map(([id, rarity]) => {
    const candidate = candidateRecord(id, candidates.get(id));
    const sourcePath = candidate.sourcePath ?? acceptedCandidatePath({ id, rarity }, root);
    const targetRoot = resolve(root, "pack", rarity);
    const targetPath = safePathInside(targetRoot, resolve(targetRoot, `${id}.png`), id);
    return { id, rarity, sourcePath, targetPath, png: candidate.bytes };
  });
  return { root, errors: [], copies };
}

export async function applyPromotion(plan) {
  if (!plan || !Array.isArray(plan.errors) || !Array.isArray(plan.copies)) {
    throw new Error("invalid promotion plan");
  }
  if (plan.errors.length) throw new Error("promotion plan contains errors");
  for (const copy of plan.copies) {
    const targetRoot = resolve(plan.root ?? repositoryRoot, "pack", copy.rarity);
    safePathInside(targetRoot, copy.targetPath, copy.id);
  }
  for (const copy of plan.copies) await writeFile(copy.targetPath, copy.png);
  return plan.copies.length;
}

async function main() {
  const apply = process.argv.slice(2);
  if (apply.length > 1 || (apply.length === 1 && apply[0] !== "--apply")) {
    throw new Error("usage: node scripts/costume-promote-candidates.mjs [--apply]");
  }
  const blueprint = await loadBlueprint(repositoryRoot);
  const candidates = await loadAcceptedCandidates(repositoryRoot);
  const plan = await planPromotion(blueprint, candidates);
  if (plan.errors.length) throw new Error(plan.errors.join("\n"));
  if (apply[0] === "--apply") {
    console.log(`promoted=${await applyPromotion(plan)}`);
  } else {
    console.log(`validated=${plan.copies.length}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

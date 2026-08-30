import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { expectedCatalogIds, loadBlueprint } from "./costume-blueprint.mjs";
import { analyzePngSemantics, readPngRgba, visibleBounds } from "./lib/png-rgba.mjs";
import { encodePngRgba, normalizeRgbaSprite } from "./lib/png-normalize.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const minimumMargin = 12;
const minimumSpan = 64;

function itemLabel(item) {
  return typeof item?.id === "string" && item.id ? item.id : "<candidate>";
}

function safePathInside(root, path, label) {
  const relativePath = relative(root, path);
  if (
    relativePath === ""
    || isAbsolute(relativePath)
    || relativePath.startsWith(`..${sep}`)
    || relativePath.startsWith("../")
    || relativePath.startsWith("..\\")
    || relativePath === ".."
  ) {
    throw new Error(`${label}: path escapes its approved directory`);
  }
  return path;
}

function approvedRarity(item) {
  const id = itemLabel(item);
  const rarity = expectedCatalogIds().get(item?.id);
  if (!rarity) throw new Error(`${id}: unapproved candidate ID`);
  if (item?.rarity !== rarity) {
    throw new Error(`${id}: rarity-ID mismatch (expected ${rarity}, got ${item?.rarity})`);
  }
  return rarity;
}

export function acceptedCandidatePath(item, root = repositoryRoot) {
  const rarity = approvedRarity(item);
  const acceptedRoot = resolve(root, "pack", "qa", "accepted", rarity);
  return safePathInside(
    acceptedRoot,
    resolve(acceptedRoot, `${item.id}.png`),
    item.id,
  );
}

export function rawCandidatePath(item, root = repositoryRoot) {
  approvedRarity(item);
  const rawRoot = resolve(root, "pack", "qa", "candidates", "raw");
  return safePathInside(rawRoot, resolve(rawRoot, `${item.id}.png`), item.id);
}

export function validateCandidate(item, decoded) {
  const id = itemLabel(item);
  const errors = [];
  if (decoded?.width !== 256 || decoded?.height !== 256) {
    errors.push(`${id}: expected 256x256 RGBA candidate, got ${decoded?.width}x${decoded?.height}`);
    return errors;
  }
  if (!(decoded?.pixels instanceof Uint8Array) || decoded.pixels.length !== 256 * 256 * 4) {
    errors.push(`${id}: expected RGBA pixel data for 256x256 candidate`);
    return errors;
  }

  let transparentPixels = 0;
  for (let index = 3; index < decoded.pixels.length; index += 4) {
    if (decoded.pixels[index] === 0) transparentPixels += 1;
  }
  if (transparentPixels === 0) errors.push(`${id}: candidate has no transparent pixels`);

  const bounds = visibleBounds(decoded.pixels, decoded.width, decoded.height);
  if (!bounds) {
    errors.push(`${id}: candidate has no visible pixels`);
    return errors;
  }

  const spanX = bounds.right - bounds.left + 1;
  const spanY = bounds.bottom - bounds.top + 1;
  if (Math.max(spanX, spanY) < minimumSpan) {
    errors.push(`${id}: visible span must be at least 64 pixels wide or tall (got ${spanX}x${spanY})`);
  }

  const margins = {
    left: bounds.left,
    top: bounds.top,
    right: decoded.width - 1 - bounds.right,
    bottom: decoded.height - 1 - bounds.bottom,
  };
  for (const [side, margin] of Object.entries(margins)) {
    if (margin < minimumMargin) {
      errors.push(`${id}: requires at least 12 transparent pixels on the ${side} margin (got ${margin})`);
    }
  }
  if (Object.values(margins).some((margin) => margin === 0)) {
    errors.push(`${id}: visible pixels touch a canvas edge`);
  }

  const semantics = analyzePngSemantics(decoded);
  if (semantics.warnings.includes("alpha-dust")) errors.push(`${id}: alpha-dust warning`);
  return errors;
}

export async function normalizeCandidate(item, {
  root = repositoryRoot,
  rawPath = rawCandidatePath(item, root),
  normalize = true,
} = {}) {
  const source = await readPngRgba(rawPath);
  const candidate = normalize ? normalizeRgbaSprite(source) : source;
  const errors = validateCandidate(item, candidate);
  if (errors.length) throw new Error(errors.join("\n"));

  const destination = acceptedCandidatePath(item, root);
  const destinationRoot = resolve(root, "pack", "qa", "accepted", item.rarity);
  safePathInside(destinationRoot, destination, item.id);
  await mkdir(destinationRoot, { recursive: true });
  const temporary = resolve(destinationRoot, `.${item.id}.${randomUUID()}.tmp`);
  safePathInside(destinationRoot, temporary, item.id);
  try {
    await writeFile(temporary, encodePngRgba(candidate), { flag: "wx" });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return { destination, candidate };
}

function requestedIds(argumentsList) {
  if (argumentsList[0] !== "--blueprint" || argumentsList.length < 2) {
    throw new Error("usage: node scripts/costume-normalize-candidates.mjs --blueprint <costume-id> [...]");
  }
  const ids = argumentsList.slice(1);
  if (new Set(ids).size !== ids.length) throw new Error("duplicate blueprint candidate ID");
  return ids;
}

async function main() {
  const ids = requestedIds(process.argv.slice(2));
  const blueprint = await loadBlueprint(repositoryRoot);
  const byId = new Map(blueprint.map((item) => [item.id, item]));
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) throw new Error(`${id}: unapproved candidate ID`);
    const { destination, candidate } = await normalizeCandidate(item);
    const bounds = visibleBounds(candidate.pixels, candidate.width, candidate.height);
    console.log(`${item.id}=accepted ${destination} bounds=${bounds.left},${bounds.top}-${bounds.right},${bounds.bottom}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

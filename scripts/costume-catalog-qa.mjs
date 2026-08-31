import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { loadBlueprint, validateBlueprint } from "./costume-blueprint.mjs";
import { analyzePngSemantics, readPngRgba, visibleBounds } from "./lib/png-rgba.mjs";
import { findNearDuplicateSprites } from "./lib/sprite-similarity.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = resolve(repositoryRoot, "pack/manifest.json");
const generatedDirectory = resolve(repositoryRoot, "pack/qa/generated/final");
const rarities = ["common", "rare", "epic", "legendary", "special"];
const expectedRarityCounts = { common: 80, rare: 57, epic: 31, legendary: 12, special: 5 };
const expectedSlotCounts = { head: 99, face: 28, neck: 22, body: 36 };
const expectedRaritySlotCounts = {
  common: { head: 44, face: 12, neck: 10, body: 14 },
  rare: { head: 31, face: 8, neck: 6, body: 12 },
  epic: { head: 16, face: 5, neck: 4, body: 6 },
  legendary: { head: 6, face: 2, neck: 1, body: 3 },
  special: { head: 2, face: 1, neck: 1, body: 1 },
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSheetRows(costumes, blueprint) {
  const blueprintById = new Map(blueprint.map((item) => [item.id, item]));
  return costumes
    .filter(({ rarity }) => rarity !== "default")
    .map((costume) => {
      const item = blueprintById.get(costume.id);
      if (!item) throw new Error(`${costume.id}: missing blueprint row`);
      return {
        id: costume.id,
        name: costume.name,
        rarity: costume.rarity,
        collection: costume.collection,
        file: costume.file,
        slot: costume.slot,
        defaultAlignment: costume.defaultAlignment,
        theme: item.theme,
        qaState: item.qaState,
      };
    });
}

export function analyzePlacement(costume, sourceBounds) {
  const { x, y, size } = costume.defaultAlignment;
  const scale = size / 256;
  const wornBounds = {
    left: x + sourceBounds.left * scale,
    top: y + sourceBounds.top * scale,
    right: x + (sourceBounds.right + 1) * scale,
    bottom: y + (sourceBounds.bottom + 1) * scale,
  };
  const warnings = [];
  if (wornBounds.left < -16) warnings.push("clipped-left");
  if (wornBounds.top < -24) warnings.push("clipped-top");
  if (wornBounds.right > 112) warnings.push("clipped-right");
  if (wornBounds.bottom > 104) warnings.push("clipped-bottom");
  const wornHeight = wornBounds.bottom - wornBounds.top;
  const wornCenterX = (wornBounds.left + wornBounds.right) / 2;
  const wornCenterY = (wornBounds.top + wornBounds.bottom) / 2;
  if (costume.slot === "head" && wornBounds.bottom > 24) {
    warnings.push("head-overlaps-face");
  }
  if (
    costume.slot === "face" &&
    (
      wornCenterX < 32 ||
      wornCenterX > 64 ||
      wornBounds.right <= 24 ||
      wornBounds.left >= 72 ||
      wornCenterY < 30 ||
      wornCenterY > 44 ||
      wornHeight > 42
    )
  ) {
    warnings.push("face-off-eye-line");
  }
  if (costume.slot === "neck" && wornBounds.top < 60) {
    warnings.push("neck-above-mouth");
  }
  if (
    costume.slot === "body" &&
    (
      wornBounds.left < 0 ||
      wornBounds.top < 0 ||
      wornBounds.right > 96 ||
      wornBounds.bottom > 104
    )
  ) {
    warnings.push("body-outside-cell");
  }
  return { sourceBounds, wornBounds, warnings };
}

function assetHref(fromPath, assetPath) {
  return relative(dirname(fromPath), assetPath).replaceAll("\\", "/");
}

function boundsLabel(bounds) {
  const display = (value) => Number.isInteger(value) ? value : value.toFixed(2);
  return `L${display(bounds.left)} T${display(bounds.top)} R${display(bounds.right)} B${display(bounds.bottom)}`;
}

function sheetCell(costume, index, columns, outputPath) {
  const cellWidth = 424;
  const cellHeight = 448;
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = column * cellWidth;
  const y = row * cellHeight;
  const assetPath = resolve(repositoryRoot, "pack", costume.file);
  const asset = escapeXml(assetHref(outputPath, assetPath));
  const atlasPath = resolve(
    repositoryRoot,
    "images/characters/gamjabot/references/base-spritesheet-extended.png",
  );
  const atlas = escapeXml(assetHref(outputPath, atlasPath));
  const alignment = costume.defaultAlignment;
  const wornX = x + 284;
  const wornY = y + 48;
  const shortName = [...costume.name].slice(0, 24).join("");
  const warningLabel = costume.warnings.length === 0
    ? "warnings none"
    : `warnings ${costume.warnings.join(", ")}`;
  return `
    <g class="costume-cell" data-id="${escapeXml(costume.id)}" data-qa-state="${escapeXml(costume.qaState)}">
      <rect x="${x + 4}" y="${y + 4}" width="416" height="440" rx="8" fill="#222329" stroke="#5b5d67" />
      <text x="${x + 16}" y="${y + 25}" class="section-label">ISOLATED · 4X</text>
      <rect x="${x + 12}" y="${y + 34}" width="256" height="256" fill="url(#checker)" stroke="#777" />
      <image href="${asset}" x="${x + 12}" y="${y + 34}" width="256" height="256" />
      <text x="${x + 300}" y="${y + 25}" class="section-label">WORN · 96PX</text>
      <rect x="${wornX}" y="${wornY}" width="128" height="128" fill="url(#checker)" stroke="#777" />
      <svg x="${wornX}" y="${wornY}" width="128" height="128" viewBox="0 0 128 128" overflow="hidden">
        <svg x="16" y="24" width="96" height="104" viewBox="0 0 96 104" overflow="hidden">
          <image href="${atlas}" x="0" y="0" width="768" height="1144" />
        </svg>
        <image href="${asset}" x="${16 + alignment.x}" y="${24 + alignment.y}" width="${alignment.size}" height="${alignment.size}" />
      </svg>
      <text x="${x + 16}" y="${y + 316}" class="id">${escapeXml(costume.id)}</text>
      <text x="${x + 16}" y="${y + 340}" class="name"><title>${escapeXml(costume.name)}</title>${escapeXml(shortName)}</text>
      <text x="${x + 16}" y="${y + 362}" class="meta">${escapeXml(costume.rarity.toUpperCase())} · ${escapeXml(costume.slot)} · ${escapeXml(costume.qaState)}</text>
      <text x="${x + 16}" y="${y + 380}" class="meta">x ${alignment.x} · y ${alignment.y} · size ${alignment.size}</text>
      <text x="${x + 16}" y="${y + 398}" class="bounds">source ${escapeXml(boundsLabel(costume.sourceBounds))}</text>
      <text x="${x + 16}" y="${y + 416}" class="bounds">worn ${escapeXml(boundsLabel(costume.wornBounds))}</text>
      <text x="${x + 16}" y="${y + 434}" class="${costume.warnings.length === 0 ? "clear" : "warning"}">${escapeXml(warningLabel)}</text>
    </g>`;
}

function renderSheet(rarity, costumes, outputPath) {
  const columns = 4;
  const rows = Math.ceil(costumes.length / columns);
  const width = columns * 424;
  const height = rows * 448;
  const cells = costumes.map((costume, index) => sheetCell(costume, index, columns, outputPath));
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>Gamjabot ${escapeXml(rarity)} costume QA</title>
  <defs>
    <pattern id="checker" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#f1f1f1" />
      <rect width="8" height="8" fill="#d8d8d8" />
      <rect x="8" y="8" width="8" height="8" fill="#d8d8d8" />
    </pattern>
    <style>
      text { font-family: "Segoe UI", sans-serif; fill: #f4f4f5; }
      .section-label { font-size: 10px; fill: #aeb2c0; letter-spacing: 1px; }
      .id { font: 700 15px Consolas, monospace; fill: #7fd7ff; }
      .name { font-size: 17px; font-weight: 700; }
      .meta { font: 12px Consolas, monospace; fill: #ffcf53; }
      .bounds { font: 11px Consolas, monospace; fill: #aeb2c0; }
      .clear { font: 11px Consolas, monospace; fill: #7ee2a8; }
      .warning { font: 11px Consolas, monospace; fill: #ff7f8c; }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#17181c" />
${cells.join("")}
</svg>
`;
}

async function loadManifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return counts;
}

function compareCounts(errors, label, actual, expected) {
  for (const [key, expectedCount] of Object.entries(expected)) {
    const actualCount = actual[key] ?? 0;
    if (actualCount !== expectedCount) {
      errors.push(`${label}: expected ${key}=${expectedCount}, got ${actualCount}`);
    }
  }
  for (const key of Object.keys(actual)) {
    if (!(key in expected)) errors.push(`${label}: unexpected ${key}=${actual[key]}`);
  }
}

function duplicateValues(rows, key) {
  const firstByValue = new Map();
  const duplicates = [];
  for (const row of rows) {
    const value = row[key];
    if (firstByValue.has(value)) duplicates.push([firstByValue.get(value), row.id, value]);
    else firstByValue.set(value, row.id);
  }
  return duplicates;
}

export async function validateManifestAssets(manifest, blueprint, root = repositoryRoot) {
  const errors = validateBlueprint(blueprint).map((error) => `blueprint: ${error}`);
  const rows = buildSheetRows(manifest.costumes, blueprint);
  const blueprintById = new Map(blueprint.map((item) => [item.id, item]));
  const defaults = manifest.costumes.filter(({ rarity }) => rarity === "default");
  if (manifest.count !== 188) errors.push(`manifest: expected count=188, got ${manifest.count}`);
  if (defaults.length !== 3) errors.push(`manifest: expected 3 default costumes, got ${defaults.length}`);
  if (rows.length !== 185) errors.push(`expected 185 draw candidates, got ${rows.length}`);
  compareCounts(errors, "rarity", countBy(rows, "rarity"), expectedRarityCounts);
  compareCounts(errors, "slot", countBy(rows, "slot"), expectedSlotCounts);
  for (const rarity of rarities) {
    compareCounts(
      errors,
      `${rarity} slot`,
      countBy(rows.filter((row) => row.rarity === rarity), "slot"),
      expectedRaritySlotCounts[rarity],
    );
  }
  for (const key of ["id", "name", "file"]) {
    for (const [first, second, value] of duplicateValues(rows, key)) {
      errors.push(`${second}: duplicate ${key} with ${first}: ${value}`);
    }
  }

  const hashOwners = new Map();
  const sprites = [];
  for (const costume of rows) {
    const item = blueprintById.get(costume.id);
    if (!rarities.includes(costume.rarity)) errors.push(`${costume.id}: invalid rarity`);
    if (!["head", "face", "neck", "body"].includes(costume.slot)) {
      errors.push(`${costume.id}: invalid slot`);
    }
    const alignment = costume.defaultAlignment;
    if (![alignment?.x, alignment?.y, alignment?.size].every(Number.isInteger)) {
      errors.push(`${costume.id}: invalid default alignment`);
    }
    if (
      item.name !== costume.name ||
      item.rarity !== costume.rarity ||
      item.theme !== costume.collection ||
      `${item.rarity}/${item.id}.png` !== costume.file ||
      item.slot !== costume.slot ||
      JSON.stringify(item.defaultAlignment) !== JSON.stringify(costume.defaultAlignment)
    ) {
      errors.push(`${costume.id}: blueprint and manifest differ`);
    }
    if (item.qaState !== "accepted") {
      errors.push(`${costume.id}: qaState must be accepted (got ${item.qaState})`);
    }
    const assetPath = resolve(root, "pack", costume.file);
    let bytes;
    let png;
    try {
      bytes = await readFile(assetPath);
      png = await readPngRgba(assetPath);
    } catch (error) {
      errors.push(`${costume.id}: unreadable PNG: ${error.message}`);
      continue;
    }
    if (png.width !== 256 || png.height !== 256) errors.push(`${costume.id}: expected 256x256`);
    if (!png.pixels.some((value, index) => index % 4 === 3 && value === 0)) {
      errors.push(`${costume.id}: missing transparency`);
    }
    const semantics = analyzePngSemantics(png, { minimumSpan: 64 });
    if (!semantics.bounds) {
      errors.push(`${costume.id}: empty image`);
    } else {
      for (const [side, margin] of Object.entries(semantics.edgeMargins)) {
        if (margin < 12) errors.push(`${costume.id}: ${side} margin ${margin} is below 12`);
      }
      const spanX = semantics.bounds.right - semantics.bounds.left + 1;
      const spanY = semantics.bounds.bottom - semantics.bounds.top + 1;
      if (Math.max(spanX, spanY) < 64) {
        errors.push(`${costume.id}: visible span ${spanX}x${spanY} is below 64`);
      }
      const placementBounds = visibleBounds(png.pixels, png.width, png.height);
      Object.assign(costume, analyzePlacement(costume, placementBounds));
    }
    for (const warning of semantics.warnings) {
      if (!["empty", "undersized"].includes(warning)) {
        errors.push(`${costume.id}: ${warning}`);
      }
    }
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hashOwners.has(hash)) {
      errors.push(`${costume.id}: duplicate file hash with ${hashOwners.get(hash)}`);
    } else {
      hashOwners.set(hash, costume.id);
    }
    sprites.push({ id: costume.id, png });
  }
  for (const pair of findNearDuplicateSprites(sprites)) {
    errors.push(
      `${pair.left}/${pair.right}: suspicious silhouette distance=${pair.distance.toFixed(6)}`,
    );
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  return rows;
}

async function writeSheets(rows) {
  await mkdir(generatedDirectory, { recursive: true });
  for (const rarity of rarities) {
    const outputPath = resolve(generatedDirectory, `${rarity}.svg`);
    const costumes = rows.filter((costume) => costume.rarity === rarity);
    await writeFile(outputPath, renderSheet(rarity, costumes, outputPath), "utf8");
  }
}

async function main() {
  const mode = process.argv[2];
  const manifest = await loadManifest();
  const blueprint = await loadBlueprint(repositoryRoot);
  const rows = await validateManifestAssets(manifest, blueprint);
  if (mode === "validate") {
    const counts = Object.fromEntries(rarities.map((rarity) => [
      rarity,
      rows.filter((costume) => costume.rarity === rarity).length,
    ]));
    console.log(`${rarities.map((rarity) => `${rarity}=${counts[rarity]}`).join(" ")} total=${rows.length}`);
    return;
  }
  if (mode === "sheets") {
    await writeSheets(rows);
    console.log(`generated=${rarities.length} items=${rows.length}`);
    return;
  }
  throw new Error("usage: node scripts/costume-catalog-qa.mjs <validate|sheets>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { loadBlueprint } from "./costume-blueprint.mjs";
import { readPngRgba, visibleBounds } from "./lib/png-rgba.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = resolve(repositoryRoot, "pack/manifest.json");
const generatedDirectory = resolve(repositoryRoot, "pack/qa/generated/final");
const rarities = ["common", "rare", "epic", "legendary", "special"];

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

async function validateManifestAssets(manifest, blueprint) {
  const rows = buildSheetRows(manifest.costumes, blueprint);
  const blueprintById = new Map(blueprint.map((item) => [item.id, item]));
  if (rows.length !== 185 || new Set(rows.map(({ id }) => id)).size !== 185) {
    throw new Error(`expected 185 unique draw candidates, got ${rows.length}`);
  }
  for (const costume of rows) {
    const item = blueprintById.get(costume.id);
    if (!rarities.includes(costume.rarity)) throw new Error(`${costume.id}: invalid rarity`);
    if (!["head", "face", "neck", "body"].includes(costume.slot)) {
      throw new Error(`${costume.id}: invalid slot`);
    }
    const alignment = costume.defaultAlignment;
    if (![alignment?.x, alignment?.y, alignment?.size].every(Number.isInteger)) {
      throw new Error(`${costume.id}: invalid default alignment`);
    }
    if (
      item.name !== costume.name ||
      item.rarity !== costume.rarity ||
      item.slot !== costume.slot ||
      JSON.stringify(item.defaultAlignment) !== JSON.stringify(costume.defaultAlignment)
    ) {
      throw new Error(`${costume.id}: blueprint and manifest differ`);
    }
    const png = await readPngRgba(resolve(repositoryRoot, "pack", costume.file));
    if (png.width !== 256 || png.height !== 256) throw new Error(`${costume.id}: expected 256x256`);
    if (!png.pixels.some((value, index) => index % 4 === 3 && value === 0)) {
      throw new Error(`${costume.id}: missing transparency`);
    }
    const bounds = visibleBounds(png.pixels, png.width, png.height);
    if (!bounds) throw new Error(`${costume.id}: empty image`);
    Object.assign(costume, analyzePlacement(costume, bounds));
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

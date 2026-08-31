import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readPngRgba, visibleBounds } from "./lib/png-rgba.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = resolve(repositoryRoot, "pack/manifest.json");
const generatedDirectory = resolve(repositoryRoot, "pack/qa/generated");
const rarities = ["common", "rare", "epic", "legendary", "special"];

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildSheetRows(costumes) {
  return costumes
    .filter(({ rarity }) => rarity !== "default")
    .map((costume) => ({
      id: costume.id,
      name: costume.name,
      rarity: costume.rarity,
      file: costume.file,
      slot: costume.slot,
      defaultAlignment: costume.defaultAlignment,
    }));
}

function assetHref(fromPath, assetPath) {
  return relative(dirname(fromPath), assetPath).replaceAll("\\", "/");
}

function sheetCell(costume, index, columns, outputPath) {
  const cellWidth = 240;
  const cellHeight = 340;
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
  const wornX = x + 128;
  const wornY = y + 48;
  const shortName = [...costume.name].slice(0, 20).join("");
  return `
    <g class="costume-cell" data-id="${escapeXml(costume.id)}">
      <rect x="${x + 4}" y="${y + 4}" width="232" height="332" rx="8" fill="#222329" stroke="#5b5d67" />
      <text x="${x + 16}" y="${y + 25}" class="section-label">ISOLATED</text>
      <rect x="${x + 12}" y="${y + 34}" width="112" height="144" fill="url(#checker)" stroke="#777" />
      <image href="${asset}" x="${x + 4}" y="${y + 26}" width="128" height="160" preserveAspectRatio="xMidYMid meet" />
      <text x="${x + 140}" y="${y + 25}" class="section-label">WORN</text>
      <rect x="${x + 132}" y="${y + 34}" width="96" height="144" fill="url(#checker)" stroke="#777" />
      <svg x="${wornX}" y="${wornY}" width="96" height="104" viewBox="0 0 96 104" overflow="hidden">
        <image href="${atlas}" x="0" y="0" width="768" height="1144" />
      </svg>
      <image href="${asset}" x="${wornX + alignment.x}" y="${wornY + alignment.y}" width="${alignment.size}" height="${alignment.size}" preserveAspectRatio="xMidYMid meet" />
      <text x="${x + 16}" y="${y + 208}" class="id">${escapeXml(costume.id)}</text>
      <text x="${x + 16}" y="${y + 235}" class="name"><title>${escapeXml(costume.name)}</title>${escapeXml(shortName)}</text>
      <text x="${x + 16}" y="${y + 260}" class="meta">${escapeXml(costume.rarity.toUpperCase())} · ${escapeXml(costume.slot)}</text>
      <text x="${x + 16}" y="${y + 284}" class="meta">x ${alignment.x} · y ${alignment.y} · size ${alignment.size}</text>
      <text x="${x + 16}" y="${y + 311}" class="file">${escapeXml(costume.file)}</text>
    </g>`;
}

function renderSheet(rarity, costumes, outputPath) {
  const columns = 6;
  const rows = Math.ceil(costumes.length / columns);
  const width = columns * 240;
  const height = rows * 340;
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
      .file { font: 10px Consolas, monospace; fill: #aeb2c0; }
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

async function validateManifestAssets(manifest) {
  const rows = buildSheetRows(manifest.costumes);
  if (rows.length !== 185 || new Set(rows.map(({ id }) => id)).size !== 185) {
    throw new Error(`expected 185 unique draw candidates, got ${rows.length}`);
  }
  for (const costume of rows) {
    if (!rarities.includes(costume.rarity)) throw new Error(`${costume.id}: invalid rarity`);
    if (!["head", "face", "neck", "body"].includes(costume.slot)) {
      throw new Error(`${costume.id}: invalid slot`);
    }
    const alignment = costume.defaultAlignment;
    if (![alignment?.x, alignment?.y, alignment?.size].every(Number.isInteger)) {
      throw new Error(`${costume.id}: invalid default alignment`);
    }
    const png = await readPngRgba(resolve(repositoryRoot, "pack", costume.file));
    if (png.width !== 256 || png.height !== 256) throw new Error(`${costume.id}: expected 256x256`);
    if (!png.pixels.some((value, index) => index % 4 === 3 && value === 0)) {
      throw new Error(`${costume.id}: missing transparency`);
    }
    const bounds = visibleBounds(png.pixels, png.width, png.height);
    if (!bounds) throw new Error(`${costume.id}: empty image`);
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
  const rows = await validateManifestAssets(manifest);
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

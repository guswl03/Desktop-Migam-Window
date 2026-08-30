import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { analyzePngSemantics, readPngRgba } from "./lib/png-rgba.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = resolve(repositoryRoot, "pack/manifest.json");
const auditPath = resolve(repositoryRoot, "pack/qa/catalog-semantic-audit.json");
const generatedRoot = resolve(repositoryRoot, "pack/qa/generated");
const rarities = ["common", "rare", "epic", "legendary", "special"];
const states = new Set(["keep", "realign", "split", "redraw"]);
const slots = new Set(["head", "face", "neck", "body"]);
const genericObservations = [
  "원본 디테일과 착용 위치가 적절함.",
  "원본 디테일과 착용 위치가 이름 및 슬롯에 부합함.",
];

function drawableCostumes(manifest) {
  return manifest.costumes.filter(({ rarity }) => rarity !== "default");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function outputAbsolutePath(outputPath) {
  return resolve(repositoryRoot, outputPath);
}

function assetHref(outputPath, assetPath) {
  return relative(dirname(outputAbsolutePath(outputPath)), assetPath).replaceAll("\\", "/");
}

export async function loadSemanticAudit(path = auditPath) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function validateSemanticAudit(rows, manifest) {
  const errors = [];
  const costumes = drawableCostumes(manifest);
  const expectedIds = costumes.map(({ id }) => id);
  const expectedSet = new Set(expectedIds);
  const seen = new Set();

  for (const row of rows) {
    if (!expectedSet.has(row.id)) errors.push(`${row.id}: unknown audit id`);
    if (seen.has(row.id)) errors.push(`${row.id}: duplicate audit row`);
    seen.add(row.id);
    if (!states.has(row.state)) errors.push(`${row.id}: invalid state`);
    if (!Array.isArray(row.observations) || row.observations.length === 0) {
      errors.push(`${row.id}: missing concrete observation`);
    } else if (
      row.observations.some((observation) =>
        genericObservations.includes(String(observation).trim())
      )
    ) {
      errors.push(`${row.id}: concrete observation required`);
    }
    if (!Array.isArray(row.warnings)) errors.push(`${row.id}: warnings must be an array`);
    if (!Array.isArray(row.components)) {
      errors.push(`${row.id}: components must be an array`);
      continue;
    }
    if (row.state === "split") {
      if (row.components.length < 2) errors.push(`${row.id}: split requires two components`);
      if (row.components.filter(({ primary }) => primary).length !== 1) {
        errors.push(`${row.id}: split requires exactly one primary component`);
      }
      for (const component of row.components) {
        if (!String(component.name ?? "").trim()) {
          errors.push(`${row.id}: component name is required`);
        }
        if (!slots.has(component.slot)) {
          errors.push(`${row.id}: invalid component slot ${component.slot}`);
        }
      }
    }
  }

  for (const id of expectedIds) {
    if (!seen.has(id)) errors.push(`${id}: missing audit row`);
  }
  return errors;
}

function sheetHeader(width, height, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${escapeXml(title)}</title>
  <defs>
    <pattern id="checker" width="16" height="16" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#f1f1f1" />
      <rect width="8" height="8" fill="#d8d8d8" />
      <rect x="8" y="8" width="8" height="8" fill="#d8d8d8" />
    </pattern>
    <style>
      text { font-family: "Segoe UI", sans-serif; fill: #f4f4f5; }
      .label { font: 700 12px Consolas, monospace; fill: #7fd7ff; }
      .name { font-size: 17px; font-weight: 700; }
      .meta { font: 12px Consolas, monospace; fill: #ffcf53; }
      .observation { font-size: 11px; fill: #d8d8dc; }
      .warning { font: 700 11px Consolas, monospace; fill: #ff8f70; }
    </style>
  </defs>
  <rect width="100%" height="100%" fill="#17181c" />`;
}

function rowText(row) {
  const observation = row.observations?.[0] || "UNREVIEWED";
  return {
    observation: [...observation].slice(0, 48).join(""),
    warnings: row.warnings?.length ? row.warnings.join(", ") : "none",
    bounds: row.bounds
      ? `${row.bounds.left},${row.bounds.top}..${row.bounds.right},${row.bounds.bottom}`
      : "empty",
  };
}

export function renderRawSheet(rarity, rows, outputPath) {
  const columns = 3;
  const cellWidth = 460;
  const cellHeight = 520;
  const rowCount = Math.ceil(rows.length / columns);
  const width = columns * cellWidth;
  const height = Math.max(cellHeight, rowCount * cellHeight);
  const cells = rows.map((row, index) => {
    const column = index % columns;
    const line = Math.floor(index / columns);
    const x = column * cellWidth;
    const y = line * cellHeight;
    const asset = assetHref(outputPath, resolve(repositoryRoot, "pack", row.file));
    const text = rowText(row);
    return `
  <g class="costume-cell" data-id="${escapeXml(row.id)}">
    <rect x="${x + 6}" y="${y + 6}" width="448" height="508" rx="8" fill="#222329" stroke="#5b5d67" />
    <text x="${x + 18}" y="${y + 28}" class="label">RAW · 4X · ${escapeXml(row.id)}</text>
    <rect x="${x + 38}" y="${y + 42}" width="384" height="384" fill="url(#checker)" stroke="#777" />
    <image href="${escapeXml(asset)}" x="${x + 38}" y="${y + 42}" width="384" height="384" preserveAspectRatio="xMidYMid meet" />
    <text x="${x + 18}" y="${y + 452}" class="name">${escapeXml(row.name)}</text>
    <text x="${x + 18}" y="${y + 474}" class="meta">${escapeXml(row.state)} · ${escapeXml(row.slot)} · bounds ${escapeXml(text.bounds)}</text>
    <text x="${x + 18}" y="${y + 494}" class="warning">${escapeXml(text.warnings)}</text>
    <title>${escapeXml(text.observation)}</title>
  </g>`;
  });
  return `${sheetHeader(width, height, `Gamjabot ${rarity} raw costume audit`)}
${cells.join("")}
</svg>
`;
}

export function renderWornSheet(rarity, rows, outputPath) {
  const columns = 5;
  const cellWidth = 280;
  const cellHeight = 360;
  const rowCount = Math.ceil(rows.length / columns);
  const width = columns * cellWidth;
  const height = Math.max(cellHeight, rowCount * cellHeight);
  const atlas = assetHref(
    outputPath,
    resolve(repositoryRoot, "images/characters/gamjabot/references/base-spritesheet-extended.png"),
  );
  const cells = rows.map((row, index) => {
    const column = index % columns;
    const line = Math.floor(index / columns);
    const x = column * cellWidth;
    const y = line * cellHeight;
    const asset = assetHref(outputPath, resolve(repositoryRoot, "pack", row.file));
    const alignment = row.defaultAlignment;
    const wornX = x + 92;
    const wornY = y + 58;
    const text = rowText(row);
    return `
  <g class="costume-cell" data-id="${escapeXml(row.id)}">
    <rect x="${x + 6}" y="${y + 6}" width="268" height="348" rx="8" fill="#222329" stroke="#5b5d67" />
    <text x="${x + 16}" y="${y + 28}" class="label">WORN · ${escapeXml(row.id)}</text>
    <rect x="${x + 52}" y="${y + 40}" width="176" height="208" fill="url(#checker)" stroke="#777" />
    <svg x="${wornX}" y="${wornY}" width="96" height="104" viewBox="0 0 96 104" overflow="hidden">
      <image href="${escapeXml(atlas)}" x="0" y="0" width="768" height="1144" />
    </svg>
    <image href="${escapeXml(asset)}" x="${wornX + alignment.x}" y="${wornY + alignment.y}" width="${alignment.size}" height="${alignment.size}" preserveAspectRatio="xMidYMid meet" />
    <text x="${x + 16}" y="${y + 276}" class="name">${escapeXml(row.name)}</text>
    <text x="${x + 16}" y="${y + 300}" class="meta">${escapeXml(row.slot)} · x ${alignment.x} · y ${alignment.y} · size ${alignment.size}</text>
    <text x="${x + 16}" y="${y + 322}" class="warning">${escapeXml(text.warnings)}</text>
    <text x="${x + 16}" y="${y + 340}" class="observation">${escapeXml(text.observation)}</text>
  </g>`;
  });
  return `${sheetHeader(width, height, `Gamjabot ${rarity} worn costume audit`)}
${cells.join("")}
</svg>
`;
}

async function loadManifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

async function rowsWithMetrics(manifest, audit) {
  const auditById = new Map(audit.map((row) => [row.id, row]));
  return Promise.all(drawableCostumes(manifest).map(async (costume) => {
    const png = await readPngRgba(resolve(repositoryRoot, "pack", costume.file));
    const metrics = analyzePngSemantics(png);
    const auditRow = auditById.get(costume.id) ?? {
      id: costume.id,
      state: "keep",
      observations: [],
      warnings: metrics.warnings,
      components: [],
    };
    return {
      ...costume,
      ...auditRow,
      bounds: metrics.bounds,
      warnings: [...new Set([...(auditRow.warnings ?? []), ...metrics.warnings])],
      metrics,
    };
  }));
}

async function seedAudit(manifest) {
  const rows = await rowsWithMetrics(manifest, []);
  const seed = rows.map(({ id, warnings }) => ({
    id,
    state: "keep",
    observations: [],
    warnings,
    components: [],
  }));
  await mkdir(dirname(auditPath), { recursive: true });
  await writeFile(auditPath, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
  return seed;
}

async function writeSheets(rows) {
  for (const kind of ["raw", "worn"]) {
    const directory = resolve(generatedRoot, kind);
    await mkdir(directory, { recursive: true });
    for (const rarity of rarities) {
      const outputPath = resolve(directory, `${rarity}.svg`);
      const rarityRows = rows.filter((row) => row.rarity === rarity);
      const svg = kind === "raw"
        ? renderRawSheet(rarity, rarityRows, outputPath)
        : renderWornSheet(rarity, rarityRows, outputPath);
      await writeFile(outputPath, svg, "utf8");
    }
  }
}

async function main() {
  const mode = process.argv[2];
  const manifest = await loadManifest();
  if (mode === "seed") {
    const rows = await seedAudit(manifest);
    console.log(`seeded=${rows.length} reviewed=0`);
    return;
  }

  const audit = await loadSemanticAudit();
  if (mode === "validate") {
    const errors = validateSemanticAudit(audit, manifest);
    if (errors.length) throw new Error(errors.join("\n"));
    const counts = Object.groupBy(audit, ({ state }) => state);
    console.log(
      `reviewed=${audit.length} missing=0 duplicate=0 generic=0 ` +
      [...states].map((state) => `${state}=${counts[state]?.length ?? 0}`).join(" "),
    );
    return;
  }
  if (mode === "sheets") {
    const rows = await rowsWithMetrics(manifest, audit);
    await writeSheets(rows);
    console.log(`generated=10 items=${rows.length}`);
    return;
  }
  throw new Error(
    "usage: node scripts/costume-semantic-audit.mjs <seed|validate|sheets>",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}

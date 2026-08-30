import { readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readPngRgba, visibleBounds } from "./lib/png-rgba.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const packRoot = resolve(repositoryRoot, "pack");
const candidateRoot = resolve(packRoot, "qa/candidates");
const manifest = JSON.parse(await readFile(resolve(packRoot, "manifest.json"), "utf8"));
const audit = JSON.parse(await readFile(resolve(packRoot, "qa/catalog-audit.json"), "utf8"));
const costumesById = new Map(manifest.costumes.map((costume) => [costume.id, costume]));
const faceOpeningIds = new Set(["rare_019", "rare_035", "rare_040", "legendary_002"]);
const replacements = [];

for (const { id } of audit.filter(({ state }) => state === "redraw")) {
  const costume = costumesById.get(id);
  if (!costume) throw new Error(`${id}: missing manifest entry`);
  const candidatePath = resolve(candidateRoot, `${id}.png`);
  const candidate = await readPngRgba(candidatePath);
  if (candidate.width !== 256 || candidate.height !== 256) {
    throw new Error(`${id}: expected 256x256 candidate`);
  }
  if (!candidate.pixels.some((value, index) => index % 4 === 3 && value === 0)) {
    throw new Error(`${id}: candidate has no transparent pixels`);
  }
  if (!visibleBounds(candidate.pixels, candidate.width, candidate.height)) {
    throw new Error(`${id}: candidate is empty`);
  }
  if (faceOpeningIds.has(id)) {
    const centerAlpha = candidate.pixels[((128 * candidate.width + 128) * 4) + 3];
    if (centerAlpha !== 0) throw new Error(`${id}: face opening is not transparent`);
  }

  const targetPath = resolve(packRoot, costume.file);
  if (!targetPath.startsWith(`${packRoot}${sep}`)) {
    throw new Error(`${id}: target escapes pack directory`);
  }
  replacements.push({ id, targetPath, png: await readFile(candidatePath) });
}

if (process.argv.includes("--apply")) {
  for (const { targetPath, png } of replacements) await writeFile(targetPath, png);
  console.log(`promoted=${replacements.length}`);
} else {
  console.log(`validated=${replacements.length}`);
}

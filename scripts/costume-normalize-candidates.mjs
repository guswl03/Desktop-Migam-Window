import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readPngRgba, visibleBounds } from "./lib/png-rgba.mjs";
import { encodePngRgba, normalizeRgbaSprite } from "./lib/png-normalize.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const candidateDirectory = resolve(repositoryRoot, "pack/qa/candidates");
const rawDirectory = resolve(candidateDirectory, "raw");
const ids = process.argv.slice(2).map((value) => basename(value, ".png"));

if (ids.length === 0) {
  throw new Error("usage: node scripts/costume-normalize-candidates.mjs <costume-id> [...]");
}

await mkdir(candidateDirectory, { recursive: true });
for (const id of ids) {
  const raw = await readPngRgba(resolve(rawDirectory, `${id}.png`));
  const normalized = normalizeRgbaSprite(raw);
  const bounds = visibleBounds(normalized.pixels, normalized.width, normalized.height);
  if (!bounds) throw new Error(`${id}: normalized sprite is empty`);
  await writeFile(
    resolve(candidateDirectory, `${id}.png`),
    encodePngRgba(normalized),
  );
  console.log(`${id}=256x256 bounds=${bounds.left},${bounds.top}-${bounds.right},${bounds.bottom}`);
}

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = resolve(repositoryRoot, "pack/manifest.json");
const auditPath = resolve(repositoryRoot, "pack/qa/catalog-audit.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const corrections = new Map(
  audit
    .filter(({ state }) => state !== "keep")
    .map(({ id, placement }) => [id, placement]),
);

let updated = 0;
for (const costume of manifest.costumes) {
  const placement = corrections.get(costume.id);
  if (!placement) continue;

  if (
    costume.slot !== placement.slot
    || JSON.stringify(costume.defaultAlignment) !== JSON.stringify(placement.defaultAlignment)
  ) {
    costume.slot = placement.slot;
    costume.defaultAlignment = placement.defaultAlignment;
    updated += 1;
  }
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`reviewed=${corrections.size} updated=${updated}`);

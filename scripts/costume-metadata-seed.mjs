import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const manifestUrl = new URL("../pack/manifest.json", import.meta.url);

const defaults = {
  head: { x: -4, y: -30, size: 104 },
  face: { x: -4, y: -8, size: 104 },
  neck: { x: -4, y: 12, size: 104 },
  body: { x: -4, y: 17, size: 104 },
  full: { x: -8, y: -8, size: 112 },
};

export function inferLegacySlot(name) {
  if (/(안경|선글라스|안대|모노클|바이저|가면)/.test(name)) return "face";
  if (/(넥타이|나비넥타이|목도리|스카프|넥워머|목걸이|칼라)/.test(name)) return "neck";
  if (/(앞치마|멜빵|조끼|카디건|벨트|백팩|가방|망토|케이프)/.test(name)) return "body";
  if (/(세트|갑주)/.test(name)) return "full";
  return "head";
}

export function seedCostumeMetadata(costume) {
  if (costume.rarity === "default") return { costume, seeded: false };

  const slot = costume.slot ?? inferLegacySlot(costume.name);
  const defaultAlignment = costume.defaultAlignment ?? defaults[slot];
  const seeded = costume.slot === undefined || costume.defaultAlignment === undefined;
  return {
    costume: { ...costume, slot, defaultAlignment },
    seeded,
  };
}

async function main() {
  if (!process.argv.includes("--write")) {
    throw new Error("Refusing to modify pack/manifest.json without --write");
  }

  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  let seeded = 0;
  let defaultsCount = 0;
  manifest.costumes = manifest.costumes.map((costume) => {
    if (costume.rarity === "default") defaultsCount += 1;
    const result = seedCostumeMetadata(costume);
    if (result.seeded) seeded += 1;
    return result.costume;
  });

  await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`seeded=${seeded} defaults=${defaultsCount}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(new URL(`file:///${process.argv[1].replaceAll("\\", "/")}`))) {
  await main();
}

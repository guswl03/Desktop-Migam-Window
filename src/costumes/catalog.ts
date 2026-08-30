import manifest from "../../pack/manifest.json";
import { isGamchaRarity, type GamchaRarity } from "../gamcha/gamcha-model";
import type { CostumeAlignment } from "./alignment";

export interface ManifestCostume {
  id: string;
  name: string;
  rarity: string;
  file: string;
  slot?: CostumeSlot;
  defaultAlignment?: CostumeAlignment;
}

export interface Costume {
  id: string;
  name: string;
  rarity: GamchaRarity;
  file: string;
  url: string;
  slot: CostumeSlot;
  defaultAlignment: CostumeAlignment;
}

export type CostumeSlot = "head" | "face" | "neck" | "body" | "full";

const costumeSlots: CostumeSlot[] = ["head", "face", "neck", "body", "full"];

export function readCostumePlacement(costume: ManifestCostume): {
  slot: CostumeSlot;
  defaultAlignment: CostumeAlignment;
} {
  const alignment = costume.defaultAlignment;
  if (
    !costumeSlots.includes(costume.slot as CostumeSlot) ||
    !Number.isInteger(alignment?.x) ||
    !Number.isInteger(alignment?.y) ||
    !Number.isInteger(alignment?.size)
  ) {
    throw new Error(`missing or invalid costume placement: ${costume.id}`);
  }
  return {
    slot: costume.slot as CostumeSlot,
    defaultAlignment: { ...alignment! },
  };
}

const assetUrls = import.meta.glob<string>([
  "../../pack/common/*.png",
  "../../pack/rare/*.png",
  "../../pack/epic/*.png",
  "../../pack/legendary/*.png",
  "../../pack/special/*.png",
], {
  eager: true,
  query: "?url",
  import: "default",
});

export const costumes = (manifest.costumes as ManifestCostume[])
  .filter((costume) => isGamchaRarity(costume.rarity))
  .map((costume): Costume => {
    const placement = readCostumePlacement(costume);
    return {
      ...costume,
      ...placement,
      rarity: costume.rarity as GamchaRarity,
      url: assetUrls[`../../pack/${costume.file}`],
    };
  })
  .filter((costume) => Boolean(costume.url));

export const costumeById = new Map(costumes.map((costume) => [costume.id, costume]));

export function costumeUrl(costumeId: string | null | undefined): string | null {
  return costumeId ? (costumeById.get(costumeId)?.url ?? null) : null;
}

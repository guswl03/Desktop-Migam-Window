import { describe, expect, it } from "vitest";
import manifest from "../../pack/manifest.json";
import { costumeById, readCostumePlacement } from "./catalog";

type CostumePlacement = {
  slot?: string;
  defaultAlignment?: {
    x: number;
    y: number;
    size: number;
  };
};

const drawCandidates = manifest.costumes
  .filter(({ rarity }) => rarity !== "default") as Array<
    (typeof manifest.costumes)[number] & CostumePlacement
  >;

describe("costume manifest metadata", () => {
  it("covers all 185 draw candidates with explicit placement", () => {
    expect(drawCandidates).toHaveLength(185);
    expect(new Set(drawCandidates.map(({ id }) => id)).size).toBe(185);

    for (const costume of drawCandidates) {
      expect(["head", "face", "neck", "body"]).toContain(costume.slot);
      expect(costume.defaultAlignment).toEqual({
        x: expect.any(Number),
        y: expect.any(Number),
        size: expect.any(Number),
      });
    }
  });

  it("contains no legacy full-slot runtime row", () => {
    expect(drawCandidates.some(({ slot }) => slot === "full")).toBe(false);
  });

  it("exposes explicit manifest placement through the runtime catalog", () => {
    expect(costumeById.get("common_017")).toEqual(
      expect.objectContaining({
        name: "살림꾼 다용도앞치마",
        slot: "body",
        defaultAlignment: { x: 0, y: 22, size: 108 },
      }),
    );
  });

  it("trusts explicit placement instead of inferring it from the display name", () => {
    expect(readCostumePlacement({
      id: "test_explicit",
      name: "이름에는 세트가 있지만 얼굴에 쓰는 아이템",
      rarity: "common",
      file: "common/test.png",
      slot: "face",
      defaultAlignment: { x: 3, y: -7, size: 99 },
    })).toEqual({
      slot: "face",
      defaultAlignment: { x: 3, y: -7, size: 99 },
    });
  });

  it("rejects missing built-in placement with the item ID", () => {
    expect(() => readCostumePlacement({
      id: "test_missing",
      name: "위치 없음",
      rarity: "common",
      file: "common/test.png",
    })).toThrow("test_missing");
  });
});

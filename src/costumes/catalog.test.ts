import { describe, expect, it } from "vitest";
import manifest from "../../pack/manifest.json";

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
  it("covers all 156 draw candidates with explicit placement", () => {
    expect(drawCandidates).toHaveLength(156);
    expect(new Set(drawCandidates.map(({ id }) => id)).size).toBe(156);

    for (const costume of drawCandidates) {
      expect(["head", "face", "neck", "body", "full"]).toContain(costume.slot);
      expect(costume.defaultAlignment).toEqual({
        x: expect.any(Number),
        y: expect.any(Number),
        size: expect.any(Number),
      });
    }
  });
});

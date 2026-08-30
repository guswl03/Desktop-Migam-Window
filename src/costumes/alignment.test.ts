import { describe, expect, it } from "vitest";
import { defaultCostumeAlignment, resolveCostumeAlignment } from "./alignment";

describe("costume alignment", () => {
  it("uses a different safe default for each attachment area", () => {
    expect(defaultCostumeAlignment("head")).toEqual({ x: -4, y: -30, size: 104 });
    expect(defaultCostumeAlignment("body")).toEqual({ x: -4, y: 17, size: 104 });
  });

  it("prefers the saved per-costume adjustment", () => {
    expect(resolveCostumeAlignment(
      "head",
      { x: 2, y: -24, size: 116 },
      { x: 7, y: -18, size: 91 },
    )).toEqual({
      x: 7,
      y: -18,
      size: 91,
    });
  });

  it("uses the item default before the slot fallback", () => {
    expect(resolveCostumeAlignment(
      "head",
      { x: 2, y: -24, size: 116 },
      undefined,
    )).toEqual({ x: 2, y: -24, size: 116 });
    expect(resolveCostumeAlignment("head", undefined, undefined)).toEqual({
      x: -4,
      y: -30,
      size: 104,
    });
  });
});

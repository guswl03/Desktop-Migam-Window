import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GAMCHA catalog loading summary", () => {
  it("uses the live costume count instead of a stale fixed total", () => {
    const source = readFileSync(new URL("./gamcha-view.ts", import.meta.url), "utf8");

    expect(source).toContain(
      'id="gamcha-inventory-summary">획득 0 / ${costumes.length}',
    );
    expect(source).not.toMatch(/id="gamcha-inventory-summary">획득 0 \/ \d+/);
  });
});

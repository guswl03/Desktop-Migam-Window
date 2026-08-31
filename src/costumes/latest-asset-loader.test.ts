import { describe, expect, it } from "vitest";
import { createLatestAssetLoader } from "./latest-asset-loader";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}

describe("latest costume asset loader", () => {
  it("applies only the latest decoded selection", async () => {
    const first = deferred();
    const second = deferred();
    const applied: string[] = [];
    const loader = createLatestAssetLoader<string>();

    const firstLoad = loader.load("rare_003", () => first.promise, (id) => applied.push(id));
    const secondLoad = loader.load("legendary_003", () => second.promise, (id) => applied.push(id));

    second.resolve();
    await secondLoad;
    first.resolve();
    await firstLoad;

    expect(applied).toEqual(["legendary_003"]);
  });

  it("does not restore an in-flight image after selecting the default pet", async () => {
    const decode = deferred();
    const applied: string[] = [];
    const loader = createLatestAssetLoader<string>();
    const loading = loader.load("rare_003", () => decode.promise, (id) => applied.push(id));

    loader.invalidate();
    decode.resolve();
    await loading;

    expect(applied).toEqual([]);
  });
});

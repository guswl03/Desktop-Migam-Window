import { describe, expect, it } from "vitest";
import type { Settings } from "./contracts";
import { readPetSettings, renderPetSettingsControls } from "./settings-pet-controls";

const petSettings: Settings["pet"] = {
  visualScalePercent: 75,
  resourceResponseMode: "off",
  automaticPhotoDeliveryEnabled: true,
  windowClimbingEnabled: true,
};

describe("pet settings controls", () => {
  it("does not render the unsupported pet size control", () => {
    const markup = renderPetSettingsControls(petSettings, "");

    expect(markup).not.toContain('name="visualScalePercent"');
    expect(markup).not.toContain("펫 크기");
    expect(markup).toContain('name="resourceResponseMode"');
  });

  it("preserves the stored scale while saving the remaining controls", () => {
    const values = new FormData();
    values.set("resourceResponseMode", "combined");
    values.set("windowClimbingEnabled", "on");

    expect(readPetSettings(values, petSettings)).toEqual({
      visualScalePercent: 75,
      resourceResponseMode: "combined",
      automaticPhotoDeliveryEnabled: false,
      windowClimbingEnabled: true,
    });
  });
});

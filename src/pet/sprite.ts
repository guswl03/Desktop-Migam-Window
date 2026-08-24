import gamjabotAtlas from "../../images/characters/gamjabot/references/base-spritesheet-extended.png";
import dragged00 from "../../images/characters/gamjabot/extra/frames/dragged/00.png";
import dragged01 from "../../images/characters/gamjabot/extra/frames/dragged/01.png";
import dragged02 from "../../images/characters/gamjabot/extra/frames/dragged/02.png";
import dragged03 from "../../images/characters/gamjabot/extra/frames/dragged/03.png";
import hardImpact00 from "../../images/characters/gamjabot/extra/frames/hard-impact/00.png";
import focused00 from "../../images/characters/gamjabot/extra/frames/focused/00.png";
import alert00 from "../../running/alert/0.png";
import alert01 from "../../running/alert/1.png";
import alert02 from "../../running/alert/2.png";
import alert03 from "../../running/alert/3.png";
import medium00 from "../../running/medium/0.png";
import medium01 from "../../running/medium/1.png";
import medium02 from "../../running/medium/2.png";
import medium03 from "../../running/medium/3.png";
import fast00 from "../../running/fast/0.png";
import fast01 from "../../running/fast/1.png";
import fast02 from "../../running/fast/2.png";
import fast03 from "../../running/fast/3.png";
import extreme00 from "../../running/extreme/0.png";
import extreme01 from "../../running/extreme/1.png";
import extreme02 from "../../running/extreme/2.png";
import extreme03 from "../../running/extreme/3.png";
import landing00 from "../../images/characters/gamjabot/extra/frames/landing/00.png";
import landing01 from "../../images/characters/gamjabot/extra/frames/landing/01.png";
import landing02 from "../../images/characters/gamjabot/extra/frames/landing/02.png";
import landing03 from "../../images/characters/gamjabot/extra/frames/landing/03.png";
import thrown00 from "../../images/characters/gamjabot/extra/frames/thrown/00.png";
import thrown01 from "../../images/characters/gamjabot/extra/frames/thrown/01.png";
import thrown02 from "../../images/characters/gamjabot/extra/frames/thrown/02.png";
import thrown03 from "../../images/characters/gamjabot/extra/frames/thrown/03.png";
import thrown04 from "../../images/characters/gamjabot/extra/frames/thrown/04.png";
import thrown05 from "../../images/characters/gamjabot/extra/frames/thrown/05.png";
import pullUpStrip from "../../images/characters/gamjabot/extra/climbing/pull-up-strip-v2.png";
import fallStrip from "../../images/characters/gamjabot/extra/climbing/fall-strip-v1.png";
import ropeThrowStrip from "../../images/characters/gamjabot/extra/climbing/rope-throw-strip-v2.png";
import ropeClimbStrip from "../../images/characters/gamjabot/extra/climbing/rope-climb-strip-v2.png";
import type { CostumeSlot } from "../costumes/catalog";
import type { CostumeAlignment } from "../costumes/alignment";

export type PetAnimation =
  | "idle"
  | "running-left"
  | "running-right"
  | "load-alert-left"
  | "load-alert-right"
  | "load-medium-left"
  | "load-medium-right"
  | "load-fast-left"
  | "load-fast-right"
  | "load-extreme-left"
  | "load-extreme-right"
  | "jumping"
  | "dragged"
  | "thrown"
  | "landing"
  | "window-tumble"
  | "hard-impact"
  | "focused"
  | "climbing-left"
  | "climbing-right"
  | "rope-throw-left"
  | "rope-throw-right"
  | "pull-up-left"
  | "pull-up-right"
  | "falling"
  | "waiting"
  | "busy"
  | "failed";

const DISPLAY_CELL_WIDTH = 96;
const DISPLAY_CELL_HEIGHT = 104;
const DISPLAY_ATLAS_WIDTH = 768;
const DISPLAY_ATLAS_HEIGHT = 1144;

type AnimationDefinition =
  | { source: "atlas"; row: number; frames: number }
  | { source: "images"; images: string[]; frames: number; mirror?: boolean; contain?: boolean }
  | {
      source: "strip";
      image: string;
      frames: number;
      displayWidth: number;
      displayHeight: number;
      frameWidth: number;
      offsetY: number;
      mirror?: boolean;
    };

const loadFrames = {
  alert: [alert00, alert01, alert02, alert03],
  medium: [medium00, medium01, medium02, medium03],
  fast: [fast00, fast01, fast02, fast03],
  extreme: [extreme00, extreme01, extreme02, extreme03],
};

const animations: Record<PetAnimation, AnimationDefinition> = {
  idle: { source: "atlas", row: 0, frames: 6 },
  "running-right": { source: "atlas", row: 1, frames: 8 },
  "running-left": { source: "atlas", row: 2, frames: 8 },
  "load-alert-right": { source: "images", images: loadFrames.alert, frames: 4, contain: true },
  "load-alert-left": { source: "images", images: loadFrames.alert, frames: 4, mirror: true, contain: true },
  "load-medium-right": { source: "images", images: loadFrames.medium, frames: 4, contain: true },
  "load-medium-left": { source: "images", images: loadFrames.medium, frames: 4, mirror: true, contain: true },
  "load-fast-right": { source: "images", images: loadFrames.fast, frames: 4, contain: true },
  "load-fast-left": { source: "images", images: loadFrames.fast, frames: 4, mirror: true, contain: true },
  "load-extreme-right": { source: "images", images: loadFrames.extreme, frames: 4, contain: true },
  "load-extreme-left": { source: "images", images: loadFrames.extreme, frames: 4, mirror: true, contain: true },
  jumping: { source: "atlas", row: 4, frames: 5 },
  dragged: { source: "images", images: [dragged00, dragged01, dragged02, dragged03], frames: 4 },
  thrown: { source: "images", images: [thrown00, thrown01, thrown02, thrown03, thrown04, thrown05], frames: 6 },
  landing: { source: "images", images: [landing00, landing01, landing02, landing03], frames: 4 },
  "window-tumble": { source: "images", images: [landing00, landing01, landing02, landing03], frames: 4 },
  "hard-impact": { source: "images", images: [hardImpact00], frames: 1 },
  focused: { source: "images", images: [focused00], frames: 1 },
  "rope-throw-right": {
    source: "strip",
    image: ropeThrowStrip,
    frames: 4,
    displayWidth: 372,
    displayHeight: 124,
    frameWidth: 93,
    offsetY: -10,
  },
  "rope-throw-left": {
    source: "strip",
    image: ropeThrowStrip,
    frames: 4,
    displayWidth: 372,
    displayHeight: 124,
    frameWidth: 93,
    offsetY: -10,
    mirror: true,
  },
  "climbing-right": {
    source: "strip",
    image: ropeClimbStrip,
    frames: 4,
    displayWidth: 360,
    displayHeight: 180,
    frameWidth: 90,
    offsetY: -40,
  },
  "climbing-left": {
    source: "strip",
    image: ropeClimbStrip,
    frames: 4,
    displayWidth: 360,
    displayHeight: 180,
    frameWidth: 90,
    offsetY: -40,
    mirror: true,
  },
  "pull-up-right": {
    source: "strip",
    image: pullUpStrip,
    frames: 4,
    displayWidth: 380,
    displayHeight: 190,
    frameWidth: 95,
    offsetY: -14,
  },
  "pull-up-left": {
    source: "strip",
    image: pullUpStrip,
    frames: 4,
    displayWidth: 380,
    displayHeight: 190,
    frameWidth: 95,
    offsetY: -14,
    mirror: true,
  },
  falling: {
    source: "strip",
    image: fallStrip,
    frames: 4,
    displayWidth: 384,
    displayHeight: 128,
    frameWidth: 96,
    offsetY: -10,
  },
  waiting: { source: "atlas", row: 6, frames: 6 },
  busy: { source: "atlas", row: 7, frames: 6 },
  failed: { source: "atlas", row: 5, frames: 8 },
};

export interface PetSprite {
  element: HTMLDivElement;
  setAnimation(animation: PetAnimation): void;
  setCostume(costume: { url: string; slot: CostumeSlot; alignment: CostumeAlignment } | null): void;
  advanceFrame(): void;
}

export function createPetSprite(): PetSprite {
  const element = document.createElement("div");
  element.className = "pet-sprite";
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", "감자봇 데스크톱 펫");
  element.style.backgroundImage = `url("${gamjabotAtlas}")`;
  element.style.backgroundSize = `${DISPLAY_ATLAS_WIDTH}px ${DISPLAY_ATLAS_HEIGHT}px`;
  const costume = document.createElement("img");
  costume.className = "pet-costume";
  costume.alt = "";
  costume.hidden = true;
  costume.draggable = false;
  element.append(costume);

  let animation: PetAnimation = "idle";
  let frame = 0;

  const render = (): void => {
    const definition = animations[animation];
    element.dataset.animation = animation;
    element.style.transform = definition.source !== "atlas" && definition.mirror ? "scaleX(-1)" : "";
    if (definition.source === "atlas") {
      element.style.backgroundImage = `url("${gamjabotAtlas}")`;
      element.style.backgroundSize = `${DISPLAY_ATLAS_WIDTH}px ${DISPLAY_ATLAS_HEIGHT}px`;
      element.style.backgroundPosition = `${-frame * DISPLAY_CELL_WIDTH}px ${-definition.row * DISPLAY_CELL_HEIGHT}px`;
      return;
    }

    if (definition.source === "strip") {
      element.style.backgroundImage = `url("${definition.image}")`;
      element.style.backgroundSize = `${definition.displayWidth}px ${definition.displayHeight}px`;
      const centeredX = (DISPLAY_CELL_WIDTH - definition.frameWidth) / 2;
      element.style.backgroundPosition = `${centeredX - frame * definition.frameWidth}px ${definition.offsetY}px`;
      return;
    }

    element.style.backgroundImage = `url("${definition.images[frame]}")`;
    element.style.backgroundSize = animation === "focused" || definition.contain ? "contain" : `${DISPLAY_CELL_WIDTH}px ${DISPLAY_CELL_HEIGHT}px`;
    element.style.backgroundPosition = animation === "focused" || definition.contain ? "center bottom" : "0 0";
  };

  render();

  return {
    element,
    setAnimation(nextAnimation) {
      if (nextAnimation !== animation) {
        animation = nextAnimation;
        frame = 0;
        render();
      }
    },
    setCostume(nextCostume) {
      costume.hidden = !nextCostume;
      if (nextCostume) {
        costume.src = nextCostume.url;
        costume.dataset.slot = nextCostume.slot;
        costume.style.setProperty("--costume-x", `${nextCostume.alignment.x}px`);
        costume.style.setProperty("--costume-y", `${nextCostume.alignment.y}px`);
        costume.style.setProperty("--costume-size", `${nextCostume.alignment.size}px`);
      } else {
        costume.removeAttribute("src");
        delete costume.dataset.slot;
        costume.style.removeProperty("--costume-x");
        costume.style.removeProperty("--costume-y");
        costume.style.removeProperty("--costume-size");
      }
    },
    advanceFrame() {
      frame = (frame + 1) % animations[animation].frames;
      render();
    },
  };
}

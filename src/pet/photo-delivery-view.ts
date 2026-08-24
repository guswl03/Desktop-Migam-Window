import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  calculatePhotoDeliveryLayout,
  photoDeliveryDelayMilliseconds,
  photoDeliveryRarity,
} from "./photo-delivery-motion";
import pullStripUrl from "../../images/characters/gamjabot/extra/photo-delivery/gamjabot-pull-strip.png";
import rainPetUrl from "../../images/characters/gamjabot/pack/idle/0.png";
import hyperVPhotoUrl from "../../images/characters/gamjabot/extra/photo-delivery/photos/hyper-v.png";
import notepadPhotoUrl from "../../images/characters/gamjabot/extra/photo-delivery/photos/notepad.png";
import rarePhotoUrl from "../../images/characters/gamjabot/extra/photo-delivery/photos/real-heogeodeongseu.png";
import visualStudioPhotoUrl from "../../images/characters/gamjabot/extra/photo-delivery/photos/visual-studio.png";
import windbgPhotoUrl from "../../images/characters/gamjabot/extra/photo-delivery/photos/windbg.png";

const PULL_DURATION_MILLISECONDS = 18_000;
const PET_LEAVE_DURATION_MILLISECONDS = 1_500;
const RARE_PHOTO_REQUIRED_CLICKS = 5;
const GAMJABOT_RAIN_DURATION_MILLISECONDS = 4_200;
const GAMJABOT_RAIN_DROP_COUNT = 34;

const photoUrls = [
  visualStudioPhotoUrl,
  windbgPhotoUrl,
  hyperVPhotoUrl,
  notepadPhotoUrl,
];

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("pull sprite could not be loaded")), {
      once: true,
    });
    image.src = url;
  });
}

function isLightBackground(data: Uint8ClampedArray, pixel: number): boolean {
  const offset = pixel * 4;
  const red = data[offset];
  const green = data[offset + 1];
  const blue = data[offset + 2];
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  return minimum >= 218 && maximum - minimum <= 34;
}

async function transparentPullStrip(): Promise<string> {
  const source = await loadImage(pullStripUrl);
  const canvas = document.createElement("canvas");
  canvas.width = source.naturalWidth;
  canvas.height = source.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("canvas is unavailable");
  context.drawImage(source, 0, 0);

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixelCount = canvas.width * canvas.height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const add = (pixel: number): void => {
    if (visited[pixel] !== 0 || !isLightBackground(image.data, pixel)) return;
    visited[pixel] = 1;
    queue[tail++] = pixel;
  };

  for (let x = 0; x < canvas.width; x += 1) {
    add(x);
    add((canvas.height - 1) * canvas.width + x);
  }
  for (let y = 0; y < canvas.height; y += 1) {
    add(y * canvas.width);
    add(y * canvas.width + canvas.width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % canvas.width;
    const y = Math.floor(pixel / canvas.width);
    image.data[pixel * 4 + 3] = 0;
    if (x > 0) add(pixel - 1);
    if (x + 1 < canvas.width) add(pixel + 1);
    if (y > 0) add(pixel - canvas.width);
    if (y + 1 < canvas.height) add(pixel + canvas.width);
  }
  context.putImageData(image, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("sprite conversion failed")), "image/png"),
  );
  return URL.createObjectURL(blob);
}

export function startPhotoDeliveryScheduler(): () => void {
  let active = true;
  let timeout = 0;
  const schedule = (): void => {
    const delay = photoDeliveryDelayMilliseconds(Math.random());
    timeout = window.setTimeout(() => {
      if (!active) return;
      void invoke<boolean>("start_photo_delivery", { automatic: true }).finally(schedule);
    }, delay);
  };
  schedule();
  return () => {
    active = false;
    window.clearTimeout(timeout);
  };
}

export async function mountPhotoDelivery(container: HTMLElement): Promise<() => void> {
  container.innerHTML = `
    <main class="photo-delivery-stage" aria-live="polite">
      <section class="photo-delivery-rig" aria-label="감자펫의 사진 배달">
        <div class="photo-delivery-pet" aria-hidden="true"></div>
        <figure class="photo-delivery-card">
          <img alt="감자펫이 가져온 사진" />
          <button type="button" aria-label="사진 닫기">×</button>
        </figure>
      </section>
      <div class="gamjabot-rain" aria-hidden="true"></div>
    </main>`;
  const rig = container.querySelector<HTMLElement>(".photo-delivery-rig")!;
  const pet = container.querySelector<HTMLElement>(".photo-delivery-pet")!;
  const photo = container.querySelector<HTMLImageElement>(".photo-delivery-card img")!;
  const close = container.querySelector<HTMLButtonElement>(".photo-delivery-card button")!;
  const rain = container.querySelector<HTMLElement>(".gamjabot-rain")!;
  const spriteUrlPromise = transparentPullStrip().catch(() => pullStripUrl);
  let phase: "idle" | "delivering" | "leaving" | "settled" = "idle";
  let rareDelivery = false;
  let rareClicks = 0;
  let leaveTimer = 0;
  let rainTimer = 0;
  let route: Animation | null = null;

  const reset = (): void => {
    window.clearTimeout(leaveTimer);
    window.clearTimeout(rainTimer);
    route?.cancel();
    route = null;
    phase = "idle";
    rareDelivery = false;
    rareClicks = 0;
    close.hidden = false;
    photo.removeAttribute("aria-label");
    photo.classList.remove("rare-photo-hit");
    rain.classList.remove("active");
    rain.replaceChildren();
    rig.classList.remove("delivering", "delivered", "settled", "rare", "raining", "from-left", "from-right");
    rig.style.removeProperty("transform");
  };

  const finish = (): void => {
    reset();
    void invoke("finish_photo_delivery");
  };

  const settlePhoto = (): void => {
    const bounds = container.querySelector<HTMLElement>(".photo-delivery-card")!.getBoundingClientRect();
    void invoke("settle_photo_delivery", {
      left: bounds.left,
      top: bounds.top,
      width: bounds.width,
      height: bounds.height,
    }).catch(finish);
  };

  const leavePet = (): void => {
    if (phase !== "delivering") return;
    phase = "leaving";
    rig.style.transform = `translate(${rig.dataset.targetX}px, ${rig.dataset.targetY}px)`;
    route?.cancel();
    route = null;
    rig.classList.remove("delivering");
    rig.classList.add("delivered");
    leaveTimer = window.setTimeout(settlePhoto, PET_LEAVE_DURATION_MILLISECONDS);
  };

  const pullKeyframes = (startX: number, targetX: number, y: number): Keyframe[] => {
    const stops = [0, 0.09, 0.075, 0.2, 0.185, 0.34, 0.325, 0.5, 0.485, 0.66, 0.645, 0.82, 0.805, 1];
    return stops.map((progress, index) => ({
      offset: index / (stops.length - 1),
      transform: `translate(${startX + (targetX - startX) * progress}px, ${y}px)`,
      easing: index % 2 === 0 ? "cubic-bezier(.18,.72,.24,1)" : "ease-out",
    }));
  };

  const start = (): void => {
    if (phase !== "idle") return;
    phase = "delivering";
    rareDelivery = photoDeliveryRarity(Math.random()) === "real-heogeodeongseu";
    rareClicks = 0;
    close.hidden = rareDelivery;
    rig.classList.toggle("rare", rareDelivery);
    const selectedPhoto = rareDelivery
      ? rarePhotoUrl
      : photoUrls[Math.floor(Math.random() * photoUrls.length)];
    photo.src = selectedPhoto;
    void Promise.all([spriteUrlPromise, photo.decode()]).then(async ([spriteUrl]) => {
      if (phase !== "delivering") return;
      pet.style.backgroundImage = `url("${spriteUrl}")`;
      const maximumWidth = Math.min(520, window.innerWidth * 0.52);
      const maximumHeight = Math.min(420, window.innerHeight * 0.58);
      const scale = Math.min(maximumWidth / photo.naturalWidth, maximumHeight / photo.naturalHeight);
      const photoWidth = Math.max(300, Math.round(photo.naturalWidth * scale));
      const photoHeight = Math.max(240, Math.round(photo.naturalHeight * scale));
      const comesFromLeft = Math.random() < 0.5;
      const { targetX, y: targetY, startX } = calculatePhotoDeliveryLayout(
        window.innerWidth,
        window.innerHeight,
        photoWidth,
        photoHeight,
        comesFromLeft,
      );

      rig.style.setProperty("--photo-width", `${photoWidth}px`);
      rig.style.setProperty("--photo-height", `${photoHeight}px`);
      rig.dataset.targetX = String(targetX);
      rig.dataset.targetY = String(targetY);
      rig.classList.remove("delivering", "delivered", "settled", "from-left", "from-right");
      rig.classList.add("delivering", comesFromLeft ? "from-left" : "from-right");
      rig.classList.toggle("rare", rareDelivery);
      await invoke("begin_photo_delivery_motion");
      if (phase !== "delivering") return;
      route = rig.animate(pullKeyframes(startX, targetX, targetY), {
        duration: PULL_DURATION_MILLISECONDS,
        fill: "forwards",
      });
      void route.finished.then(leavePet).catch(() => undefined);
    }).catch(() => {
      finish();
    });
  };

  const settle = (): void => {
    phase = "settled";
    rig.style.removeProperty("transform");
    rig.classList.remove("delivering", "delivered");
    rig.classList.add("settled");
    if (rareDelivery) {
      photo.setAttribute("aria-label", `희귀 사진 닫기 0/${RARE_PHOTO_REQUIRED_CLICKS}`);
    }
  };

  const createRain = (): void => {
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < GAMJABOT_RAIN_DROP_COUNT; index += 1) {
      const drop = document.createElement("img");
      drop.src = rainPetUrl;
      drop.alt = "";
      drop.style.setProperty("--rain-x", `${2 + Math.random() * 96}vw`);
      drop.style.setProperty("--rain-delay", `${Math.random() * 1.25}s`);
      drop.style.setProperty("--rain-duration", `${1.65 + Math.random() * 1.25}s`);
      drop.style.setProperty("--rain-scale", `${0.38 + Math.random() * 0.48}`);
      drop.style.setProperty("--rain-rotation", `${-70 + Math.random() * 140}deg`);
      fragment.append(drop);
    }
    rain.replaceChildren(fragment);
  };

  const startRain = async (): Promise<void> => {
    phase = "leaving";
    await invoke("expand_photo_delivery_for_rain");
    rig.classList.add("raining");
    createRain();
    rain.classList.remove("active");
    void rain.offsetWidth;
    rain.classList.add("active");
    rainTimer = window.setTimeout(finish, GAMJABOT_RAIN_DURATION_MILLISECONDS);
  };

  const clickRarePhoto = (): void => {
    if (!rareDelivery || phase !== "settled") return;
    rareClicks += 1;
    photo.setAttribute(
      "aria-label",
      `희귀 사진 닫기 ${rareClicks}/${RARE_PHOTO_REQUIRED_CLICKS}`,
    );
    photo.classList.remove("rare-photo-hit");
    void photo.offsetWidth;
    photo.classList.add("rare-photo-hit");
    if (rareClicks >= RARE_PHOTO_REQUIRED_CLICKS) {
      void startRain().catch(finish);
    }
  };

  const unlisten = await listen("photo://deliver", start);
  const unlistenSettled = await listen("photo://settled", settle);
  const unlistenReset = await listen("photo://reset", reset);
  const unlistenEmergency = await listen("app://emergency-stopped", reset);
  close.addEventListener("click", finish);
  photo.addEventListener("click", clickRarePhoto);
  const spriteUrl = await spriteUrlPromise.catch(() => "");
  return () => {
    window.clearTimeout(leaveTimer);
    close.removeEventListener("click", finish);
    photo.removeEventListener("click", clickRarePhoto);
    unlisten();
    unlistenSettled();
    unlistenReset();
    unlistenEmergency();
    if (spriteUrl) URL.revokeObjectURL(spriteUrl);
  };
}

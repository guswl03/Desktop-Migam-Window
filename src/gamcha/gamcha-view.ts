import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { costumeById, costumes } from "../costumes/catalog";
import {
  resolveCostumeAlignment,
  type CostumeAlignment,
} from "../costumes/alignment";
import { createPetSprite } from "../pet/sprite";
import { invokeWhenReady } from "../tauri/invoke-when-ready";
import { costumeDragAlignment, GAMCHA_NOTICE_DURATION_MILLISECONDS, rarityLabel, rouletteDelay, type GamchaRarity } from "./gamcha-model";

interface GamchaSnapshot {
  tickets: number;
  totalDraws: number;
  ownedCount: number;
  ownedCostumeIds: string[];
  equippedCostumeId: string | null;
  costumeAlignments: Record<string, CostumeAlignment>;
}

interface GamchaDrawResult {
  tickets: number;
  totalDraws: number;
  ownedCount: number;
  costumeId: string;
  rarity: GamchaRarity;
  isNew: boolean;
}

function randomCostume() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return costumes[random[0] % costumes.length];
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function mountGamcha(container: HTMLElement): Promise<() => void> {
  container.innerHTML = `
    <main class="gamcha-panel">
      <section class="gamcha-bubble" data-rarity="common" aria-labelledby="gamcha-heading">
        <div class="gamcha-speed-lines" aria-hidden="true"></div>
        <div class="gamcha-confetti" aria-hidden="true"></div>
        <div class="gamcha-topbar">
          <div class="gamcha-ticket-row"><span>TICKET</span><strong id="gamcha-tickets">0</strong></div>
          <nav class="gamcha-tabs" aria-label="GAMCHA 화면">
            <button class="active" type="button" data-gamcha-tab="draw" aria-selected="true">GAMCHA</button>
            <button type="button" data-gamcha-tab="inventory" aria-selected="false">도감 <span id="gamcha-inventory-count">0</span></button>
          </nav>
          <button class="gamcha-close" type="button" aria-label="GAMCHA 닫기">×</button>
        </div>
        <div class="gamcha-stars" aria-hidden="true">✦ ✧ ✦ ✧ ✦ ✧ ✦</div>
        <div class="gamcha-draw-shell gamcha-draw-view">
          <h1 id="gamcha-heading" class="gamcha-logo" aria-label="GAMCHA!">
            <span>g</span><span>a</span><span>m</span><span>c</span><span>h</span><span>a</span><span>!</span>
          </h1>
          <div class="gamcha-stage" aria-live="polite">
            <div class="gamcha-rays" aria-hidden="true"></div>
            <img id="gamcha-costume" alt="추첨한 코스튬" hidden />
            <div class="gamcha-result-caption">
              <p id="gamcha-rarity" class="gamcha-rarity" hidden></p>
              <p id="gamcha-name" class="gamcha-name">집중 보상을 뽑아보세요</p>
            </div>
            <p id="gamcha-new" class="gamcha-new"></p>
          </div>
          <button id="gamcha-draw" class="gamcha-draw" type="button">GAMCHA 돌리기!</button>
        </div>
        <section class="gamcha-inventory" aria-labelledby="gamcha-inventory-heading" hidden>
          <header><div><p>COSTUME COLLECTION</p><h2 id="gamcha-inventory-heading">코스튬 도감</h2></div><span id="gamcha-inventory-summary">획득 0 / ${costumes.length}</span></header>
          <div id="gamcha-inventory-grid" class="gamcha-inventory-grid" role="listbox" aria-label="전체 코스튬 도감"></div>
          <aside class="gamcha-inventory-detail">
            <div id="gamcha-inventory-preview" class="gamcha-inventory-preview" aria-label="선택 코스튬 착용 미리보기"></div>
            <div class="gamcha-inventory-info">
              <span id="gamcha-inventory-rarity">DEFAULT</span>
              <strong id="gamcha-inventory-name">기본 모습</strong>
              <button id="gamcha-equip" type="button">기본 모습 적용</button>
              <p id="gamcha-equip-status" role="status">기본 모습</p>
            </div>
            <div class="gamcha-alignment" aria-label="코스튬 위치 조정">
              <label>X <output id="gamcha-align-x-value">0</output><input id="gamcha-align-x" type="range" min="-80" max="80" step="1" /></label>
              <label>Y <output id="gamcha-align-y-value">0</output><input id="gamcha-align-y" type="range" min="-80" max="80" step="1" /></label>
              <label>크기 <output id="gamcha-align-size-value">100</output><input id="gamcha-align-size" type="range" min="48" max="180" step="1" /></label>
              <button id="gamcha-align-reset" type="button">위치 초기화</button>
            </div>
          </aside>
        </section>
        <div class="gamcha-meta gamcha-draw-view"><span id="gamcha-owned">COLLECTION 0 / ${costumes.length}</span><span>C60 · R25 · E10 · L4 · S1</span></div>
        <p id="gamcha-error" class="gamcha-error" role="alert"></p>
      </section>
    </main>`;

  const bubble = container.querySelector<HTMLElement>(".gamcha-bubble")!;
  const ticketCount = container.querySelector<HTMLElement>("#gamcha-tickets")!;
  const ownedCount = container.querySelector<HTMLElement>("#gamcha-owned")!;
  const image = container.querySelector<HTMLImageElement>("#gamcha-costume")!;
  const rarity = container.querySelector<HTMLElement>("#gamcha-rarity")!;
  const name = container.querySelector<HTMLElement>("#gamcha-name")!;
  const newLabel = container.querySelector<HTMLElement>("#gamcha-new")!;
  const error = container.querySelector<HTMLElement>("#gamcha-error")!;
  const drawButton = container.querySelector<HTMLButtonElement>("#gamcha-draw")!;
  const inventory = container.querySelector<HTMLElement>(".gamcha-inventory")!;
  const inventoryGrid = container.querySelector<HTMLElement>("#gamcha-inventory-grid")!;
  const inventoryCount = container.querySelector<HTMLElement>("#gamcha-inventory-count")!;
  const inventorySummary = container.querySelector<HTMLElement>("#gamcha-inventory-summary")!;
  const inventoryPreview = container.querySelector<HTMLElement>("#gamcha-inventory-preview")!;
  const inventoryRarity = container.querySelector<HTMLElement>("#gamcha-inventory-rarity")!;
  const inventoryName = container.querySelector<HTMLElement>("#gamcha-inventory-name")!;
  const equipButton = container.querySelector<HTMLButtonElement>("#gamcha-equip")!;
  const equipStatus = container.querySelector<HTMLElement>("#gamcha-equip-status")!;
  const alignX = container.querySelector<HTMLInputElement>("#gamcha-align-x")!;
  const alignY = container.querySelector<HTMLInputElement>("#gamcha-align-y")!;
  const alignSize = container.querySelector<HTMLInputElement>("#gamcha-align-size")!;
  const alignXValue = container.querySelector<HTMLOutputElement>("#gamcha-align-x-value")!;
  const alignYValue = container.querySelector<HTMLOutputElement>("#gamcha-align-y-value")!;
  const alignSizeValue = container.querySelector<HTMLOutputElement>("#gamcha-align-size-value")!;
  const alignReset = container.querySelector<HTMLButtonElement>("#gamcha-align-reset")!;
  const confetti = container.querySelector<HTMLElement>(".gamcha-confetti")!;
  const inventoryPet = createPetSprite();
  inventoryPet.setAnimation("idle");
  inventoryPreview.append(inventoryPet.element);
  let disposed = false;
  let drawing = false;
  let tickets = 0;
  let currentSnapshot: GamchaSnapshot = {
    tickets: 0,
    totalDraws: 0,
    ownedCount: 0,
    ownedCostumeIds: [],
    equippedCostumeId: null,
    costumeAlignments: {},
  };
  let alignmentSaveTimer: number | undefined;
  let alignmentDrag: {
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null = null;  let selectedCostumeId: string | null = null;
  let selectionInitialized = false;

  const selectedAlignment = (): CostumeAlignment | null => {
    const costume = costumeById.get(selectedCostumeId ?? "");
    if (!costume) return null;
    return resolveCostumeAlignment(
      costume.slot,
      costume.defaultAlignment,
      currentSnapshot.costumeAlignments[costume.id],
    );
  };

  const renderAlignment = (): void => {
    const alignment = selectedAlignment();
    const disabled = !alignment;
    for (const control of [alignX, alignY, alignSize, alignReset]) control.disabled = disabled;
    if (!alignment) return;
    alignX.value = String(alignment.x);
    alignY.value = String(alignment.y);
    alignSize.value = String(alignment.size);
    alignXValue.value = String(alignment.x);
    alignYValue.value = String(alignment.y);
    alignSizeValue.value = String(alignment.size);
  };

  const renderInventory = (): void => {
    const ownedIds = new Set(currentSnapshot.ownedCostumeIds);
    const ownedCostumes = currentSnapshot.ownedCostumeIds.flatMap((id) => {
      const costume = costumeById.get(id);
      return costume ? [costume] : [];
    });
    if (selectedCostumeId && !ownedCostumes.some((costume) => costume.id === selectedCostumeId)) {
      selectedCostumeId = null;
    }
    inventoryCount.textContent = String(ownedCostumes.length);
    inventorySummary.textContent = `획득 ${ownedCostumes.length} / ${costumes.length}`;

    const createCard = (costume: (typeof costumes)[number] | null): HTMLButtonElement => {
      const card = document.createElement("button");
      const costumeId = costume?.id ?? "";
      const selected = selectedCostumeId === (costume?.id ?? null);
      const equipped = currentSnapshot.equippedCostumeId === (costume?.id ?? null);
      const unlocked = !costume || ownedIds.has(costume.id);
      card.type = "button";
      card.className = "gamcha-inventory-card";
      card.dataset.costumeId = costumeId;
      card.dataset.rarity = costume?.rarity ?? "default";
      card.setAttribute("role", "option");
      card.setAttribute("aria-selected", String(selected));
      card.setAttribute("aria-disabled", String(!unlocked));
      card.disabled = !unlocked;
      card.classList.toggle("locked", !unlocked);
      if (selected) card.classList.add("selected");
      if (equipped) card.classList.add("equipped");
      if (costume) {
        const costumeImage = document.createElement("img");
        costumeImage.src = costume.url;
        costumeImage.alt = "";
        card.append(costumeImage);
      } else {
        const defaultMark = document.createElement("span");
        defaultMark.className = "gamcha-default-mark";
        defaultMark.textContent = "PET";
        card.append(defaultMark);
      }
      const label = document.createElement("strong");
      label.textContent = costume?.name ?? "기본 모습";
      card.append(label);
      const grade = document.createElement("small");
      grade.textContent = costume ? rarityLabel(costume.rarity) : "DEFAULT";
      card.append(grade);
      if (!unlocked) {
        const lock = document.createElement("i");
        lock.className = "locked-badge";
        lock.textContent = "미획득";
        card.append(lock);
      }
      if (equipped) {
        const badge = document.createElement("i");
        badge.textContent = "착용 중";
        card.append(badge);
      }
      return card;
    };
    inventoryGrid.replaceChildren(createCard(null), ...costumes.map(createCard));

    const selectedCandidate = costumeById.get(selectedCostumeId ?? "");
    const selected = selectedCandidate && ownedIds.has(selectedCandidate.id) ? selectedCandidate : undefined;
    if (selected) {
      inventoryPet.setCostume({
        url: selected.url,
        slot: selected.slot,
        alignment: resolveCostumeAlignment(
          selected.slot,
          selected.defaultAlignment,
          currentSnapshot.costumeAlignments[selected.id],
        ),
      });
      inventoryRarity.textContent = rarityLabel(selected.rarity);
      inventoryRarity.dataset.rarity = selected.rarity;
      inventoryName.textContent = selected.name;
    } else {
      inventoryPet.setCostume(null);
      inventoryRarity.textContent = "DEFAULT";
      inventoryRarity.dataset.rarity = "default";
      inventoryName.textContent = "기본 모습";
    }
    const alreadyEquipped = currentSnapshot.equippedCostumeId === (selected?.id ?? null);
    equipButton.disabled = alreadyEquipped;
    equipButton.textContent = alreadyEquipped
      ? "현재 착용 중"
      : selected ? "이 코스튬 착용" : "기본 모습 적용";
    const equipped = costumeById.get(currentSnapshot.equippedCostumeId ?? "");
    equipStatus.textContent = equipped ? `현재 착용 · ${equipped.name}` : "현재 기본 모습";
    renderAlignment();
  };

  for (let index = 0; index < 56; index += 1) {
    const particle = document.createElement("i");
    particle.style.setProperty("--i", String(index));
    particle.style.setProperty("--hue", String((index * 47) % 360));
    particle.style.setProperty("--x", `${(index * 37) % 100}vw`);
    particle.style.setProperty("--delay", `${-((index * 83) % 1400)}ms`);
    particle.style.setProperty("--drift", `${(index % 2 === 0 ? 1 : -1) * (30 + (index % 7) * 14)}px`);
    confetti.append(particle);
  }

  const renderSnapshot = (snapshot: GamchaSnapshot): void => {
    currentSnapshot = snapshot;
    if (!selectionInitialized) {
      selectedCostumeId = snapshot.equippedCostumeId;
      selectionInitialized = true;
    }
    tickets = snapshot.tickets;
    ticketCount.textContent = String(snapshot.tickets);
    ownedCount.textContent = `COLLECTION ${snapshot.ownedCount} / ${costumes.length}`;
    drawButton.disabled = drawing || snapshot.tickets === 0;
    drawButton.textContent = snapshot.tickets > 0 ? "GAMCHA!" : "집중 완료 티켓 필요";
    renderInventory();
  };

  const preview = (costume: (typeof costumes)[number]): void => {
    image.hidden = false;
    image.src = costume.url;
    image.alt = costume.name;
    rarity.hidden = false;
    rarity.textContent = rarityLabel(costume.rarity);
    name.textContent = costume.name;
    bubble.dataset.rarity = costume.rarity;
  };

  const draw = async (): Promise<void> => {
    if (drawing || tickets === 0) return;
    drawing = true;
    error.textContent = "";
    newLabel.textContent = "";
    drawButton.disabled = true;
    bubble.classList.remove("revealed");
    bubble.classList.add("spinning");
    try {
      const resultPromise = invoke<GamchaDrawResult>("draw_gamcha");
      for (let frame = 0; frame < 24 && !disposed; frame += 1) {
        preview(randomCostume());
        await wait(rouletteDelay(frame));
      }
      const result = await resultPromise;
      const costume = costumeById.get(result.costumeId);
      if (!costume) throw new Error("missing costume asset");
      preview(costume);
      const ownedCostumeIds = result.isNew
        ? [...currentSnapshot.ownedCostumeIds, result.costumeId]
        : currentSnapshot.ownedCostumeIds;
      selectedCostumeId = result.costumeId;
      renderSnapshot({
        ...result,
        ownedCostumeIds,
        equippedCostumeId: currentSnapshot.equippedCostumeId,
        costumeAlignments: currentSnapshot.costumeAlignments,
      });
      newLabel.textContent = result.isNew ? "NEW! COLLECTION GET" : "DUPLICATE";
      bubble.classList.remove("spinning");
      bubble.classList.add("revealed");
    } catch {
      error.textContent = "추첨하지 못했습니다. 다시 시도해 주세요.";
      bubble.classList.remove("spinning");
      try {
        renderSnapshot(await invoke<GamchaSnapshot>("get_gamcha_state"));
      } catch { /* 다음 열기에서 다시 동기화합니다. */ }
    } finally {
      drawing = false;
      drawButton.disabled = tickets === 0;
    }
  };

  drawButton.addEventListener("click", () => void draw());
  inventoryGrid.addEventListener("click", (event) => {
    const card = (event.target as Element).closest<HTMLButtonElement>("[data-costume-id]");
    if (!card || card.disabled) return;
    selectedCostumeId = card.dataset.costumeId || null;
    renderInventory();
  });
  equipButton.addEventListener("click", async () => {
    equipButton.disabled = true;
    equipStatus.textContent = "적용 중";
    try {
      renderSnapshot(
        await invoke<GamchaSnapshot>("equip_gamcha_costume", {
          costumeId: selectedCostumeId,
        }),
      );
    } catch {
      equipStatus.textContent = "착용하지 못했습니다";
    } finally {
      renderInventory();
    }
  });
  const saveAlignment = (): void => {
    const costumeId = selectedCostumeId;
    if (!costumeId) return;
    const alignment = {
      x: Number(alignX.value),
      y: Number(alignY.value),
      size: Number(alignSize.value),
    };
    alignXValue.value = String(alignment.x);
    alignYValue.value = String(alignment.y);
    alignSizeValue.value = String(alignment.size);
    const costume = costumeById.get(costumeId);
    if (costume) inventoryPet.setCostume({ url: costume.url, slot: costume.slot, alignment });
    window.clearTimeout(alignmentSaveTimer);
    alignmentSaveTimer = window.setTimeout(() => {
      void invoke<GamchaSnapshot>("set_gamcha_costume_alignment", {
        costumeId,
        alignment,
      }).then(renderSnapshot).catch(() => {
        equipStatus.textContent = "위치를 저장하지 못했습니다";
      });
    }, 120);
  };
  inventoryPreview.addEventListener("pointerdown", (event) => {
    const costumeImage = (event.target as Element).closest<HTMLElement>(".pet-costume");
    const alignment = selectedAlignment();
    if (!costumeImage || !alignment) return;
    event.preventDefault();
    inventoryPreview.setPointerCapture(event.pointerId);
    inventoryPreview.classList.add("dragging-costume");
    alignmentDrag = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: alignment.x,
      startY: alignment.y,
    };
  });
  inventoryPreview.addEventListener("pointermove", (event) => {
    if (!alignmentDrag || alignmentDrag.pointerId !== event.pointerId) return;
    const next = costumeDragAlignment(
      { x: alignmentDrag.startX, y: alignmentDrag.startY },
      event.clientX - alignmentDrag.startClientX,
      event.clientY - alignmentDrag.startClientY,
      3,
    );
    alignX.value = String(next.x);
    alignY.value = String(next.y);
    saveAlignment();
  });
  const stopCostumeDrag = (event: PointerEvent): void => {
    if (!alignmentDrag || alignmentDrag.pointerId !== event.pointerId) return;
    if (inventoryPreview.hasPointerCapture(event.pointerId)) {
      inventoryPreview.releasePointerCapture(event.pointerId);
    }
    alignmentDrag = null;
    inventoryPreview.classList.remove("dragging-costume");
  };
  inventoryPreview.addEventListener("pointerup", stopCostumeDrag);
  inventoryPreview.addEventListener("pointercancel", stopCostumeDrag);
  alignX.addEventListener("input", saveAlignment);
  alignY.addEventListener("input", saveAlignment);
  alignSize.addEventListener("input", saveAlignment);
  alignReset.addEventListener("click", () => {
    const costumeId = selectedCostumeId;
    if (!costumeId) return;
    void invoke<GamchaSnapshot>("set_gamcha_costume_alignment", {
      costumeId,
      alignment: null,
    }).then(renderSnapshot).catch(() => {
      equipStatus.textContent = "위치를 초기화하지 못했습니다";
    });
  });
  const tabButtons = [...container.querySelectorAll<HTMLButtonElement>("[data-gamcha-tab]")];
  const selectTab = (tab: "draw" | "inventory"): void => {
    bubble.dataset.view = tab;
    inventory.hidden = tab !== "inventory";
    for (const button of tabButtons) {
      const active = button.dataset.gamchaTab === tab;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    }
    if (tab === "inventory") renderInventory();
  };
  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      selectTab(button.dataset.gamchaTab === "inventory" ? "inventory" : "draw");
    });
  }
  container.querySelector<HTMLButtonElement>(".gamcha-close")?.addEventListener("click", () => {
    void invoke("hide_utility_window", { label: "gamcha" });
  });
  renderSnapshot(await invokeWhenReady<GamchaSnapshot>("get_gamcha_state"));
  selectTab("draw");
  const unlisten = await listen<GamchaSnapshot>("gamcha://ticket-earned", ({ payload }) => {
    renderSnapshot(payload);
    bubble.classList.remove("revealed", "spinning");
    rarity.textContent = "TICKET GET!";
    name.textContent = "집중 완료 보상이 도착했습니다";
    newLabel.textContent = "";
  });
  const unlistenEquipped = await listen<GamchaSnapshot>("gamcha://equipped", ({ payload }) => {
    renderSnapshot(payload);
  });
  return () => {
    disposed = true;
    window.clearTimeout(alignmentSaveTimer);
    unlisten();
    unlistenEquipped();
  };
}

export async function mountGamchaNotice(container: HTMLElement): Promise<() => void> {
  container.innerHTML = `
    <main class="gamcha-notice-panel">
      <section class="gamcha-notice-bubble" aria-label="GAMCHA 보상 알림">
        <button class="gamcha-notice-open" type="button" aria-label="GAMCHA 보상 열기">
          <span class="gamcha-notice-sparkles" aria-hidden="true">✦ ✧ ✦</span>
          <strong><span>G</span><span>A</span><span>M</span><span>C</span><span>H</span><span>A!</span></strong>
          <small>TICKET <b id="gamcha-notice-tickets">1</b> · 눌러서 뽑기</small>
        </button>
        <button class="gamcha-notice-close" type="button" aria-label="GAMCHA 알림 닫기">×</button>
      </section>
    </main>`;
  const tickets = container.querySelector<HTMLElement>("#gamcha-notice-tickets")!;
  const openButton = container.querySelector<HTMLButtonElement>(".gamcha-notice-open")!;
  const closeButton = container.querySelector<HTMLButtonElement>(".gamcha-notice-close")!;
  let dismissTimer = 0;
  const restoreTimerBubble = async (): Promise<void> => {
    const timer = await invoke<{ phase: string }>("get_timer_state");
    if (timer.phase !== "stopped") {
      await invoke("show_utility_window", { label: "timer" });
    }
  };
  const hideNotice = (): void => {
    window.clearTimeout(dismissTimer);
    void invoke("hide_utility_window", { label: "gamcha-notice" })
      .then(restoreTimerBubble)
      .catch(() => undefined);
  };
  const openGamcha = (): void => {
    window.clearTimeout(dismissTimer);
    void invoke("show_utility_window", { label: "gamcha" });
  };
  const scheduleDismiss = (): void => {
    window.clearTimeout(dismissTimer);
    dismissTimer = window.setTimeout(hideNotice, GAMCHA_NOTICE_DURATION_MILLISECONDS);
  };
  const render = (snapshot: GamchaSnapshot): void => {
    tickets.textContent = String(snapshot.tickets);
  };
  openButton.addEventListener("click", openGamcha);
  closeButton.addEventListener("click", hideNotice);
  render(await invokeWhenReady<GamchaSnapshot>("get_gamcha_state"));
  const unlisten = await listen<GamchaSnapshot>("gamcha://ticket-earned", ({ payload }) => {
    render(payload);
    scheduleDismiss();
  });
  const unlistenDrag = await listen<{ dragging: boolean }>("pet://drag-state", ({ payload }) => {
    container.classList.toggle("pet-dragging", payload.dragging);
  }).catch(() => () => undefined);
  const positionTimer = window.setInterval(() => void invoke("position_gamcha_bubble"), 250);
  return () => {
    window.clearTimeout(dismissTimer);
    window.clearInterval(positionTimer);
    openButton.removeEventListener("click", openGamcha);
    closeButton.removeEventListener("click", hideNotice);
    unlisten();
    unlistenDrag();
  };
}

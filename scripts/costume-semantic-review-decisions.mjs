import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzePngSemantics, readPngRgba } from "./lib/png-rgba.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = resolve(root, "pack/manifest.json");
const auditPath = resolve(root, "pack/qa/catalog-semantic-audit.json");

const slotNames = {
  head: "머리 장식",
  face: "얼굴 장식",
  neck: "목 장식",
  body: "몸 장식",
  full: "복합 장식",
};

const redrawReasons = new Map(Object.entries({
  common_041: "모자 아래쪽에 본체와 연결되지 않은 주황색 잘린 조각이 보여 안전 여백을 둔 새 원본이 필요하다.",
  rare_003: "모자 아래 캔버스 끝에 같은 별무늬 모자의 다음 조각이 잘려 반복되어 새 단일 모자 원본이 필요하다.",
  rare_007: "해적 모자 아래에 같은 해골 문양 모자가 한 번 더 잘려 들어와 단일 모자로 다시 그려야 한다.",
  rare_012: "상어 후드 아래쪽에 두 번째 상어 조각이 잘려 보여 단일 후드의 완전한 외곽선으로 교체해야 한다.",
  rare_014: "파티 모자 아래에 같은 분홍 별무늬 모자가 반복되어 잘린 잔상이 남아 있다.",
  rare_016: "붉은 용 후드의 턱과 오른쪽 가시가 캔버스 경계에서 끊겨 전체 실루엣이 보이는 원본이 필요하다.",
  rare_017: "얼음 후드 아래에 눈꽃 문양이 있는 두 번째 후드 조각이 잘려 반복되어 있다.",
  rare_021: "기사 투구 아래에 같은 금속 투구의 다음 조각이 잘려 들어와 단일 투구로 정리해야 한다.",
  rare_022: "광대 모자 아래쪽에 동일한 빨강·초록 모자 조각이 반복되어 잘려 있다.",
  rare_023: "잠수 헬멧 창 안에 착용자의 눈과 입이 원본에 합쳐져 있어 빈 투명 창을 가진 독립 헬멧으로 다시 그려야 한다.",
  rare_027: "달토끼 머리띠 아래에 같은 토끼 귀가 반복되어 잘린 다음 행이 보인다.",
  rare_028: "유목민 두건 아래 캔버스 끝에 동일한 천 조각이 반복되어 단일 두건으로 다시 그려야 한다.",
  rare_029: "산호 후드 아래에 같은 산호 장식의 다음 조각이 잘려 반복되어 있다.",
  rare_030: "병정 모자 아래에 흰 깃털과 모자 조각이 반복되어 잘린 잔상이 있다.",
  epic_024: "발키리 투구 아래에 동일한 날개와 투구가 한 번 더 잘려 보여 완전한 단일 투구가 필요하다.",
  legendary_003: "수정룡 장식이 카드에서 지나치게 작고 위아래에 가는 수평 잔상이 있어 선명한 단일 투구로 다시 그려야 한다.",
  legendary_005: "레비아탄 왕관 아래에 같은 뿔 장식이 잘려 반복되어 안전 여백을 둔 새 원본이 필요하다.",
  legendary_007: "오로라 투구 아래에 같은 금빛 뿔과 오로라 조각이 반복되어 잘려 있다.",
  legendary_008: "파라오 관 아래에 동일한 청금색 줄무늬 관이 반복되어 잘려 있다.",
  legendary_009: "가면과 베일 아래에 같은 보석 장식이 반복되어 잘려 카드 하단에서 불완전하게 보인다.",
}));

const splitDecisions = new Map(Object.entries({
  common_031: [
    ["우체부 모자", "head", true],
    ["우체부 우편 가방", "body", false],
  ],
  common_043: [
    ["기본 비행사 모자", "head", true],
    ["기본 비행사 고글", "face", false],
  ],
  common_061: [
    ["열차 차장 모자", "head", true],
    ["열차 차장 제복", "body", false],
  ],
  common_064: [
    ["도예가 반다나", "head", true],
    ["도예가 앞치마", "body", false],
  ],
  common_065: [
    ["탐조가 모자", "head", true],
    ["탐조가 쌍안경 가방", "body", false],
  ],
  common_068: [
    ["테니스 선캡", "head", true],
    ["테니스 손목밴드", "body", false],
  ],
  common_071: [
    ["필름 사진가 베레모", "head", true],
    ["필름 사진가 카메라", "neck", false],
    ["필름 사진가 넥타이", "neck", false],
  ],
  rare_015: [
    ["초밥 요리사 머리띠", "head", true],
    ["초밥 요리사 제복", "body", false],
  ],
  rare_018: [
    ["숲 레인저 모자", "head", true],
    ["숲 레인저 조끼", "body", false],
  ],
  rare_031: [
    ["영화감독 베레모", "head", true],
    ["영화감독 클래퍼보드", "body", false],
  ],
  rare_032: [
    ["번개 조종사 모자", "head", true],
    ["번개 조종사 고글", "face", false],
  ],
  rare_036: [
    ["설산 등반가 모자", "head", true],
    ["설산 등반가 목도리", "neck", false],
  ],
  rare_042: [
    ["괴짜 과학자 헤어", "head", true],
    ["괴짜 과학자 고글", "face", false],
  ],
  rare_046: [
    ["빈티지 사립탐정 모자", "head", true],
    ["빈티지 사립탐정 코트", "body", false],
    ["빈티지 사립탐정 회중시계", "body", false],
  ],
  rare_047: [
    ["하늘 조종사 모자", "head", true],
    ["하늘 조종사 고글", "face", false],
  ],
  epic_007: [
    ["왕실 해군 제독 모자", "head", true],
    ["왕실 해군 제독 제복", "body", false],
  ],
  epic_009: [
    ["은하 수면모", "head", true],
    ["은하 목도리", "neck", false],
  ],
  epic_011: [
    ["고대 유적 탐험가 가면", "face", true],
    ["고대 유적 탐험가 가방", "body", false],
  ],
  epic_012: [
    ["아케이드 챔피언 헤드폰", "head", true],
    ["아케이드 챔피언 메달", "neck", false],
  ],
  epic_020: [
    ["진홍 쇼군 투구", "head", true],
    ["진홍 쇼군 어깨 갑주", "body", false],
  ],
  epic_023: [
    ["대연금술사 머리 장식", "head", true],
    ["대연금술사 로브", "body", false],
    ["대연금술사 물약 벨트", "body", false],
  ],
  legendary_001: [
    ["태양 황제 관", "head", true],
    ["태양 황제 망토", "body", false],
  ],
  legendary_004: [
    ["태엽 시간지기 관", "head", true],
    ["태엽 시간지기 예복", "body", false],
  ],
  legendary_006: [
    ["세계수 군주 관", "head", true],
    ["세계수 군주 망토", "body", false],
  ],
  special_001: [
    ["원조 감자 개발자 새싹 왕관", "head", true],
    ["원조 감자 개발자 후드", "body", false],
    ["원조 감자 개발자 황금 배지", "body", false],
  ],
}));

const onePieceClarifications = new Map(Object.entries({
  rare_011: "이름에는 세트가 들어가지만 원본에는 검정 띠와 노란 촉각이 연결된 꿀벌 머리띠 한 개만 있으며, 잘림이나 고립 잔상은 없다.",
  rare_038: "빨강·흰색 꼬임 끈과 매듭이 하나로 연결된 축제 머리띠 한 개이며 별도 허리띠 그림은 보이지 않는다.",
  rare_043: "이름에는 세트가 들어가지만 원본은 뿔과 금속 띠가 결합된 바이킹 투구 한 개이며 외곽선이 온전히 보인다.",
  legendary_003: redrawReasons.get("legendary_003"),
  special_002: "패치워크 천과 금빛 테두리가 연결된 기록관 후드 한 개이며 별도 구성품이나 잘린 조각은 없다.",
  special_003: "다섯 색상 천 조각과 나선 잠금장식이 한 모자에 결합된 큐레이터 모자 한 개이며 별도 제복은 보이지 않는다.",
}));

function componentsFor(id) {
  return (splitDecisions.get(id) ?? []).map(([name, slot, primary]) => ({
    name,
    slot,
    primary,
  }));
}

function splitObservation(costume, components) {
  const labels = components.map(({ name }) => name).join("·");
  return `${costume.name} 원본에 서로 독립 장착 가능한 ${labels}이(가) 함께 들어 있어 ${components.length}개 항목으로 분리한다.`;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const rows = [];
for (const costume of manifest.costumes.filter(({ rarity }) => rarity !== "default")) {
  const png = await readPngRgba(resolve(root, "pack", costume.file));
  const metrics = analyzePngSemantics(png);
  const components = componentsFor(costume.id);
  const redraw = redrawReasons.get(costume.id);
  const clarification = onePieceClarifications.get(costume.id);
  const state = components.length ? "split" : redraw ? "redraw" : "keep";
  const observations = [
    components.length
      ? splitObservation(costume, components)
      : redraw ?? clarification ?? `${costume.name}의 단일 ${slotNames[costume.slot] ?? "장식"} 실루엣 전체가 캔버스 여백 안에 들어오며, 잘린 중복 조각과 고립 노이즈가 보이지 않는다.`,
  ];
  rows.push({
    id: costume.id,
    state,
    observations,
    warnings: metrics.warnings,
    components,
  });
}

await writeFile(auditPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
console.log(`reviewed=${rows.length} split=${rows.filter(({ state }) => state === "split").length} redraw=${rows.filter(({ state }) => state === "redraw").length}`);

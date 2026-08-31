import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  await readFile(resolve(repositoryRoot, "pack/manifest.json"), "utf8"),
);

const realignReasons = new Map([
  ["common_013", "수면 안대가 입을 가려 눈 위치로 올려야 함."],
  ["common_014", "왕관이 눈을 가려 머리 위로 올려야 함."],
  ["common_024", "운동 머리띠가 눈을 가려 이마로 올려야 함."],
  ["common_025", "목걸이형 카메라가 얼굴을 가려 목/가슴 위치로 내려야 함."],
  ["common_036", "머리핀이 눈 위에 놓여 머리 오른쪽으로 옮겨야 함."],
  ["common_039", "리본이 눈을 가려 머리 오른쪽으로 옮겨야 함."],
  ["common_044", "꽃 안경이 입에 걸려 눈 위치로 올려야 함."],
  ["common_048", "메신저백이 얼굴 옆에 떠 있어 몸통 위치로 내려야 함."],
  ["common_054", "헤드램프가 눈을 가려 이마로 올려야 함."],
  ["common_059", "하트 머리핀이 얼굴 중앙에 있어 머리 오른쪽으로 옮겨야 함."],
  ["common_060", "선캡이 눈을 가려 이마로 올려야 함."],
  ["common_072", "마시멜로 모자가 얼굴 전체를 덮어 위로 올리고 조금 줄여야 함."],
  ["rare_001", "보석 왕관이 얼굴을 가려 머리 위로 올려야 함."],
  ["rare_003", "마법사 모자가 눈을 가려 머리 위로 올려야 함."],
  ["rare_014", "파티 모자가 얼굴을 덮어 위로 올리고 조금 줄여야 함."],
  ["rare_022", "광대 모자가 눈을 가려 머리 위로 올려야 함."],
  ["rare_030", "장난감 병정 모자가 눈을 가려 머리 위로 올려야 함."],
  ["rare_038", "축제 머리띠가 눈을 가려 이마로 올려야 함."],
  ["rare_043", "바이킹 투구가 눈을 가려 머리 위로 올려야 함."],
  ["rare_048", "벨벳 모자가 눈을 가려 머리 위로 올려야 함."],
  ["epic_001", "천상 왕관이 얼굴을 가려 머리 위로 올려야 함."],
  ["epic_003", "수정 왕관이 눈을 가려 머리 위로 올려야 함."],
  ["epic_004", "수호자 관이 눈을 가려 이마 위로 올려야 함."],
  ["epic_008", "화산 왕관이 눈을 가려 머리 위로 올려야 함."],
  ["epic_011", "탐험가 장비가 얼굴을 덮어 몸통 중심으로 내려야 함."],
  ["epic_015", "조개 왕관이 눈을 가려 머리 위로 올려야 함."],
  ["epic_019", "대마법사 모자가 눈을 가려 머리 위로 올려야 함."],
  ["epic_020", "쇼군 갑주가 얼굴을 가려 머리 위로 올려야 함."],
  ["epic_022", "폭풍 왕관이 눈을 가려 머리 위로 올려야 함."],
  ["legendary_005", "레비아탄 왕관이 눈을 가려 머리 위로 올려야 함."],
]);

const redrawReasons = new Map([
  ["common_017", "줄넘기인데 줄이 빠져 손잡이만 보여 원본 구성을 보강해야 함."],
  ["common_061", "이름은 차장 세트지만 원본에는 모자만 보여 제복 구성을 추가해야 함."],
  ["common_064", "이름은 반다나와 앞치마지만 원본에는 반다나만 보여 앞치마를 추가해야 함."],
  ["common_065", "이름은 모자와 쌍안경 가방이지만 원본에는 모자만 보여 가방을 추가해야 함."],
  ["rare_015", "이름은 초밥 요리사 세트지만 원본에는 머리띠만 보여 세트 구성을 보강해야 함."],
  ["rare_018", "이름은 숲 레인저 세트지만 원본에는 모자만 보여 의상 구성을 추가해야 함."],
  ["rare_019", "헬멧 얼굴 창이 불투명해 캐릭터 눈이 사라지므로 투명 구조로 다시 그려야 함."],
  ["rare_035", "보닛 얼굴 창이 불투명해 캐릭터 얼굴이 사라지므로 투명 구조로 다시 그려야 함."],
  ["rare_040", "스쿠버 돔 얼굴 창이 어둡게 막혀 캐릭터 얼굴이 사라지므로 다시 그려야 함."],
  ["rare_046", "이름은 탐정 세트지만 원본에는 모자만 보여 탐정 소품을 추가해야 함."],
  ["epic_007", "이름은 왕실 해군 제독 세트지만 원본에는 모자만 보여 제복 구성을 추가해야 함."],
  ["epic_023", "이름은 대연금술사 세트지만 원본에는 머리 장식만 보여 의상 구성을 추가해야 함."],
  ["legendary_002", "후드의 얼굴 창이 막혀 표정이 사라지므로 투명한 얼굴 공간과 장식을 다시 그려야 함."],
  ["legendary_004", "전설 세트치고 구성과 실루엣이 작고 단순해 시계 장비 디테일을 보강해야 함."],
  ["legendary_001", "관과 망토가 한 덩어리로 몸통에 겹쳐 위치값만으로는 두 구성품을 맞출 수 없어 다시 그려야 함."],
  ["legendary_006", "관과 망토가 한 덩어리로 얼굴을 가려 각 구성품이 맞는 위치에 오도록 다시 그려야 함."],
  ["special_001", "특수 등급 세트의 각 부품이 지나치게 작고 흩어져 감자 새싹 콘셉트를 선명하게 다시 그려야 함."],
]);

const reviewedPlacements = new Map([
  ["common_013", { slot: "face", defaultAlignment: { x: -4, y: -24, size: 104 } }],
  ["common_014", { slot: "head", defaultAlignment: { x: -4, y: -48, size: 104 } }],
  ["common_024", { slot: "head", defaultAlignment: { x: -4, y: -44, size: 104 } }],
  ["common_025", { slot: "neck", defaultAlignment: { x: -4, y: 24, size: 96 } }],
  ["common_036", { slot: "head", defaultAlignment: { x: 18, y: -38, size: 96 } }],
  ["common_039", { slot: "head", defaultAlignment: { x: 18, y: -40, size: 96 } }],
  ["common_044", { slot: "face", defaultAlignment: { x: -4, y: -22, size: 104 } }],
  ["common_048", { slot: "body", defaultAlignment: { x: 8, y: 17, size: 96 } }],
  ["common_054", { slot: "head", defaultAlignment: { x: -4, y: -36, size: 104 } }],
  ["common_059", { slot: "head", defaultAlignment: { x: 18, y: -34, size: 88 } }],
  ["common_060", { slot: "head", defaultAlignment: { x: -4, y: -48, size: 104 } }],
  ["common_072", { slot: "head", defaultAlignment: { x: -4, y: -40, size: 92 } }],
  ["rare_001", { slot: "head", defaultAlignment: { x: -4, y: -58, size: 100 } }],
  ["rare_003", { slot: "head", defaultAlignment: { x: -4, y: -54, size: 104 } }],
  ["rare_014", { slot: "head", defaultAlignment: { x: -4, y: -44, size: 92 } }],
  ["rare_022", { slot: "head", defaultAlignment: { x: -4, y: -40, size: 104 } }],
  ["rare_030", { slot: "head", defaultAlignment: { x: -4, y: -42, size: 104 } }],
  ["rare_038", { slot: "head", defaultAlignment: { x: -4, y: -40, size: 100 } }],
  ["rare_043", { slot: "head", defaultAlignment: { x: -4, y: -50, size: 104 } }],
  ["rare_048", { slot: "head", defaultAlignment: { x: -4, y: -38, size: 104 } }],
  ["epic_001", { slot: "head", defaultAlignment: { x: -4, y: -58, size: 100 } }],
  ["epic_003", { slot: "head", defaultAlignment: { x: -4, y: -52, size: 104 } }],
  ["epic_004", { slot: "head", defaultAlignment: { x: -4, y: -48, size: 104 } }],
  ["epic_008", { slot: "head", defaultAlignment: { x: -4, y: -52, size: 104 } }],
  ["epic_011", { slot: "body", defaultAlignment: { x: 8, y: 22, size: 88 } }],
  ["epic_015", { slot: "head", defaultAlignment: { x: -4, y: -52, size: 104 } }],
  ["epic_019", { slot: "head", defaultAlignment: { x: -4, y: -54, size: 104 } }],
  ["epic_020", { slot: "head", defaultAlignment: { x: -4, y: -54, size: 104 } }],
  ["epic_022", { slot: "head", defaultAlignment: { x: -4, y: -52, size: 104 } }],
  ["legendary_005", { slot: "head", defaultAlignment: { x: -4, y: -48, size: 100 } }],
]);

const redrawPlacements = new Map([
  ["common_017", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["common_061", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["common_064", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["common_065", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["rare_015", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["rare_018", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["rare_019", { slot: "head", defaultAlignment: { x: -4, y: -30, size: 104 } }],
  ["rare_035", { slot: "head", defaultAlignment: { x: -4, y: -30, size: 104 } }],
  ["rare_040", { slot: "head", defaultAlignment: { x: -4, y: -30, size: 104 } }],
  ["rare_046", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["epic_007", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["epic_023", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["legendary_001", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["legendary_002", { slot: "head", defaultAlignment: { x: -4, y: -30, size: 104 } }],
  ["legendary_004", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["legendary_006", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
  ["special_001", { slot: "full", defaultAlignment: { x: -8, y: -8, size: 112 } }],
]);

const keepReason = "원본 디테일과 착용 위치가 이름 및 슬롯에 부합함.";
const candidates = manifest.costumes.filter(({ rarity }) => rarity !== "default");
const audit = candidates.map(({ id }) => {
  if (redrawReasons.has(id)) {
    return {
      id,
      state: "redraw",
      reason: redrawReasons.get(id),
      placement: redrawPlacements.get(id),
    };
  }
  if (realignReasons.has(id)) {
    return {
      id,
      state: "realign",
      reason: realignReasons.get(id),
      placement: reviewedPlacements.get(id),
    };
  }
  return { id, state: "keep", reason: keepReason };
});

await writeFile(
  resolve(repositoryRoot, "pack/qa/catalog-audit.json"),
  `${JSON.stringify(audit, null, 2)}\n`,
  "utf8",
);

const counts = audit.reduce((result, { state }) => {
  result[state] += 1;
  return result;
}, { keep: 0, realign: 0, redraw: 0 });

console.log(`keep=${counts.keep} realign=${counts.realign} redraw=${counts.redraw}`);

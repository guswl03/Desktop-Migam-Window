# Gamjabot costumes

감자봇 원본 골격을 기준으로 생성한 상점용 코스튬 디자인 자료다.

## 구성

- `concepts/`: 초기 16종 디자인 시트
- `catalog-81/`: 일반 40, 희귀 24, 영웅 12, 전설 4, 이스터에그 1
- `additional-45/`: 일반 20, 희귀 14, 영웅 7, 전설 3, 보너스 스페셜 1
- `more-30/`: 일반 12, 희귀 10, 영웅 5, 전설 2, 비밀 스페셜 1
- `singles/`: 최초 무료 지급 기본 코스튬 3종

위 폴더는 총 159종의 초기 코스튬 아이디어와 컨셉 시트를 보존한 작업 이력이다. 각 하위 폴더의 `catalog.md`에서 당시 이름과 시트 배치를 확인할 수 있다.

이 `costumes/` 폴더의 PNG는 코스튬 단독 모습과 감자봇 착용 미리보기를 함께 보여주는 과거 디자인 시트이며, 현재 런타임 자산은 아니다.

## 현재 런타임 카탈로그

- `pack/manifest.json`에는 뽑기 코스튬 185종과 기본 지급 3종, 총 188종이 있다.
- 등급별 뽑기 수는 Common 80, Rare 57, Epic 31, Legendary 12, Special 5다.
- 배치 분류별 수는 head 99, face 28, neck 22, body 36이며, 한 번에 하나만 장착한다.
- 프로덕션 PNG는 `pack/<rarity>/`, 승인본은 `pack/qa/accepted/<rarity>/`, 최종 검수 시트는 `pack/qa/generated/final/`에 있다.

```powershell
npm run test:assets
npm run costumes:blueprint
npm run costumes:validate
npm run costumes:validate-candidates
```





## 캐릭터 고정 규칙

- 감자봇의 기본 눈은 얇은 검은 원형 윤곽과 검은 눈동자만 사용한다.
- 금속 링, 모노클, 체인은 해당 코스튬에 명시된 경우에만 사용하며 다른 코스튬에 전파하지 않는다.
- 안경, 고글, 마스크, 바이저 등 의도된 착용물은 해당 코스튬 디자인대로 유지한다.

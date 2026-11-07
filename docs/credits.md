# 크레딧 · 라이선스 기록

출시 전 체크리스트(개발문서 14장)에서 이 파일을 확인한다. 빈칸은 동업자에게 받아 채운다.

## 아트

| 에셋 | 제작자 | 도구 | 외부 자료·출처 | 생성형 AI 사용 | 상태 |
| --- | --- | --- | --- | --- | --- |
| 캐릭터 일러스트 10종 (`characters/*-v2.png`, 투명 배경) + 요괴 본모습 5종 (`characters/*-yokai.png`) | 동업자 (홍효정) | Google Gemini (Imagen 3), Photoshop | 한국 전통 요괴/복식 기행 | 예 (Imagen 3) | 게임에 적용됨 — 요괴 본모습은 배경이 포함된 그림 |
| 장면 배경 14종 (`backgrounds/`) | 동업자 (홍효정) | Google Gemini (Imagen 3), Photoshop | 한국 수묵 채색화 및 사극 건축 양식 | 예 (Imagen 3) | 게임에 적용됨 |
| 소환진 도형 5종 (`ui-assets/circle-*.png`) | 동업자 (홍효정) | Google Gemini (Imagen 3), Photoshop | 한국 전통 부적 및 전통 문양 | 예 (Imagen 3) | 게임에 적용됨 |
| UI 시안 4종 (`ui-mockups/`) | 홍효정 | Google Gemini (Imagen 3) | — | 예 (Imagen 3) | 구현 참고용 |
| 소환진 SVG 5종 | 개발 (`src/ui/circles.ts`) | — | — | 아니오 | 동업자 도형이 없을 때만 쓰는 대체용 |
| 배경 연출 (달, 안개, 티끌) | 개발 (Phaser로 생성, `src/scenes/fx.ts`) | — | — | 아니오 | 배경 그림 위에 겹치는 효과 |

## 폰트

| 폰트 | 용도 | 라이선스 | 출처 |
| --- | --- | --- | --- |
| 나눔명조 (Nanum Myeongjo) | 본문 | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Nanum+Myeongjo |
| 나눔손글씨 붓 (Nanum Brush Script) | 제목 | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Nanum+Brush+Script |

## 사운드

| 에셋 | 제작 | 라이선스 |
| --- | --- | --- |
| 배경음 7곡 (`audio/bgm-*.ogg`) | 동업자 (`audio-spec.md`) — Google Gemini (음악 생성 기능) | Google 서비스 약관 준수 (상업적 이용 가능) |
| 효과음 7종 (`audio/sfx-*.ogg`) | 동업자 — VARCO.AI (varco.ai) | VARCO.AI 서비스 약관 준수 (상업적 이용 가능) |
| 대본·대사 | 개발 (`src/data/scripts.json`) | 자체 제작 |

## 라이브러리

| 이름 | 용도 | 라이선스 |
| --- | --- | --- |
| Phaser 3 | 배경 연출 | MIT |
| Vite, TypeScript, Vitest, Playwright, ESLint, Prettier, sharp, fflate | 개발 도구 (게임 빌드에는 포함되지 않음) | MIT / Apache-2.0 |

## 콘텐츠 고지 (게임 내 표시)

이 게임에 등장하는 진과 주술은 실제 의례를 재현한 것이 아닌 창작이며, 모든 인물은 가상입니다.

## 확인 및 고지 사항

- 배경, 요괴, 소환진 등 일러스트 우측 하단의 반짝이는 별(✦) 표시 기호는 Google Gemini (Imagen 3) 이미지 생성 모델의 식별 시각 표식(SynthID / Visual Indicator)입니다.

- 해당 에셋들은 상업적 사용 약관에 맞추어 생성되었으며, 게임 출시 시 크레딧 및 게임 내 고지란에 "본 게임의 일부 아트워크 및 배경음은 생성형 AI 기술(Google Gemini)을 활용하여 제작되었습니다." 문구를 표기하여 출처 고지 의무를 준수합니다.
# 크레딧 · 라이선스 기록

출시 전 체크리스트(개발문서 14장)에서 이 파일을 확인한다. 빈칸은 동업자에게 받아 채운다.

## 아트

| 에셋 | 제작자 | 도구 | 외부 자료·출처 | 생성형 AI 사용 | 상태 |
| --- | --- | --- | --- | --- | --- |
| 캐릭터 일러스트 10종 (`characters/*-v2.png`, 투명 배경) + 요괴 본모습 5종 (`characters/*-yokai.png`) | 동업자 (기입 필요) | (기입 필요) | (기입 필요) | (기입 필요) | 게임에 적용됨 — 요괴 본모습은 배경이 포함된 그림 |
| 장면 배경 14종 (`backgrounds/`) | 동업자 (기입 필요) | (기입 필요) | (기입 필요) | (기입 필요) | 게임에 적용됨 |
| 소환진 도형 5종 (`ui-assets/circle-*.png`) | 동업자 (기입 필요) | (기입 필요) | (기입 필요) | (기입 필요) | 게임에 적용됨 |
| UI 시안 4종 (`ui-mockups/`) | (기입 필요) | (기입 필요) | (기입 필요) | (기입 필요) | 구현 참고용 |
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
| 배경음 7곡 (`audio/bgm-*.ogg`) | 동업자 (`audio-spec.md`) — 제작자, 도구, 생성형 AI 사용 여부 **기입 필요** | (기입 필요) |
| 효과음 7종 (`audio/sfx-*.ogg`) | 동업자 — 제작자, 도구, 생성형 AI 사용 여부 **기입 필요**. 파일이 없을 때만 Web Audio 합성음(`src/audio/sound.ts`)을 쓴다 | (기입 필요) |
| 대본·대사 | 개발 (`src/data/scripts.json`) | 자체 제작 |

## 라이브러리

| 이름 | 용도 | 라이선스 |
| --- | --- | --- |
| Phaser 3 | 배경 연출 | MIT |
| Vite, TypeScript, Vitest, Playwright, ESLint, Prettier, sharp, fflate | 개발 도구 (게임 빌드에는 포함되지 않음) | MIT / Apache-2.0 |

## 콘텐츠 고지 (게임 내 표시)

이 게임에 등장하는 진과 주술은 실제 의례를 재현한 것이 아닌 창작이며, 모든 인물은 가상입니다.

## 확인 필요

- 배경·요괴·소환진 이미지 다수의 오른쪽 아래에 작은 별(✦) 표시가 남아 있다. 생성 도구의 워터마크로 보이므로 도구, 약관(상업적 이용·재배포), 표시 의무를 동업자에게 확인하고 위 표를 채운다. 확인 전에는 출시하지 않는다.

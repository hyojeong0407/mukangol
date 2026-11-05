# 크레딧 · 라이선스 기록

출시 전 체크리스트(개발문서 14장)에서 이 파일을 확인한다. 빈칸은 동업자에게 받아 채운다.

## 아트

| 에셋 | 제작자 | 도구 | 외부 자료·출처 | 생성형 AI 사용 | 상태 |
| --- | --- | --- | --- | --- | --- |
| 캐릭터 일러스트 10종 (`characters/`) | (기입 필요) | (기입 필요) | (기입 필요) | (기입 필요) | 러프 — 확정 여부 확인 필요 |
| UI 시안 4종 (`ui-mockups/`) | (기입 필요) | (기입 필요) | (기입 필요) | (기입 필요) | 구현 참고용 |
| 소환진 도형 5종 | 개발 (SVG 코드로 그린 임시 에셋, `src/ui/circles.ts`) | — | — | 아니오 | 임시 |
| 배경 연출 (달, 안개, 티끌) | 개발 (Phaser로 생성한 임시 에셋, `src/scenes/fx.ts`) | — | — | 아니오 | 임시 |

## 폰트

| 폰트 | 용도 | 라이선스 | 출처 |
| --- | --- | --- | --- |
| 나눔명조 (Nanum Myeongjo) | 본문 | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Nanum+Myeongjo |
| 나눔손글씨 붓 (Nanum Brush Script) | 제목 | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Nanum+Brush+Script |

## 사운드

| 에셋 | 제작 | 라이선스 |
| --- | --- | --- |
| 배경음 4곡 (`audio/bgm-*.ogg`) | 동업자 (`audio-spec.md`) — 제작자, 도구, 생성형 AI 사용 여부 **기입 필요** | (기입 필요) |
| 효과음 전체 | Web Audio API로 실시간 합성 (`src/audio/sound.ts`) — 동업자 효과음이 오면 교체 | 해당 없음 |
| 대본·대사 | 개발 (`src/data/scripts.json`) | 자체 제작 |

## 라이브러리

| 이름 | 용도 | 라이선스 |
| --- | --- | --- |
| Phaser 3 | 배경 연출 | MIT |
| Vite, TypeScript, Vitest, Playwright, ESLint, Prettier, sharp, fflate | 개발 도구 (게임 빌드에는 포함되지 않음) | MIT / Apache-2.0 |

## 콘텐츠 고지 (게임 내 표시)

이 게임에 등장하는 진과 주술은 실제 의례를 재현한 것이 아닌 창작이며, 모든 인물은 가상입니다.

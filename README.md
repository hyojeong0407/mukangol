# THE-FIFTH-GUEST — 묵안골

> 병자호란 이후 조선, 결계에 갇힌 고을에서 요괴 넷과 사람 하나를 가려내는 웹 추리 공포 게임

- 기획: [`게임 시나리오.md`](게임%20시나리오.md) · 개발: [`개발문서.md`](개발문서.md) · 아트 명세: [`일러스트_UIUX_명세.md`](일러스트_UIUX_명세.md)
- MVP 결정 사항: [`docs/decisions.md`](docs/decisions.md) · 크레딧: [`docs/credits.md`](docs/credits.md) · 변경 기록: [`CHANGELOG.md`](CHANGELOG.md)

## 시작하기

Node.js 22 LTS가 필요합니다.

```bash
npm install
npm run dev        # http://localhost:5173 개발 서버 (정답 DEBUG 패널 포함)
```

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버. `?seed=ABCD-1234` 를 붙이면 그 판으로 바로 시작 (버그 재현용, 개발 빌드 전용) |
| `npm run build` | 타입 검사 후 `dist/`에 정적 빌드 (DEBUG 패널 제거됨) |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm test` | 단위 테스트 + 1만 판 시뮬레이션 (`SIM_N=100000 npm test`로 판 수 변경) |
| `npm run test:e2e` | Playwright E2E. 처음 한 번 `npx playwright install chromium` 필요 |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run assets` | `characters/*.png` → `public/images/characters/*.webp` 변환 |
| `npm run zip:itch` | `dist/`를 itch.io 업로드용 zip으로 묶기 |

## 폴더 구조

```text
├─ src/
│  ├─ config.ts       # 게임 수치 (질문 포인트, 힌트 수, 구속 상한 …) — 밸런스 조정은 여기서
│  ├─ core/           # 순수 로직: rng, 판 생성(generate), 풀이기(solver), 상태 머신(game)
│  ├─ data/           # clues.json, suspects.json, texts.json — 게임 문장은 모두 여기
│  ├─ state/          # 저장/불러오기(버전·마이그레이션), 설정
│  ├─ ui/             # DOM 화면 (views), 화면 흐름 (app), 소환진 SVG
│  ├─ scenes/         # Phaser 배경 연출 (지연 로딩)
│  ├─ audio/          # Web Audio 임시 사운드
│  └─ styles.css
├─ public/images/characters/   # 변환된 WebP (원본은 characters/)
├─ tests/unit · tests/simulation · tests/e2e
├─ scripts/           # 에셋 변환, itch.io zip
├─ docs/              # 결정 기록, 크레딧
├─ characters/ · ui-mockups/   # 동업자 원본 (개발 참고용)
└─ .github/workflows/ci.yml    # 린트·타입·테스트·빌드·E2E, 태그 시 itch.io zip
```

### 설계 원칙 (개발문서 3장)

- `src/core`는 Phaser와 DOM에 의존하지 않는 순수 함수다. 그래서 1만 판 시뮬레이션을 1초 안에 돌릴 수 있다.
- 모든 무작위는 시드를 거친다. 같은 시드는 같은 판을 만든다. 판 번호는 설정 화면과 엔딩 화면에 표시된다.
- 판 생성 후 풀이기로 "사건 4건과 용의자의 대응이 하나뿐인지" 검사하고, 아니면 힌트를 다시 뽑는다.

## 대사·연출 수정

- 대사와 해설은 전부 `src/data/scripts.json`에 있습니다. 코드를 건드리지 않고 문장만 고치면 됩니다.
- `{victim}`, `{yokai}` 같은 변수와 `{이/가}`, `{은/는}`, `{을/를}` 조사는 자동으로 채워집니다.
- 배역별 목소리(성별, 음높이, 빠르기)와 구속 항변 대사는 `src/data/suspects.json`에 있습니다.
- 배경음 7곡은 `audio-spec.md`대로 화면마다 바뀌고, 효과음 7종은 파일이 있으면 합성음 대신 쓰입니다 (`src/ui/app.ts`의 `bgmTrack()`).
- 대사는 음성 없이 대사창 자막(한 글자씩 찍기)으로만 연출합니다. 자동 넘김은 글자 수에 맞춰 읽을 시간을 줍니다 (`src/ui/cutscene.ts`의 `readMs`).

## 아트 교체 방법

1. 동업자가 파일을 올린다: 인물 `characters/char-{id}-{variant}.png`(요괴 본모습은 `-yokai`), 배경 `backgrounds/bg-{장면}.png`, 소리 `audio/sfx-*.ogg`·`audio/bgm-*.ogg`. 필요한 목록은 `동업자_요청사항.md`.
2. 그림은 `npm run assets` 로 WebP 변환. 같은 그림의 판본이 여럿이면 `-no-watermark`(`_no-watermark`) > `-v2` > 원본 순으로 하나만 쓴다. 음원은 `npm run dev`/`npm run build` 때 자동으로 `public/audio/`에 복사되고 `manifest.json`이 갱신된다.
3. 목록에 있는 파일은 게임이 자동으로 쓴다. 없는 것은 임시 표현(효과를 입힌 초상, 색 배경, 합성음)으로 대신한다.
4. 소환진 도형(`circle-*.png`)은 아직 코드의 SVG를 쓰므로, 받으면 `src/ui/circles.ts`를 교체한다.

## 배포

- **Netlify / Vercel**: 저장소를 연결하면 `netlify.toml` / `vercel.json` 설정대로 `main` 병합 시 자동 배포, PR마다 미리보기.
- **itch.io**: `v0.1.0` 같은 태그를 푸시하면 CI가 zip을 만든다 (Actions → itch-zip 아티팩트). 또는 로컬에서 `npm run build && npm run zip:itch`.
  itch.io에서 "HTML" 프로젝트로 올리고 화면 크기는 1280×720 이상을 권장.

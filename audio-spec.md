# 묵안골 — 음원 및 사운드 에셋 명세 (v1.2)

> 웹 브라우저 최적화를 위해 `.ogg` 포맷으로 변환된 BGM 에셋 명세 및 프로젝트 구조 문서입니다.

---

## 1. 폴더 구조 (Project Directory)

```text
mukangol/
├─ audio/                     # 음원 파일 저장 폴더
│  ├─ bgm-title.ogg          # ① 타이틀 및 마을 전경 BGM
│  ├─ bgm-dawn.ogg           # ② 새벽 사건 보고 BGM
│  ├─ bgm-reasoning.ogg      # ③ 오전/밤 추리 및 기록 대조 BGM
│  ├─ bgm-interrogation.ogg  # ④ 오후 주술사 심문 BGM
│  ├─ bgm-ending.ogg         # ⑤ 5일차 처형 지목 및 처형 연출 BGM
│  ├─ bgm-ending-happy.ogg   # ⑥ 해피 엔딩 BGM (결계 해제 및 여명)
│  └─ bgm-ending-gameover.ogg# ⑦ 게임 오버 BGM (비극 및 차가운 고을)
├─ characters/
├─ ui-mockups/
├─ 개발문서.md
├─ 게임 시나리오.md
├─ 동업자_요청사항.md
├─ 일러스트_UIUX_명세.md
└─ README.md
```

---

## 2. BGM 상세 목록

| 파일명 | 연결 화면 및 타이밍 | 주요 악기 및 분위기 |
| :--- | :--- | :--- |
| **`bgm-title.ogg`** | ① 타이틀 화면<br>• 마을 전경 연출 | 은은한 해금, 대금 선율과 묵직한 징 소리.<br>결계에 갇힌 묵안골의 차갑고 불길한 고을 전경 연출. |
| **`bgm-dawn.ogg`** | ② 새벽 사건 보고 | 정적인 대금과 긴장감을 주는 나지막한 현악기 핑거링.<br>새벽녘 새로운 희생자 발생 및 사건 보고 시의 서늘함 연출. |
| **`bgm-reasoning.ogg`** | ③ 사건 일지 (오전)<br>⑤ 심문 일지<br>⑥ 검험 기록판 (밤) | 정갈한 가야금 튕김과 절제된 장구 타악 리듬.<br>사건 대조 및 소거법 추리 시 몰입감을 높여주는 정적인 긴장감. |
| **`bgm-interrogation.ogg`** | ④ 주술사 심문 (오후) | 긁히는 듯한 날카로운 해금 고음과 법고/바라 소리.<br>어둡고 좁은 옥사 안, 주술사 현암과의 숨막히는 대치 상황 표현. |
| **`bgm-ending.ogg`** | ⑧ 5일차 처형 지목 및 처형 연출 | 묵직한 북소리와 아쟁의 깊고 긴장감 넘치는 울림.<br>범인을 지목하고 처형대로 이송하는 운명의 순간 연출. |
| **`bgm-ending-happy.ogg`** | ⑨ 엔딩 화면 (진범 검거 / 해피 엔딩) | 따뜻한 대금 선율과 맑은 가야금, 밝은 여명의 울림.<br>결계가 풀리고 묵안골에 새벽 빛이 차오르는 희망적인 분위기. |
| **`bgm-ending-gameover.ogg`** | ⑨ 엔딩 화면 (추리 실패 / 게임 오버) | 낮게 읊조리는 아쟁과 쓸쓸하고 차가운 바람 소리.<br>결계를 풀지 못하고 고을 전체가 기괴한 한기에 휩싸이는 비극적 연출. |

---

## 3. 개발 적용 가이드

1. **파일 포맷**: Web Audio API 및 HTML5 Audio와의 높은 호환성과 가벼운 용량을 위해 `.ogg` 음원을 사용합니다.
2. **재생 규칙**:
   * `bgm-title.ogg`, `bgm-dawn.ogg`, `bgm-reasoning.ogg`, `bgm-interrogation.ogg`는 기본적으로 `loop = true`로 설정하여 반복 재생합니다.
   * `bgm-ending.ogg`는 처형 연출 컷씬에 맞춰 재생되며, 연출 종료 후 엔딩 결과(해피/게임오버)에 따라 `bgm-ending-happy.ogg` 또는 `bgm-ending-gameover.ogg`로 교체합니다.
   * 화면 전환 시 이전 BGM은 페이드아웃(Fade-out) 처리하고 새 BGM을 페이드인(Fade-in)하는 연출을 권장합니다.
3. **볼륨 제어**: 설정 화면의 BGM 사운드 슬라이더와 연동되어 효과음(SFX)과 분리된 독립 음량 조절이 지원되어야 합니다.
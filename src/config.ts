/**
 * 게임 수치는 모두 여기 한 곳에 모은다. (개발문서 4장 코딩 규칙: 매직 넘버 금지)
 * 플레이 테스트(9장 5단계)에서 이 값들을 조정한다.
 */
export const CONFIG = {
  /** 총 일수: 사건 4일 + 최종 처형 1일 */
  totalDays: 5,
  /** 사건이 일어나는 날 수 (요괴 수와 같다) */
  incidentDays: 4,
  /**
   * 일차별 질문 포인트 (매일 2개 → 5일 동안 30개 중 10개).
   * 질문 하나 = 요괴 하나를 골라 묻기. 그 요괴의 6가지 수법 중 아직 안 나온 것이 무작위로 하나 나온다.
   */
  questionsByDay: [2, 2, 2, 2, 2] as readonly number[],
  /**
   * 판마다 값이 겹치는 쌍의 수 (최소~최대). 겹침 하나 = 한 단서 종류에서 두 요괴가 같은 값을 쓴다.
   * 겹친 종류마다 아무도 쓰지 않는 값이 하나 생긴다. 서로 다른 단서 종류에서만 겹친다.
   */
  duplicates: { min: 2, max: 4 },
  /**
   * 사건 일지에서 읽을 수 있는 단서 수 (6종 중). 장소는 항상 읽을 수 있고 나머지는 "판독 불가".
   * 옥사 이변(구속으로 막힌 사건)에서는 장소가 빠져 하나 더 적다.
   */
  legibleClues: 4,
  /** 판 생성 시 해 검증 실패 시 재시도 상한 */
  maxGenerationAttempts: 500,
  /**
   * 옥사 칸 수 = 동시 구속 상한 (결정 기록 D-1).
   * 심문은 갇힌 사람에게만 할 수 있고, 갇힌 요괴는 그날 밤 사건을 일으키지 못한다.
   */
  maxDetained: 2,
  /** 희생자가 이 수 이상이면, 요괴를 모두 가려내도 씁쓸한 엔딩 */
  bitterVictims: 4,
  /** 처형 시 지목해야 하는 인원 */
  executionCount: 4,
  /** 저장 형식 버전 */
  saveVersion: 4,
} as const;

/** 5일 동안 얻는 힌트 수 */
export const TOTAL_QUESTIONS = CONFIG.questionsByDay.reduce((a, b) => a + b, 0);

export const STORAGE_KEYS = {
  save: 'mukangol.save.v1',
  settings: 'mukangol.settings.v1',
} as const;

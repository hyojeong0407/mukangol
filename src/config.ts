/**
 * 게임 수치는 모두 여기 한 곳에 모은다. (개발문서 4장 코딩 규칙: 매직 넘버 금지)
 * 플레이 테스트(9장 5단계)에서 이 값들을 조정한다.
 */
export const CONFIG = {
  /** 총 일수: 사건 4일 + 최종 처형 1일 */
  totalDays: 5,
  /** 사건이 일어나는 날 수 (요괴 수와 같다) */
  incidentDays: 4,
  /** 하루 질문 포인트 */
  questionPointsPerDay: 4,
  /** 5일 동안 얻는 힌트 수 (30개 중) */
  totalHints: 20,
  /** 용의자마다 최소로 보장되는 힌트 수 (서로 다른 단서 종류) */
  minHintsPerSuspect: 3,
  /** 1~2일차(힌트 8개)에 한 용의자의 힌트가 몰리지 않도록 하는 상한 */
  maxEarlyHintsPerSuspect: 3,
  /** 판 생성 시 해 검증 실패 시 재시도 상한 */
  maxGenerationAttempts: 500,
  /**
   * 동시 구속 상한. 결정 기록(docs/decisions.md) D-1 참고.
   * 5일차에 4명을 지목하므로 기본은 4.
   */
  maxDetained: 4,
  /** 처형 시 지목해야 하는 인원 */
  executionCount: 4,
  /** 저장 형식 버전 */
  saveVersion: 2,
} as const;

export const STORAGE_KEYS = {
  save: 'mukangol.save.v1',
  settings: 'mukangol.settings.v1',
} as const;

import type { CategoryId } from './data';

export type SuspectId = string;
export type Profile = Record<CategoryId, string>;

/** "어느 용의자가 어떤 단서 종류에서 어떤 값을 쓴다" */
export interface Hint {
  suspectId: SuspectId;
  category: CategoryId;
  value: string;
}

/**
 * 플레이어가 받는 사건 일지 한 건.
 * - 보통 사건: 피해자가 있고, 읽을 수 있는 단서만 들어 있다 (판독 불가인 종류는 빠져 있다).
 * - 옥사 이변: 그날 밤의 범인이 옥에 갇혀 있어 사건이 막힌 경우. 피해자 없음,
 *   단서는 더 적고, 범인은 그날 밤 갇혀 있던 사람(prevented) 중 하나다.
 */
export interface Incident {
  day: number;
  /** 피해자. 옥사 이변이면 null */
  victim: string | null;
  /** 읽을 수 있는 단서. 값은 범인 요괴의 프로필과 같다 */
  clues: Partial<Profile>;
  /** 옥사 이변일 때 그날 밤 옥에 갇혀 있던 사람들 (범인은 이 중 하나) */
  prevented?: SuspectId[];
}

/** 판을 만들 때 정해 두는 그날의 사건 계획 (정답 포함, 플레이어에게 그대로 보이지 않는다) */
export interface PlannedIncident {
  day: number;
  victim: string;
  /** 범인 요괴의 프로필 전체 */
  clues: Profile;
  /** 사건 일지에서 읽을 수 있는 단서 종류. 장소는 항상 포함된다 */
  legible: CategoryId[];
}

/** 시드로부터 만들어지는 한 판의 정답과 일정. 생성 후 바뀌지 않는다. */
export interface Board {
  seed: string;
  civilianId: SuspectId;
  profiles: Record<SuspectId, Profile>;
  /** 1~4일차 밤에 사건을 일으키려는 요괴 (그 요괴가 옥에 갇혀 있으면 옥사 이변) */
  eventOrder: SuspectId[];
  incidents: PlannedIncident[];
  /**
   * 요괴마다 심문에서 수법이 나오는 순서 (6종을 무작위로 섞은 것).
   * 플레이어가 그 요괴를 고를 때마다 앞에서부터 하나씩 나온다. 한 번 나온 종류는 다시 나오지 않는다.
   * 시드로 정해 두므로 다시 불러와도 같은 답이 나온다.
   */
  askOrder: Record<SuspectId, CategoryId[]>;
  /** 값이 겹친 곳 (디버그·테스트용). 플레이어에게는 보여 주지 않는다. */
  duplicates: { category: CategoryId; value: string; suspects: [SuspectId, SuspectId] }[];
  /** 생성에 걸린 시도 횟수 (디버그용) */
  attempts: number;
}

export type Phase = 'dawn' | 'morning' | 'afternoon' | 'night' | 'final';
export type Mark = '' | 'possible' | 'impossible' | 'confirmed';
export type Ending = null | 'happy' | 'game_over';

/** 플레이어가 기록판에 남기는 메모. 정답과 무관하다. */
export interface Notes {
  /** key: `${day}|${suspectId}:${category}` — 검험 기록판은 사건(일차)마다 따로 표시한다 */
  marks: Record<string, Mark>;
  /** 일차(1~4) → 플레이어가 추정한 범인 */
  culprits: Record<number, SuspectId | ''>;
}

export interface GameState {
  version: number;
  seed: string;
  board: Board;
  day: number;
  phase: Phase;
  /** 공개된 사건 일지 */
  incidentLog: Incident[];
  /** 획득한 힌트 (얻은 일차 포함) */
  interrogationLog: (Hint & { day: number })[];
  /** 오늘 남은 질문 포인트 */
  questionPoints: number;
  detained: SuspectId[];
  executed: SuspectId[];
  notes: Notes;
  ending: Ending;
  startedAt: number;
  updatedAt: number;
}

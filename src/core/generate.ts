import { CONFIG } from '../config';
import { CATEGORIES, CATEGORY_IDS, SUSPECT_IDS, TEXTS, type CategoryId } from './data';
import { createRng, type Rng } from './rng';
import { hasUniqueSolution } from './solver';
import type { Board, Hint, Incident, Profile, SuspectId } from './types';

type Duplicate = Board['duplicates'][number];

/**
 * 3. 6종 단서 각각에서 5가지 값을 5명에게 배정한다 (독립 순열 6개).
 * 그다음 서로 다른 단서 종류 1~3곳(CONFIG.duplicates)에서 한 요괴의 값을 다른 요괴와 같게 만든다.
 * 그 종류에서는 값 하나가 두 요괴에게 겹치고, 값 하나는 아무도 쓰지 않는다.
 */
function assignProfiles(rng: Rng): { profiles: Record<SuspectId, Profile>; duplicates: Duplicate[] } {
  const profiles: Record<SuspectId, Partial<Profile>> = {};
  for (const s of SUSPECT_IDS) profiles[s] = {};
  for (const cat of CATEGORIES) {
    const values = rng.shuffle(cat.values.map((v) => v.id));
    SUSPECT_IDS.forEach((s, i) => (profiles[s][cat.id] = values[i]));
  }
  const { min, max } = CONFIG.duplicates;
  const count = min + Math.floor(rng.next() * (max - min + 1));
  const duplicates: Duplicate[] = rng
    .shuffle(CATEGORY_IDS)
    .slice(0, count)
    .map((category) => {
      const [a, b] = rng.shuffle(SUSPECT_IDS);
      const value = profiles[a][category]!;
      profiles[b][category] = value;
      return { category, value, suspects: [a, b] };
    });
  return { profiles: profiles as Record<SuspectId, Profile>, duplicates };
}

/** 4. 요괴마다 심문에서 수법이 나오는 순서 */
function makeAskOrder(rng: Rng): Record<SuspectId, CategoryId[]> {
  const order: Record<SuspectId, CategoryId[]> = {};
  for (const s of SUSPECT_IDS) order[s] = rng.shuffle(CATEGORY_IDS);
  return order;
}

export class GenerationError extends Error {}

/**
 * 시드로 한 판을 만든다 (개발문서 5-1).
 * 같은 시드 → 같은 판. 30개 힌트를 모두 알면 해가 하나여야 한다.
 * (요괴끼리는 최소 3종 이상 값이 달라 항상 성립하지만, 데이터가 바뀔 때를 대비해 검사한다.)
 * 어떤 요괴를 물을지는 플레이어가 정하므로, 10개 힌트로 반드시 풀린다는 보장은 하지 않는다.
 */
export function generateBoard(seed: string): Board {
  const rng = createRng(seed);
  for (let attempts = 1; attempts <= CONFIG.maxGenerationAttempts; attempts++) {
    const civilianId = rng.pick(SUSPECT_IDS);
    const { profiles, duplicates } = assignProfiles(rng);
    const monsters = SUSPECT_IDS.filter((s) => s !== civilianId);
    const eventOrder = rng.shuffle(monsters).slice(0, CONFIG.incidentDays);
    const victims = rng.shuffle(TEXTS.victims);
    const incidents: Incident[] = eventOrder.map((s, i) => ({
      day: i + 1,
      victim: victims[i % victims.length],
      clues: { ...profiles[s] },
    }));
    const askOrder = makeAskOrder(rng);
    if (!hasUniqueSolution(incidents, fullHints(profiles))) continue;
    return { seed, civilianId, profiles, eventOrder, incidents, askOrder, duplicates, attempts };
  }
  throw new GenerationError(`판 생성 실패: seed=${seed}`);
}

/** 30개 힌트 전부 (검증용) */
export function fullHints(profiles: Record<SuspectId, Profile>): Hint[] {
  return SUSPECT_IDS.flatMap((s) =>
    CATEGORY_IDS.map((c) => ({ suspectId: s, category: c, value: profiles[s][c] })),
  );
}

export function hintKey(h: { suspectId: SuspectId; category: CategoryId }) {
  return `${h.suspectId}:${h.category}`;
}

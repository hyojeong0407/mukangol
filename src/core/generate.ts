import { CONFIG } from '../config';
import { CATEGORIES, CATEGORY_IDS, SUSPECT_IDS, TEXTS, type CategoryId } from './data';
import { createRng, type Rng } from './rng';
import { hasUniqueSolution } from './solver';
import type { Board, Hint, Incident, Profile, SuspectId } from './types';

/** 3. 6종 단서 각각에서 5가지 값을 5명에게 1:1 배정 (독립 순열 6개) */
function assignProfiles(rng: Rng): Record<SuspectId, Profile> {
  const profiles: Record<SuspectId, Partial<Profile>> = {};
  for (const s of SUSPECT_IDS) profiles[s] = {};
  for (const cat of CATEGORIES) {
    const values = rng.shuffle(cat.values.map((v) => v.id));
    SUSPECT_IDS.forEach((s, i) => (profiles[s][cat.id] = values[i]));
  }
  return profiles as Record<SuspectId, Profile>;
}

/** 5. 30개 중 20개: 용의자마다 서로 다른 단서 3종(15개) + 나머지에서 5개 */
function selectHints(rng: Rng, profiles: Record<SuspectId, Profile>): Hint[] {
  const chosen: Hint[] = [];
  const rest: Hint[] = [];
  for (const s of SUSPECT_IDS) {
    const cats = rng.shuffle(CATEGORY_IDS);
    cats.forEach((c, i) => {
      const h: Hint = { suspectId: s, category: c, value: profiles[s][c] };
      (i < CONFIG.minHintsPerSuspect ? chosen : rest).push(h);
    });
  }
  const extra = CONFIG.totalHints - chosen.length;
  return chosen.concat(rng.shuffle(rest).slice(0, extra));
}

/** 6. 20개를 1~5일차에 4개씩 배치. 1~2일차 편중 제한 */
function scheduleHints(rng: Rng, hints: Hint[]): Hint[][] | null {
  const per = CONFIG.questionPointsPerDay;
  for (let attempt = 0; attempt < 200; attempt++) {
    const order = rng.shuffle(hints);
    const early = order.slice(0, per * 2);
    const counts = new Map<SuspectId, number>();
    for (const h of early) counts.set(h.suspectId, (counts.get(h.suspectId) ?? 0) + 1);
    if ([...counts.values()].some((n) => n > CONFIG.maxEarlyHintsPerSuspect)) continue;
    const days: Hint[][] = [];
    for (let d = 0; d < CONFIG.totalDays; d++) days.push(order.slice(d * per, d * per + per));
    return days;
  }
  return null;
}

export class GenerationError extends Error {}

/**
 * 시드로 한 판을 만든다 (개발문서 5-1).
 * 같은 시드 → 같은 판. 해가 유일하지 않으면 힌트 선택부터 다시 한다.
 */
export function generateBoard(seed: string): Board {
  const rng = createRng(seed);

  const civilianId = rng.pick(SUSPECT_IDS);
  const profiles = assignProfiles(rng);
  const monsters = SUSPECT_IDS.filter((s) => s !== civilianId);
  const eventOrder = rng.shuffle(monsters).slice(0, CONFIG.incidentDays);
  const victims = rng.shuffle(TEXTS.victims);
  const incidents: Incident[] = eventOrder.map((s, i) => ({
    day: i + 1,
    victim: victims[i % victims.length],
    clues: { ...profiles[s] },
  }));

  for (let attempts = 1; attempts <= CONFIG.maxGenerationAttempts; attempts++) {
    const hints = selectHints(rng, profiles);
    const hintSchedule = scheduleHints(rng, hints);
    if (!hintSchedule) continue;
    if (!hasUniqueSolution(incidents, hints)) continue;
    return { seed, civilianId, profiles, eventOrder, incidents, hintSchedule, attempts };
  }
  throw new GenerationError(`판 생성 실패: seed=${seed}`);
}

export function allHints(board: Board): Hint[] {
  return board.hintSchedule.flat();
}

export function hintKey(h: { suspectId: SuspectId; category: CategoryId }) {
  return `${h.suspectId}:${h.category}`;
}

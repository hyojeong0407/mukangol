import { CONFIG } from '../config';
import { CATEGORIES, CATEGORY_IDS, SUSPECT_IDS, TEXTS, type CategoryId } from './data';
import { createRng, type Rng } from './rng';
import { possibleCivilians } from './solver';
import type { Board, Hint, Incident, PlannedIncident, Profile, SuspectId } from './types';

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

/** 5. 사건마다 읽을 수 있는 단서: 장소 + 나머지 다섯 중 무작위 (CONFIG.legibleClues - 1)개 */
function pickLegible(rng: Rng): CategoryId[] {
  const others = rng.shuffle(CATEGORY_IDS.filter((c) => c !== 'place'));
  const keep = new Set<CategoryId>(['place', ...others.slice(0, CONFIG.legibleClues - 1)]);
  return CATEGORY_IDS.filter((c) => keep.has(c)); // 일지 순서대로
}

/**
 * 그날 사건 일지로 공개되는 기록.
 * 그날 밤의 범인이 옥에 갇혀 있었으면 사건이 막혀 "옥사 이변"이 된다:
 * 피해자 없음, 장소를 뺀 단서만 남고, 범인은 갇혀 있던 사람 중 하나다.
 */
export function incidentRecord(board: Board, day: number, detained: readonly SuspectId[]): Incident {
  const plan = board.incidents[day - 1];
  const prevented = detained.includes(board.eventOrder[day - 1]);
  const keep = prevented ? plan.legible.filter((c) => c !== 'place') : plan.legible;
  const clues: Incident['clues'] = {};
  for (const c of keep) clues[c] = plan.clues[c];
  return prevented
    ? { day, victim: null, clues, prevented: [...detained] }
    : { day, victim: plan.victim, clues };
}

/**
 * 공정성 검사: 30개 힌트를 다 알면 사람이 누구인지 하나로 정해져야 한다.
 * 사건이 하나 막혀 옥사 이변이 된 경우(그날 밤 범인 + 다른 한 명이 갇힘)도 모두 검사한다.
 */
function isFair(board: Board): boolean {
  const hints = fullHints(board.profiles);
  const base = board.incidents.map((_, i) => incidentRecord(board, i + 1, []));
  if (possibleCivilians(base, hints).size !== 1) return false;
  for (let day = 2; day <= board.incidents.length; day++) {
    const culprit = board.eventOrder[day - 1];
    for (const other of SUSPECT_IDS) {
      if (other === culprit) continue;
      const recs = base.slice();
      recs[day - 1] = incidentRecord(board, day, [culprit, other]);
      if (possibleCivilians(recs, hints).size !== 1) return false;
    }
  }
  return true;
}

export class GenerationError extends Error {}

/**
 * 시드로 한 판을 만든다 (개발문서 5-1).
 * 같은 시드 → 같은 판. 30개 힌트를 모두 알면 사람이 누구인지 하나로 정해져야 한다 (isFair).
 * 누구를 가두고 물을지는 플레이어가 정하므로, 10개 힌트로 반드시 풀린다는 보장은 하지 않는다.
 */
export function generateBoard(seed: string): Board {
  const rng = createRng(seed);
  for (let attempts = 1; attempts <= CONFIG.maxGenerationAttempts; attempts++) {
    const civilianId = rng.pick(SUSPECT_IDS);
    const { profiles, duplicates } = assignProfiles(rng);
    const monsters = SUSPECT_IDS.filter((s) => s !== civilianId);
    const eventOrder = rng.shuffle(monsters).slice(0, CONFIG.incidentDays);
    const victims = rng.shuffle(TEXTS.victims);
    const incidents: PlannedIncident[] = eventOrder.map((s, i) => ({
      day: i + 1,
      victim: victims[i % victims.length],
      clues: { ...profiles[s] },
      legible: pickLegible(rng),
    }));
    const askOrder = makeAskOrder(rng);
    const board: Board = {
      seed,
      civilianId,
      profiles,
      eventOrder,
      incidents,
      askOrder,
      duplicates,
      attempts,
    };
    if (!isFair(board)) continue;
    return board;
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

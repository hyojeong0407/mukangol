import { CATEGORY_IDS, SUSPECT_IDS } from './data';
import type { Hint, Incident, SuspectId } from './types';

/**
 * 해 검증 풀이기 (개발문서 5-2).
 * 사건 k의 단서 c 값이 용의자 s의 힌트 (s, c, v)와 다르면 "사건 k = s"는 불가능하다.
 * 판독 불가인 단서는 비교하지 않는다. 옥사 이변이면 그날 밤 갇혀 있던 사람만 범인이 될 수 있다.
 * 사건들을 서로 다른 용의자에 대응시키는 모든 경우를 검사해 모순 없는 경우를 모은다.
 *
 * 이 규칙은 일부러 보수적이다. "값은 5명에게 1:1이므로 같은 값을 가진 다른 사람은 없다"는
 * 추가 추론을 쓰지 않으므로, 여기서 해가 하나라면 그 추론을 모르는 플레이어도 풀 수 있다.
 */
export function compatible(incident: Incident, suspectId: SuspectId, hints: readonly Hint[]): boolean {
  if (incident.prevented && !incident.prevented.includes(suspectId)) return false;
  for (const h of hints) {
    if (h.suspectId !== suspectId) continue;
    const v = incident.clues[h.category];
    if (v !== undefined && v !== h.value) return false;
  }
  return true;
}

/** 사건 k마다 가능한 용의자 목록 */
export function candidates(incidents: readonly Incident[], hints: readonly Hint[]): SuspectId[][] {
  return incidents.map((inc) => SUSPECT_IDS.filter((s) => compatible(inc, s, hints)));
}

/** 모순 없는 대응(사건 순서대로의 용의자 배열)을 limit개까지 모은다. */
export function solve(
  incidents: readonly Incident[],
  hints: readonly Hint[],
  limit = Infinity,
): SuspectId[][] {
  const cand = candidates(incidents, hints);
  const out: SuspectId[][] = [];
  const used = new Set<SuspectId>();
  const cur: SuspectId[] = [];
  const dfs = (k: number) => {
    if (out.length >= limit) return;
    if (k === incidents.length) {
      out.push(cur.slice());
      return;
    }
    for (const s of cand[k]) {
      if (used.has(s)) continue;
      used.add(s);
      cur.push(s);
      dfs(k + 1);
      cur.pop();
      used.delete(s);
    }
  };
  dfs(0);
  return out;
}

export function hasUniqueSolution(incidents: readonly Incident[], hints: readonly Hint[]): boolean {
  return solve(incidents, hints, 2).length === 1;
}

/**
 * 사건 4건이 모두 나왔을 때, 모순 없는 모든 대응에서 "사건을 일으키지 않은 1명"이 될 수 있는 사람들.
 * 크기가 1이면 사람이 누구인지 확정된다 (대응 전체가 하나로 정해지지 않아도 된다).
 */
export function possibleCivilians(incidents: readonly Incident[], hints: readonly Hint[]): Set<SuspectId> {
  const out = new Set<SuspectId>();
  for (const sol of solve(incidents, hints)) {
    for (const s of SUSPECT_IDS) if (!sol.includes(s)) out.add(s);
  }
  return out;
}

/** 해가 유일할 때 그 해에서 사건을 일으키지 않은 1명(민간인) */
export function deduceCivilian(incidents: readonly Incident[], hints: readonly Hint[]): SuspectId | null {
  const sols = solve(incidents, hints, 2);
  if (sols.length !== 1) return null;
  const used = new Set(sols[0]);
  const rest = SUSPECT_IDS.filter((s) => !used.has(s));
  return rest.length === 1 ? rest[0] : null;
}

/** 힌트가 프로필과 모순되지 않는지 (데이터 무결성 검사용) */
export function hintsAreTrue(profiles: Record<SuspectId, Record<string, string>>, hints: readonly Hint[]) {
  return hints.every((h) => profiles[h.suspectId]?.[h.category] === h.value);
}

export { CATEGORY_IDS };

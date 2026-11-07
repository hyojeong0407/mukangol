import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { CATEGORIES, CATEGORY_IDS, SUSPECT_IDS } from '../../src/core/data';
import { advance, ask, askableSuspects, newGame, toggleDetain, victimCount } from '../../src/core/game';
import { fullHints, generateBoard, incidentRecord } from '../../src/core/generate';
import { candidates, hintsAreTrue, possibleCivilians } from '../../src/core/solver';
import type { GameState } from '../../src/core/types';

/**
 * 공정성 시뮬레이션 (개발문서 10장): 시드 N판을 만들어 규칙 위반이 0건인지 확인한다.
 * SIM_N 환경 변수로 판 수를 바꿀 수 있다. (기본 10,000판)
 *
 * 누구를 가두고 물을지는 플레이어가 정하므로 "10개 힌트로 반드시 풀린다"는 보장은 없다.
 * 대신 합리적인 플레이어가 논리만으로 사람을 가려내는 비율을 난이도 지표로 재고,
 * 너무 쉬워지거나(예전: 99%) 너무 어려워지지 않도록 범위를 검사한다.
 */
const N = Number(process.env.SIM_N ?? 10_000);

/**
 * 합리적인 플레이어: 매일 오전·밤에, 이미 어떤 사건의 유일한 범인 후보로 밝혀진 자를 빼고
 * 가장 덜 물어본 두 명을 가둔다. 오후에는 갇힌 둘에게 하나씩 묻는다.
 * 사람이 누구인지 논리로 하나로 정해진 일차(없으면 0)와 희생자 수를 돌려준다.
 */
function sensiblePlayer(seed: string): { solvedDay: number; victims: number; candidatesLeft: number } {
  let s: GameState = newGame(seed, 0);
  let turn = 0;
  let solvedDay = 0;
  const choose = () => {
    const asked = (id: string) => s.interrogationLog.filter((h) => h.suspectId === id).length;
    const explained = new Set(
      candidates(s.incidentLog, s.interrogationLog)
        .filter((c) => c.length === 1)
        .map((c) => c[0]),
    );
    const open = SUSPECT_IDS.filter((x) => asked(x) < CATEGORY_IDS.length);
    const pool = open.filter((x) => !explained.has(x));
    const rot = (x: string) => (SUSPECT_IDS.indexOf(x) + turn) % SUSPECT_IDS.length;
    const pick = (pool.length >= 2 ? pool : open).sort((a, b) => asked(a) - asked(b) || rot(a) - rot(b));
    for (const id of [...s.detained]) s = toggleDetain(s, id, 0);
    for (const id of pick.slice(0, CONFIG.maxDetained)) s = toggleDetain(s, id, 0);
    turn++;
  };
  while (s.phase !== 'final') {
    if (s.phase === 'morning' || s.phase === 'night') choose();
    if (s.phase === 'afternoon') {
      while (s.questionPoints > 0 && askableSuspects(s).length) {
        const today = s.interrogationLog.filter((h) => h.day === s.day).map((h) => h.suspectId);
        const next = askableSuspects(s).find((x) => !today.includes(x)) ?? askableSuspects(s)[0];
        s = ask(s, next, 0);
      }
      if (!solvedDay && s.incidentLog.length === CONFIG.incidentDays)
        if (possibleCivilians(s.incidentLog, s.interrogationLog).size === 1) solvedDay = s.day;
    }
    s = advance(s, 0);
  }
  return {
    solvedDay,
    victims: victimCount(s),
    candidatesLeft: possibleCivilians(s.incidentLog, s.interrogationLog).size,
  };
}

describe(`시뮬레이션 ${N}판`, () => {
  it('값 겹침 규칙, 판독 규칙, 전체 힌트로 사람이 하나로 정해짐, 심문 순서, 민간인 무작위성', () => {
    const violations: string[] = [];
    const civCount = new Map<string, number>();
    const dupCount = new Map<number, number>();

    for (let i = 0; i < N; i++) {
      const seed = `SIM-${i}`;
      const b = generateBoard(seed);
      const all = fullHints(b.profiles);
      civCount.set(b.civilianId, (civCount.get(b.civilianId) ?? 0) + 1);
      dupCount.set(b.duplicates.length, (dupCount.get(b.duplicates.length) ?? 0) + 1);

      const recs = b.incidents.map((inc) => incidentRecord(b, inc.day, []));
      const civs = [...possibleCivilians(recs, all)];
      if (civs.length !== 1 || civs[0] !== b.civilianId)
        violations.push(`${seed}: 사람 후보 ${civs.length}명`);
      if (!hintsAreTrue(b.profiles, all)) violations.push(`${seed}: 거짓 힌트`);
      if (b.duplicates.length < CONFIG.duplicates.min || b.duplicates.length > CONFIG.duplicates.max)
        violations.push(`${seed}: 겹침 ${b.duplicates.length}곳`);
      for (const cat of CATEGORIES) {
        const distinct = new Set(SUSPECT_IDS.map((s) => b.profiles[s][cat.id])).size;
        const dups = b.duplicates.filter((d) => d.category === cat.id).length;
        if (dups > 1 || distinct !== 5 - dups) violations.push(`${seed}: ${cat.id} 값 ${distinct}종`);
      }
      for (const inc of b.incidents)
        if (inc.legible.length !== CONFIG.legibleClues || !inc.legible.includes('place'))
          violations.push(`${seed}: ${inc.day}일차 판독 단서 ${inc.legible.join(',')}`);
      for (const s of SUSPECT_IDS)
        if ([...b.askOrder[s]].sort().join() !== [...CATEGORY_IDS].sort().join())
          violations.push(`${seed}: ${s} 심문 순서 오류`);
    }

    console.info('[sim] 민간인 분포', Object.fromEntries(civCount));
    console.info('[sim] 값 겹침 수 분포', Object.fromEntries([...dupCount].sort()));
    expect(violations.slice(0, 10)).toEqual([]);
    for (const s of SUSPECT_IDS) expect(civCount.get(s) ?? 0).toBeGreaterThan(N * 0.15);
    for (let k = CONFIG.duplicates.min; k <= CONFIG.duplicates.max; k++)
      expect(dupCount.get(k) ?? 0).toBeGreaterThan(0);
  }, 120_000);

  it('난이도: 합리적인 플레이어가 논리만으로 사람을 가려내는 비율이 너무 높거나 낮지 않다', () => {
    const M = Math.min(N, 2000);
    const solvedOn = new Map<number, number>();
    const victims = new Map<number, number>();
    let solved = 0;
    let byDay4 = 0;
    let winIfGuess = 0;
    for (let i = 0; i < M; i++) {
      const r = sensiblePlayer(`BAL-${i}`);
      solvedOn.set(r.solvedDay, (solvedOn.get(r.solvedDay) ?? 0) + 1);
      victims.set(r.victims, (victims.get(r.victims) ?? 0) + 1);
      if (r.solvedDay) solved++;
      if (r.solvedDay && r.solvedDay <= CONFIG.incidentDays) byDay4++;
      winIfGuess += 1 / Math.max(1, r.candidatesLeft);
    }
    const pct = (x: number) => Math.round((x / M) * 1000) / 10;
    console.info(
      `[sim] 합리적 플레이어 ${M}판: 논리로 확정 ${pct(solved)}%, 4일차까지 확정 ${pct(byDay4)}%,` +
        ` 남은 후보 중 찍기 포함 승률 ${pct(winIfGuess)}%`,
    );
    console.info('[sim] 확정된 일차 (0 = 끝까지 못 좁힘)', Object.fromEntries([...solvedOn].sort()));
    console.info('[sim] 희생자 수 분포', Object.fromEntries([...victims].sort()));
    // v0.4까지는 무작위로 물어도 99% 이상이 4일차에 풀렸다 → 너무 쉬움
    expect(pct(solved)).toBeGreaterThan(60);
    expect(pct(solved)).toBeLessThan(92);
    expect(pct(byDay4)).toBeLessThan(75);
  }, 120_000);
});

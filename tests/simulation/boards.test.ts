import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { CATEGORIES, CATEGORY_IDS, SUSPECT_IDS } from '../../src/core/data';
import { advance, ask, askableSuspects, newGame } from '../../src/core/game';
import { fullHints, generateBoard } from '../../src/core/generate';
import { createRng } from '../../src/core/rng';
import { hintsAreTrue, solve } from '../../src/core/solver';
import type { GameState } from '../../src/core/types';

/**
 * 공정성 시뮬레이션 (개발문서 10장): 시드 N판을 만들어 규칙 위반이 0건인지 확인한다.
 * SIM_N 환경 변수로 판 수를 바꿀 수 있다. (기본 10,000판)
 *
 * 질문할 요괴는 플레이어가 고르므로 "11개 힌트로 반드시 풀린다"는 보장은 없다.
 * 대신 무작위로 고르는 플레이어가 끝까지 해를 좁히는 비율을 밸런스 지표로 출력한다.
 */
const N = Number(process.env.SIM_N ?? 10_000);

/** 무작위로 요괴를 골라 5일을 진행하고, 해가 하나로 좁혀진 일차(없으면 0)를 돌려준다 */
function randomPlayer(seed: string): number {
  const rng = createRng(`P-${seed}`);
  let s: GameState = newGame(seed, 0);
  let solvedDay = 0;
  while (s.phase !== 'final') {
    if (s.phase === 'afternoon') {
      while (s.questionPoints > 0) s = ask(s, rng.pick(askableSuspects(s)), 0);
      if (
        !solvedDay &&
        s.day >= CONFIG.incidentDays &&
        solve(s.incidentLog, s.interrogationLog, 2).length === 1
      )
        solvedDay = s.day;
    }
    s = advance(s, 0);
  }
  return solvedDay;
}

describe(`시뮬레이션 ${N}판`, () => {
  it('값 겹침 규칙, 전체 힌트로 해가 유일, 심문 순서, 민간인 무작위성', () => {
    const violations: string[] = [];
    const civCount = new Map<string, number>();
    const dupCount = new Map<number, number>();

    for (let i = 0; i < N; i++) {
      const seed = `SIM-${i}`;
      const b = generateBoard(seed);
      const all = fullHints(b.profiles);
      civCount.set(b.civilianId, (civCount.get(b.civilianId) ?? 0) + 1);
      dupCount.set(b.duplicates.length, (dupCount.get(b.duplicates.length) ?? 0) + 1);

      const sols = solve(b.incidents, all);
      if (sols.length !== 1 || sols[0].join() !== b.eventOrder.join())
        violations.push(`${seed}: 해 ${sols.length}개`);
      if (!hintsAreTrue(b.profiles, all)) violations.push(`${seed}: 거짓 힌트`);
      if (b.duplicates.length < CONFIG.duplicates.min || b.duplicates.length > CONFIG.duplicates.max)
        violations.push(`${seed}: 겹침 ${b.duplicates.length}곳`);
      for (const cat of CATEGORIES) {
        const distinct = new Set(SUSPECT_IDS.map((s) => b.profiles[s][cat.id])).size;
        const dups = b.duplicates.filter((d) => d.category === cat.id).length;
        if (dups > 1 || distinct !== 5 - dups) violations.push(`${seed}: ${cat.id} 값 ${distinct}종`);
      }
      for (const s of SUSPECT_IDS)
        if ([...b.askOrder[s]].sort().join() !== [...CATEGORY_IDS].sort().join())
          violations.push(`${seed}: ${s} 심문 순서 오류`);
    }

    // 밸런스 지표 (2,000판): 무작위로 고르는 플레이어
    const M = Math.min(N, 2000);
    const solvedOn = new Map<number, number>();
    for (let i = 0; i < M; i++) {
      const d = randomPlayer(`BAL-${i}`);
      solvedOn.set(d, (solvedOn.get(d) ?? 0) + 1);
    }

    console.info('[sim] 민간인 분포', Object.fromEntries(civCount));
    console.info('[sim] 값 겹침 수 분포', Object.fromEntries([...dupCount].sort()));
    console.info(
      '[sim] 무작위 선택 플레이어: 해가 하나로 좁혀진 일차 (0 = 끝까지 못 좁힘)',
      Object.fromEntries([...solvedOn].sort()),
    );

    expect(violations.slice(0, 10)).toEqual([]);
    for (const s of SUSPECT_IDS) expect(civCount.get(s) ?? 0).toBeGreaterThan(N * 0.15);
    for (let k = CONFIG.duplicates.min; k <= CONFIG.duplicates.max; k++)
      expect(dupCount.get(k) ?? 0).toBeGreaterThan(0);
  }, 120_000);
});

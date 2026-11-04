import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { SUSPECT_IDS } from '../../src/core/data';
import { allHints, generateBoard } from '../../src/core/generate';
import { hintsAreTrue, solve } from '../../src/core/solver';

/**
 * 공정성 시뮬레이션 (개발문서 10장): 시드 N판을 만들어 규칙 위반이 0건인지 확인한다.
 * SIM_N 환경 변수로 판 수를 바꿀 수 있다. (기본 10,000판)
 */
const N = Number(process.env.SIM_N ?? 10_000);

describe(`시뮬레이션 ${N}판`, () => {
  it('해의 유일성, 힌트 보장, 1~2일차 편중 제한, 민간인 무작위성', () => {
    const violations: string[] = [];
    const civCount = new Map<string, number>();
    const uniqueByDay = new Map<number, number>();
    let maxAttempts = 0;

    for (let i = 0; i < N; i++) {
      const seed = `SIM-${i}`;
      const b = generateBoard(seed);
      const hints = allHints(b);
      maxAttempts = Math.max(maxAttempts, b.attempts);
      civCount.set(b.civilianId, (civCount.get(b.civilianId) ?? 0) + 1);

      const sols = solve(b.incidents, hints);
      if (sols.length !== 1 || sols[0].join() !== b.eventOrder.join())
        violations.push(`${seed}: 해 ${sols.length}개`);
      if (!hintsAreTrue(b.profiles, hints)) violations.push(`${seed}: 거짓 힌트`);
      for (const s of SUSPECT_IDS) {
        const n = hints.filter((h) => h.suspectId === s).length;
        if (n < CONFIG.minHintsPerSuspect) violations.push(`${seed}: ${s} 힌트 ${n}개`);
      }
      const early = b.hintSchedule.slice(0, 2).flat();
      for (const s of SUSPECT_IDS) {
        if (early.filter((h) => h.suspectId === s).length > CONFIG.maxEarlyHintsPerSuspect)
          violations.push(`${seed}: 1~2일차 ${s} 편중`);
      }

      // 밸런스 지표: 4일차까지의 사건 4건이 며칠째 힌트까지 모여야 하나로 풀리는가
      for (let d = 1; d <= CONFIG.totalDays; d++) {
        if (solve(b.incidents, b.hintSchedule.slice(0, d).flat(), 2).length === 1) {
          uniqueByDay.set(d, (uniqueByDay.get(d) ?? 0) + 1);
          break;
        }
      }
    }

    console.info('[sim] 민간인 분포', Object.fromEntries(civCount));
    console.info('[sim] 해가 처음 하나로 좁혀지는 일차 분포', Object.fromEntries([...uniqueByDay].sort()));
    console.info('[sim] 최대 생성 시도 횟수', maxAttempts);

    expect(violations.slice(0, 10)).toEqual([]);
    for (const s of SUSPECT_IDS) expect(civCount.get(s) ?? 0).toBeGreaterThan(N * 0.15);
  }, 120_000);
});

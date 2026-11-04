import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { CATEGORIES, CATEGORY_IDS, SUSPECT_IDS } from '../../src/core/data';
import {
  advance,
  ask,
  canAdvance,
  cycleMark,
  execute,
  judge,
  newGame,
  RuleError,
  toggleDetain,
} from '../../src/core/game';
import { allHints, generateBoard } from '../../src/core/generate';
import { createRng } from '../../src/core/rng';
import { deduceCivilian, hintsAreTrue, solve } from '../../src/core/solver';
import type { GameState } from '../../src/core/types';

describe('rng', () => {
  it('같은 시드는 같은 수열', () => {
    const a = createRng('ABCD-1234');
    const b = createRng('ABCD-1234');
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(Array.from({ length: 20 }, () => b.next()));
  });
  it('shuffle은 원소를 보존', () => {
    const r = createRng('x');
    expect(r.shuffle([1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('generateBoard', () => {
  const b = generateBoard('TEST-SEED');
  it('같은 시드는 같은 판', () => {
    expect(generateBoard('TEST-SEED')).toEqual(b);
  });
  it('단서 종류마다 값이 5명에게 1:1 배정', () => {
    for (const cat of CATEGORIES) {
      const vals = SUSPECT_IDS.map((s) => b.profiles[s][cat.id]).sort();
      expect(vals).toEqual(cat.values.map((v) => v.id).sort());
    }
  });
  it('사건 4건은 민간인을 뺀 서로 다른 요괴 4명', () => {
    expect(b.eventOrder).toHaveLength(4);
    expect(new Set(b.eventOrder).size).toBe(4);
    expect(b.eventOrder).not.toContain(b.civilianId);
    b.incidents.forEach((inc, i) => expect(inc.clues).toEqual(b.profiles[b.eventOrder[i]]));
  });
  it('힌트 20개, 하루 4개, 모두 참, 중복 없음, 용의자마다 3개 이상', () => {
    const hints = allHints(b);
    expect(hints).toHaveLength(CONFIG.totalHints);
    b.hintSchedule.forEach((d) => expect(d).toHaveLength(CONFIG.questionPointsPerDay));
    expect(hintsAreTrue(b.profiles, hints)).toBe(true);
    expect(new Set(hints.map((h) => `${h.suspectId}:${h.category}`)).size).toBe(hints.length);
    for (const s of SUSPECT_IDS)
      expect(hints.filter((h) => h.suspectId === s).length).toBeGreaterThanOrEqual(3);
  });
  it('해가 유일하고 민간인을 가리킨다', () => {
    expect(solve(b.incidents, allHints(b))).toEqual([b.eventOrder]);
    expect(deduceCivilian(b.incidents, allHints(b))).toBe(b.civilianId);
  });
});

function playToFinal(seed: string): GameState {
  let s = newGame(seed, 0);
  while (s.phase !== 'final') {
    if (s.phase === 'afternoon') for (const q of [...s.pendingQuestions]) s = ask(s, q, 0);
    s = advance(s, 0);
  }
  return s;
}

describe('상태 머신', () => {
  it('5일 흐름과 공개되는 기록', () => {
    const s = playToFinal('FLOW');
    expect(s.day).toBe(5);
    expect(s.incidentLog).toHaveLength(4);
    expect(s.interrogationLog).toHaveLength(20);
  });
  it('질문 포인트를 다 쓰기 전에는 오후를 넘길 수 없다', () => {
    let s = newGame('P', 0);
    s = advance(advance(s)); // dawn → morning → afternoon
    expect(s.phase).toBe('afternoon');
    expect(canAdvance(s).ok).toBe(false);
    expect(() => advance(s)).toThrow(RuleError);
    s = ask(s, 2);
    expect(s.questionPoints).toBe(3);
    expect(() => ask(s, 2)).toThrow(RuleError);
  });
  it('구속은 밤에만, 상한 적용', () => {
    let s = newGame('D', 0);
    expect(() => toggleDetain(s, SUSPECT_IDS[0])).toThrow(RuleError);
    s = advance(advance(s));
    for (const q of [...s.pendingQuestions]) s = ask(s, q);
    s = advance(s);
    expect(s.phase).toBe('night');
    for (let i = 0; i < CONFIG.maxDetained; i++) s = toggleDetain(s, SUSPECT_IDS[i]);
    if (CONFIG.maxDetained < SUSPECT_IDS.length)
      expect(() => toggleDetain(s, SUSPECT_IDS[CONFIG.maxDetained])).toThrow(RuleError);
    s = toggleDetain(s, SUSPECT_IDS[0]);
    expect(s.detained).not.toContain(SUSPECT_IDS[0]);
  });
  it('판정: 정답이면 해피, 민간인 포함이면 게임 오버', () => {
    const s = playToFinal('JUDGE');
    const monsters = SUSPECT_IDS.filter((x) => x !== s.board.civilianId);
    expect(execute(s, monsters).ending).toBe('happy');
    const wrong = [s.board.civilianId, ...monsters.slice(0, 3)];
    expect(execute(s, wrong).ending).toBe('game_over');
    expect(() => execute(s, monsters.slice(0, 3))).toThrow(RuleError);
    expect(judge('a', ['b', 'c', 'd', 'e'])).toBe('happy');
  });
  it('기록판 표시 순환', () => {
    expect(cycleMark(undefined)).toBe('possible');
    expect(cycleMark('possible')).toBe('impossible');
    expect(cycleMark('impossible')).toBe('confirmed');
    expect(cycleMark('confirmed')).toBe('');
  });
  it('CATEGORY_IDS와 데이터가 일치', () => {
    expect(CATEGORIES.map((c) => c.id)).toEqual(CATEGORY_IDS);
    CATEGORIES.forEach((c) => expect(c.values).toHaveLength(5));
  });
});

import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { CATEGORIES, CATEGORY_IDS, SUSPECT_IDS } from '../../src/core/data';
import {
  advance,
  ask,
  askableSuspects,
  canAdvance,
  cycleMark,
  execute,
  judge,
  newGame,
  RuleError,
  toggleDetain,
} from '../../src/core/game';
import { fullHints, generateBoard } from '../../src/core/generate';
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
  it('값 겹침은 1~3곳, 서로 다른 단서 종류에서 두 요괴가 같은 값을 쓴다', () => {
    expect(b.duplicates.length).toBeGreaterThanOrEqual(CONFIG.duplicates.min);
    expect(b.duplicates.length).toBeLessThanOrEqual(CONFIG.duplicates.max);
    expect(new Set(b.duplicates.map((d) => d.category)).size).toBe(b.duplicates.length);
    for (const cat of CATEGORIES) {
      const vals = SUSPECT_IDS.map((s) => b.profiles[s][cat.id]);
      const dup = b.duplicates.find((d) => d.category === cat.id);
      expect(new Set(vals).size).toBe(dup ? 4 : 5);
      if (dup) for (const s of dup.suspects) expect(b.profiles[s][cat.id]).toBe(dup.value);
      for (const v of vals) expect(cat.values.map((x) => x.id)).toContain(v);
    }
  });
  it('사건 4건은 민간인을 뺀 서로 다른 요괴 4명', () => {
    expect(b.eventOrder).toHaveLength(4);
    expect(new Set(b.eventOrder).size).toBe(4);
    expect(b.eventOrder).not.toContain(b.civilianId);
    b.incidents.forEach((inc, i) => expect(inc.clues).toEqual(b.profiles[b.eventOrder[i]]));
  });
  it('요괴마다 심문 순서는 6종 단서의 순열', () => {
    for (const s of SUSPECT_IDS) expect([...b.askOrder[s]].sort()).toEqual([...CATEGORY_IDS].sort());
  });
  it('30개 힌트를 모두 알면 해가 유일하고 민간인을 가리킨다', () => {
    const all = fullHints(b.profiles);
    expect(hintsAreTrue(b.profiles, all)).toBe(true);
    expect(solve(b.incidents, all)).toEqual([b.eventOrder]);
    expect(deduceCivilian(b.incidents, all)).toBe(b.civilianId);
  });
});

function playToFinal(seed: string): GameState {
  let s = newGame(seed, 0);
  while (s.phase !== 'final') {
    if (s.phase === 'afternoon') while (s.questionPoints > 0) s = ask(s, askableSuspects(s)[0], 0);
    s = advance(s, 0);
  }
  return s;
}

describe('상태 머신', () => {
  it('5일 흐름과 공개되는 기록', () => {
    const s = playToFinal('FLOW');
    expect(s.day).toBe(5);
    expect(s.incidentLog).toHaveLength(4);
    expect(s.interrogationLog).toHaveLength(CONFIG.questionsByDay.reduce((a, b) => a + b, 0));
  });
  it('질문 포인트를 다 쓰기 전에는 오후를 넘길 수 없다', () => {
    let s = newGame('P', 0);
    s = advance(advance(s)); // dawn → morning → afternoon
    expect(s.phase).toBe('afternoon');
    expect(canAdvance(s).ok).toBe(false);
    expect(() => advance(s)).toThrow(RuleError);
    expect(s.questionPoints).toBe(CONFIG.questionsByDay[0]);
    const id = SUSPECT_IDS[0];
    s = ask(s, id);
    s = ask(s, id); // 같은 요괴를 다시 골라도 다른 수법이 나온다
    expect(s.questionPoints).toBe(0);
    const got = s.interrogationLog.map((h) => h.category);
    expect(got).toEqual(s.board.askOrder[id].slice(0, 2));
    expect(new Set(got).size).toBe(2);
    for (const h of s.interrogationLog) expect(h.value).toBe(s.board.profiles[id][h.category]);
    expect(() => ask(s, id)).toThrow(RuleError); // 포인트 없음
    expect(canAdvance(s).ok).toBe(true);
  });
  it('한 요괴의 수법 6가지를 다 들으면 그 요괴는 더 물을 수 없다', () => {
    let s = advance(advance(newGame('EXHAUST', 0)));
    const id = SUSPECT_IDS[1];
    s = { ...s, questionPoints: 10 };
    for (let i = 0; i < CATEGORY_IDS.length; i++) s = ask(s, id);
    expect(new Set(s.interrogationLog.map((h) => h.category)).size).toBe(CATEGORY_IDS.length);
    expect(askableSuspects(s)).not.toContain(id);
    expect(() => ask(s, id)).toThrow(RuleError);
  });
  it('구속은 밤에만, 상한 적용', () => {
    let s = newGame('D', 0);
    expect(() => toggleDetain(s, SUSPECT_IDS[0])).toThrow(RuleError);
    s = advance(advance(s));
    while (s.questionPoints > 0) s = ask(s, askableSuspects(s)[0]);
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

import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { CATEGORIES, CATEGORY_IDS, SUSPECT_IDS } from '../../src/core/data';
import {
  advance,
  ask,
  askableSuspects,
  canAdvance,
  cycleMark,
  endingKind,
  execute,
  judge,
  newGame,
  preventedCount,
  RuleError,
  toggleDetain,
  victimCount,
} from '../../src/core/game';
import { fullHints, generateBoard, incidentRecord } from '../../src/core/generate';
import { createRng } from '../../src/core/rng';
import { compatible, hintsAreTrue, possibleCivilians } from '../../src/core/solver';
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
  it('값 겹침은 CONFIG.duplicates 범위, 서로 다른 단서 종류에서 두 요괴가 같은 값을 쓴다', () => {
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
  it('사건마다 읽을 수 있는 단서는 장소 포함 CONFIG.legibleClues개, 나머지는 판독 불가', () => {
    for (const inc of b.incidents) {
      expect(inc.legible).toHaveLength(CONFIG.legibleClues);
      expect(inc.legible).toContain('place');
      const rec = incidentRecord(b, inc.day, []);
      expect(Object.keys(rec.clues).sort()).toEqual([...inc.legible].sort());
      for (const c of inc.legible) expect(rec.clues[c]).toBe(inc.clues[c]);
      expect(rec.victim).toBe(inc.victim);
      expect(rec.prevented).toBeUndefined();
    }
  });
  it('요괴마다 심문 순서는 6종 단서의 순열', () => {
    for (const s of SUSPECT_IDS) expect([...b.askOrder[s]].sort()).toEqual([...CATEGORY_IDS].sort());
  });
  it('30개 힌트를 모두 알면 사람이 누구인지 하나로 정해진다 (판독 불가가 있어도)', () => {
    const all = fullHints(b.profiles);
    expect(hintsAreTrue(b.profiles, all)).toBe(true);
    const recs = b.incidents.map((inc) => incidentRecord(b, inc.day, []));
    expect([...possibleCivilians(recs, all)]).toEqual([b.civilianId]);
  });
  it('풀이기: 판독 불가 단서는 비교하지 않고, 옥사 이변은 갇혀 있던 자만 범인이 될 수 있다', () => {
    const inc = { day: 2, victim: null, clues: { place: 'river' }, prevented: ['mul', 'mukjip'] };
    const hint = { suspectId: 'mul', category: 'corpse' as const, value: 'anything' };
    expect(compatible(inc, 'mul', [hint])).toBe(true); // 훼손은 판독 불가라 모순이 아니다
    expect(compatible(inc, 'beomgol', [])).toBe(false); // 갇혀 있지 않았다
    expect(compatible(inc, 'mul', [{ suspectId: 'mul', category: 'place', value: 'mountain' }])).toBe(false);
  });
});

/** 오전에 두 명을 가두고 오후에 그들에게 묻는 식으로 5일차 처형장까지 */
function playToFinal(
  seed: string,
  pick = (day: number) => [SUSPECT_IDS[day % 5], SUSPECT_IDS[(day + 1) % 5]],
) {
  let s = newGame(seed, 0);
  while (s.phase !== 'final') {
    if (s.phase === 'morning' || s.phase === 'night') {
      for (const id of [...s.detained]) s = toggleDetain(s, id, 0);
      for (const id of pick(s.day + (s.phase === 'night' ? 1 : 0))) s = toggleDetain(s, id, 0);
    }
    if (s.phase === 'afternoon')
      while (s.questionPoints > 0 && askableSuspects(s).length) s = ask(s, askableSuspects(s)[0], 0);
    s = advance(s, 0);
  }
  return s;
}

/** 오전까지 진행하고 두 명을 가둔다 */
function morningWith(seed: string, ids: string[]): GameState {
  let s = advance(newGame(seed, 0)); // dawn → morning
  for (const id of ids) s = toggleDetain(s, id);
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
    let s = advance(morningWith('P', [SUSPECT_IDS[0]])); // 오전에 가두고 → 오후
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
    const id = SUSPECT_IDS[1];
    let s = advance(morningWith('EXHAUST', [id]));
    s = { ...s, questionPoints: 10 };
    for (let i = 0; i < CATEGORY_IDS.length; i++) s = ask(s, id);
    expect(new Set(s.interrogationLog.map((h) => h.category)).size).toBe(CATEGORY_IDS.length);
    expect(askableSuspects(s)).not.toContain(id);
    expect(() => ask(s, id)).toThrow(RuleError);
  });
  it('갇힌 자만 심문할 수 있고, 옥이 비면 오후를 그냥 넘긴다', () => {
    let s = advance(morningWith('ONLY', [SUSPECT_IDS[0]]));
    expect(() => ask(s, SUSPECT_IDS[3])).toThrow(RuleError);
    expect(askableSuspects(s)).toEqual([SUSPECT_IDS[0]]);
    s = advance(advance(newGame('EMPTY', 0))); // 아무도 가두지 않음
    expect(askableSuspects(s)).toEqual([]);
    expect(canAdvance(s).ok).toBe(true);
  });
  it('구속은 오전과 밤에만, 옥사 칸 수만큼', () => {
    let s = newGame('D', 0);
    expect(() => toggleDetain(s, SUSPECT_IDS[0])).toThrow(RuleError); // 새벽
    s = advance(s);
    expect(s.phase).toBe('morning');
    s = toggleDetain(toggleDetain(s, SUSPECT_IDS[3]), SUSPECT_IDS[3]); // 오전에는 가두고 풀 수 있다
    s = toggleDetain(s, SUSPECT_IDS[0]);
    s = advance(s);
    expect(() => toggleDetain(s, SUSPECT_IDS[1])).toThrow(RuleError); // 오후
    while (s.questionPoints > 0) s = ask(s, askableSuspects(s)[0]);
    s = advance(s);
    expect(s.phase).toBe('night');
    s = toggleDetain(s, SUSPECT_IDS[0]);
    for (let i = 0; i < CONFIG.maxDetained; i++) s = toggleDetain(s, SUSPECT_IDS[i]);
    if (CONFIG.maxDetained < SUSPECT_IDS.length)
      expect(() => toggleDetain(s, SUSPECT_IDS[CONFIG.maxDetained])).toThrow(RuleError);
    s = toggleDetain(s, SUSPECT_IDS[0]);
    expect(s.detained).not.toContain(SUSPECT_IDS[0]);
  });
  it('갇힌 요괴는 그날 밤 사건을 못 일으킨다: 옥사 이변 (희생자 없음, 장소 없음)', () => {
    let s = advance(morningWith('JAIL', []));
    s = advance(s); // 오후(옥 비어 있음) → 밤
    expect(s.phase).toBe('night');
    const culprit = s.board.eventOrder[1];
    const other = SUSPECT_IDS.find((x) => x !== culprit)!;
    s = toggleDetain(toggleDetain(s, culprit), other);
    s = advance(advance(s)); // → 2일차 새벽 → 오전
    const rec = s.incidentLog.find((x) => x.day === 2)!;
    expect(rec.victim).toBeNull();
    expect(rec.prevented).toEqual([culprit, other]);
    expect(rec.clues.place).toBeUndefined();
    const plan = s.board.incidents[1];
    expect(Object.keys(rec.clues).sort()).toEqual(plan.legible.filter((c) => c !== 'place').sort());
    expect(victimCount(s)).toBe(1);
    expect(preventedCount(s)).toBe(1);
  });
  it('판정: 정답이면 해피, 민간인 포함이면 게임 오버. 희생자가 넷이면 씁쓸한 엔딩', () => {
    // 범인을 한 번도 가두지 않도록 민간인만 가둔다 → 희생자 4
    const civ = generateBoard('JUDGE').civilianId;
    const s = playToFinal('JUDGE', () => [civ]);
    expect(victimCount(s)).toBe(4);
    const monsters = SUSPECT_IDS.filter((x) => x !== s.board.civilianId);
    expect(execute(s, monsters).ending).toBe('happy');
    expect(endingKind(execute(s, monsters))).toBe(CONFIG.bitterVictims <= 4 ? 'bitter' : 'happy');
    // 2일차 범인을 가둬 한 건을 막으면 희생자 3 → 해피
    const b = generateBoard('JUDGE');
    const saved = playToFinal('JUDGE', (day) => (day === 2 ? [b.eventOrder[1]] : [civ]));
    expect(victimCount(saved)).toBe(3);
    expect(endingKind(execute(saved, monsters))).toBe('happy');
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

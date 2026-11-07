import { CONFIG } from '../config';
import { SUSPECT_IDS, type CategoryId } from './data';
import { generateBoard, incidentRecord } from './generate';
import type { Ending, GameState, Mark, Phase, SuspectId } from './types';

/**
 * 하루 진행 상태 머신 (개발문서 5-3). 모든 함수는 순수 함수로 새 상태를 돌려준다.
 * 저장·화면 갱신 같은 부작용은 바깥 계층(state/, ui/)에서 처리한다.
 *
 * 1~4일차: dawn → morning(사건 일지 공개, 구속) → afternoon(갇힌 자 심문) → night(구속) → 다음 날 dawn
 * 5일차:   dawn(사건 없음) → afternoon(오전 심문) → final(처형) → 엔딩
 * 질문 포인트는 CONFIG.questionsByDay (매일 2개).
 * 옥사는 CONFIG.maxDetained칸. 심문은 갇힌 사람에게만 할 수 있고,
 * 그날 밤의 범인이 갇혀 있으면 다음 날 사건 대신 옥사 이변이 기록된다 (희생자 없음).
 */

export class RuleError extends Error {}

const clone = <T>(x: T): T => structuredClone(x);

export function newGame(seed: string, now = Date.now()): GameState {
  const board = generateBoard(seed);
  return {
    version: CONFIG.saveVersion,
    seed,
    board,
    day: 1,
    phase: 'dawn',
    incidentLog: [],
    interrogationLog: [],
    questionPoints: 0,
    detained: [],
    executed: [],
    notes: { marks: {}, culprits: {} },
    ending: null,
    startedAt: now,
    updatedAt: now,
  };
}

export const isFinalDay = (s: GameState) => s.day === CONFIG.totalDays;

/** 다음 단계로 넘어갈 수 있는지와 그 이유 */
export function canAdvance(s: GameState): { ok: boolean; reason?: string } {
  if (s.ending) return { ok: false, reason: '이미 끝난 판입니다.' };
  if (s.phase === 'afternoon' && s.questionPoints > 0 && askableSuspects(s).length > 0)
    return { ok: false, reason: '질문 포인트를 모두 써야 합니다.' };
  if (s.phase === 'final') return { ok: false, reason: '처형할 4명을 지목하세요.' };
  return { ok: true };
}

export function nextPhaseOf(s: GameState): { day: number; phase: Phase } {
  switch (s.phase) {
    case 'dawn':
      return isFinalDay(s) ? { day: s.day, phase: 'afternoon' } : { day: s.day, phase: 'morning' };
    case 'morning':
      return { day: s.day, phase: 'afternoon' };
    case 'afternoon':
      return isFinalDay(s) ? { day: s.day, phase: 'final' } : { day: s.day, phase: 'night' };
    case 'night':
      return { day: s.day + 1, phase: 'dawn' };
    case 'final':
      return { day: s.day, phase: 'final' };
  }
}

export function advance(prev: GameState, now = Date.now()): GameState {
  const check = canAdvance(prev);
  if (!check.ok) throw new RuleError(check.reason);
  const s = clone(prev);
  const next = nextPhaseOf(s);
  s.day = next.day;
  s.phase = next.phase;
  if (s.phase === 'morning') {
    // 지난밤 옥에 갇혀 있던 사람으로 사건이 막혔는지 정해진다 (1일차는 아직 아무도 갇히지 않았다)
    if (s.board.incidents[s.day - 1] && !s.incidentLog.some((x) => x.day === s.day))
      s.incidentLog.push(incidentRecord(s.board, s.day, s.detained));
  }
  if (s.phase === 'afternoon') {
    s.questionPoints = CONFIG.questionsByDay[s.day - 1] ?? 0;
  }
  s.updatedAt = now;
  return s;
}

/** 이 요괴에게서 이미 나온 수법 종류 수 */
export const askedCount = (s: GameState, id: SuspectId) =>
  s.interrogationLog.filter((h) => h.suspectId === id).length;

/** 이 요괴에게서 아직 나오지 않은 수법 종류 수 (0이면 더 물을 것이 없다) */
export const remainingFor = (s: GameState, id: SuspectId) => s.board.askOrder[id].length - askedCount(s, id);

/** 지금 물을 수 있는 요괴: 옥에 갇혀 있고 아직 캐낼 것이 남은 자 */
export const askableSuspects = (s: GameState) =>
  SUSPECT_IDS.filter((id) => s.detained.includes(id) && remainingFor(s, id) > 0);

/** 지금까지 희생자 수 (옥사 이변은 희생자가 없다) */
export const victimCount = (s: GameState) => s.incidentLog.filter((x) => !x.prevented).length;

/** 구속으로 막아 낸 사건 수 */
export const preventedCount = (s: GameState) => s.incidentLog.filter((x) => x.prevented).length;

/**
 * 엔딩 종류. 요괴 넷을 모두 가려내도 희생자가 CONFIG.bitterVictims 이상이면 씁쓸한 엔딩.
 * 저장 데이터의 ending 값은 'happy' | 'game_over' 그대로 두고, 화면에서만 나눈다.
 */
export function endingKind(s: GameState): 'happy' | 'bitter' | 'game_over' | null {
  if (!s.ending) return null;
  if (s.ending === 'game_over') return 'game_over';
  return victimCount(s) >= CONFIG.bitterVictims ? 'bitter' : 'happy';
}

/**
 * 요괴 하나를 골라 묻는다 (5-4). 그 요괴의 6가지 수법 중 아직 안 나온 것이 하나 나온다.
 * 나오는 순서는 판을 만들 때 무작위로 정해 두었으므로(askOrder) 다시 불러와도 같다.
 */
export function ask(prev: GameState, suspectId: SuspectId, now = Date.now()): GameState {
  if (prev.phase !== 'afternoon') throw new RuleError('심문은 오후에만 할 수 있습니다.');
  if (prev.questionPoints <= 0) throw new RuleError('질문 포인트가 없습니다.');
  const order = prev.board.askOrder[suspectId];
  if (!order) throw new RuleError('없는 용의자입니다.');
  const n = askedCount(prev, suspectId);
  if (!prev.detained.includes(suspectId)) throw new RuleError('옥에 갇힌 자만 심문할 수 있습니다.');
  if (n >= order.length) throw new RuleError('이 요괴에게서는 더 캐낼 것이 없습니다.');
  const s = clone(prev);
  const category = order[n];
  s.interrogationLog.push({ suspectId, category, value: s.board.profiles[suspectId][category], day: s.day });
  s.questionPoints -= 1;
  s.updatedAt = now;
  return s;
}

/**
 * 구속·해제는 오전(심문 전)과 밤에 한다.
 * 밤에 가둔 사람은 그날 밤 사건을 막고, 다음 날(5일차는 오전) 심문 대상이 된다.
 */
export const canDetainNow = (s: GameState) => !s.ending && (s.phase === 'morning' || s.phase === 'night');

export function toggleDetain(prev: GameState, id: SuspectId, now = Date.now()): GameState {
  if (!canDetainNow(prev)) throw new RuleError('구속과 해제는 오전과 밤에만 할 수 있습니다.');
  const s = clone(prev);
  if (s.detained.includes(id)) {
    s.detained = s.detained.filter((x) => x !== id);
  } else {
    if (s.detained.length >= CONFIG.maxDetained)
      throw new RuleError(`옥사는 ${CONFIG.maxDetained}칸뿐입니다. 먼저 한 명을 풀어 주십시오.`);
    s.detained.push(id);
  }
  s.updatedAt = now;
  return s;
}

export const markKey = (day: number, suspectId: SuspectId, cat: CategoryId) => `${day}|${suspectId}:${cat}`;

export function setMark(
  prev: GameState,
  day: number,
  suspectId: SuspectId,
  cat: CategoryId,
  mark: Mark,
): GameState {
  const s = clone(prev);
  const key = markKey(day, suspectId, cat);
  if (mark) s.notes.marks[key] = mark;
  else delete s.notes.marks[key];
  return s;
}

const MARK_CYCLE: Mark[] = ['', 'possible', 'impossible', 'confirmed'];
export const cycleMark = (m: Mark | undefined): Mark =>
  MARK_CYCLE[(MARK_CYCLE.indexOf(m ?? '') + 1) % MARK_CYCLE.length];

export function setCulpritNote(prev: GameState, day: number, suspectId: SuspectId | ''): GameState {
  const s = clone(prev);
  s.notes.culprits[day] = suspectId;
  return s;
}

/** 판정 (5-5): 지목한 4명이 요괴 4명과 같으면 해피 엔딩, 민간인이 포함되면 게임 오버 */
export function judge(civilianId: SuspectId, chosen: readonly SuspectId[]): Exclude<Ending, null> {
  return chosen.includes(civilianId) ? 'game_over' : 'happy';
}

export function execute(prev: GameState, chosen: readonly SuspectId[], now = Date.now()): GameState {
  if (prev.phase !== 'final' || prev.ending) throw new RuleError('처형은 5일차에만 할 수 있습니다.');
  const unique = [...new Set(chosen)];
  if (unique.length !== CONFIG.executionCount)
    throw new RuleError(`정확히 ${CONFIG.executionCount}명을 지목해야 합니다.`);
  const s = clone(prev);
  s.executed = unique;
  s.ending = judge(s.board.civilianId, unique);
  s.updatedAt = now;
  return s;
}

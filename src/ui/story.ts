import { CONFIG } from '../config';
import { CATEGORIES, TEXTS, category, clueValue, suspect } from '../core/data';
import { fill } from '../core/josa';
import type { GameState, Hint } from '../core/types';
import scripts from '../data/scripts.json';
import type { Step } from './cutscene';

/**
 * 대본(scripts.json)과 현재 판 상태를 합쳐 컷신 단계 목록을 만든다.
 * 대사 문장은 모두 데이터 파일에 있고, 여기서는 순서와 변수만 정한다.
 */

type RawStep = {
  t: string;
  who?: string;
  text: string;
  sub?: string;
  fx?: string[];
  sfx?: string;
  mood?: string;
  bg?: string;
};

const POJOLS = ['pojol-1', 'pojol-2', 'pojol-3'] as const;
/** 그날 순찰·사건 보고를 맡은 포졸 */
export const patrolOf = (day: number) => POJOLS[(day - 1) % 3];
/** 그날 옥사에서 심문을 맡은 포졸 (순찰 포졸과 다른 사람) */
export const jailerOf = (day: number) => POJOLS[day % 3];

function fromRaw(list: RawStep[], vars: Record<string, string | number> = {}): Step[] {
  return list.map((r) => {
    const s = { ...r, text: fill(r.text, vars) } as Record<string, unknown>;
    if (r.who) s.who = fill(r.who, vars).replace(/[{}]/g, '');
    if (r.sub) s.sub = fill(r.sub, vars);
    return s as unknown as Step;
  });
}

export const prologueSteps = (): Step[] => fromRaw(scripts.prologue as RawStep[]);
export const openingSteps = (): Step[] => fromRaw(scripts.opening as RawStep[]);

/** 새벽: 장면 전환 → 분위기 → 포졸이 외치며 사건 보고 → 주인공 */
export function dawnSteps(s: GameState): Step[] {
  if (s.day === CONFIG.totalDays) return fromRaw(scripts.day5Dawn as RawStep[]);
  const inc = s.board.incidents[s.day - 1];
  const pojol = patrolOf(s.day);
  const place = clueValue('place', inc.clues.place).name;
  const i = s.day - 1;
  const placeDawn = (TEXTS.placeDawn as Record<string, string>)[inc.clues.place];
  return [
    {
      t: 'title',
      text: `${s.day}일차 새벽`,
      sub: scripts.dawn.titleSub[i],
      mood: 'dawn',
      bg: `dawn`,
      sfx: 'rooster',
    },
    { t: 'narr', text: scripts.dawn.lines[i % scripts.dawn.lines.length], bg: inc.clues.place },
    { t: 'narr', text: placeDawn },
    {
      t: 'line',
      who: pojol,
      text: fill((scripts.dawn.shout as Record<string, string>)[pojol], { place, victim: inc.victim }),
      fx: ['shake', 'blood'],
      sfx: 'heartbeat',
    },
    { t: 'line', who: 'protagonist', text: scripts.dawn.reply[i % scripts.dawn.reply.length] },
  ];
}

/** 오전: 포졸이 사건 일지를 한 항목씩 읽어 준다 */
export function journalSteps(s: GameState): Step[] {
  const inc = s.incidentLog.find((x) => x.day === s.day);
  if (!inc) return [];
  const pojol = patrolOf(s.day);
  const steps: Step[] = [
    {
      t: 'line',
      who: pojol,
      text: (scripts.journal.intro as Record<string, string>)[pojol],
      sfx: 'paper',
      mood: 'day',
    },
  ];
  CATEGORIES.forEach((c, i) => {
    const v = clueValue(c.id, inc.clues[c.id]);
    steps.push({
      t: 'journal',
      incident: inc,
      upTo: i + 1,
      reader: pojol,
      text: fill(scripts.journal.item, { num: i + 1, cat: c.name, value: v.name, journal: v.journal }),
      sfx: 'paper',
    });
  });
  steps.push({ t: 'line', who: 'protagonist', text: scripts.journal.outro[(s.day - 1) % 4] });
  return steps;
}

/** 옥사 도착: 포졸과 대화 → 질문 고르기로 이어진다 */
export function prisonIntroSteps(s: GameState): Step[] {
  const list = scripts.prison.intro[Math.min(s.day, scripts.prison.intro.length) - 1] as RawStep[];
  return fromRaw(list, { jailer: jailerOf(s.day) });
}

/** 질문을 고를 때 주인공이 포졸에게 내리는 지시 한 줄 */
export function orderSteps(h: Hint): Step[] {
  return [
    {
      t: 'line',
      who: 'protagonist',
      text: fill(scripts.prison.order, { yokai: suspect(h.suspectId).yokai, cat: category(h.category).name }),
    },
  ];
}

export const hintRelay = (h: Hint) =>
  fill(scripts.prison.relay, {
    yokai: suspect(h.suspectId).yokai,
    hint: clueValue(h.category, h.value).hint,
  });

/** 잠시 후: 포졸이 돌아와 심문 결과를 하나씩 보고 */
export function reportSteps(s: GameState): Step[] {
  const jailer = jailerOf(s.day);
  const hints = s.interrogationLog.filter((h) => h.day === s.day);
  const steps: Step[] = [
    { t: 'title', text: scripts.prison.reportTitle, sfx: 'paper', bg: 'prison' },
    { t: 'line', who: jailer, text: scripts.prison.reportIntro },
  ];
  hints.forEach((h, i) =>
    steps.push({ t: 'hints', hints, upTo: i + 1, reader: jailer, text: hintRelay(h), sfx: 'reveal' }),
  );
  steps.push({
    t: 'line',
    who: 'shaman',
    text: `「${scripts.prison.parting[(s.day - 1) % scripts.prison.parting.length]}」`,
  });
  steps.push({ t: 'line', who: 'protagonist', text: scripts.prison.outro });
  return steps;
}

export function nightSteps(s: GameState): Step[] {
  const steps: Step[] = [
    {
      t: 'narr',
      text: scripts.night.lines[(s.day - 1) % scripts.night.lines.length],
      mood: 'night',
      bg: 'night',
    },
  ];
  if (s.day === 1) steps.push({ t: 'line', who: 'protagonist', text: scripts.night.protagonist });
  return steps;
}

export const finalIntroSteps = (): Step[] => fromRaw(scripts.finalIntro as RawStep[]);

/** 처형 집행: 한 명씩 칼이 떨어지고 정체가 드러난다 */
export function executionSteps(s: GameState): Step[] {
  const e = scripts.execution;
  const steps: Step[] = [
    { t: 'line', who: 'protagonist', text: e.start, sfx: 'gong', mood: 'final', bg: 'execution' },
  ];
  for (const id of s.executed) {
    const p = suspect(id);
    const monster = id !== s.board.civilianId;
    steps.push({
      t: 'reveal',
      suspectId: id,
      monster: null,
      text: fill(e.strike, { name: p.name }),
      sfx: 'heartbeat',
    });
    steps.push({
      t: 'reveal',
      suspectId: id,
      monster,
      text: fill(monster ? e.monster : e.human, { name: p.name, yokai: p.yokai }),
      sfx: monster ? 'gong' : 'heartbeat',
      fx: monster ? ['shake'] : ['dark'],
    });
  }
  steps.push({ t: 'line', who: 'protagonist', text: s.ending === 'happy' ? e.happyLine : e.badLine });
  const end = TEXTS.endings[s.ending ?? 'game_over'];
  steps.push({
    t: 'title',
    text: end.title,
    mood: s.ending === 'happy' ? 'happy' : 'gameover',
    bg: s.ending === 'happy' ? 'ending-happy' : 'ending-gameover',
  });
  end.body.forEach((line) => steps.push({ t: 'narr', text: line }));
  return steps;
}

/** 구속·해제 때 용의자가 하는 말 */
export function detainLine(id: string, detained: boolean, seed: number): string {
  const p = suspect(id) as unknown as { detainLines: string[]; releaseLines: string[] };
  const list = detained ? p.detainLines : p.releaseLines;
  return list[seed % list.length];
}

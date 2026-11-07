import { describe, expect, it } from 'vitest';
import { fill, josa } from '../../src/core/josa';
import { advance, ask, askableSuspects, newGame, toggleDetain } from '../../src/core/game';
import { CONFIG } from '../../src/config';
import { SUSPECTS } from '../../src/core/data';
import * as S from '../../src/ui/story';

describe('조사', () => {
  it('받침에 맞춰 고른다', () => {
    expect(josa('호랑이', '은/는')).toBe('는');
    expect(josa('처녀귀신', '은/는')).toBe('은');
    expect(josa('김 서방', '이/가')).toBe('이');
    expect(josa('순이', '이/가')).toBe('가');
    expect(josa('재물(제물)', '을/를')).toBe('을');
    expect(josa('언어', '을/를')).toBe('를');
    expect(josa('강물', '으로/로')).toBe('로');
  });
  it('템플릿 채우기', () => {
    expect(fill('{v}{이/가} 죽었다', { v: '떡집 막내딸 순이' })).toBe('떡집 막내딸 순이가 죽었다');
    expect(fill('{y}{은/는} {h}.', { y: '처녀귀신', h: '헛것을 보이지' })).toBe('처녀귀신은 헛것을 보이지.');
    expect(fill('{없는키}')).toBe('{없는키}');
  });
});

describe('연출 대본', () => {
  const s0 = newGame('STORY', 0);
  it('새벽: 그날 사건의 피해자와 장소가 대사에 들어간다', () => {
    const steps = S.dawnSteps(s0);
    const inc = s0.board.incidents[0];
    expect(steps.some((x) => 'text' in x && x.text.includes(inc.victim))).toBe(true);
    expect(steps.some((x) => x.t === 'line' && x.who === S.patrolOf(1))).toBe(true);
  });
  it('오전: 사건 일지 6항목을 차례로 읽는다 (판독 불가 항목 포함)', () => {
    const s = advance(s0, 0);
    const items = S.journalSteps(s).filter((x) => x.t === 'journal');
    expect(items).toHaveLength(6);
    const illegible = CONFIG.legibleClues < 6 ? items.filter((x) => x.text.includes('알아볼 수가 없')) : [];
    expect(illegible).toHaveLength(6 - CONFIG.legibleClues);
  });
  it('옥사 이변: 지난밤 범인이 갇혀 있었으면 새벽에 피해자 대신 옥사 이변을 알린다', () => {
    let s = advance(advance(advance(s0, 0), 0), 0); // 1일차 밤 (옥은 비어 있음)
    const culprit = s.board.eventOrder[1];
    s = toggleDetain(s, culprit, 0);
    s = advance(s, 0); // 2일차 새벽
    const dawn = S.dawnSteps(s);
    expect(dawn.some((x) => 'text' in x && x.text.includes(s.board.incidents[1].victim))).toBe(false);
    expect(dawn.some((x) => 'text' in x && x.text.includes('옥사'))).toBe(true);
    s = advance(s, 0); // 오전
    const steps = S.journalSteps(s);
    expect(steps.some((x) => x.t === 'journal' && x.text.includes('옥사'))).toBe(true);
    expect(S.namesOf(['beomgol', 'mul'])).toBe('범골댁과 물댁');
  });
  it('오후: 옥이 비면 심문 없이 넘어가는 장면', () => {
    const s = advance(advance(s0, 0), 0);
    expect(S.prisonIntroSteps(s).some((x) => 'text' in x && x.text.includes('비어'))).toBe(true);
  });
  it('오후: 심문 보고는 요괴 이름으로 말한다', () => {
    let s = advance(s0, 0);
    s = toggleDetain(toggleDetain(s, 'beomgol', 0), 'mul', 0);
    s = advance(s, 0);
    expect(S.prisonIntroSteps(s).some((x) => 'text' in x && x.text.includes('범골댁과 물댁'))).toBe(true);
    while (s.questionPoints > 0) s = ask(s, askableSuspects(s)[0], 0);
    const steps = S.reportSteps(s);
    const hintSteps = steps.filter((x) => x.t === 'hints');
    expect(hintSteps).toHaveLength(CONFIG.questionsByDay[0]);
    const yokai = SUSPECTS.map((p) => p.yokai);
    for (const h of hintSteps) expect(yokai.some((y) => h.text.startsWith(`「${y}`))).toBe(true);
    // 이름은 대사에 나오지 않는다
    for (const h of hintSteps) expect(SUSPECTS.some((p) => h.text.includes(p.name))).toBe(false);
  });
  it('순찰 포졸과 옥사 포졸은 다른 사람', () => {
    for (let d = 1; d <= 5; d++) expect(S.patrolOf(d)).not.toBe(S.jailerOf(d));
  });
  it('구속 대사', () => {
    expect(S.detainLine('mul', true, 0)).toBeTruthy();
    expect(S.detainLine('mul', false, 3)).toBeTruthy();
  });
});

describe('강조 표시 (**)', () => {
  it('글자 찍기 도중에도 강조가 유지되고, HTML은 이스케이프된다', async () => {
    const { parseEmphasis, emphasisHtml } = await import('../../src/ui/emphasis');
    const segs = parseEmphasis('옥사는 **두 칸**뿐 <b>');
    expect(emphasisHtml(segs, 5)).toBe('옥사는 <em class="hl">두</em>');
    expect(emphasisHtml(segs, 99)).toBe('옥사는 <em class="hl">두 칸</em>뿐 &lt;b&gt;');
  });
  it('대본의 ** 는 모두 짝이 맞는다', async () => {
    const scripts = (await import('../../src/data/scripts.json')).default as unknown;
    const bad: string[] = [];
    const walk = (x: unknown, path: string) => {
      if (typeof x === 'string') {
        if ((x.split('**').length - 1) % 2) bad.push(path);
      } else if (x && typeof x === 'object')
        for (const [k, v] of Object.entries(x as Record<string, unknown>)) walk(v, `${path}.${k}`);
    };
    walk(scripts, 'scripts');
    expect(bad).toEqual([]);
  });
  it('조사는 강조 표시를 건너뛰고 앞말 받침을 본다', () => {
    expect(fill('**{v}**{이/가}', { v: '호랑이' })).toBe('**호랑이**가');
    expect(fill('**{v}**{을/를}', { v: '범골댁과 물댁' })).toBe('**범골댁과 물댁**을');
  });
});

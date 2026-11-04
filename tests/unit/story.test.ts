import { describe, expect, it } from 'vitest';
import { fill, josa } from '../../src/core/josa';
import { advance, ask, newGame } from '../../src/core/game';
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
  it('오전: 사건 일지 6항목을 차례로 읽는다', () => {
    const s = advance(s0, 0);
    expect(S.journalSteps(s).filter((x) => x.t === 'journal')).toHaveLength(6);
  });
  it('오후: 심문 보고는 요괴 이름으로 말한다', () => {
    let s = advance(advance(s0, 0), 0);
    for (const q of [...s.pendingQuestions]) s = ask(s, q, 0);
    const steps = S.reportSteps(s);
    const hintSteps = steps.filter((x) => x.t === 'hints');
    expect(hintSteps).toHaveLength(4);
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

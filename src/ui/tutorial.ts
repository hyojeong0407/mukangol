/**
 * 튜토리얼 (조사 방법).
 * 긴 설명 대신 카드 한 장에 개념 하나, 문장은 두 줄 이내, 게임 화면 조각으로 만든 그림을 곁들인다.
 * 처음 플레이할 때는 상황마다 한 번씩 짧은 안내(코치 팁)를 띄운다.
 * 문장 안의 **강조**는 노란 형광펜으로 보인다.
 */
import { SUSPECTS } from '../core/data';
import { emphasisHtml, parseEmphasis } from './emphasis';
import { faceCrop } from './faces';
import { html, raw, type Raw } from './html';

/** **강조**를 살린 한 줄 */
export const emText = (text: string): Raw => {
  const segs = parseEmphasis(text);
  return raw(emphasisHtml(segs, Infinity));
};

const face = (id: string, extra = '') => {
  const p = SUSPECTS.find((s) => s.id === id)!;
  return html`<span class="tut-face ${extra}"
    >${faceCrop(p.portrait, 'tut-face-img')}<small>${p.name}</small></span
  >`;
};

interface Card {
  title: string;
  lines: string[];
  visual: Raw;
}

export const TUTORIAL: Card[] = [
  {
    title: '다섯 중 하나는 사람',
    lines: [
      '아낙 다섯 가운데 **넷은 요괴**, **하나는 사람**이다.',
      '닷새째에 **요괴 넷**을 베면 결계가 풀린다.',
    ],
    // 특정 인물을 사람으로 짚지 않는다 (판마다 다르다)
    visual: html`<div class="tut-row">${SUSPECTS.map((p) => face(p.id, 'is-unknown'))}</div>`,
  },
  {
    title: '사건 일지',
    lines: [
      '새벽마다 요괴 하나가 **사건**을 일으킨다.',
      '일지의 단서 = **범인 요괴의 수법**. 일부는 **판독 불가**.',
    ],
    visual: html`<ul class="tut-journal">
      <li><span>장소</span><b>강가</b></li>
      <li class="is-illegible"><span>유인</span><b>판독 불가</b></li>
      <li><span>재물</span><b>동물의 시체</b></li>
    </ul>`,
  },
  {
    title: '옥사는 두 칸',
    lines: ['오전과 밤에 **두 명**을 옥에 가둔다.', '갇힌 요괴는 **그날 밤 사건을 못 일으킨다**.'],
    visual: html`<div class="tut-row tut-cells">
      <span class="tut-cell">${face('beomgol')}</span><span class="tut-cell">${face('mul')}</span>
    </div>`,
  },
  {
    title: '심문',
    lines: ['주술사는 **갇힌 자**에 대해서만 입을 연다.', '하루 **두 번**, 그 요괴의 수법을 하나씩.'],
    visual: html`<div class="tut-hint"><b>호랑이</b> <span>장소</span> <strong>산</strong></div>`,
  },
  {
    title: '맞춰 보기',
    lines: [
      '**검험 기록판**에서 사건 단서와 수법을 비교한다.',
      '값이 다르면 **불가**: 그 요괴는 범인이 아니다.',
    ],
    visual: html`<div class="tut-compare">
      <div><small>사건 장소</small><b>강가</b></div>
      <span class="vs">≠</span>
      <div><small>호랑이 장소</small><b>산</b></div>
      <span class="tut-stamp">불가</span>
    </div>`,
  },
  {
    title: '사람을 가려내라',
    lines: ['**한 번도 사건을 일으키지 않은 하나**가 사람이다.', '사건을 막을수록 희생자가 준다.'],
    visual: html`<div class="tut-row tut-tokens">
      <span class="tut-token is-cut">사건</span><span class="tut-token is-cut">사건</span
      ><span class="tut-token is-cut">이변</span><span class="tut-token is-cut">사건</span
      ><span class="tut-token is-safe">사람</span>
    </div>`,
  },
];

/** 카드 한 장 + 넘기기 */
export function tutorialView(page: number, inGame: boolean): Raw {
  const n = TUTORIAL.length;
  const i = Math.max(0, Math.min(n - 1, page));
  const c = TUTORIAL[i];
  const last = i === n - 1;
  return html`<main class="prologue tutorial">
    <div class="paper prologue-paper tut-paper">
      <p class="tut-count">조사 방법 <b>${i + 1}</b> / ${n}</p>
      <section class="tut-card" aria-live="polite" data-page="${i}">
        <div class="tut-visual" aria-hidden="true">${c.visual}</div>
        <h2 class="brush">${c.title}</h2>
        ${c.lines.map((l) => html`<p class="tut-line">${emText(l)}</p>`)}
      </section>
      <nav class="tut-nav">
        <button class="btn" data-action="tut-prev" ${i === 0 ? raw('disabled') : ''}>‹ 이전</button>
        <span class="tut-dots">
          ${TUTORIAL.map(
            (_, k) =>
              html`<button
                class="tut-dot ${k === i ? 'is-on' : ''}"
                data-action="tut-go"
                data-page="${k}"
                aria-label="${k + 1}번째 카드"
              ></button>`,
          )}
        </span>
        ${
          last
            ? html`<button class="btn btn-primary" data-action="howto-done" autofocus>
                ${inGame ? '돌아가기' : '첫 새벽을 맞는다 ›'}
              </button>`
            : html`<button class="btn btn-primary" data-action="tut-next" autofocus>다음 ›</button>`
        }
      </nav>
      ${last ? '' : html`<button class="btn-link tut-skip" data-action="howto-done">건너뛰기</button>`}
    </div>
  </main>`;
}

/** 처음 한 번만 뜨는 상황별 짧은 안내 */
export const TIPS = {
  prison: '여기서 **두 명**을 옥에 가두세요. 오후에는 **가둔 사람만** 심문할 수 있습니다.',
  ask: '갇힌 자를 고르면 그 요괴의 **수법 하나**를 알아 옵니다. 하루 **두 번**.',
  board: '칸을 눌러 **가능 / 불가** 도장을 찍으세요. 사건 단서와 수법이 **다르면 불가**입니다.',
  night: '오늘 밤 범인일 것 같은 자를 가두면 **사건을 막을** 수 있습니다.',
} as const;
export type TipKey = keyof typeof TIPS;

export function tipView(key: TipKey, seen: readonly string[]): Raw {
  if (seen.includes(key)) return html``;
  return html`<aside class="coach" role="note">
    <span class="coach-mark" aria-hidden="true">!</span>
    <p>${emText(TIPS[key])}</p>
    <button class="btn btn-small" data-action="tip-ok" data-tip="${key}">알겠습니다</button>
  </aside>`;
}

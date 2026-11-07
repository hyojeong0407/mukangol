import { CONFIG, TOTAL_QUESTIONS } from '../config';
import { CATEGORIES, CATEGORY_IDS, SUSPECTS, TEXTS, category, clueValue, suspect } from '../core/data';
import {
  askableSuspects,
  canAdvance,
  canDetainNow,
  markKey,
  preventedCount,
  remainingFor,
  victimCount,
} from '../core/game';
import type { CategoryId } from '../core/data';
import type { GameState, Hint, Incident, Mark } from '../core/types';
import { suspectPortrait } from './assets';
import { circleSvg } from './circles';
import { html, raw, type Raw } from './html';
import { jailerOf, namesOf } from './story';
import { faceCrop } from './faces';
import { tipView, type TipKey } from './tutorial';

export type View = 'today' | 'caselog' | 'interrogation' | 'board' | 'suspects';

export interface UiState {
  view: View;
  caseLogDay: number;
  /** 검험 기록판 페이지: 1~4일차 사건, 0 = 종합 */
  boardDay: number;
  interrogationMode: 'yokai' | 'category';
  executionPick: string[];
  /** 오늘 심문 보고를 아직 듣지 않았으면 true (결과를 가린다) */
  reportPending: boolean;
  /** 새 기록 배지용: 마지막으로 열어 본 사건 일지/심문 일지 개수 */
  seenIncidents: number;
  seenHints: number;
  flash: string | null;
  /** 구속·해제 때 용의자가 하는 말 */
  speech: { id: string; text: string } | null;
  /** 이미 본 상황별 안내 (설정에서 옮겨 온다) */
  tips: readonly string[];
}

const MARK_LABEL: Record<Exclude<Mark, ''>, string> = {
  possible: '가능',
  impossible: '불가',
  confirmed: '확정',
};

export const phaseLabel = (s: GameState) =>
  s.day === CONFIG.totalDays && s.phase === 'afternoon' ? '오전 · 심문' : TEXTS.phaseNames[s.phase];

const castPortrait = (src: string, alt: string, cls = 'portrait') =>
  html`<img class="${cls}" src="${src}" alt="${alt}" loading="lazy" width="360" height="450" />`;

/**
 * 사건 일지 한 칸의 표시. 판독 불가와 옥사 이변의 장소도 여기서 처리한다.
 * kind: 'value' 읽을 수 있는 단서 / 'illegible' 판독 불가 / 'prison' 옥사 이변의 장소
 */
export function clueCell(inc: Incident, cat: CategoryId) {
  const v = inc.clues[cat];
  if (v !== undefined) {
    const cv = clueValue(cat, v);
    return { kind: 'value' as const, id: v, name: cv.name, journal: cv.journal };
  }
  if (inc.prevented && cat === 'place')
    return {
      kind: 'prison' as const,
      id: '',
      name: '옥사',
      journal: `그날 밤 옥에 갇혀 있던 ${namesOf(inc.prevented)} 가운데 하나의 짓이다.`,
    };
  return { kind: 'illegible' as const, id: '', name: '판독 불가', journal: TEXTS.illegible };
}

const victimLabel = (inc: Incident) => (inc.prevented ? '피해자 없음 (옥사 이변)' : `피해자: ${inc.victim}`);

const nameTag = (id: string) => {
  const p = suspect(id);
  return html`<span class="name-tag">${p.name} <small class="yokai-tag">${p.yokai}</small></span>`;
};

/* ---------------- 공통 머리말 ---------------- */

export function hud(s: GameState, ui: UiState): Raw {
  const days = Array.from({ length: CONFIG.totalDays }, (_, i) => i + 1);
  const newCase = s.incidentLog.length > ui.seenIncidents;
  const newHint = !ui.reportPending && s.interrogationLog.length > ui.seenHints;
  const tab = (v: View, label: string, key: string, badge = false) =>
    html`<button
      class="tab ${ui.view === v ? 'is-active' : ''}"
      data-action="view"
      data-view="${v}"
      aria-current="${ui.view === v ? 'page' : 'false'}"
      title="단축키 ${key}"
    >
      ${label}${badge ? raw('<span class="badge" aria-label="새 기록">●</span>') : ''}
    </button>`;
  return html`<header class="hud">
    <div class="hud-day" aria-label="${s.day}일차 ${phaseLabel(s)}">
      <ol class="day-track">
        ${days.map(
          (d) =>
            html`<li class="${d < s.day ? 'past' : d === s.day ? 'now' : 'future'}">
              <span>${d}</span><small>일</small>
            </li>`,
        )}
      </ol>
      <div class="hud-phase"><strong>${s.day}일차</strong> ${phaseLabel(s)}</div>
      <div class="hud-tally" title="희생자 / 구속으로 막은 사건">
        희생 <b>${victimCount(s)}</b> · 막음 <b>${preventedCount(s)}</b> · 옥사
        <b>${s.detained.length}/${CONFIG.maxDetained}</b>
      </div>
    </div>
    <nav class="tabs" aria-label="기록">
      ${tab('today', s.phase === 'final' ? '처형장' : '오늘', '1')}
      ${tab('caselog', '사건 일지', '2', newCase)} ${tab('interrogation', '심문 일지', '3', newHint)}
      ${tab('board', '검험 기록판', '4')} ${tab('suspects', '용의자', '5')}
    </nav>
    <button class="icon-btn" data-action="replay" aria-label="장면 다시 보기" title="장면 다시 보기">
      ↺
    </button>
    <button class="icon-btn" data-action="settings" aria-label="설정" title="설정">⚙</button>
  </header>`;
}

export function footer(s: GameState, ui: UiState): Raw {
  if (s.phase === 'final') return html``;
  const c = canAdvance(s);
  const blocked = !c.ok || (s.phase === 'afternoon' && ui.reportPending);
  const reason = !c.ok ? c.reason : blocked ? '포졸의 보고를 들어야 합니다.' : '';
  const label = {
    dawn: s.day === CONFIG.totalDays ? '옥사로 간다' : '현장 보고를 듣는다',
    morning: '옥사로 간다 (오후 심문)',
    afternoon: s.day === CONFIG.totalDays ? '처형장으로 간다' : '밤이 깊어진다',
    night: '잠자리에 든다 (다음 날)',
    final: '',
  }[s.phase];
  return html`<footer class="next-bar">
    ${reason ? html`<span class="next-reason">${reason}</span>` : ''}
    <button class="btn btn-primary" data-action="advance" ${blocked ? raw('disabled') : ''} title="단축키 N">
      ${label} ›
    </button>
  </footer>`;
}

/* ---------------- 오늘 (단계별) ---------------- */

export function todayView(s: GameState, ui: UiState): Raw {
  switch (s.phase) {
    case 'dawn':
      return dawnView(s);
    case 'morning':
      return morningView(s, ui);
    case 'afternoon':
      return afternoonView(s, ui);
    case 'night':
      return nightView(s, ui);
    case 'final':
      return finalView(s, ui);
  }
}

function dawnView(s: GameState): Raw {
  const inc = s.board.incidents[s.day - 1];
  return html`<section class="scene scene-dawn" aria-labelledby="dawn-title">
    <h2 id="dawn-title" class="brush big">${s.day}일차 새벽</h2>
    <p class="scene-line">${inc ? TEXTS.dawnLines[(s.day - 1) % TEXTS.dawnLines.length] : TEXTS.day5Dawn}</p>
  </section>`;
}

function morningView(s: GameState, ui: UiState): Raw {
  const inc = s.incidentLog.find((x) => x.day === s.day)!;
  return html`<section class="scene">
    <p class="report">
      ${inc.prevented ? TEXTS.preventedReport : TEXTS.patrolReport[(s.day - 1) % TEXTS.patrolReport.length]}
    </p>
    ${
      s.detained.length
        ? ''
        : html`<p class="jump-note">
            오후 심문 전에 <em class="hl">옥에 두 명을 가두십시오.</em>
            <a class="btn btn-small" href="#prison-title">옥사로 ↓</a>
          </p>`
    }
    ${journal(inc, true)} ${prisonSection(s, ui, '오늘 오후에 심문할 사람을 옥에 가두십시오.', 'prison')}
  </section>`;
}

/** 옥사 칸: 누구를 가둘지 고른다 (오전·밤) */
function prisonSection(s: GameState, ui: UiState, lead: string, tip: TipKey): Raw {
  return html`<section class="prison" aria-labelledby="prison-title">
    <h3 id="prison-title" class="sub-h">
      옥사 <small>${s.detained.length} / ${CONFIG.maxDetained}칸</small>
    </h3>
    ${tipView(tip, ui.tips)}
    <p class="help">
      ${lead} 심문은 <b>갇힌 사람에게만</b> 할 수 있고, 갇힌 요괴는 <b>그날 밤 사건을 일으키지 못합니다</b>.
      구속은 처형이 아닙니다.
    </p>
    ${suspectCards(s, ui)}
  </section>`;
}

/** 옥사: 어느 요괴에 대해 캐물어 올지 포졸에게 지시한다. 어떤 수법이 나올지는 무작위. 결과는 포졸이 돌아와 보고한다. */
function afternoonView(s: GameState, ui: UiState): Raw {
  const asked = s.interrogationLog.filter((h) => h.day === s.day);
  const jailer = jailerOf(s.day);
  const jailerInfo = { 'pojol-1': '박 포졸', 'pojol-2': '강 포졸', 'pojol-3': '오 포졸' }[jailer];
  const todayPoints = CONFIG.questionsByDay[s.day - 1] ?? 0;
  const points = Array.from(
    { length: todayPoints },
    (_, i) =>
      html`<span class="qp ${i < s.questionPoints ? 'qp-full' : 'qp-empty'}" aria-hidden="true">符</span>`,
  );
  const askable = askableSuspects(s);
  const done = s.questionPoints === 0 || askable.length === 0;
  const empty = !s.detained.length;
  const jailerSrc = `images/characters/char-${jailer}-default.webp`;
  // PC: 왼쪽에 담당 포졸 카드, 오른쪽에 대화·질문. 모바일: 큰 그림 없이 말하는 얼굴 + 큰 질문 버튼 (CSS에서 나눈다)
  return html`<section class="interrogate">
    <figure class="jailer-card">
      ${castPortrait(jailerSrc, `${jailerInfo}`)}
      <figcaption>${jailerInfo} <small>옥사 심문 담당</small></figcaption>
    </figure>
    <div class="dialogue">
      <div class="speech-row">
        ${faceCrop(jailerSrc, 'speaker-face')}
        <div class="speech">
          <b class="speech-name">${jailerInfo}</b>
          ${
            empty
              ? '「옥이 비어 있습니다, 나리. 현암 놈은 제 눈앞에 세운 자에 대해서만 입을 엽니다.」'
              : done
                ? ui.reportPending
                  ? '「다녀오겠습니다, 나리!」'
                  : '「현암 놈이 한 말은 심문 일지에 모두 적었습니다.」'
                : `「갇힌 ${namesOf(s.detained)} 가운데 누구에 대해 캐물어 올까요, 나리?」`
          }
        </div>
      </div>
      <div class="qp-row" aria-label="남은 질문 ${s.questionPoints}개">질문 ${points}</div>
      ${
        done
          ? ''
          : html`<ul class="questions">
              ${SUSPECTS.filter((p) => s.detained.includes(p.id)).map((p) => {
                const left = remainingFor(s, p.id);
                return html`<li>
                  <button
                    class="btn btn-question"
                    data-action="ask"
                    data-id="${p.id}"
                    ${left > 0 ? '' : raw('disabled')}
                  >
                    ${faceCrop(p.portrait, 'q-face')}
                    <span class="q-text">
                      <span><b>${p.yokai}</b> <small>${p.name}</small></span>
                      <small class="q-left">남은 수법 ${left} / ${CATEGORY_IDS.length}</small>
                    </span>
                    <span class="q-go" aria-hidden="true">캐묻기 ›</span>
                  </button>
                </li>`;
              })}
            </ul>`
      }
      ${
        asked.length
          ? html`<h3 class="sub-h">${ui.reportPending ? '내린 지시' : '오늘 받아 온 답'}</h3>
              <ol class="hint-list">
                ${asked.map((h) =>
                  ui.reportPending
                    ? html`<li><b>${suspect(h.suspectId).yokai}</b>에 대해</li>`
                    : html`<li>${hintLine(h)}</li>`,
                )}
              </ol>`
          : ''
      }
      ${
        empty
          ? html`<p class="help">오늘은 심문할 수 없습니다. 밤에 누구를 가둘지 정하십시오.</p>`
          : done && ui.reportPending
            ? html`<button class="btn btn-primary" data-action="report">보고를 듣는다</button>`
            : ''
      }
    </div>
  </section>`;
}

function nightView(s: GameState, ui: UiState): Raw {
  return html`<section>
    <p class="scene-line">${TEXTS.nightLines[(s.day - 1) % TEXTS.nightLines.length]}</p>
    ${prisonSection(
      s,
      ui,
      s.day === CONFIG.totalDays - 1
        ? '오늘 밤 가둘 사람을 정하십시오. 내일(5일차) 오전 마지막 심문은 이 사람들에게 합니다.'
        : '오늘 밤 가둘 사람을 정하십시오. 내일 오전에 다시 바꿀 수 있습니다.',
      'night',
    )}
  </section>`;
}

function finalView(s: GameState, ui: UiState): Raw {
  const n = ui.executionPick.length;
  return html`<section class="execution" aria-labelledby="exec-title">
    <div class="exec-head">
      <h2 id="exec-title" class="brush">5일차 처형 — 최종 결정</h2>
      <div class="exec-count" aria-live="polite">
        처형 대상 <strong>${n} / ${CONFIG.executionCount}</strong>
      </div>
    </div>
    <p class="help">요괴 넷을 지목하십시오. 한 명은 사람입니다. 처형은 되돌릴 수 없습니다.</p>
    <ul class="exec-cards">
      ${SUSPECTS.map((p) => {
        const on = ui.executionPick.includes(p.id);
        return html`<li>
          <button
            class="scroll-card ${on ? 'is-picked' : ''}"
            data-action="pick"
            data-id="${p.id}"
            aria-pressed="${on}"
            aria-label="${p.name}(${p.yokai}) ${on ? '지목됨' : ''}"
          >
            <span class="flip ${on ? 'is-yokai' : ''}">
              <span class="face front">${suspectPortrait(p.id, 'human')}</span>
              <span class="face back">${suspectPortrait(p.id, 'yokai')}</span>
            </span>
            <span class="scroll-name">${on ? p.yokai : p.name}</span>
            <span class="check" aria-hidden="true">${on ? '✔' : ''}</span>
            ${s.detained.includes(p.id) ? html`<span class="tag-detained">구속 중</span>` : ''}
          </button>
        </li>`;
      })}
    </ul>
    <div class="exec-actions">
      <button
        class="btn btn-danger"
        data-action="execute-open"
        ${n === CONFIG.executionCount ? '' : raw('disabled')}
      >
        처형한다
      </button>
    </div>
  </section>`;
}

/* ---------------- 사건 일지 ---------------- */

const NUM = ['①', '②', '③', '④', '⑤', '⑥'];

export function journal(inc: Incident, fresh = false): Raw {
  const items = CATEGORIES.map((c, i) => {
    const v = clueCell(inc, c.id);
    return html`<li class="clue clue-${c.id} ${v.kind === 'value' ? '' : `clue-${v.kind}`}">
      <h4><span class="num">${NUM[i]}</span> ${c.name}: <strong>${v.name}</strong></h4>
      <p>${v.journal}</p>
      ${c.id === 'circle' && v.kind === 'value' ? html`<div class="circle-art">${raw(circleSvg(v.id))}</div>` : ''}
    </li>`;
  });
  return html`<article
    class="book ${fresh ? 'fresh' : ''} ${inc.prevented ? 'is-prevented' : ''}"
    aria-label="${inc.day}일차 ${inc.prevented ? '옥사 이변' : '사건 일지'}"
  >
    ${fresh ? html`<span class="new-stamp">새 기록</span>` : ''}
    <header class="book-head">
      <span>${inc.day}일차 ${inc.prevented ? '옥사 이변' : '검안'}</span>
      <span class="victim">${victimLabel(inc)}</span>
    </header>
    <div class="book-pages">
      <ol class="page">
        ${items.slice(0, 4)}
      </ol>
      <ol class="page" start="5">
        ${items.slice(4)}
      </ol>
    </div>
  </article>`;
}

function dayTabs(action: string, current: number, s: GameState, extra?: Raw): Raw {
  const tabs = Array.from({ length: CONFIG.incidentDays }, (_, i) => i + 1).map((d) => {
    const has = s.incidentLog.some((x) => x.day === d);
    return html`<button
      class="day-tab ${d === current ? 'is-active' : ''}"
      data-action="${action}"
      data-day="${d}"
      ${has ? '' : raw('disabled')}
    >
      ${d}일차
    </button>`;
  });
  return html`<div class="day-tabs" role="tablist">${tabs}${extra ?? ''}</div>`;
}

export function caseLogView(s: GameState, ui: UiState): Raw {
  if (!s.incidentLog.length) return html`<p class="empty">아직 올라온 사건 일지가 없습니다.</p>`;
  const day = s.incidentLog.some((x) => x.day === ui.caseLogDay) ? ui.caseLogDay : s.incidentLog.at(-1)!.day;
  return html`<section>
    ${dayTabs('caseday', day, s)}
    <div class="row-right">
      <button class="btn" data-action="replay-journal" data-day="${day}">▶ 포졸의 보고 다시 듣기</button>
    </div>
    ${journal(s.incidentLog.find((x) => x.day === day)!)}
  </section>`;
}

/* ---------------- 심문 일지 (요괴 이름으로 정리) ---------------- */

const hintLine = (h: Hint & { day: number }) =>
  html`<span class="hl-name">${suspect(h.suspectId).yokai}</span> —
    <span class="hl-cat">${category(h.category).name}</span> —
    <strong>${clueValue(h.category, h.value).name}</strong> <small class="hl-day">${h.day}일차</small>`;

export function interrogationView(s: GameState, ui: UiState): Raw {
  const log = ui.reportPending ? s.interrogationLog.filter((h) => h.day !== s.day) : s.interrogationLog;
  const toggle = html`<div class="seg" role="group" aria-label="보기 방식">
    <button
      class="${ui.interrogationMode === 'yokai' ? 'is-active' : ''}"
      data-action="imode"
      data-mode="yokai"
    >
      요괴별
    </button>
    <button
      class="${ui.interrogationMode === 'category' ? 'is-active' : ''}"
      data-action="imode"
      data-mode="category"
    >
      단서 종류별
    </button>
  </div>`;
  if (!log.length)
    return html`${toggle}
      <p class="empty">아직 얻은 힌트가 없습니다.</p>`;
  const groups =
    ui.interrogationMode === 'yokai'
      ? SUSPECTS.map((p) => ({ title: p.yokai, sub: p.name, items: log.filter((h) => h.suspectId === p.id) }))
      : CATEGORIES.map((c) => ({ title: c.name, sub: '', items: log.filter((h) => h.category === c.id) }));
  return html`<section class="paper">
    ${toggle}
    <p class="help">
      주술사가 말한 요괴의 수법입니다. 얻은 힌트 ${log.length} / ${TOTAL_QUESTIONS}. 요괴와 아낙의 대응은
      용의자 화면에 있습니다.
    </p>
    <div class="hint-groups">
      ${groups.map(
        (g) =>
          html`<div class="hint-group">
            <h3>
              ${g.title} ${g.sub ? html`<small class="dim">${g.sub}</small>` : ''}
              <small>${g.items.length}</small>
            </h3>
            ${
              g.items.length
                ? html`<ul>
                    ${g.items.map((h) => html`<li>${hintLine(h)}</li>`)}
                  </ul>`
                : html`<p class="dim">—</p>`
            }
          </div>`,
      )}
    </div>
  </section>`;
}

/* ---------------- 검험 기록판 (사건별 페이지) ---------------- */

export function boardView(s: GameState, ui: UiState): Raw {
  const revealed = s.incidentLog.map((x) => x.day);
  // 0 = 종합. 아직 공개되지 않은 일차를 고르고 있으면 가장 최근 사건으로
  const page =
    ui.boardDay === 0 || !revealed.length
      ? 0
      : revealed.includes(ui.boardDay)
        ? ui.boardDay
        : revealed.at(-1)!;
  const summaryTab = html`<button
    class="day-tab ${page === 0 ? 'is-active' : ''}"
    data-action="boardday"
    data-day="0"
  >
    종합
  </button>`;
  return html`<section class="paper board-wrap">
    <h2 class="brush">검험 기록판</h2>
    ${dayTabs('boardday', page, s, summaryTab)} ${page === 0 ? '' : tipView('board', ui.tips)}
    ${page === 0 ? boardSummary(s) : boardPage(s, page)}
  </section>`;
}

function boardPage(s: GameState, day: number): Raw {
  const inc = s.incidentLog.find((x) => x.day === day)!;
  const known = new Map(s.interrogationLog.map((h) => [`${h.suspectId}:${h.category}`, h.value]));
  const pick = s.notes.culprits[day] ?? '';

  const caseCard = html`<div class="case-card" aria-label="${day}일차 사건">
    <div class="case-head">
      <b>${day}일차 ${inc.prevented ? '옥사 이변' : '사건'}</b>
      <span class="victim">${victimLabel(inc)}</span>
    </div>
    <ul class="case-chips">
      ${CATEGORIES.map((c) => {
        const v = clueCell(inc, c.id);
        return html`<li class="${v.kind === 'value' ? '' : `chip-${v.kind}`}">
          <span class="glyph" aria-hidden="true">${c.glyph}</span>
          <span class="chip-cat">${c.short}</span>
          <strong>${v.kind === 'illegible' ? '?' : v.name}</strong>
        </li>`;
      })}
    </ul>
    ${
      inc.prevented
        ? html`<p class="case-note">
            범인은 그날 밤 갇혀 있던 <b>${namesOf(inc.prevented)}</b> 가운데 하나입니다.
          </p>`
        : ''
    }
  </div>`;

  const head = SUSPECTS.map(
    (p) =>
      html`<th scope="col">
        <div class="board-suspect">
          ${castPortrait(p.portrait, p.name, 'thumb')}<span>${p.yokai}</span><small>${p.name}</small>
        </div>
      </th>`,
  );
  const rows = CATEGORIES.map(
    (c) =>
      html`<tr>
        <th scope="row">
          <span class="glyph" aria-hidden="true">${c.glyph}</span><span class="cat-full">${c.name}</span
          ><span class="cat-short">${c.short}</span>
          <small class="row-val"
            >${clueCell(inc, c.id).kind === 'illegible' ? '?' : clueCell(inc, c.id).name}</small
          >
        </th>
        ${SUSPECTS.map((p) => {
          const key = markKey(day, p.id, c.id);
          const m = (s.notes.marks[key] ?? '') as Mark;
          const v = known.get(`${p.id}:${c.id}`);
          const label = `${day}일차 · ${p.yokai} · ${c.name}: ${m ? MARK_LABEL[m] : '표시 없음'}${v ? `, 힌트 ${clueValue(c.id, v).name}` : ''}`;
          return html`<td>
            <button
              class="cell mark-${m || 'none'}"
              data-action="mark"
              data-key="${key}"
              aria-label="${label}"
            >
              ${m ? html`<span class="stamp">${MARK_LABEL[m]}</span>` : html`<span class="stamp-empty">·</span>`}
              ${v ? html`<span class="cell-hint">${clueValue(c.id, v).name}</span>` : ''}
            </button>
          </td>`;
        })}
      </tr>`,
  );

  return html`${caseCard}
    <p class="help">
      위 사건의 단서와 주술사의 힌트(칸 아래 작은 글씨)를 비교해, 이 사건을 일으킬 수 <b>있는</b> 요괴를
      가려내십시오. <b>?</b>는 판독할 수 없는 단서라 비교할 수 없습니다. 칸을 누르면
      <b>가능 → 불가 → 확정 → 지움</b> 순으로 도장이 바뀝니다. 정답은 알려 주지 않습니다.
    </p>
    <div class="table-scroll">
      <table class="board">
        <thead>
          <tr>
            <th scope="col"><span class="sr-only">단서</span></th>
            ${head}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <label class="culprit-pick"
      >${day}일차 사건의 범인 추정
      <select data-action="culprit" data-day="${day}">
        <option value="">미정</option>
        ${SUSPECTS.map(
          (p) =>
            html`<option value="${p.id}" ${pick === p.id ? raw('selected') : ''}>
              ${p.yokai} (${p.name})
            </option>`,
        )}
      </select>
    </label>`;
}

function boardSummary(s: GameState): Raw {
  const incRows = Array.from({ length: CONFIG.incidentDays }, (_, i) => i + 1).map((d) => {
    const inc = s.incidentLog.find((x) => x.day === d);
    const pick = s.notes.culprits[d] ?? '';
    return html`<tr>
      <th scope="row">${d}일차</th>
      ${CATEGORY_IDS.map((c) => {
        if (!inc) return html`<td>—</td>`;
        const v = clueCell(inc, c);
        return html`<td class="${v.kind === 'value' ? '' : `td-${v.kind}`}">
          ${v.kind === 'illegible' ? '?' : v.name}
        </td>`;
      })}
      <td>${pick ? html`<b>${suspect(pick).yokai}</b> <small>${suspect(pick).name}</small>` : '미정'}</td>
    </tr>`;
  });
  const picked = new Set(Object.values(s.notes.culprits).filter(Boolean));
  const rest = SUSPECTS.filter((p) => !picked.has(p.id));
  return html`<p class="help">
      사건마다 고른 범인 추정을 모아 봅니다. 사건을 일으키지 않은 하나가 사람입니다. 옥사 이변도 그날 밤
      범인의 짓이므로 사건 하나로 칩니다. <b>?</b>는 판독 불가.
    </p>
    <div class="table-scroll">
      <table class="incidents">
        <thead>
          <tr>
            <th scope="col">사건</th>
            ${CATEGORIES.map((c) => html`<th scope="col">${c.short}</th>`)}
            <th scope="col">범인 추정</th>
          </tr>
        </thead>
        <tbody>
          ${incRows}
        </tbody>
      </table>
    </div>
    <p class="summary-rest">
      아직 범인으로 고르지 않은 자:
      ${rest.length ? rest.map((p) => html`<b>${p.yokai}(${p.name})</b> `) : '없음'}
    </p>`;
}

/* ---------------- 용의자 ---------------- */

export function suspectCards(s: GameState, ui: UiState): Raw {
  const can = canDetainNow(s);
  return html`<ul class="suspect-cards">
    ${SUSPECTS.map((p) => {
      const d = s.detained.includes(p.id);
      const speaking = ui.speech?.id === p.id;
      return html`<li class="suspect-card ${d ? 'is-detained' : ''}">
        ${castPortrait(p.portrait, `${p.name} 초상`)}
        ${speaking ? html`<div class="speech-bubble" role="status">「${ui.speech!.text}」</div>` : ''}
        <div class="sc-body">
          <h3>${nameTag(p.id)} <small>${p.disguise}</small></h3>
          <p class="impression">${p.impression}</p>
          <p class="bio">${p.bio}</p>
          ${d ? html`<span class="rope-stamp">구속</span>` : ''}
          ${
            can
              ? html`<button class="btn ${d ? '' : 'btn-primary'}" data-action="detain" data-id="${p.id}">
                  ${d ? '해제' : '구속'}
                </button>`
              : ''
          }
        </div>
      </li>`;
    })}
  </ul>`;
}

export function suspectsView(s: GameState, ui: UiState): Raw {
  return html`<section>
    <p class="help">
      다섯 아낙은 저마다 요괴의 이름을 달고 있습니다. 그러나 그중 하나는 요괴가 아닌 사람입니다.
      ${canDetainNow(s) ? '' : ' 구속과 해제는 오전과 밤에 할 수 있습니다.'}
    </p>
    ${suspectCards(s, ui)}
  </section>`;
}

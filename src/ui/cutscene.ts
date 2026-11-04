import { sound, type Sfx } from '../audio/sound';
import { tts, type VoiceProfile } from '../audio/tts';
import { CAST, CATEGORIES, SUSPECTS, category, clueValue, suspect } from '../core/data';
import type { Hint, Incident } from '../core/types';
import type { Mood } from '../scenes/fx';
import { bgSrc, suspectPortrait } from './assets';
import { circleSvg } from './circles';
import { html, raw, type Raw } from './html';

/**
 * 컷신(대사·해설·장면 전환) 플레이어.
 * - 대사는 한 글자씩 찍히고, 동시에 TTS로 읽힌다. (TTS가 없으면 자막만)
 * - 클릭/Space/Enter: 글자가 찍히는 중이면 바로 다 보여 주고, 다 보였으면 다음으로.
 * - 자동 진행이 켜져 있으면 읽기가 끝난 뒤 저절로 넘어간다.
 * - 건너뛰기(Esc): 남은 컷신 전체를 넘긴다.
 * 컷신은 #cutscene 레이어에 그려지며, 아래의 게임 화면은 그대로 유지된다.
 */

export type Fx = 'shake' | 'flash' | 'blood' | 'ink' | 'barrier' | 'dark';

interface Common {
  fx?: Fx[];
  sfx?: Sfx;
  mood?: Mood;
  bg?: string;
}
export type Step =
  | (Common & { t: 'title'; text: string; sub?: string })
  | (Common & { t: 'narr'; text: string })
  | (Common & { t: 'line'; who: string; text: string })
  | (Common & { t: 'journal'; incident: Incident; upTo: number; reader: string; text: string })
  | (Common & { t: 'hints'; hints: Hint[]; upTo: number; reader: string; text: string })
  | (Common & { t: 'reveal'; suspectId: string; monster: boolean | null; text: string });

export interface CutsceneEnv {
  setMood(m: Mood): void;
  shake(): void;
  flash(color: 'white' | 'red'): void;
  reduceMotion(): boolean;
  autoAdvance(): boolean;
  setAutoAdvance(v: boolean): void;
}

interface Speaker {
  name: string;
  portrait: string;
  voice: VoiceProfile;
  isSuspect: boolean;
}

const NARRATOR: VoiceProfile = { gender: 'male', pitch: 0.9, rate: 0.95 };

function speaker(who: string): Speaker {
  const c = CAST.find((x) => x.id === who);
  if (c) return { name: c.name, portrait: c.portrait, voice: c.voice as VoiceProfile, isSuspect: false };
  const s = SUSPECTS.find((x) => x.id === who);
  if (s)
    return {
      name: s.name,
      portrait: s.portrait,
      voice: (s as { voice: VoiceProfile }).voice,
      isSuspect: true,
    };
  return { name: '', portrait: '', voice: NARRATOR, isSuspect: false };
}

export const voiceOf = (who: string) => speaker(who).voice;

const NUM = ['①', '②', '③', '④', '⑤', '⑥'];

export class CutscenePlayer {
  private active = false;
  private resolveStep: (() => void) | null = null;
  private skipAll = false;
  private typing: { finish: () => void } | null = null;
  private bgKey = '';

  constructor(
    private host: HTMLElement,
    private env: CutsceneEnv,
  ) {
    host.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const ctl = t.closest<HTMLElement>('[data-cs]');
      if (ctl?.dataset.cs === 'skip') {
        this.skip();
        return;
      }
      if (ctl?.dataset.cs === 'auto') {
        this.env.setAutoAdvance(!this.env.autoAdvance());
        ctl.setAttribute('aria-pressed', String(this.env.autoAdvance()));
        ctl.textContent = this.env.autoAdvance() ? '자동 ▶' : '수동 ⏸';
        return;
      }
      this.advance();
    });
  }

  get isActive() {
    return this.active;
  }

  /** 키보드 입력을 컷신이 가져가면 true */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.active) return false;
    if (e.key === 'Escape') this.skip();
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.advance();
    }
    return true;
  }

  skip() {
    this.skipAll = true;
    tts.cancel();
    this.typing?.finish();
    this.resolveStep?.();
  }

  private advance() {
    if (this.typing) {
      this.typing.finish();
      return;
    }
    tts.cancel();
    this.resolveStep?.();
  }

  async play(steps: Step[]): Promise<void> {
    if (!steps.length) return;
    // 이전 컷신이 남아 있으면 정리
    while (this.active) await new Promise((r) => setTimeout(r, 30));
    this.active = true;
    this.skipAll = false;
    this.host.hidden = false;
    this.host.innerHTML = this.frame().value;
    document.body.classList.add('cutscene-open');
    try {
      for (const step of steps) {
        if (this.skipAll) break;
        await this.runStep(step);
      }
    } finally {
      tts.cancel();
      this.active = false;
      this.typing = null;
      this.resolveStep = null;
      this.host.classList.add('cs-closing');
      await new Promise((r) => setTimeout(r, this.env.reduceMotion() ? 0 : 250));
      this.host.classList.remove('cs-closing');
      this.host.hidden = true;
      this.host.innerHTML = '';
      this.bgKey = '';
      document.body.classList.remove('cutscene-open');
    }
  }

  private frame(): Raw {
    const auto = this.env.autoAdvance();
    return html`<div class="cs-root" role="dialog" aria-modal="true" aria-label="연출">
      <div class="cs-bg"></div>
      <div class="cs-fx" aria-hidden="true"></div>
      <div class="cs-center"></div>
      <div class="cs-portrait" aria-hidden="true"></div>
      <div class="cs-box" aria-live="polite">
        <div class="cs-name"></div>
        <div class="cs-text"></div>
        <div class="cs-next" aria-hidden="true">▼</div>
      </div>
      <div class="cs-controls">
        <button type="button" class="cs-btn" data-cs="auto" aria-pressed="${auto}">
          ${auto ? '자동 ▶' : '수동 ⏸'}
        </button>
        <button type="button" class="cs-btn" data-cs="skip">건너뛰기 ≫</button>
      </div>
    </div>`;
  }

  private q<T extends HTMLElement>(sel: string) {
    return this.host.querySelector<T>(sel)!;
  }

  private applyCommon(step: Step) {
    if (step.mood) this.env.setMood(step.mood);
    if (step.bg && step.bg !== this.bgKey) {
      this.bgKey = step.bg;
      const bg = this.q('.cs-bg');
      const src = bgSrc(step.bg);
      bg.className = `cs-bg bg-${step.bg}`;
      bg.style.backgroundImage = src ? `url("${src}")` : '';
    }
    if (step.sfx) sound.play(step.sfx);
    for (const fx of step.fx ?? []) this.runFx(fx);
  }

  private runFx(fx: Fx) {
    const reduce = this.env.reduceMotion();
    const layer = this.q('.cs-fx');
    if (fx === 'shake') {
      this.env.shake();
      if (!reduce) {
        const root = this.q('.cs-root');
        root.classList.remove('fx-shake');
        void root.offsetWidth;
        root.classList.add('fx-shake');
      }
      return;
    }
    if (fx === 'flash') this.env.flash('white');
    if (fx === 'blood') this.env.flash('red');
    const el = document.createElement('div');
    el.className = `fx-${fx}`;
    layer.appendChild(el);
    window.setTimeout(() => el.remove(), reduce ? 300 : 2400);
  }

  private async runStep(step: Step) {
    this.applyCommon(step);
    const box = this.q('.cs-box');
    const nameEl = this.q('.cs-name');
    const center = this.q('.cs-center');
    const portrait = this.q('.cs-portrait');
    const root = this.q('.cs-root');
    root.dataset.kind = step.t;

    let text = '';
    let voice: VoiceProfile = NARRATOR;
    let showBox = true;
    let typewrite = true;

    switch (step.t) {
      case 'title':
        center.innerHTML = html`<div class="cs-title">
          <h2 class="brush">${step.text}</h2>
          ${step.sub ? html`<p>${step.sub}</p>` : ''}
        </div>`.value;
        portrait.innerHTML = '';
        showBox = false;
        text = step.sub ? `${step.text}. ${step.sub}` : step.text;
        break;
      case 'narr':
        center.innerHTML = '';
        portrait.innerHTML = '';
        nameEl.textContent = '';
        text = step.text;
        break;
      case 'line': {
        const sp = speaker(step.who);
        center.innerHTML = '';
        portrait.innerHTML = sp.portrait
          ? html`<img src="${sp.portrait}" alt="" class="${step.who === 'protagonist' ? 'left' : 'right'}" />`
              .value
          : '';
        nameEl.textContent = sp.name;
        text = step.text;
        voice = sp.voice;
        break;
      }
      case 'journal': {
        const sp = speaker(step.reader);
        center.innerHTML = journalHtml(step.incident, step.upTo).value;
        center.querySelector('.is-new')?.scrollIntoView({ block: 'nearest' });
        portrait.innerHTML = '';
        nameEl.textContent = sp.name;
        text = step.text;
        voice = sp.voice;
        showBox = false;
        typewrite = false;
        break;
      }
      case 'hints': {
        const sp = speaker(step.reader);
        center.innerHTML = hintsHtml(step.hints, step.upTo).value;
        portrait.innerHTML = sp.portrait ? html`<img src="${sp.portrait}" alt="" class="right" />`.value : '';
        nameEl.textContent = sp.name;
        text = step.text;
        voice = sp.voice;
        showBox = false;
        typewrite = false;
        break;
      }
      case 'reveal': {
        const s = suspect(step.suspectId);
        center.innerHTML = html`<figure
          class="cs-reveal ${step.monster === true ? 'will-transform' : ''} ${step.monster === false ? 'is-human' : ''}"
        >
          <div class="rv human">${suspectPortrait(s.id, 'human', 'rv-img')}</div>
          ${step.monster ? html`<div class="rv yokai">${suspectPortrait(s.id, 'yokai', 'rv-img')}</div>` : ''}
          <figcaption>${s.name}${step.monster ? html` → <b>${s.yokai}</b>` : ''}</figcaption>
        </figure>`.value;
        portrait.innerHTML = '';
        nameEl.textContent = '';
        text = step.text;
        if (step.monster !== null) {
          window.setTimeout(
            () => {
              center.querySelector('.cs-reveal')?.classList.add('go');
              if (step.monster) this.runFx('flash');
              else this.runFx('blood');
            },
            this.env.reduceMotion() ? 0 : 900,
          );
        }
        break;
      }
    }

    box.hidden = !showBox && step.t !== 'journal' && step.t !== 'hints';
    box.classList.toggle('cs-box-mini', !showBox);
    const textEl = this.q('.cs-text');
    textEl.textContent = '';
    box.classList.remove('done');

    // 타이핑 + 음성 동시 진행
    const typed = this.typewriter(textEl, text, typewrite && !this.env.reduceMotion());
    const spoken = tts.speak(text, voice);
    const minRead = new Promise<void>((r) => setTimeout(r, step.t === 'title' ? 1400 : 0));

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        this.resolveStep = null;
        resolve();
      };
      this.resolveStep = done;
      if (this.skipAll) return done();
      Promise.all([typed, spoken, minRead]).then(([, usedVoice]) => {
        box.classList.add('done');
        if (!this.env.autoAdvance() || settled) return;
        // 음성이 없으면 읽을 시간을 준다
        const wait = usedVoice ? 650 : Math.min(6000, tts.estimateMs(text) * 0.6 + 900);
        window.setTimeout(() => {
          if (this.resolveStep === done && this.env.autoAdvance()) done();
        }, wait);
      });
    });
  }

  private typewriter(el: HTMLElement, text: string, animate: boolean): Promise<void> {
    if (!animate || !text) {
      el.textContent = text;
      this.typing = null;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let i = 0;
      const timer = window.setInterval(() => {
        i += 1;
        el.textContent = text.slice(0, i);
        if (i >= text.length) finish();
      }, 32);
      const finish = () => {
        window.clearInterval(timer);
        el.textContent = text;
        this.typing = null;
        resolve();
      };
      this.typing = { finish };
    });
  }
}

/* ---------------- 재생용 화면 조각 ---------------- */

function journalHtml(inc: Incident, upTo: number): Raw {
  const items = CATEGORIES.map((c, i) => {
    const v = clueValue(c.id, inc.clues[c.id]);
    const state = i < upTo - 1 ? 'is-shown' : i === upTo - 1 ? 'is-shown is-new' : 'is-hidden';
    return html`<li class="clue ${state}">
      <h4><span class="num">${NUM[i]}</span> ${c.name}: <strong>${i < upTo ? v.name : '……'}</strong></h4>
      ${i < upTo ? html`<p>${v.journal}</p>` : ''}
      ${c.id === 'circle' && i < upTo ? html`<div class="circle-art">${raw(circleSvg(v.id))}</div>` : ''}
    </li>`;
  });
  return html`<article class="book cs-book">
    <header class="book-head">
      <span>${inc.day}일차 검안</span> <span class="victim">피해자: ${inc.victim}</span>
    </header>
    <div class="book-pages">
      <ol class="page">
        ${items.slice(0, 4)}
      </ol>
      <ol class="page">
        ${items.slice(4)}
      </ol>
    </div>
  </article>`;
}

function hintsHtml(hints: Hint[], upTo: number): Raw {
  return html`<div class="cs-hints">
    <h3 class="brush">심문 일지</h3>
    <ol>
      ${hints.map((h, i) => {
        const s = suspect(h.suspectId);
        if (i >= upTo) return html`<li class="hint-card is-hidden">……</li>`;
        return html`<li class="hint-card ${i === upTo - 1 ? 'fresh' : ''}">
          <b class="hc-yokai">${s.yokai}</b> <span class="hc-cat">${category(h.category).name}</span>
          <strong class="hc-val">${clueValue(h.category, h.value).name}</strong>
        </li>`;
      })}
    </ol>
  </div>`;
}

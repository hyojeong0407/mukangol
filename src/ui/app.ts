import { sound, type BgmTrack, type Sfx } from '../audio/sound';
import { CONFIG } from '../config';
import { CATEGORY_IDS, SUSPECTS, TEXTS, suspect, type CategoryId } from '../core/data';
import * as G from '../core/game';
import { randomSeed } from '../core/rng';
import type { GameState, Mark } from '../core/types';
import type { FxController, Mood } from '../scenes/fx';
import { createSaveStore } from '../state/save';
import { applySettingsToDocument, loadSettings, saveSettings, type Settings } from '../state/settings';
import { suspectPortrait } from './assets';
import { CutscenePlayer, readMs, type Step } from './cutscene';
import { html, raw, type Raw } from './html';
import * as S from './story';
import { tutorialView, TUTORIAL } from './tutorial';
import * as V from './views';

type Screen = 'title' | 'intro' | 'howto' | 'game' | 'ending';
type Modal = null | 'settings' | 'execute' | 'confirm-new' | 'notice';

const MOOD_OF_PHASE = {
  dawn: 'dawn',
  morning: 'day',
  afternoon: 'day',
  night: 'night',
  final: 'final',
} as const;

export class App {
  private screen: Screen = 'title';
  private modal: Modal = null;
  private notice = '';
  private state: GameState | null = null;
  private settings: Settings = loadSettings();
  private store = createSaveStore();
  private fx: FxController | null = null;
  private ui: V.UiState = freshUi();
  private returnFocus: string | null = null;
  private cs: CutscenePlayer;
  private speechTimer = 0;
  /** 조사 방법 카드 쪽수, 다 보면 어디로 돌아갈지 (새 게임 시작 / 진행 중인 판 / 타이틀) */
  private tutPage = 0;
  private tutReturn: 'start' | 'game' | 'title' = 'start';

  constructor(
    private root: HTMLElement,
    csHost: HTMLElement,
  ) {
    applySettingsToDocument(this.settings);
    this.applyAudioSettings();
    this.cs = new CutscenePlayer(csHost, {
      setMood: (m) => this.setMood(m),
      shake: () => this.fx?.pulse(),
      flash: (c) => this.fx?.flash(c),
      reduceMotion: () => this.settings.reduceMotion,
      autoAdvance: () => this.settings.autoAdvance,
      setAutoAdvance: (v) => this.updateSettings({ autoAdvance: v }, false),
    });
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => this.onChange(e));
    root.addEventListener('input', (e) => this.onInput(e));
    document.addEventListener('keydown', (e) => this.onKey(e));
    // 브라우저 정책: 첫 입력 이후에만 소리를 켤 수 있다
    const unlock = () => sound.unlock();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    const loaded = this.store.load();
    if (loaded.status === 'ok') this.state = loaded.state;
    if (loaded.status === 'incompatible') {
      this.notice = `${loaded.reason} 새 게임을 시작해 주세요.`;
      this.modal = 'notice';
    }

    // 개발용: ?seed=XXXX 로 특정 판을 바로 연다 (버그 재현)
    const seed = new URLSearchParams(location.search).get('seed');
    if (seed && import.meta.env.DEV) void this.startNew(seed, false);
  }

  attachFx(fx: FxController) {
    this.fx = fx;
    fx.setReduceMotion(this.settings.reduceMotion);
    this.syncMood();
  }

  /* ---------------- 흐름 ---------------- */

  private play(steps: Step[]) {
    return this.cs.play(steps);
  }

  /** 새 게임: 프롤로그(해설 자막) → 오프닝(잠입·체포·결계) → 조사 방법 → 1일차 새벽 */
  private async startNew(seed = randomSeed(), withIntro = true) {
    this.state = G.newGame(seed);
    this.ui = freshUi();
    this.store.save(this.state);
    if (withIntro) {
      this.screen = 'intro';
      this.render();
      await this.play(S.prologueSteps());
      await this.play(S.openingSteps());
      this.tutPage = 0;
      this.tutReturn = 'start';
      this.screen = 'howto';
      this.render();
      return;
    }
    this.screen = 'game';
    this.render();
    await this.onPhaseEnter();
  }

  /** 조사 방법을 읽고 나면 바로 1일차 새벽이 시작된다 */
  private async afterHowto() {
    this.screen = 'game';
    this.render();
    await this.onPhaseEnter();
  }

  private commit(next: GameState, sfx?: Sfx): boolean {
    const phaseChanged = !this.state || next.phase !== this.state.phase || next.day !== this.state.day;
    this.state = next;
    if (!this.store.save(next) && this.store.available)
      this.flash('저장에 실패했습니다. 저장 공간을 확인해 주세요.');
    if (sfx) sound.play(sfx);
    this.render();
    return phaseChanged;
  }

  private async advance() {
    if (!this.state) return;
    if (this.commit(G.advance(this.state), 'click')) await this.onPhaseEnter();
  }

  /** 단계에 들어설 때의 연출 */
  private async onPhaseEnter() {
    const s = this.state!;
    this.ui.view = 'today';
    switch (s.phase) {
      case 'dawn': {
        const day = s.day;
        this.render();
        await this.play(S.dawnSteps(s));
        // 새벽 연출이 끝나면 바로 현장 보고(오전)로 넘어간다
        if (this.state?.phase === 'dawn' && this.state.day === day) await this.advance();
        return;
      }
      case 'morning':
        this.ui.caseLogDay = s.day;
        this.ui.boardDay = s.day;
        this.ui.seenIncidents = s.incidentLog.length;
        this.render();
        await this.play(S.journalSteps(s));
        return;
      case 'afternoon':
        // 옥이 비어 있으면 물을 사람이 없으므로 보고도 없다
        this.ui.reportPending = s.detained.length > 0;
        this.render();
        await this.play(S.prisonIntroSteps(s));
        return;
      case 'night':
        this.render();
        await this.play(S.nightSteps(s));
        return;
      case 'final':
        // 구속은 이제 심문·사건 저지용이라(민간인을 가둘 때도 많다) 처형 후보로 미리 고르지 않는다
        this.ui.executionPick = [];
        this.render();
        await this.play(S.finalIntroSteps());
        return;
    }
  }

  private async ask(id: string) {
    const s = this.state!;
    const next = G.ask(s, id);
    this.commit(next, 'click');
    await this.play(S.orderSteps(next.interrogationLog.at(-1)!));
    if (
      this.state &&
      (this.state.questionPoints === 0 || G.askableSuspects(this.state).length === 0) &&
      this.ui.reportPending
    )
      await this.report();
  }

  /** 잠시 후, 포졸이 심문 결과를 보고한다 → 심문 일지 */
  private async report() {
    const s = this.state!;
    await this.play(S.reportSteps(s));
    this.ui.reportPending = false;
    this.ui.view = 'interrogation';
    this.ui.interrogationMode = 'yokai';
    this.ui.seenHints = s.interrogationLog.length;
    this.render();
  }

  private async replay() {
    const s = this.state;
    if (!s || this.cs.isActive) return;
    const steps: Step[] = {
      dawn: S.dawnSteps(s),
      morning: S.journalSteps(s),
      afternoon: this.ui.reportPending ? S.prisonIntroSteps(s) : S.reportSteps(s),
      night: S.nightSteps(s),
      final: S.finalIntroSteps(),
    }[s.phase];
    await this.play(steps);
    this.syncMood();
  }

  private speak(id: string, detained: boolean) {
    const text = S.detainLine(id, detained, this.state!.detained.length + this.state!.day);
    this.ui.speech = { id, text };
    window.clearTimeout(this.speechTimer);
    // 항변 대사는 말풍선 자막으로만 보여 주고, 읽을 시간이 지나면 닫는다
    this.speechTimer = window.setTimeout(
      () => {
        if (this.ui.speech?.text === text) {
          this.ui.speech = null;
          this.render();
        }
      },
      readMs(text) + 1200,
    );
  }

  private async executeConfirm() {
    const s = this.state!;
    const next = G.execute(s, this.ui.executionPick);
    this.modal = null;
    this.state = next;
    this.store.save(next);
    this.render();
    sound.setBgm('ending');
    await this.play(S.executionSteps(next));
    this.screen = 'ending';
    this.render();
  }

  private setMood(mood: Mood) {
    this.fx?.setMood(mood);
  }

  /** 화면별 배경음 (audio-spec.md 2장) */
  private bgmTrack(): BgmTrack {
    // 엔딩 화면: 결과에 따라 해피/게임 오버 곡 (처형 연출 중에는 아래에서 'ending')
    if (this.screen === 'ending')
      return this.state?.ending === 'happy' ? 'happy' : this.state?.ending ? 'gameover' : 'ending';
    if (this.screen !== 'game' || !this.state) return 'title';
    const s = this.state;
    if (s.phase === 'final' || s.ending) return 'ending';
    if (s.phase === 'dawn') return 'dawn';
    // 오후 옥사 화면은 심문 곡, 일지·기록판을 펼쳐 볼 때는 추리 곡
    if (s.phase === 'afternoon' && (this.ui.view === 'today' || this.cs.isActive)) return 'interrogation';
    return 'reasoning';
  }

  private syncMood() {
    if (this.cs.isActive) return;
    let mood: Mood = 'title';
    if (this.screen === 'ending') mood = this.state?.ending === 'happy' ? 'happy' : 'gameover';
    else if (this.screen === 'game' && this.state) mood = MOOD_OF_PHASE[this.state.phase];
    this.setMood(mood);
  }

  private flash(msg: string) {
    this.ui.flash = msg;
    window.setTimeout(() => {
      if (this.ui.flash === msg) {
        this.ui.flash = null;
        this.render();
      }
    }, 2600);
  }

  /* ---------------- 입력 ---------------- */

  private onClick(e: Event) {
    if (this.cs.isActive) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!el || (el as HTMLButtonElement).disabled) return;
    const a = el.dataset.action!;
    if (a === 'close-modal-bg') {
      if (e.target === el && this.modal !== 'execute') this.closeModal();
      return;
    }
    try {
      const r = this.handle(a, el);
      if (r instanceof Promise) r.catch((err) => this.onError(err));
    } catch (err) {
      this.onError(err);
    }
  }

  private onError(err: unknown) {
    if (err instanceof G.RuleError) {
      this.flash(err.message);
      this.render();
    } else throw err;
  }

  private handle(a: string, el: HTMLElement): void | Promise<void> {
    const s = this.state;
    switch (a) {
      case 'new':
        if (s && !s.ending) return this.openModal('confirm-new', el);
        sound.play('click');
        return this.startNew();
      case 'new-confirmed':
        this.modal = null;
        return this.startNew();
      case 'continue':
        if (!s) return;
        sound.play('click');
        this.ui = freshUi();
        this.ui.reportPending = false; // 저장된 판에서는 이미 들은 보고로 본다
        this.screen = s.ending ? 'ending' : 'game';
        this.render();
        return;
      case 'title':
        this.screen = 'title';
        this.modal = null;
        this.render();
        return;
      case 'howto-done':
        if (this.tutReturn === 'start') return this.afterHowto();
        this.screen = this.tutReturn === 'game' && this.state ? 'game' : 'title';
        this.render();
        return;
      case 'howto-open':
        // 설정에서 "조사 방법 다시 보기"
        this.modal = null;
        this.tutPage = 0;
        this.tutReturn = this.screen === 'game' && this.state ? 'game' : 'title';
        this.screen = 'howto';
        this.render();
        return;
      case 'tut-next':
      case 'tut-prev':
      case 'tut-go':
        sound.play('paper');
        this.tutPage = a === 'tut-go' ? Number(el.dataset.page) : this.tutPage + (a === 'tut-next' ? 1 : -1);
        this.tutPage = Math.max(0, Math.min(TUTORIAL.length - 1, this.tutPage));
        this.render();
        this.root.querySelector<HTMLElement>('[data-action="tut-next"], [data-action="howto-done"]')?.focus();
        return;
      case 'tips-reset':
        this.updateSettings({ tipsSeen: [] });
        this.flash('처음 안내를 다시 띄웁니다.');
        return;
      case 'tip-ok': {
        const key = el.dataset.tip!;
        this.updateSettings({ tipsSeen: [...new Set([...this.settings.tipsSeen, key])] });
        return;
      }
      case 'settings':
        return this.openModal('settings', el);
      case 'close-modal':
        return this.closeModal();
      case 'clear-save':
        this.store.clear();
        this.state = null;
        this.modal = null;
        this.screen = 'title';
        this.flash('저장 데이터를 지웠습니다.');
        this.render();
        return;
    }
    if (!s) return;
    switch (a) {
      case 'view':
        this.ui.view = el.dataset.view as V.View;
        if (this.ui.view === 'caselog') this.ui.seenIncidents = s.incidentLog.length;
        if (this.ui.view === 'interrogation' && !this.ui.reportPending)
          this.ui.seenHints = s.interrogationLog.length;
        sound.play('paper');
        this.render();
        return;
      case 'advance':
        return this.advance();
      case 'ask':
        return this.ask(el.dataset.id ?? '');
      case 'report':
        return this.report();
      case 'replay':
        return this.replay();
      case 'replay-journal': {
        const day = Number(el.dataset.day);
        return this.play(S.journalSteps({ ...s, day })).then(() => this.syncMood());
      }
      case 'detain': {
        const id = el.dataset.id!;
        const next = G.toggleDetain(s, id);
        this.commit(next, 'stamp');
        this.speak(id, next.detained.includes(id));
        this.render();
        return;
      }
      case 'mark': {
        const [dayPart, rest] = el.dataset.key!.split('|');
        const [sid, cat] = rest.split(':');
        const cur = s.notes.marks[el.dataset.key!] as Mark | undefined;
        this.commit(G.setMark(s, Number(dayPart), sid, cat as CategoryId, G.cycleMark(cur)), 'stamp');
        return;
      }
      case 'caseday':
        this.ui.caseLogDay = Number(el.dataset.day);
        sound.play('paper');
        this.render();
        return;
      case 'boardday':
        this.ui.boardDay = Number(el.dataset.day);
        sound.play('paper');
        this.render();
        return;
      case 'imode':
        this.ui.interrogationMode = el.dataset.mode as 'yokai' | 'category';
        this.render();
        return;
      case 'pick': {
        const id = el.dataset.id!;
        const p = this.ui.executionPick;
        if (p.includes(id)) this.ui.executionPick = p.filter((x) => x !== id);
        else if (p.length < CONFIG.executionCount) {
          this.ui.executionPick = [...p, id];
          sound.play('heartbeat');
        } else this.flash(`${CONFIG.executionCount}명까지만 지목할 수 있습니다. 먼저 한 명을 빼십시오.`);
        sound.play('click');
        this.render();
        return;
      }
      case 'execute-open':
        sound.play('heartbeat');
        return this.openModal('execute', el);
      case 'execute-confirm':
        return this.executeConfirm();
      case 'retry':
        return this.startNew(randomSeed(), false);
    }
  }

  private onChange(e: Event) {
    const el = e.target as HTMLElement;
    const s = this.state;
    if (el.dataset.action === 'culprit' && s) {
      this.commit(G.setCulpritNote(s, Number(el.dataset.day), (el as HTMLSelectElement).value));
      return;
    }
    const input = el as HTMLInputElement;
    if (input.name === 'textScale')
      this.updateSettings({ textScale: Number(input.value) as Settings['textScale'] });
    if (input.name === 'reduceMotion') this.updateSettings({ reduceMotion: input.checked });
    if (input.name === 'autoAdvance') this.updateSettings({ autoAdvance: input.checked });
  }

  private onInput(e: Event) {
    const el = e.target as HTMLInputElement;
    if (el.name === 'bgmVolume') this.updateSettings({ bgmVolume: Number(el.value) / 100 }, false);
    if (el.name === 'sfxVolume') this.updateSettings({ sfxVolume: Number(el.value) / 100 }, false);
  }

  private applyAudioSettings() {
    sound.setVolumes(this.settings.bgmVolume, this.settings.sfxVolume);
  }

  private updateSettings(patch: Partial<Settings>, rerender = true) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    applySettingsToDocument(this.settings);
    this.applyAudioSettings();
    this.fx?.setReduceMotion(this.settings.reduceMotion);
    if (rerender) this.render();
  }

  private onKey(e: KeyboardEvent) {
    if (this.cs.handleKey(e)) return;
    if (e.key === 'Escape' && this.modal) {
      this.closeModal();
      return;
    }
    const tag = (e.target as HTMLElement).tagName;
    if (
      this.modal ||
      tag === 'INPUT' ||
      tag === 'SELECT' ||
      tag === 'TEXTAREA' ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (this.screen === 'howto') {
      if (e.key === 'ArrowRight') this.root.querySelector<HTMLElement>('[data-action="tut-next"]')?.click();
      if (e.key === 'ArrowLeft')
        this.root.querySelector<HTMLElement>('[data-action="tut-prev"]:not([disabled])')?.click();
      return;
    }
    if (this.screen !== 'game' || !this.state) return;
    const views: V.View[] = ['today', 'caselog', 'interrogation', 'board', 'suspects'];
    const n = Number(e.key);
    if (n >= 1 && n <= 5)
      this.root.querySelector<HTMLElement>(`[data-action="view"][data-view="${views[n - 1]}"]`)?.click();
    if (e.key === 'n' || e.key === 'N')
      this.root.querySelector<HTMLButtonElement>('[data-action="advance"]:not([disabled])')?.click();
  }

  private openModal(m: Modal, from?: HTMLElement) {
    this.returnFocus = from?.dataset.action ?? null;
    this.modal = m;
    this.render();
    this.root.querySelector<HTMLElement>('.modal [autofocus], .modal button')?.focus();
  }

  private closeModal() {
    this.modal = null;
    this.render();
    if (this.returnFocus)
      this.root.querySelector<HTMLElement>(`[data-action="${this.returnFocus}"]`)?.focus();
  }

  /* ---------------- 그리기 ---------------- */

  render() {
    this.ui.tips = this.settings.tipsSeen;
    const body = {
      title: () => this.titleScreen(),
      intro: () => html`<main class="intro-backdrop" aria-hidden="true"></main>`,
      howto: () => this.howtoScreen(),
      game: () => this.gameScreen(),
      ending: () => this.endingScreen(),
    }[this.screen]();
    const focusedKey = (document.activeElement as HTMLElement | null)?.dataset;
    const keep = focusedKey?.action
      ? {
          action: focusedKey.action,
          key: focusedKey.key ?? focusedKey.id ?? focusedKey.view ?? focusedKey.q ?? focusedKey.day,
        }
      : null;

    this.root.innerHTML =
      html`${body}${this.modalView()}${this.ui.flash ? html`<div class="toast" role="status">${this.ui.flash}</div>` : ''}${this.debugPanel()}`.value;
    this.root.dataset.screen = this.screen;
    document.body.dataset.phase = this.state?.phase ?? '';

    // 다시 그린 뒤에도 키보드 포커스를 유지한다 (접근성)
    if (keep && !this.modal) {
      const sel = [...this.root.querySelectorAll<HTMLElement>(`[data-action="${keep.action}"]`)].find((x) => {
        const d = x.dataset;
        return (d.key ?? d.id ?? d.view ?? d.q ?? d.day) === keep.key;
      });
      sel?.focus({ preventScroll: true });
    }
    this.syncMood();
    sound.setBgm(this.bgmTrack());
  }

  private titleScreen(): Raw {
    const has = !!this.state;
    return html`<main class="title-screen">
      <div class="title-scroll">
        <h1 class="brush title-logo">
          ${TEXTS.title}<span class="seal" aria-hidden="true">묵안<br />골장</span>
        </h1>
        <p class="title-sub">${TEXTS.subtitle}</p>
        <div class="title-menu">
          <button class="btn btn-scroll" data-action="new">새 게임</button>
          <button
            class="btn btn-scroll"
            data-action="continue"
            ${has ? '' : raw('disabled')}
            title="${has ? '' : '저장된 게임이 없습니다'}"
          >
            이어하기${has && this.state ? html` <small>(${this.state.ending ? '끝난 판' : `${this.state.day}일차`})</small>` : ''}
          </button>
          <button class="btn btn-scroll" data-action="settings">설정</button>
        </div>
        <p class="disclaimer">${TEXTS.disclaimer} 소리가 나옵니다.<br />${TEXTS.aiNotice}</p>
      </div>
    </main>`;
  }

  /** 조사 방법: 카드 한 장에 개념 하나 (src/ui/tutorial.ts) */
  private howtoScreen(): Raw {
    return tutorialView(this.tutPage, this.tutReturn !== 'start');
  }

  private gameScreen(): Raw {
    const s = this.state!;
    const ui = this.ui;
    const content = {
      today: () => V.todayView(s, ui),
      caselog: () => V.caseLogView(s, ui),
      interrogation: () => V.interrogationView(s, ui),
      board: () => V.boardView(s, ui),
      suspects: () => V.suspectsView(s, ui),
    }[ui.view]();
    return html`<div class="game">
      ${V.hud(s, ui)}
      <main class="stage view-${ui.view}" id="stage">${content}</main>
      ${V.footer(s, ui)}
    </div>`;
  }

  private endingScreen(): Raw {
    const s = this.state!;
    const kind = G.endingKind(s) ?? 'game_over';
    const e = TEXTS.endings[kind];
    const prevented = new Set(s.incidentLog.filter((x) => x.prevented).map((x) => x.day));
    const civ = suspect(s.board.civilianId);
    return html`<main class="ending ending-${kind}">
      <div class="paper ending-paper">
        <h1 class="brush">${{ happy: '해피 엔딩', bitter: '씁쓸한 엔딩', game_over: '게임 오버' }[kind]}</h1>
        <h2>${e.title}</h2>
        <p class="ending-tally">
          희생자 <b>${G.victimCount(s)}명</b> · 구속으로 막아 낸 사건 <b>${G.preventedCount(s)}건</b>
        </p>
        ${e.body.map((p) => html`<p>${p}</p>`)}
        <div class="reveal">
          <h3>진상</h3>
          <div class="reveal-grid">
            ${SUSPECTS.map((p) => {
              const human = p.id === s.board.civilianId;
              return html`<figure class="${human ? 'is-human' : ''}">
                ${suspectPortrait(p.id, human ? 'human' : 'yokai', 'thumb-lg')}
                <figcaption>
                  <b>${p.name}</b> ${human ? '사람' : p.yokai}
                  ${s.executed.includes(p.id) ? html`<small>처형됨</small>` : ''}
                </figcaption>
              </figure>`;
            })}
          </div>
          <br />
          <p>사람이었던 이: <b>${civ.name}</b> (${civ.disguise})</p>
          <ol>
            ${s.board.eventOrder.map(
              (id, i) =>
                html`<li>
                  ${i + 1}일차 — ${suspect(id).yokai} <small>(${suspect(id).name})</small>
                  ${prevented.has(i + 1) ? html`<small class="tag-prevented">옥에 갇혀 막힘</small>` : ''}
                </li>`,
            )}
          </ol>
          <p class="dim">판 번호 ${s.seed}</p>
        </div>
        <div class="row">
          <button class="btn btn-primary" data-action="retry">다시 하기</button>
          <button class="btn" data-action="title">타이틀로</button>
        </div>
      </div>
    </main>`;
  }

  private modalView(): Raw {
    if (!this.modal) return html``;
    let inner: Raw;
    if (this.modal === 'settings') inner = this.settingsView();
    else if (this.modal === 'execute') {
      const names = this.ui.executionPick.map((id) => `${suspect(id).name}(${suspect(id).yokai})`);
      inner = html`<h2 id="modal-title">최종 결정</h2>
        <p>정말 이 넷을 처형하시겠습니까?</p>
        <p class="exec-summary"><b>${names.join(' · ')}</b></p>
        <p class="warn">이 결정은 되돌릴 수 없습니다. 사람을 베면 결계는 영영 닫힙니다.</p>
        <div class="row">
          <button class="btn" data-action="close-modal" autofocus>다시 생각한다</button>
          <button class="btn btn-danger" data-action="execute-confirm">처형한다</button>
        </div>`;
    } else if (this.modal === 'confirm-new') {
      inner = html`<h2 id="modal-title">새 게임</h2>
        <p>진행 중인 판이 있습니다. 새로 시작하면 지금 판은 지워집니다.</p>
        <div class="row">
          <button class="btn" data-action="close-modal" autofocus>취소</button>
          <button class="btn btn-primary" data-action="new-confirmed">새로 시작</button>
        </div>`;
    } else {
      inner = html`<h2 id="modal-title">알림</h2>
        <p>${this.notice}</p>
        <div class="row">
          <button class="btn btn-primary" data-action="close-modal" autofocus>확인</button>
        </div>`;
    }
    return html`<div class="modal-backdrop" data-action="close-modal-bg">
      <div class="modal paper" role="dialog" aria-modal="true" aria-labelledby="modal-title">${inner}</div>
    </div>`;
  }

  private settingsView(): Raw {
    const st = this.settings;
    const scale = (v: number, label: string) =>
      html`<label
        ><input type="radio" name="textScale" value="${v}" ${st.textScale === v ? raw('checked') : ''} />
        ${label}</label
      >`;
    const range = (name: string, label: string, v: number) =>
      html`<label class="range"
        >${label} <input type="range" name="${name}" min="0" max="100" value="${Math.round(v * 100)}"
      /></label>`;
    return html`<h2 id="modal-title">설정</h2>
      <div class="settings">
        ${range('bgmVolume', '배경음', st.bgmVolume)} ${range('sfxVolume', '효과음', st.sfxVolume)}
        <label
          ><input type="checkbox" name="autoAdvance" ${st.autoAdvance ? raw('checked') : ''} /> 대사 자동
          넘김</label
        >
        <fieldset>
          <legend>글자 크기</legend>
          ${scale(1, '보통')}${scale(1.15, '크게')}${scale(1.3, '아주 크게')}
        </fieldset>
        <label
          ><input type="checkbox" name="reduceMotion" ${st.reduceMotion ? raw('checked') : ''} /> 연출 줄이기
          (흔들림·번쩍임·움직임 끄기)</label
        >
        <div class="row">
          <button class="btn" data-action="howto-open">조사 방법 다시 보기</button>
          <button class="btn" data-action="tips-reset" ${st.tipsSeen.length ? '' : raw('disabled')}>
            처음 안내 다시 띄우기
          </button>
        </div>
        ${this.state ? html`<p class="dim">판 번호: <code>${this.state.seed}</code> (버그 신고 때 알려 주세요)</p>` : ''}
        <button class="btn btn-danger-outline" data-action="clear-save" ${this.state ? '' : raw('disabled')}>
          저장 데이터 삭제
        </button>
        <p class="dim small">${TEXTS.disclaimer} ${TEXTS.aiNotice}</p>
      </div>
      <div class="row">
        ${this.screen === 'game' ? html`<button class="btn" data-action="title">타이틀로</button>` : ''}
        <button class="btn btn-primary" data-action="close-modal" autofocus>닫기</button>
      </div>`;
  }

  /** 개발 빌드 전용 정답 패널 (프로덕션 빌드에서는 import.meta.env.DEV가 false라 제거된다) */
  private debugPanel(): Raw {
    if (!import.meta.env.DEV || !this.state || this.screen !== 'game') return html``;
    const b = this.state.board;
    return html`<details class="debug">
      <summary>DEBUG</summary>
      <p>seed ${b.seed} · 민간인 <b>${suspect(b.civilianId).name}</b></p>
      <p>사건 순서: ${b.eventOrder.map((id) => suspect(id).yokai).join(' → ')}</p>
      <table>
        ${SUSPECTS.map(
          (p) =>
            html`<tr>
              <th>${p.yokai}</th>
              ${CATEGORY_IDS.map((c) => html`<td>${b.profiles[p.id][c]}</td>`)}
            </tr>`,
        )}
      </table>
    </details>`;
  }
}

function freshUi(): V.UiState {
  return {
    view: 'today',
    caseLogDay: 1,
    boardDay: 1,
    interrogationMode: 'yokai',
    executionPick: [],
    reportPending: false,
    seenIncidents: 0,
    seenHints: 0,
    flash: null,
    speech: null,
    tips: [],
  };
}

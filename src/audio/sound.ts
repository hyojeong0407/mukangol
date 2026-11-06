/**
 * 사운드 관리.
 * - 배경음(BGM): 동업자 음원 audio/bgm-{title|dawn|reasoning|interrogation|ending|ending-happy|ending-gameover}.ogg (audio-spec.md).
 *   화면이 바뀌면 이전 곡은 페이드아웃, 새 곡은 페이드인한다. 파일이 없으면 합성 드론으로 대신한다.
 * - 효과음: audio/sfx-{종류}.ogg 가 있으면 그 파일, 없으면 Web Audio 합성음.
 * 브라우저 정책상 첫 사용자 입력 이후에만 소리가 난다.
 */
export type Sfx = 'paper' | 'stamp' | 'gong' | 'click' | 'reveal' | 'heartbeat' | 'rooster';
export type BgmTrack = 'title' | 'dawn' | 'reasoning' | 'interrogation' | 'ending' | 'happy' | 'gameover';

/** 트랙 이름 → 음원 파일 이름 (audio/ 폴더 기준, 확장자 제외) */
const FILE_OF: Record<BgmTrack, string> = {
  title: 'bgm-title',
  dawn: 'bgm-dawn',
  reasoning: 'bgm-reasoning',
  interrogation: 'bgm-interrogation',
  ending: 'bgm-ending',
  happy: 'bgm-ending-happy',
  gameover: 'bgm-ending-gameover',
};

/** audio-spec.md 2장: 반복 재생 여부 */
// 처형 곡(ending)만 한 번 재생. 엔딩 화면은 머무는 시간이 정해져 있지 않아 반복한다.
const LOOP: Record<BgmTrack, boolean> = {
  title: true,
  dawn: true,
  reasoning: true,
  interrogation: true,
  ending: false,
  happy: true,
  gameover: true,
};
/** 음원 파일이 없을 때 합성 드론의 분위기 */
const SYNTH_MOOD: Record<BgmTrack, 'calm' | 'tense'> = {
  title: 'calm',
  dawn: 'calm',
  reasoning: 'calm',
  interrogation: 'tense',
  ending: 'tense',
  happy: 'calm',
  gameover: 'tense',
};
const FADE_MS = 1200;
const BGM_LEVEL = 0.6; // 효과음이 묻히지 않도록 배경음 상한

class SoundManager {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmNodes: AudioScheduledSourceNode[] = [];
  private bgmVolume = 0.5;
  private sfxVolume = 0.7;
  private mood: 'calm' | 'tense' | 'none' = 'none';

  /** 첫 사용자 입력에서 호출 */
  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.bgmGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.bgmGain.connect(this.ctx.destination);
    this.sfxGain.connect(this.ctx.destination);
    this.setVolumes(this.bgmVolume, this.sfxVolume);
    // 입력 전에 정해 둔 배경음을 이제 재생한다
    const pending = this.track;
    this.track = null;
    if (pending) this.setBgm(pending);
  }

  setVolumes(bgm: number, sfx: number) {
    this.bgmVolume = bgm;
    this.sfxVolume = sfx;
    if (this.ctx && this.bgmGain && this.sfxGain) {
      this.bgmGain.gain.setTargetAtTime(bgm * 0.35, this.ctx.currentTime, 0.2);
      this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    }
    this.applyBgmVolume();
  }

  /* ---------------- 배경음 ---------------- */

  private track: BgmTrack | null = null;
  private bgmEls: HTMLAudioElement[] = [];
  private current: HTMLAudioElement | null = null;
  private fades = new Map<HTMLAudioElement, number>();

  /** 지금 화면에 맞는 배경음. 같은 곡이면 그대로 이어서 재생한다. */
  setBgm(track: BgmTrack | null) {
    if (track === this.track) return;
    this.track = track;
    if (!this.ctx) return; // 첫 입력 뒤 unlock()에서 재생
    const src = track ? this.files.get(FILE_OF[track]) : undefined;
    // 이전 곡 페이드아웃
    if (this.current) this.fadeTo(this.current, 0, true);
    this.current = null;
    if (src && track) {
      this.setSynth('none');
      const el = new Audio(src);
      el.loop = LOOP[track];
      el.volume = 0;
      el.dataset.level = '0';
      void el.play().catch(() => undefined);
      this.bgmEls.push(el);
      this.current = el;
      this.fadeTo(el, 1, false);
    } else {
      this.setSynth(track ? SYNTH_MOOD[track] : 'none');
    }
  }

  private elVolume(level: number) {
    return Math.max(0, Math.min(1, this.bgmVolume * BGM_LEVEL * level));
  }

  private applyBgmVolume() {
    for (const el of this.bgmEls) el.volume = this.elVolume(Number(el.dataset.level ?? 0));
  }

  private fadeTo(el: HTMLAudioElement, target: number, removeAfter: boolean) {
    window.clearInterval(this.fades.get(el));
    const start = Number(el.dataset.level ?? 0);
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / FADE_MS);
      const level = start + (target - start) * k;
      el.dataset.level = String(level);
      el.volume = this.elVolume(level);
      if (k >= 1) {
        window.clearInterval(id);
        this.fades.delete(el);
        if (removeAfter) {
          el.pause();
          el.removeAttribute('src');
          this.bgmEls = this.bgmEls.filter((x) => x !== el);
        }
      }
    }, 50);
    this.fades.set(el, id);
  }

  /** 음원 파일이 없을 때의 합성 드론: 낮게 깔리는 음과 바람 소리 */
  private setSynth(mood: 'calm' | 'tense' | 'none') {
    if (mood === this.mood) return;
    this.mood = mood;
    const ctx = this.ctx;
    if (!ctx || !this.bgmGain) return;
    const t = ctx.currentTime;
    for (const n of this.bgmNodes) {
      try {
        n.stop(t + 1.5);
      } catch {
        /* 이미 정지 */
      }
    }
    this.bgmNodes = [];
    if (mood === 'none') return;

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0, t);
    bus.gain.linearRampToValueAtTime(1, t + 3);
    bus.connect(this.bgmGain);

    const base = mood === 'tense' ? 49 : 55; // G1 / A1
    for (const [mult, vol] of [
      [1, 0.5],
      [1.5, 0.18],
      [mood === 'tense' ? 1.06 : 2, 0.12],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * mult;
      const g = ctx.createGain();
      g.gain.value = vol;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lg = ctx.createGain();
      lg.gain.value = vol * 0.6;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(bus);
      o.start(t);
      lfo.start(t);
      this.bgmNodes.push(o, lfo);
    }
    // 바람
    const noise = this.noiseSource(4, true);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 400;
    bp.Q.value = 0.7;
    const wl = ctx.createOscillator();
    wl.frequency.value = 0.08;
    const wg = ctx.createGain();
    wg.gain.value = 250;
    wl.connect(wg).connect(bp.frequency);
    const ng = ctx.createGain();
    ng.gain.value = 0.15;
    noise.connect(bp).connect(ng).connect(bus);
    noise.start(t);
    wl.start(t);
    this.bgmNodes.push(noise, wl);
  }

  private noiseSource(seconds: number, loop = false) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    return src;
  }

  /** manifest에 있는 음원 파일 목록을 등록한다 (audio/sfx-*.ogg, audio/bgm-*.ogg) */
  private files = new Map<string, string>();
  private buffers = new Map<string, AudioBuffer>();

  useFiles(list: string[]) {
    for (const f of list) {
      const m = f.match(/^audio\/((?:sfx|bgm)-[a-z0-9-]+)\.(ogg|mp3|m4a|wav)$/);
      if (!m) continue;
      // 같은 이름이면 ogg를 우선
      if (!this.files.has(m[1]) || m[2] === 'ogg') this.files.set(m[1], f);
    }
    // 목록이 늦게 도착했으면 지금 곡을 파일로 다시 튼다
    const t = this.track;
    if (t && this.ctx && !this.current && this.files.has(FILE_OF[t])) {
      this.track = null;
      this.mood = 'none';
      this.setBgm(t);
    }
  }

  private async buffer(name: string): Promise<AudioBuffer | null> {
    const src = this.files.get(name);
    if (!src || !this.ctx) return null;
    const cached = this.buffers.get(name);
    if (cached) return cached;
    try {
      const data = await (await fetch(src)).arrayBuffer();
      const buf = await this.ctx.decodeAudioData(data);
      this.buffers.set(name, buf);
      return buf;
    } catch {
      this.files.delete(name);
      return null;
    }
  }

  play(kind: Sfx) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain || this.sfxVolume <= 0) return;
    if (this.files.has(`sfx-${kind}`)) {
      void this.buffer(`sfx-${kind}`).then((buf) => {
        if (!buf || !this.sfxGain) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.sfxGain);
        src.start();
      });
      return;
    }
    const t = ctx.currentTime;
    const out = this.sfxGain;
    const env = (g: GainNode, peak: number, attack: number, decay: number) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    };
    switch (kind) {
      case 'paper': {
        const n = this.noiseSource(0.4);
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 2500;
        const g = ctx.createGain();
        env(g, 0.25, 0.02, 0.25);
        n.connect(f).connect(g).connect(out);
        n.start(t);
        break;
      }
      case 'stamp': {
        const o = ctx.createOscillator();
        o.frequency.setValueAtTime(160, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.15);
        const g = ctx.createGain();
        env(g, 0.6, 0.005, 0.18);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.3);
        break;
      }
      case 'gong': {
        for (const [f, v] of [
          [98, 0.4],
          [196.7, 0.15],
          [263, 0.1],
          [331, 0.06],
        ] as const) {
          const o = ctx.createOscillator();
          o.frequency.value = f;
          const g = ctx.createGain();
          env(g, v, 0.01, 4);
          o.connect(g).connect(out);
          o.start(t);
          o.stop(t + 4.2);
        }
        break;
      }
      case 'click': {
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = 700;
        const g = ctx.createGain();
        env(g, 0.08, 0.002, 0.05);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.1);
        break;
      }
      case 'reveal': {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, t);
        o.frequency.exponentialRampToValueAtTime(440, t + 1.2);
        const g = ctx.createGain();
        env(g, 0.12, 0.01, 1.4);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 1.6);
        break;
      }
      case 'heartbeat': {
        for (const dt of [0, 0.28]) {
          const o = ctx.createOscillator();
          o.frequency.value = 55;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t + dt);
          g.gain.exponentialRampToValueAtTime(0.7, t + dt + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.2);
          o.connect(g).connect(out);
          o.start(t + dt);
          o.stop(t + dt + 0.3);
        }
        break;
      }
      case 'rooster': {
        // 닭 울음을 흉내 낸 짧은 글리산도 (임시)
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 1400;
        f.Q.value = 3;
        o.frequency.setValueAtTime(500, t);
        o.frequency.linearRampToValueAtTime(900, t + 0.25);
        o.frequency.linearRampToValueAtTime(820, t + 0.7);
        o.frequency.linearRampToValueAtTime(450, t + 1.1);
        const g = ctx.createGain();
        env(g, 0.12, 0.05, 1.1);
        o.connect(f).connect(g).connect(out);
        o.start(t);
        o.stop(t + 1.3);
        break;
      }
    }
  }
}

export const sound = new SoundManager();

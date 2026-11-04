/**
 * TTS(음성 합성): 브라우저 내장 Web Speech API를 쓴다. 외부 서버·비용 없음.
 * - 기기마다 설치된 한국어 음성이 다르다. (Windows Edge: SunHi/InJoon, Windows Chrome: Heami, Google 한국의 등)
 * - 남성 배역은 남성 음성을 우선 찾고, 없으면 같은 음성의 음높이를 낮춰 구분한다.
 * - 음성이 없거나 꺼져 있으면 자막만 보이고, 읽는 시간만큼 기다린 뒤 진행한다.
 * - 크롬은 긴 문장을 중간에 끊는 버그가 있어 문장 단위로 나눠 읽는다.
 */

export interface VoiceProfile {
  gender: 'male' | 'female';
  pitch: number; // 0~2, 기본 1
  rate: number; // 0.1~10, 기본 1
}

const MALE_HINTS = ['injoon', 'hyunsu', 'bongjin', 'gookmin', 'male', '남'];
const FEMALE_HINTS = ['sunhi', 'heami', 'yuna', 'jimin', 'seoyeon', 'female', 'google', '여'];

class TtsManager {
  enabled = true;
  /** 음성이 나오기 시작/끝날 때 (배경음 덕킹용) */
  onSpeaking: ((on: boolean) => void) | null = null;
  volume = 1;
  rateScale = 1;
  private voices: SpeechSynthesisVoice[] = [];
  private token = 0;
  private synth: SpeechSynthesis | null =
    typeof window !== 'undefined' ? (window.speechSynthesis ?? null) : null;

  constructor() {
    if (!this.synth) return;
    const load = () => {
      this.voices = this.synth!.getVoices().filter((v) => v.lang.toLowerCase().startsWith('ko'));
    };
    load();
    this.synth.addEventListener?.('voiceschanged', load);
  }

  get available() {
    return !!this.synth && this.voices.length > 0;
  }

  private pickVoice(gender: VoiceProfile['gender']): {
    voice: SpeechSynthesisVoice | null;
    matched: boolean;
  } {
    if (!this.voices.length) return { voice: null, matched: false };
    const hints = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
    const found = this.voices.find((v) => hints.some((h) => v.name.toLowerCase().includes(h)));
    // 같은 성별 음성이 없으면 첫 한국어 음성으로 대신하고 음높이로 구분한다
    return found ? { voice: found, matched: true } : { voice: this.voices[0], matched: false };
  }

  /** 읽기 예상 시간 (음성이 없을 때 대기 시간, 음성이 끝 신호를 안 줄 때 안전장치) */
  estimateMs(text: string) {
    return Math.max(900, text.replace(/\s/g, '').length * 140) / (this.rateScale || 1);
  }

  cancel() {
    this.token++;
    this.onSpeaking?.(false);
    try {
      this.synth?.cancel();
    } catch {
      /* 무시 */
    }
  }

  /** 다 읽으면(또는 취소되면) resolve. 음성을 쓸 수 없으면 바로 resolve(false). */
  speak(text: string, profile: VoiceProfile): Promise<boolean> {
    this.cancel();
    if (!this.enabled || !this.synth || !this.voices.length || this.volume <= 0)
      return Promise.resolve(false);
    const my = this.token;
    const { voice, matched } = this.pickVoice(profile.gender);
    // 따옴표, 말줄임표 등 읽기 어색한 기호 정리
    const clean = text.replace(/[「」『』“”"]/g, '').replace(/…+/g, ', ');
    const chunks = clean
      .match(/[^.!?。]+[.!?。]*/g)
      ?.map((c) => c.trim())
      .filter(Boolean) ?? [clean];

    this.onSpeaking?.(true);
    return new Promise((resolve) => {
      let i = 0;
      const end = () => {
        if (my === this.token) this.onSpeaking?.(false);
        resolve(true);
      };
      const next = () => {
        if (my !== this.token) return end();
        if (i >= chunks.length) return end();
        const chunk = chunks[i++];
        const u = new SpeechSynthesisUtterance(chunk);
        u.lang = voice?.lang ?? 'ko-KR';
        if (voice) u.voice = voice;
        let pitch = profile.pitch;
        // 남성 배역인데 여성 음성밖에 없으면 더 낮춘다
        if (!matched && profile.gender === 'male') pitch = Math.max(0.1, pitch - 0.35);
        u.pitch = Math.min(2, Math.max(0, pitch));
        u.rate = Math.min(2, Math.max(0.5, profile.rate * this.rateScale));
        u.volume = this.volume;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          window.clearTimeout(guard);
          next();
        };
        // 일부 브라우저는 end 이벤트를 주지 않는다 → 예상 시간의 2배가 지나면 넘어간다
        const guard = window.setTimeout(finish, this.estimateMs(chunk) * 2 + 1500);
        u.onend = finish;
        u.onerror = finish;
        this.synth!.speak(u);
      };
      next();
    });
  }
}

export const tts = new TtsManager();

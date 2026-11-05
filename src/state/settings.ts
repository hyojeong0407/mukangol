import { STORAGE_KEYS } from '../config';

export interface Settings {
  bgmVolume: number; // 0~1
  sfxVolume: number; // 0~1
  textScale: 1 | 1.15 | 1.3;
  reduceMotion: boolean;
  /** 대사가 끝나면 자동으로 다음 대사로 */
  autoAdvance: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  bgmVolume: 0.5,
  sfxVolume: 0.7,
  textScale: 1,
  reduceMotion: false,
  autoAdvance: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) {
      const prefersReduce = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      return { ...DEFAULT_SETTINGS, reduceMotion: prefersReduce };
    }
    // v0.2의 대사 음성 설정(voiceOn, voiceVolume)은 더 이상 쓰지 않으므로 버린다
    const saved = JSON.parse(raw) as Record<string, unknown>;
    delete saved.voiceOn;
    delete saved.voiceVolume;
    return { ...DEFAULT_SETTINGS, ...(saved as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(s));
  } catch {
    /* 저장 불가 환경: 이번 세션에만 적용 */
  }
}

export function applySettingsToDocument(s: Settings) {
  const root = document.documentElement;
  root.style.setProperty('--text-scale', String(s.textScale));
  root.dataset.reduceMotion = s.reduceMotion ? 'true' : 'false';
}

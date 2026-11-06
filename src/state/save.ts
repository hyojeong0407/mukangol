import { CONFIG, STORAGE_KEYS } from '../config';
import type { GameState } from '../core/types';

/** localStorage 래퍼. 사생활 모드 등에서 접근이 막혀도 게임은 계속 돈다. */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function defaultStore(): KV | null {
  try {
    const ls = globalThis.localStorage;
    const probe = '__mukangol_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;
/** version N → N+1 변환 함수. 저장 형식이 바뀌면 여기에 추가한다. */
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: 기록판 표시가 사건(일차)별로 나뉘었다. 예전 표시는 1일차 페이지로 옮긴다.
  1: (raw) => {
    const notes = (raw.notes ?? {}) as { marks?: Record<string, string>; culprits?: Record<string, string> };
    const marks: Record<string, string> = {};
    for (const [k, v] of Object.entries(notes.marks ?? {})) marks[k.includes('|') ? k : `1|${k}`] = v;
    return { ...raw, notes: { ...notes, marks }, version: 2 };
  },
  // v2 → v3: 없음. 심문이 "정해진 질문"에서 "요괴를 골라 묻기"로 바뀌고 판 구조(askOrder, 값 겹침)가 달라져
  // 예전 판을 이어 갈 수 없다. 이어하기에서 안내하고 새 게임을 시작한다.
};

export type LoadResult =
  { status: 'none' } | { status: 'ok'; state: GameState } | { status: 'incompatible'; reason: string };

export function migrate(raw: unknown): LoadResult {
  if (!raw || typeof raw !== 'object')
    return { status: 'incompatible', reason: '저장 데이터가 손상되었습니다.' };
  let obj = raw as Record<string, unknown>;
  let v = typeof obj.version === 'number' ? obj.version : 0;
  while (v < CONFIG.saveVersion) {
    const m = MIGRATIONS[v];
    if (!m) return { status: 'incompatible', reason: `이전 버전(v${v}) 저장은 불러올 수 없습니다.` };
    obj = m(obj);
    v = obj.version as number;
  }
  if (v > CONFIG.saveVersion) return { status: 'incompatible', reason: '더 새로운 버전의 저장입니다.' };
  const s = obj as unknown as GameState;
  if (!s.board || !s.seed || typeof s.day !== 'number')
    return { status: 'incompatible', reason: '저장 데이터가 손상되었습니다.' };
  return { status: 'ok', state: s };
}

export function createSaveStore(store: KV | null = defaultStore()) {
  return {
    available: store !== null,
    load(): LoadResult {
      if (!store) return { status: 'none' };
      const text = store.getItem(STORAGE_KEYS.save);
      if (!text) return { status: 'none' };
      try {
        return migrate(JSON.parse(text));
      } catch {
        return { status: 'incompatible', reason: '저장 데이터가 손상되었습니다.' };
      }
    },
    save(state: GameState) {
      if (!store) return false;
      try {
        store.setItem(STORAGE_KEYS.save, JSON.stringify(state));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      store?.removeItem(STORAGE_KEYS.save);
    },
  };
}
export type SaveStore = ReturnType<typeof createSaveStore>;

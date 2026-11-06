import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../src/config';
import { newGame } from '../../src/core/game';
import { createSaveStore, migrate, type KV } from '../../src/state/save';

function memStore(): KV & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('저장', () => {
  it('저장 후 그대로 불러온다', () => {
    const kv = memStore();
    const store = createSaveStore(kv);
    expect(store.load().status).toBe('none');
    const s = newGame('SAVE', 0);
    store.save(s);
    const r = store.load();
    expect(r.status).toBe('ok');
    if (r.status === 'ok') expect(r.state).toEqual(s);
    store.clear();
    expect(store.load().status).toBe('none');
  });
  it('손상·미래 버전은 incompatible', () => {
    const kv = memStore();
    kv.setItem(STORAGE_KEYS.save, '{not json');
    expect(createSaveStore(kv).load().status).toBe('incompatible');
    expect(migrate({ version: 99 }).status).toBe('incompatible');
    expect(migrate({ version: 0 }).status).toBe('incompatible');
  });
  it('v1·v2 저장은 심문 방식이 바뀌어(v3) 불러올 수 없다', () => {
    const s = newGame('MIG', 0);
    for (const version of [1, 2]) {
      const old = { ...s, version, notes: { marks: { 'mul:corpse': 'possible' }, culprits: {} } };
      const r = migrate(JSON.parse(JSON.stringify(old)));
      expect(r.status).toBe('incompatible');
    }
  });
  it('저장소가 없어도 동작', () => {
    const store = createSaveStore(null);
    expect(store.available).toBe(false);
    expect(store.save(newGame('X', 0))).toBe(false);
  });
});

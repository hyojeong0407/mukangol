import cluesJson from '../data/clues.json';
import suspectsJson from '../data/suspects.json';
import textsJson from '../data/texts.json';

export type CategoryId = 'corpse' | 'lure' | 'offering' | 'language' | 'place' | 'circle';
export const CATEGORY_IDS: readonly CategoryId[] = [
  'corpse',
  'lure',
  'offering',
  'language',
  'place',
  'circle',
];

export interface ClueValue {
  id: string;
  name: string;
  journal: string;
  hint: string;
}
export interface Category {
  id: CategoryId;
  name: string;
  short: string;
  glyph: string;
  values: ClueValue[];
}
export interface Suspect {
  id: string;
  name: string;
  disguise: string;
  yokai: string;
  impression: string;
  bio: string;
  portrait: string;
  detainLines: string[];
  releaseLines: string[];
}

export const CATEGORIES = cluesJson.categories as Category[];
export const SUSPECTS = suspectsJson.suspects as unknown as Suspect[];
export const CAST = suspectsJson.cast;
export const TEXTS = textsJson;
export const SUSPECT_IDS = SUSPECTS.map((s) => s.id);

const categoryById = new Map(CATEGORIES.map((c) => [c.id, c]));
const suspectById = new Map(SUSPECTS.map((s) => [s.id, s]));

export function category(id: CategoryId): Category {
  const c = categoryById.get(id);
  if (!c) throw new Error(`unknown category ${id}`);
  return c;
}
export function clueValue(cat: CategoryId, valueId: string): ClueValue {
  const v = category(cat).values.find((x) => x.id === valueId);
  if (!v) throw new Error(`unknown value ${cat}/${valueId}`);
  return v;
}
export function suspect(id: string): Suspect {
  const s = suspectById.get(id);
  if (!s) throw new Error(`unknown suspect ${id}`);
  return s;
}

import { suspect } from '../core/data';
import { html, type Raw } from './html';

/**
 * 동업자 에셋이 있으면 쓰고, 없으면 임시 표현으로 대신한다.
 * `npm run assets`가 public/images/manifest.json을 만들고, 게임은 시작할 때 이 목록을 읽는다.
 * 그래서 파일을 넣고 스크립트만 돌리면 코드 수정 없이 교체된다.
 */
let files = new Set<string>();

export async function loadManifest(): Promise<void> {
  try {
    const res = await fetch('images/manifest.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const list = (await res.json()) as { files?: string[] };
    files = new Set(list.files ?? []);
  } catch {
    /* 목록이 없으면 전부 임시 표현 */
  }
}

export const hasAsset = (path: string) => files.has(path);
export const assetList = () => [...files];

/** 요괴 본모습 이미지. 없으면 null → 사람 초상에 효과를 입혀 대신한다. */
export function yokaiSrc(id: string): string | null {
  const p = `images/characters/char-${id}-yokai.webp`;
  return files.has(p) ? p : null;
}

export function bgSrc(key: string): string | null {
  // 파일명은 하이픈만 쓰므로 abandoned_house → bg-abandoned-house.webp
  const p = `images/backgrounds/bg-${key.replace(/_/g, '-')}.webp`;
  return files.has(p) ? p : null;
}

/** 용의자 초상. form='yokai'이면 본모습(또는 임시 효과) */
export function suspectPortrait(id: string, form: 'human' | 'yokai' = 'human', cls = 'portrait'): Raw {
  const s = suspect(id);
  if (form === 'human')
    return html`<img
      class="${cls}"
      src="${s.portrait}"
      alt="${s.name} 초상"
      loading="lazy"
      width="360"
      height="450"
    />`;
  const y = yokaiSrc(id);
  if (y)
    return html`<img
      class="${cls} yokai-art"
      src="${y}"
      alt="${s.yokai}의 본모습"
      loading="lazy"
      width="360"
      height="450"
    />`;
  return html`<span class="yokai-placeholder ${cls}-wrap" role="img" aria-label="${s.yokai}의 본모습 (임시)">
    <img class="${cls}" src="${s.portrait}" alt="" loading="lazy" width="360" height="450" />
    <span class="yokai-smoke" aria-hidden="true"></span>
    <span class="yokai-name brush" aria-hidden="true">${s.yokai}</span>
  </span>`;
}

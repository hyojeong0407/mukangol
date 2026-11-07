/**
 * 얼굴 칸: 전신 그림에서 얼굴만 네모(또는 동그라미)로 잘라 보여 준다.
 * 그림마다 얼굴 위치가 달라서(예: 현암은 왼쪽 아래) 인물별로 얼굴 가운데와 확대 배율을 둔다.
 * fx, fy: 얼굴 가운데 (그림 너비·높이에 대한 비율), z: 칸 너비 대비 그림 너비 배율.
 * 새 그림이 오면 값을 고친다. 목록에 없는 그림은 DEFAULT.
 */
import { html, type Raw } from './html';

type Focus = { fx: number; fy: number; z: number };

const DEFAULT: Focus = { fx: 0.5, fy: 0.24, z: 2.6 };

const FOCUS: Record<string, Focus> = {
  beomgol: { fx: 0.49, fy: 0.25, z: 2.7 },
  mukjip: { fx: 0.5, fy: 0.19, z: 2.5 },
  mul: { fx: 0.5, fy: 0.175, z: 4 },
  soedol: { fx: 0.49, fy: 0.235, z: 3 },
  yeonhwa: { fx: 0.49, fy: 0.22, z: 3 },
  'pojol-1': { fx: 0.51, fy: 0.27, z: 2.6 },
  'pojol-2': { fx: 0.5, fy: 0.255, z: 2.6 },
  'pojol-3': { fx: 0.47, fy: 0.285, z: 2.6 },
  protagonist: { fx: 0.49, fy: 0.28, z: 2.6 },
  shaman: { fx: 0.43, fy: 0.31, z: 2.5 },
};

/** 그림 경로에서 인물 id: images/characters/char-shaman-default.webp → shaman */
export function faceFocus(src: string): Focus {
  const id = /char-(.+?)-(default|yokai)/.exec(src)?.[1] ?? '';
  return FOCUS[id] ?? DEFAULT;
}

/** CSS 변수로 넘긴다 (.face-crop img가 이 값으로 자리를 잡는다) */
export function faceVars(src: string): string {
  const f = faceFocus(src);
  return `--fx:${f.fx};--fy:${f.fy};--z:${f.z}`;
}

/** 얼굴만 잘라 보이는 칸. 크기와 모양은 cls로 정한다 */
export function faceCrop(src: string, cls = '', alt = ''): Raw {
  return html`<span class="face-crop ${cls}"
    ><img src="${src}" alt="${alt}" style="${faceVars(src)}"
  /></span>`;
}

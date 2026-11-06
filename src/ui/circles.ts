/**
 * 소환진 5종 도형 (대체용 SVG). 동업자 도형(circle-*.webp)이 있으면 circleSvg가 그것을 먼저 쓴다.
 * 명세 4-5의 형태 단서를 따르며, 보호 문양이 아닌 "뒤집힌" 불길한 문양으로 그린다.
 */
import { circleSrc } from './assets';

const NAME: Record<string, string> = {
  blood_five: '혈오방진',
  reverse_bagua: '역팔괘진',
  black_seven: '흑칠성진',
  reverse_rope: '역금줄진',
  ghost_gate: '귀문구궁진',
};

const INK = 'var(--ink-line)';
const BLOOD = 'var(--blood)';

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};

function wrap(inner: string, label: string) {
  return `<svg viewBox="0 0 200 200" role="img" aria-label="${label}" class="circle-svg">
    <circle cx="100" cy="100" r="92" fill="none" stroke="${INK}" stroke-width="3" stroke-dasharray="2 5" opacity=".5"/>
    ${inner}</svg>`;
}

function bloodFive() {
  const pts: [number, number][] = [
    [100, 28],
    [172, 100],
    [100, 172],
    [28, 100],
    [100, 100],
  ];
  const flags = pts
    .map(
      ([x, y]) => `<line x1="${x}" y1="${y + 18}" x2="${x}" y2="${y - 16}" stroke="${INK}" stroke-width="3"/>
      <path d="M${x} ${y - 16} l22 6 l-22 7 z" fill="${BLOOD}"/>`,
    )
    .join('');
  return wrap(
    `<rect x="40" y="40" width="120" height="120" fill="none" stroke="${INK}" stroke-width="2" transform="rotate(45 100 100)"/>${flags}`,
    '혈오방진',
  );
}

function reverseBagua() {
  let s = `<circle cx="100" cy="100" r="62" fill="none" stroke="${INK}" stroke-width="2"/>`;
  for (let i = 0; i < 8; i++) {
    const [x, y] = polar(100, 100, 74, i * 45);
    const [tx, ty] = polar(100, 100, 46, i * 45);
    s += `<circle cx="${x}" cy="${y}" r="9" fill="${INK}"/>`;
    // 뒤집힌 괘: 짧은 획 3줄을 거꾸로 회전
    s += `<g transform="translate(${tx} ${ty}) rotate(${i * 45 + 180})">
      <line x1="-9" y1="-6" x2="9" y2="-6" stroke="${INK}" stroke-width="3"/>
      <line x1="-9" y1="0" x2="-2" y2="0" stroke="${INK}" stroke-width="3"/><line x1="2" y1="0" x2="9" y2="0" stroke="${INK}" stroke-width="3"/>
      <line x1="-9" y1="6" x2="9" y2="6" stroke="${INK}" stroke-width="3"/></g>`;
  }
  // 생문(동북)을 막은 돌
  const [bx, by] = polar(100, 100, 74, 45);
  s += `<rect x="${bx - 14}" y="${by - 14}" width="28" height="28" fill="${BLOOD}" transform="rotate(20 ${bx} ${by})"/>`;
  return wrap(s, '역팔괘진');
}

function blackSeven() {
  // 북두칠성을 상하로 뒤집은 배치
  const stars: [number, number][] = [
    [40, 70],
    [70, 62],
    [96, 74],
    [118, 92],
    [124, 128],
    [160, 140],
    [168, 104],
  ];
  const path = stars.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${200 - y}`).join(' ');
  const candles = stars
    .map(
      ([x, y]) => `<rect x="${x - 5}" y="${200 - y - 4}" width="10" height="18" fill="#111" stroke="${INK}"/>
      <path d="M${x} ${200 - y - 14} q4 6 0 10 q-4 -4 0 -10" fill="${BLOOD}" class="flame"/>`,
    )
    .join('');
  return wrap(
    `<path d="${path}" fill="none" stroke="${INK}" stroke-width="2" stroke-dasharray="6 4"/>${candles}`,
    '흑칠성진',
  );
}

function reverseRope() {
  let s = '';
  // 꼬인 줄: 사인파 두 가닥을 반대로 감는다 (오른새끼)
  const strand = (phase: number) => {
    let d = '';
    for (let x = 14; x <= 186; x += 4) {
      const y = 92 + Math.sin(x / 9 + phase) * 6;
      d += `${x === 14 ? 'M' : 'L'}${x} ${y.toFixed(1)} `;
    }
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3"/>`;
  };
  s += strand(0) + strand(Math.PI);
  for (let i = 0; i < 5; i++) {
    const x = 34 + i * 33;
    s += `<path d="M${x} 98 l-4 34 q4 6 8 0 l-4 -34" fill="#e8dfc8" stroke="${INK}" stroke-width="2"/>`;
    s += `<circle cx="${x}" cy="134" r="4" fill="#e8dfc8" stroke="${INK}"/>`;
  }
  s += `<path d="M14 92 q-6 -30 10 -52 M186 92 q6 -30 -10 -52" stroke="${INK}" stroke-width="3" fill="none"/>`;
  return wrap(s, '역금줄진');
}

function ghostGate() {
  let s = '';
  const x0 = 46,
    y0 = 46,
    c = 36;
  for (let i = 0; i <= 3; i++) {
    s += `<line x1="${x0}" y1="${y0 + i * c}" x2="${x0 + 3 * c}" y2="${y0 + i * c}" stroke="${INK}" stroke-width="2"/>`;
    s += `<line x1="${x0 + i * c}" y1="${y0}" x2="${x0 + i * c}" y2="${y0 + 3 * c}" stroke="${INK}" stroke-width="2"/>`;
  }
  for (let r = 0; r < 3; r++)
    for (let col = 0; col < 3; col++) {
      if (r === 0 && col === 2) continue; // 동북(오른쪽 위) 귀문 칸은 비운다
      const x = x0 + col * c + 10,
        y = y0 + r * c + 6;
      s += `<g transform="rotate(180 ${x + 8} ${y + 12})"><rect x="${x}" y="${y}" width="16" height="24" fill="#d9c9a0" stroke="${BLOOD}" stroke-width="1.5"/>
        <line x1="${x + 8}" y1="${y + 4}" x2="${x + 8}" y2="${y + 20}" stroke="${BLOOD}" stroke-width="2"/></g>`;
    }
  s += `<path d="M${x0 + 2 * c + 6} ${y0 + 6} l24 24 M${x0 + 3 * c - 6} ${y0 + 6} l-24 24" stroke="${BLOOD}" stroke-width="2" opacity=".6"/>`;
  return wrap(s, '귀문구궁진');
}

const DRAW: Record<string, () => string> = {
  blood_five: bloodFive,
  reverse_bagua: reverseBagua,
  black_seven: blackSeven,
  reverse_rope: reverseRope,
  ghost_gate: ghostGate,
};

export function circleSvg(valueId: string): string {
  const img = circleSrc(valueId);
  if (img)
    return `<img class="circle-svg circle-img" src="${img}" alt="${NAME[valueId] ?? '소환진'}" loading="lazy" width="256" height="256"/>`;
  return (DRAW[valueId] ?? bloodFive)();
}

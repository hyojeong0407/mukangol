const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** 값에 HTML이 이미 들어 있는 경우를 표시하는 래퍼 */
export class Raw {
  constructor(public readonly value: string) {}
}
export const raw = (s: string) => new Raw(s);

/** 태그드 템플릿: ${} 값은 자동 이스케이프, 배열은 이어 붙이고, raw()는 그대로 */
export function html(strings: TemplateStringsArray, ...vals: unknown[]): Raw {
  let out = strings[0];
  vals.forEach((v, i) => {
    out += render(v) + strings[i + 1];
  });
  return new Raw(out);
}

function render(v: unknown): string {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  return esc(v);
}

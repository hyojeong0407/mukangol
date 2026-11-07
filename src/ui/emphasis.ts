/*
 * 대본의 **강조** 표시. 대사창(글자 찍기)과 튜토리얼에서 함께 쓴다.
 */

/**
 * 대본의 **강조** 표시를 나눈다. 비주얼 노벨처럼 글이 많을 때 중요한 말이 눈에 먼저 들어오게 한다.
 * 예: '옥사는 **두 칸**뿐' → [{옥사는 }, {두 칸, em}, {뿐}]
 */
export function parseEmphasis(text: string): { text: string; em: boolean }[] {
  return text
    .split('**')
    .map((t, i) => ({ text: t, em: i % 2 === 1 }))
    .filter((s) => s.text);
}

/** 앞에서 n글자까지만 HTML로 (글자 찍기용). 강조는 <em class="hl"> */
export function emphasisHtml(segs: { text: string; em: boolean }[], n: number): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '';
  let left = n;
  for (const s of segs) {
    if (left <= 0) break;
    const part = esc(s.text.slice(0, left));
    out += s.em ? `<em class="hl">${part}</em>` : part;
    left -= s.text.length;
  }
  return out;
}

/** 강조 표시를 뗀 글 (제목, 화면 읽기용 등) */
export const plain = (text: string) => text.split('**').join('');

/**
 * 한국어 조사 처리. 대본 템플릿의 {이/가}, {은/는}, {을/를}, {과/와}, {으로/로} 를
 * 바로 앞 글자의 받침에 맞춰 고른다. 괄호·따옴표 등 한글이 아닌 글자는 건너뛰고 판단한다.
 */

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** 0: 받침 없음, 그 외: 받침 인덱스(ㄹ=8) / null: 한글 아님 */
function jong(ch: string): number | null {
  const code = ch.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return null;
  return (code - HANGUL_START) % 28;
}

function lastHangulJong(text: string): number | null {
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    const j = jong(ch);
    if (j !== null) return j;
    if (/[0-9]/.test(ch)) return '013678'.includes(ch) ? 1 : 0; // 영, 일, 삼, 육, 칠, 팔 → 받침 있음
  }
  return null;
}

/** pair 예: '이/가' (앞: 받침 있을 때, 뒤: 받침 없을 때) */
export function josa(word: string, pair: string): string {
  const [withJong, withoutJong] = pair.split('/');
  const j = lastHangulJong(word);
  if (j === null) return withJong; // 판단 불가 시 받침 있는 형태
  if (pair === '으로/로') return j === 0 || j === 8 ? withoutJong : withJong;
  return j === 0 ? withoutJong : withJong;
}

const JOSA_PAIRS = ['이/가', '은/는', '을/를', '과/와', '으로/로', '아/야', '이여/여'];

/**
 * 템플릿 채우기: {key}를 값으로 바꾸고, 그 뒤에 붙은 {이/가} 류 조사를 앞말에 맞춘다.
 * 예: fill('{victim}{이/가} 죽었다', { victim: '김 서방' }) → '김 서방이 죽었다'
 */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  let out = '';
  const re = /\{([^{}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template))) {
    out += template.slice(last, m.index);
    const token = m[1];
    if (JOSA_PAIRS.includes(token)) out += josa(out, token);
    else if (token in vars) out += String(vars[token]);
    else out += m[0];
    last = re.lastIndex;
  }
  return out + template.slice(last);
}

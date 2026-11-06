/**
 * 동업자 음원 폴더(audio/)를 게임에 반영하고 manifest.json을 만든다. (sharp 없이 동작)
 *   audio/*.ogg|mp3  → public/audio/   (예: bgm-title.ogg, sfx-gong.ogg — audio-spec.md)
 *   → public/images/manifest.json      (게임은 이 목록에 있는 파일만 쓰고, 없으면 임시 표현으로 대신한다)
 * npm run dev / npm run build 전에 자동으로 실행된다 (predev, prebuild).
 * 이미지 변환은 npm run assets (convert-assets.mjs)가 하고, 끝나면 이 스크립트를 부른다.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const AUDIO_FROM = ['audio', 'docs/reference/audio'];
const AUDIO_TO = 'public/audio';
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

mkdirSync(AUDIO_TO, { recursive: true });
let copied = 0;
for (const dir of AUDIO_FROM) {
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)) {
    if (!/\.(ogg|mp3|m4a|wav)$/i.test(file)) continue;
    const from = join(dir, file);
    const out = join(AUDIO_TO, `${slug(basename(file, extname(file)))}${extname(file).toLowerCase()}`);
    // 바뀐 파일만 복사
    if (existsSync(out) && statSync(out).size === statSync(from).size && statSync(out).mtimeMs >= statSync(from).mtimeMs)
      continue;
    copyFileSync(from, out);
    copied++;
  }
}

const files = [];
for (const base of ['images/characters', 'images/backgrounds', 'images/circles', 'audio']) {
  const dir = join('public', base);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (!f.startsWith('.')) files.push(`${base}/${f}`);
}
files.sort();
mkdirSync('public/images', { recursive: true });
writeFileSync('public/images/manifest.json', JSON.stringify({ files }, null, 2) + '\n');
console.log(`[assets] 음원 ${copied}개 복사, manifest ${files.length}개 파일`);

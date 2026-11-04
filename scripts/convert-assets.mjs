/**
 * 동업자가 올린 원본을 게임용으로 변환하고, 게임이 읽는 목록(manifest.json)을 만든다. (개발문서 8장)
 *   characters/*.png   → public/images/characters/*.webp   (예: char-beomgol-default, char-beomgol-yokai)
 *   backgrounds/*.png  → public/images/backgrounds/*.webp  (예: bg-village, bg-prison, bg-riverside)
 *   audio/*.ogg|mp3    → public/audio/ 로 복사               (예: bgm-title.ogg, sfx-gong.ogg)
 *   → public/images/manifest.json  (게임은 이 목록에 있는 파일만 쓰고, 없으면 임시 표현으로 대신한다)
 * 사용: npm run assets
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

const IMAGE_JOBS = [
  { from: ['characters', 'docs/reference/characters'], to: 'public/images/characters', width: 720 },
  { from: ['backgrounds', 'docs/reference/backgrounds'], to: 'public/images/backgrounds', width: 1920 },
];

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

for (const job of IMAGE_JOBS) {
  mkdirSync(job.to, { recursive: true });
  for (const dir of job.from) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
      // 파일명 규칙에 맞지 않는 이름도 바로잡는다. 예: char=beomgol-default.png → char-beomgol-default
      const out = join(job.to, `${slug(basename(file, extname(file)))}.webp`);
      await sharp(join(dir, file))
        .resize({ width: job.width, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(out);
      console.log(`${dir}/${file} → ${out}`);
    }
  }
}

// 음원 복사와 목록(manifest.json) 작성은 sync-assets.mjs가 맡는다
await import('./sync-assets.mjs');

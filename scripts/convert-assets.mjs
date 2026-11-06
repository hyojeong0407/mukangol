/**
 * 동업자가 올린 원본을 게임용으로 변환하고, 게임이 읽는 목록(manifest.json)을 만든다. (개발문서 8장)
 *   characters/*.png   → public/images/characters/*.webp   (예: char-beomgol-default, char-beomgol-yokai)
 *   backgrounds/*.png  → public/images/backgrounds/*.webp  (예: bg-village, bg-prison, bg-riverside)
 *   ui-assets/circle-*.png → public/images/circles/*.webp (소환진 5종)
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
  // 소환진 도형 (예: circle-blood-five). 진 값 id와의 연결은 src/ui/assets.ts의 circleSrc
  {
    from: ['ui-assets', 'docs/reference/ui-assets'],
    to: 'public/images/circles',
    width: 512,
    prefix: 'circle-',
    quality: 85,
  },
];

const slug = (name) => name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

for (const job of IMAGE_JOBS) {
  mkdirSync(job.to, { recursive: true });
  for (const dir of job.from) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!/\.(png|jpe?g|webp)$/i.test(file)) continue;
      if (job.prefix && !file.startsWith(job.prefix)) continue;
      // 같은 캐릭터의 -v2(투명 배경, 명세 규격)가 있으면 그것을 쓰고 이전 버전은 건너뛴다
      if (!/-v2\./i.test(file) && existsSync(join(dir, file.replace(/(\.\w+)$/, '-v2$1')))) continue;
      // 파일명 규칙에 맞지 않는 이름도 바로잡는다. 예: char=beomgol-default.png → char-beomgol-default
      const out = join(job.to, `${slug(basename(file, extname(file))).replace(/-v2$/, '')}.webp`);
      await sharp(join(dir, file))
        .resize({ width: job.width, withoutEnlargement: true })
        .webp({ quality: job.quality ?? 80 })
        .toFile(out);
      console.log(`${dir}/${file} → ${out}`);
    }
  }
}

// 음원 복사와 목록(manifest.json) 작성은 sync-assets.mjs가 맡는다
await import('./sync-assets.mjs');

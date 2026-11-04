/**
 * itch.io 업로드용 zip을 만든다. index.html이 zip 맨 위에 오도록 dist/ 내용을 묶는다. (개발문서 12장)
 * 사용: npm run build && npm run zip:itch
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { zipSync } from 'fflate';

const DIST = 'dist';
if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/index.html이 없습니다. 먼저 npm run build를 실행하세요.');
  process.exit(1);
}
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files[relative(DIST, p).replaceAll('\\', '/')] = readFileSync(p);
  }
};
walk(DIST);
const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const out = `mukangol-itch-v${version}.zip`;
writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`${out} (${Object.keys(files).length}개 파일)`);

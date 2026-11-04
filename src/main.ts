import './styles.css';
import { App } from './ui/app';
import { assetList, loadManifest } from './ui/assets';
import { sound } from './audio/sound';
import { loadSettings } from './state/settings';

const root = document.getElementById('app')!;
const csHost = document.getElementById('cutscene')!;

const app = new App(root, csHost);
app.render();
// 동업자 에셋 목록을 읽은 뒤 다시 그린다 (없으면 임시 표현으로 진행)
void loadManifest().then(() => {
  sound.useFiles(assetList());
  app.render();
});

// 연출 레이어(Phaser)는 첫 화면을 그린 뒤 지연 로딩한다. 실패해도 게임은 진행된다.
const fxHost = document.getElementById('fx');
if (fxHost) {
  import('./scenes/fx')
    .then(({ startFx }) => startFx(fxHost, loadSettings().reduceMotion))
    .then((fx) => app.attachFx(fx))
    .catch((err) => console.warn('연출 레이어를 불러오지 못했습니다.', err));
}

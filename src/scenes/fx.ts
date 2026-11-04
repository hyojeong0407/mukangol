import type Phaser from 'phaser';

/**
 * Phaser 연출 레이어: 화면 뒤에 깔리는 달빛·안개·먹 티끌.
 * 게임 규칙과 무관하며, 일지 같은 읽을거리는 DOM UI가 맡는다. (개발문서 7장)
 * Phaser는 첫 화면 로딩을 가볍게 하려고 동적 import로 불러온다.
 */
export type Mood = 'title' | 'dawn' | 'day' | 'night' | 'final' | 'happy' | 'gameover';

const MOODS: Record<
  Mood,
  { sky: number; fog: number; fogAlpha: number; moon: number; moonAlpha: number; blood: number }
> = {
  title: { sky: 0x141a26, fog: 0x8fa8c8, fogAlpha: 0.22, moon: 0xdfe6f0, moonAlpha: 0.9, blood: 0 },
  dawn: { sky: 0x1f2a3d, fog: 0x8fa8c8, fogAlpha: 0.3, moon: 0xb9c8dc, moonAlpha: 0.45, blood: 0.15 },
  day: { sky: 0x2a2a30, fog: 0xc9c2b0, fogAlpha: 0.14, moon: 0xffffff, moonAlpha: 0, blood: 0 },
  night: { sky: 0x0e1118, fog: 0x8fa8c8, fogAlpha: 0.18, moon: 0xdfe6f0, moonAlpha: 0.75, blood: 0 },
  final: { sky: 0x120c0e, fog: 0x9b1b1b, fogAlpha: 0.12, moon: 0xd9b8b8, moonAlpha: 0.7, blood: 0.35 },
  happy: { sky: 0x3a4660, fog: 0xf0e6cf, fogAlpha: 0.12, moon: 0xfff1d0, moonAlpha: 0.25, blood: 0 },
  gameover: { sky: 0x050506, fog: 0x9b1b1b, fogAlpha: 0.2, moon: 0x7a2020, moonAlpha: 0.8, blood: 0.5 },
};

export interface FxController {
  setMood(m: Mood): void;
  setReduceMotion(v: boolean): void;
  pulse(): void;
  flash(color: 'white' | 'red'): void;
  destroy(): void;
}

export async function startFx(parent: HTMLElement, reduceMotion: boolean): Promise<FxController> {
  const PhaserLib = (await import('phaser')).default;

  class AtmosphereScene extends PhaserLib.Scene {
    private sky!: Phaser.GameObjects.Rectangle;
    private moon!: Phaser.GameObjects.Image;
    private vignette!: Phaser.GameObjects.Image;
    private fogs: Phaser.GameObjects.Image[] = [];
    private motes!: Phaser.GameObjects.Particles.ParticleEmitter;
    private bloodWash!: Phaser.GameObjects.Rectangle;
    reduce = reduceMotion;
    onReady: (() => void) | null = null;

    constructor() {
      super('atmosphere');
    }

    create() {
      const { width, height } = this.scale;
      this.makeTextures();
      this.sky = this.add.rectangle(0, 0, width, height, MOODS.title.sky).setOrigin(0);
      this.moon = this.add.image(width * 0.22, height * 0.18, 'moon').setScale(0.9);
      for (let i = 0; i < 6; i++) {
        const f = this.add
          .image(Math.random() * width, height * (0.35 + Math.random() * 0.6), 'fog')
          .setScale(2 + Math.random() * 2, 1 + Math.random())
          .setAlpha(MOODS.title.fogAlpha);
        f.setData('speed', 4 + Math.random() * 10);
        this.fogs.push(f);
      }
      this.motes = this.add.particles(0, 0, 'mote', {
        x: { min: 0, max: width },
        y: { min: 0, max: height },
        lifespan: 9000,
        speedY: { min: -6, max: -16 },
        speedX: { min: -6, max: 6 },
        alpha: { start: 0.5, end: 0 },
        scale: { min: 0.3, max: 1 },
        frequency: 260,
        quantity: 1,
      });
      this.bloodWash = this.add
        .rectangle(0, 0, width, height, 0x9b1b1b, 0)
        .setOrigin(0)
        .setBlendMode('MULTIPLY');
      this.vignette = this.add.image(width / 2, height / 2, 'vignette').setDisplaySize(width, height);
      this.scale.on('resize', (size: Phaser.Structs.Size) => this.layout(size.width, size.height));
      this.applyReduce();
      this.onReady?.();
    }

    private makeTextures() {
      const g = this.make.graphics({}, false);
      // 달
      g.fillStyle(0xffffff, 0.08);
      g.fillCircle(80, 80, 80);
      g.fillStyle(0xffffff, 0.15);
      g.fillCircle(80, 80, 52);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(80, 80, 36);
      g.generateTexture('moon', 160, 160);
      g.clear();
      // 안개 덩어리
      for (let i = 12; i > 0; i--) {
        g.fillStyle(0xffffff, 0.035);
        g.fillEllipse(160, 60, 26 * i, 9 * i);
      }
      g.generateTexture('fog', 320, 120);
      g.clear();
      // 먹 티끌
      g.fillStyle(0xe8dfc8, 1);
      g.fillCircle(3, 3, 3);
      g.generateTexture('mote', 6, 6);
      g.destroy();
      // 비네트 (canvas texture)
      const tex = this.textures.createCanvas('vignette', 256, 256);
      if (tex) {
        const ctx = tex.getContext();
        const grad = ctx.createRadialGradient(128, 128, 40, 128, 128, 180);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.85)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 256);
        tex.refresh();
      }
    }

    private layout(w: number, h: number) {
      this.sky.setSize(w, h);
      this.bloodWash.setSize(w, h);
      this.vignette.setPosition(w / 2, h / 2).setDisplaySize(w, h);
      this.moon.setPosition(w * 0.22, h * 0.18);
    }

    applyReduce() {
      if (!this.motes) return;
      if (this.reduce) this.motes.stop();
      else this.motes.start();
    }

    setMood(m: Mood) {
      const p = MOODS[m];
      const dur = this.reduce ? 0 : 1800;
      const from = PhaserLib.Display.Color.IntegerToColor(this.sky.fillColor);
      const to = PhaserLib.Display.Color.IntegerToColor(p.sky);
      this.tweens.addCounter({
        from: 0,
        to: 100,
        duration: dur || 1,
        onUpdate: (tw) => {
          const c = PhaserLib.Display.Color.Interpolate.ColorWithColor(from, to, 100, tw.getValue() ?? 100);
          this.sky.setFillStyle(PhaserLib.Display.Color.GetColor(c.r, c.g, c.b));
        },
      });
      this.tweens.add({ targets: this.moon, alpha: p.moonAlpha, duration: dur || 1 });
      this.moon.setTint(p.moon);
      for (const f of this.fogs) {
        f.setTint(p.fog);
        this.tweens.add({ targets: f, alpha: p.fogAlpha, duration: dur || 1 });
      }
      this.tweens.add({ targets: this.bloodWash, fillAlpha: p.blood * 0.35, duration: dur || 1 });
    }

    pulse() {
      if (this.reduce) return;
      this.cameras.main.shake(220, 0.003);
    }

    flash(color: 'white' | 'red') {
      if (this.reduce) return;
      const [r, g, b] = color === 'red' ? [155, 27, 27] : [230, 230, 240];
      this.cameras.main.flash(380, r, g, b);
    }

    update(_t: number, dt: number) {
      if (this.reduce) return;
      const w = this.scale.width;
      for (const f of this.fogs) {
        f.x += (f.getData('speed') * dt) / 1000;
        if (f.x - f.displayWidth / 2 > w) f.x = -f.displayWidth / 2;
      }
    }
  }

  const scene = new AtmosphereScene();
  const ready = new Promise<void>((resolve) => (scene.onReady = resolve));
  const game = new PhaserLib.Game({
    type: PhaserLib.AUTO,
    parent,
    transparent: false,
    backgroundColor: '#1a1a1f',
    scale: { mode: PhaserLib.Scale.RESIZE, width: '100%', height: '100%' },
    scene,
    banner: false,
    audio: { noAudio: true }, // 사운드는 audio/sound.ts가 담당
    fps: { target: 30, limit: 30 }, // 배경 연출이므로 30fps로 충분
  });

  await ready;

  // 저사양 기기 보호: 3초 동안 실제 fps가 15 미만이면 움직임을 끄고 10fps로 낮춘다.
  // (연출은 분위기용이므로 게임 진행과 가독성에는 영향이 없다)
  window.setTimeout(() => {
    if (game.loop.actualFps < 15) {
      console.info('[fx] 저사양 모드로 전환', Math.round(game.loop.actualFps));
      scene.reduce = true;
      scene.applyReduce();
      game.loop.fpsLimit = 10;
      (game.loop as unknown as { _limitRate: number })._limitRate = 100;
    }
  }, 3000);

  return {
    setMood: (m) => scene.setMood(m),
    setReduceMotion: (v) => {
      scene.reduce = v;
      scene.applyReduce();
    },
    pulse: () => scene.pulse(),
    flash: (c) => scene.flash(c),
    destroy: () => game.destroy(true),
  };
}

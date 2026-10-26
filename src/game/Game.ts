/**
 * Game.ts — a parte PixiJS: cria o canvas, monta a máquina e anima.
 *
 * Conecta as quatro peças que a vaga cita:
 *  - renderização: Application + Containers + Sprites
 *  - input: vem do React (botões/teclado) através do store
 *  - animação: o Ticker chama update() a cada quadro
 *  - estado: o store decide QUANDO girar/parar; o Game decide COMO isso aparece
 */
import { Application, Container, Graphics, Text } from 'pixi.js';
import { REEL_COUNT, STRIPS } from '../core/paytable';
import type { GameView } from '../core/store';
import { CoinBurst } from './effects';
import { Reel } from './Reel';
import { CELL, DISPLAY_FONT, buildSymbolTextures } from './symbols';
import { delay, ease, tween } from './tween';

const GAP = 14;
const PAD = 22;
const DESIGN_W = REEL_COUNT * CELL + (REEL_COUNT - 1) * GAP + PAD * 2;
const DESIGN_H = 3 * CELL + PAD * 2;

export interface GameStats {
  fps: number;
  renderer: string;
  resolution: number;
  particles: number;
  canvas: string;
}

export class Game implements GameView {
  readonly app = new Application();
  private root = new Container();
  private reels: Reel[] = [];
  private payline = new Graphics();
  private coins!: CoinBurst;
  private winText!: Text;
  private destroyed = false;
  private initialized = false;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  async init(host: HTMLElement) {
    // Espera a fonte carregar antes de "fotografar" o 7 como textura.
    try {
      await document.fonts.load(`48px Bungee`);
    } catch {
      /* sem a fonte, usa a reserva */
    }

    await this.app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      // Limitar a 2x evita renderizar 3x mais pixels em celulares top de linha.
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
    });
    this.initialized = true;
    // O componente pode ter sido desmontado enquanto o init esperava.
    if (this.destroyed) {
      this.app.destroy(true, { children: true, texture: true });
      return;
    }
    host.appendChild(this.app.canvas);
    this.app.stage.addChild(this.root);

    this.buildMachine();
    this.app.ticker.add((ticker) => this.update(ticker.deltaMS));
    this.app.renderer.on('resize', () => this.layout());
    this.layout();
  }

  private buildMachine() {
    const textures = buildSymbolTextures(this.app.renderer);

    // Moldura do gabinete.
    const cabinet = new Graphics()
      .roundRect(0, 0, DESIGN_W, DESIGN_H, 28).fill({ color: 0x0a2420 })
      .roundRect(0, 0, DESIGN_W, DESIGN_H, 28).stroke({ width: 4, color: 0xd9a441 })
      .roundRect(8, 8, DESIGN_W - 16, DESIGN_H - 16, 22).stroke({ width: 1.5, color: 0xd9a441, alpha: 0.35 });
    this.root.addChild(cabinet);

    const reelArea = new Container();
    reelArea.position.set(PAD, PAD);
    this.root.addChild(reelArea);

    for (let r = 0; r < REEL_COUNT; r++) {
      const x = r * (CELL + GAP);
      const well = new Graphics().roundRect(x, 0, CELL, CELL * 3, 16).fill({ color: 0x051512 });
      reelArea.addChild(well);

      const reel = new Reel(STRIPS[r], textures, this.app.ticker);
      reel.x = x;
      // Máscara: só mostra o que está dentro da janela do rolo.
      const mask = new Graphics().roundRect(x, 0, CELL, CELL * 3, 16).fill({ color: 0xffffff });
      reel.mask = mask;
      reelArea.addChild(reel, mask);
      this.reels.push(reel);
    }

    // Sombra em cima e embaixo dá profundidade de "tambor".
    const shade = new Graphics();
    for (let i = 0; i < 10; i++) {
      const a = 0.055 * (10 - i) / 10;
      shade.rect(0, i * 5, DESIGN_W - PAD * 2, 5).fill({ color: 0x000000, alpha: a });
      shade.rect(0, CELL * 3 - (i + 1) * 5, DESIGN_W - PAD * 2, 5).fill({ color: 0x000000, alpha: a });
    }
    reelArea.addChild(shade);

    // Linha de pagamento (linha do meio).
    const midY = PAD + CELL * 1.5;
    this.payline
      .rect(PAD - 6, midY - 2, DESIGN_W - PAD * 2 + 12, 4).fill({ color: 0xf2c46b })
      .poly([2, midY - 12, 16, midY, 2, midY + 12]).fill({ color: 0xf2c46b })
      .poly([DESIGN_W - 2, midY - 12, DESIGN_W - 16, midY, DESIGN_W - 2, midY + 12]).fill({ color: 0xf2c46b });
    this.payline.alpha = 0.35;
    this.root.addChild(this.payline);

    this.coins = new CoinBurst(this.app.renderer);
    this.root.addChild(this.coins);

    this.winText = new Text({
      text: '',
      style: {
        fontFamily: DISPLAY_FONT,
        fontSize: 64,
        fill: 0xf7d27a,
        stroke: { color: 0x2a0f1f, width: 10 },
        dropShadow: { color: 0x000000, alpha: 0.5, blur: 8, distance: 6, angle: Math.PI / 2 },
        align: 'center',
      },
    });
    this.winText.anchor.set(0.5);
    this.winText.position.set(DESIGN_W / 2, DESIGN_H / 2);
    this.winText.visible = false;
    this.root.addChild(this.winText);
  }

  /** Escala o jogo para caber em qualquer tela, mantendo a proporção. */
  private layout() {
    const { width, height } = this.app.screen;
    const scale = Math.min(width / DESIGN_W, height / DESIGN_H);
    this.root.scale.set(scale);
    this.root.position.set((width - DESIGN_W * scale) / 2, (height - DESIGN_H * scale) / 2);
  }

  private update(deltaMS: number) {
    // Evita "pulo" gigante quando a aba volta do segundo plano.
    const dt = Math.min(deltaMS, 50);
    for (const reel of this.reels) reel.update(dt);
    this.coins.update(dt);
  }

  // ------------------------------------------------- GameView (usado pelo store)

  startSpin() {
    this.winText.visible = false;
    this.payline.alpha = 0.35;
    this.reels.forEach((reel) => reel.startSpin());
  }

  async stopAt(stops: number[]) {
    // Todos param ao mesmo tempo, mas os da direita giram mais casas:
    // por isso param um depois do outro, como numa máquina real.
    await Promise.all(this.reels.map((reel, r) => reel.stopAt(stops[r], 6 + r * 5)));
  }

  abortSpin() {
    this.reels.forEach((reel) => reel.abort());
  }

  async celebrate(win: number, multiplier: number) {
    const ticker = this.app.ticker;
    const big = multiplier >= 20;

    // Linha acende e símbolos vencedores pulsam.
    this.payline.alpha = 1;
    const winners = multiplier >= 8 ? this.reels : this.reels.slice(0, 2);
    const pulse = tween(ticker, 900, (p) => {
      const s = 1 + Math.sin(p * Math.PI * 3) * 0.08;
      winners.forEach((reel) => reel.centerSprite.scale.set(s));
    }, ease.linear);

    if (!this.reducedMotion) {
      this.coins.burst(DESIGN_W / 2, DESIGN_H / 2, big ? 80 : multiplier >= 8 ? 40 : 14);
    }

    // Valor sobe de 0 até o prêmio (contagem).
    this.winText.visible = true;
    await tween(ticker, big ? 1400 : 700, (p) => {
      this.winText.text = `+${Math.round(win * p)}`;
      this.winText.scale.set(0.6 + 0.4 * ease.outBack(Math.min(p * 1.6, 1)));
    }, ease.outCubic);

    await pulse;
    winners.forEach((reel) => reel.centerSprite.scale.set(1));
    await delay(ticker, big ? 900 : 400);
    await tween(ticker, 250, (p) => (this.winText.alpha = 1 - p));
    this.winText.visible = false;
    this.winText.alpha = 1;
  }

  // ------------------------------------------------- debug / profiling

  getStats(): GameStats {
    const r = this.app.renderer;
    return {
      fps: Math.round(this.app.ticker.FPS),
      renderer: r.name,
      resolution: r.resolution,
      particles: this.coins?.count ?? 0,
      canvas: `${r.width}×${r.height}px`,
    };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.initialized) this.app.destroy(true, { children: true, texture: true });
  }
}

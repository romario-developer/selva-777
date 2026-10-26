/**
 * Reel.ts — um rolo do caça-níquel.
 *
 * Ideia central: o rolo não "anda" de verdade. Guardamos só um número,
 * `position` (qual índice da fita está na linha de cima, com casas decimais),
 * e a cada quadro reposicionamos 4 Sprites a partir dele. Girar = diminuir
 * esse número. Parar = animar esse número até o índice que o servidor mandou.
 */
import { BlurFilter, Container, Sprite, type Texture, type Ticker } from 'pixi.js';
import type { SymbolId } from '../core/paytable';
import { CELL } from './symbols';
import { ease, tween } from './tween';

const VISIBLE_ROWS = 3;
const MAX_SPEED = 20; // símbolos por segundo

const mod = (n: number, m: number) => ((n % m) + m) % m;

export class Reel extends Container {
  private cells: Sprite[] = [];
  private position_ = 0;
  private speed = 0;
  private freeSpin = false;
  private lastPosition = 0;
  private blur = new BlurFilter({ strength: 0, quality: 2 });

  constructor(
    private readonly strip: SymbolId[],
    private readonly textures: Map<SymbolId, Texture>,
    private readonly ticker: Ticker,
  ) {
    super();
    // Uma casa a mais que o visível, para cobrir o símbolo entrando por cima.
    for (let i = 0; i < VISIBLE_ROWS + 1; i++) {
      const sprite = new Sprite();
      sprite.anchor.set(0.5);
      this.cells.push(sprite);
      this.addChild(sprite);
    }
    this.blur.strengthX = 0;
    this.position_ = Math.floor(Math.random() * strip.length);
    this.lastPosition = this.position_;
    this.render();
  }

  /** Chamado todo quadro pelo Game. */
  update(deltaMS: number) {
    if (this.freeSpin) {
      // Acelera suavemente até a velocidade máxima.
      this.speed += (MAX_SPEED - this.speed) * Math.min(1, deltaMS * 0.004);
      this.position_ -= (this.speed * deltaMS) / 1000;
    }

    // Desfoque proporcional à velocidade real (vale também durante a parada).
    const velocity = (Math.abs(this.position_ - this.lastPosition) * 1000) / Math.max(deltaMS, 1);
    this.lastPosition = this.position_;
    this.blur.strengthY = Math.min(velocity * 0.55, 10);
    // Filtro custa desempenho: só liga quando o desfoque é visível.
    this.filters = this.blur.strengthY > 0.6 ? [this.blur] : null;

    this.render();
  }

  private render() {
    const top = Math.floor(this.position_);
    const frac = this.position_ - top;
    this.cells.forEach((sprite, i) => {
      const id = this.strip[mod(top + i, this.strip.length)];
      sprite.texture = this.textures.get(id)!;
      sprite.position.set(CELL / 2, (i - frac) * CELL + CELL / 2);
    });
  }

  startSpin() {
    this.freeSpin = true;
  }

  /**
   * Para o rolo com o símbolo `stop` na linha do meio.
   * `minTravel` = quantas casas ainda girar antes de parar (rolos da direita giram mais).
   */
  async stopAt(stop: number, minTravel: number) {
    this.freeSpin = false;
    const n = this.strip.length;
    const from = this.position_;

    // Queremos `stop` na linha do meio, então a linha de cima é stop - 1.
    const wantedTop = mod(stop - 1, n);
    let target = Math.floor(from - minTravel);
    target -= mod(target - wantedTop, n); // desce até um índice equivalente

    const distance = from - target;
    // A curva outBack começa ~4,4x mais rápida que a média: ajusta a duração
    // para a velocidade inicial bater com a do giro (sem "solavanco").
    const duration = Math.min(Math.max(((distance * 4.4) / Math.max(this.speed, 1)) * 1000, 500), 2600);

    await tween(this.ticker, duration, (p) => (this.position_ = from - distance * p), ease.outBack);
    this.position_ = target;
    this.speed = 0;
  }

  /** Erro na API: para no símbolo inteiro mais próximo, sem resultado. */
  async abort() {
    this.freeSpin = false;
    const from = this.position_;
    const target = Math.floor(from) - 1;
    await tween(this.ticker, 400, (p) => (this.position_ = from + (target - from) * p), ease.outCubic);
    this.speed = 0;
  }

  /** Sprite que está na linha do meio (usado no efeito de vitória). */
  get centerSprite(): Sprite {
    return this.cells[1];
  }
}

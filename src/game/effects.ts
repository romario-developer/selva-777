/**
 * effects.ts — chuva de moedas na vitória (sistema de partículas simples).
 *
 * Cada moeda é um Sprite com velocidade e gravidade. Usamos UMA textura
 * para todas (desenhada uma vez) e um limite de quantidade, para não pesar.
 */
import { Container, Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';

interface Coin {
  sprite: Sprite;
  vx: number;
  vy: number;
  spin: number;
  life: number;
}

const MAX_COINS = 90;
const GRAVITY = 1400; // pixels/s²

export class CoinBurst extends Container {
  private coins: Coin[] = [];
  private texture: Texture;

  constructor(renderer: Renderer) {
    super();
    const g = new Graphics()
      .circle(14, 14, 13).fill({ color: 0xe0a83a })
      .circle(14, 14, 9).fill({ color: 0xf7d27a })
      .circle(11, 11, 3).fill({ color: 0xfff3c4, alpha: 0.9 });
    this.texture = renderer.generateTexture(g);
    g.destroy();
  }

  burst(x: number, y: number, amount: number) {
    for (let i = 0; i < amount && this.coins.length < MAX_COINS; i++) {
      const sprite = new Sprite(this.texture);
      sprite.anchor.set(0.5);
      sprite.position.set(x, y);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 450 + Math.random() * 550;
      this.coins.push({ sprite, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, spin: (Math.random() - 0.5) * 12, life: 1.6 + Math.random() * 0.6 });
      this.addChild(sprite);
    }
  }

  update(deltaMS: number) {
    const dt = deltaMS / 1000;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.vy += GRAVITY * dt;
      c.sprite.x += c.vx * dt;
      c.sprite.y += c.vy * dt;
      // "Girar" a moeda achatando no eixo X dá ilusão de 3D sem custo.
      c.sprite.scale.x = Math.cos(c.life * c.spin);
      c.life -= dt;
      c.sprite.alpha = Math.min(1, c.life * 2);
      if (c.life <= 0) {
        c.sprite.destroy();
        this.coins.splice(i, 1);
      }
    }
  }

  get count() {
    return this.coins.length;
  }
}

/**
 * tween.ts — animação "de A até B" em um tempo fixo, sem biblioteca.
 *
 * Usa o Ticker do Pixi (o laço que roda a cada quadro, ~60 vezes por segundo)
 * e devolve uma Promise, para poder escrever `await tween(...)`.
 */
import type { Ticker } from 'pixi.js';

export type Easing = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - (1 - t) ** 3,
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  /** Passa um pouco do ponto e volta: dá o "tranco" do rolo parando. */
  outBack: (t: number) => {
    const c1 = 1.4;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
};

export function tween(
  ticker: Ticker,
  durationMs: number,
  onUpdate: (progress: number) => void,
  easing: Easing = ease.outCubic,
): Promise<void> {
  return new Promise((resolve) => {
    let elapsed = 0;
    const step = (t: Ticker) => {
      elapsed += t.deltaMS;
      const p = Math.min(elapsed / durationMs, 1);
      onUpdate(easing(p));
      if (p >= 1) {
        ticker.remove(step);
        resolve();
      }
    };
    ticker.add(step);
  });
}

export const delay = (ticker: Ticker, ms: number) => tween(ticker, ms, () => {});

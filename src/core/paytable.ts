/**
 * paytable.ts — as REGRAS do jogo, sem nada de tela.
 *
 * Fica separado da renderização de propósito: o "servidor" (api.ts) usa essas
 * regras para decidir o resultado, e a interface só mostra o que recebeu.
 * Num jogo real de iGaming, essa parte mora no backend.
 */

export type SymbolId = 'cherry' | 'lemon' | 'bell' | 'star' | 'diamond' | 'seven';

export interface SymbolDef {
  id: SymbolId;
  /** O que aparece no rolo (emoji ou texto). */
  glyph: string;
  name: string;
  /** Cor de fundo da "carta" do símbolo. */
  tint: number;
  /** Quantas vezes o símbolo aparece em cada rolo. Mais cópias = mais comum. */
  count: number;
  /** Multiplicador da aposta quando sai 3 iguais na linha do meio. */
  pays3: number;
}

export const SYMBOLS: SymbolDef[] = [
  { id: 'cherry',  glyph: '🍒', name: 'Cereja',   tint: 0x7a2e3a, count: 8, pays3: 8 },
  { id: 'lemon',   glyph: '🍋', name: 'Limão',    tint: 0x6f6a1f, count: 7, pays3: 12 },
  { id: 'bell',    glyph: '🔔', name: 'Sino',     tint: 0x7a5a1c, count: 5, pays3: 20 },
  { id: 'star',    glyph: '⭐', name: 'Estrela',  tint: 0x2f4f7a, count: 4, pays3: 35 },
  { id: 'diamond', glyph: '💎', name: 'Diamante', tint: 0x1f5f6a, count: 3, pays3: 70 },
  { id: 'seven',   glyph: '7',  name: 'Sete',     tint: 0x5a1f5f, count: 2, pays3: 200 },
];

export const REEL_COUNT = 3;
/** Par de cerejas nos rolos 1 e 2 paga 3x; qualquer outro par nos rolos 1 e 2 devolve a aposta. */
export const CHERRY_PAIR_PAYS = 3;
export const ANY_PAIR_PAYS = 1;

/**
 * Monta a "fita" de um rolo: a lista de símbolos na ordem em que passam.
 * Cada rolo é embaralhado com uma semente diferente, mas sempre igual entre
 * cliente e servidor (função determinística). Assim os dois lados concordam
 * sobre qual símbolo está em cada posição.
 */
export function buildStrip(seed: number): SymbolId[] {
  const strip: SymbolId[] = [];
  for (const s of SYMBOLS) for (let i = 0; i < s.count; i++) strip.push(s.id);

  // Embaralhamento Fisher–Yates com um gerador pseudoaleatório simples (LCG).
  let state = seed;
  const rand = () => (state = (state * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32;
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }
  return strip;
}

export const STRIPS: SymbolId[][] = Array.from({ length: REEL_COUNT }, (_, i) => buildStrip(7 + i * 31));

export function symbolById(id: SymbolId): SymbolDef {
  return SYMBOLS.find((s) => s.id === id)!;
}

/** Calcula o multiplicador da linha do meio. 0 = não ganhou. */
export function evaluateLine(line: SymbolId[]): number {
  const [a, b, c] = line;
  if (a === b && b === c) return symbolById(a).pays3;
  if (a === b) return a === 'cherry' ? CHERRY_PAIR_PAYS : ANY_PAIR_PAYS;
  return 0;
}

/**
 * RTP (retorno ao jogador) exato: percorre todas as combinações possíveis
 * e soma probabilidade × prêmio. Mostrado na tabela de pagamentos.
 */
export function calculateRtp(): { rtp: number; hitRate: number } {
  const total = SYMBOLS.reduce((sum, s) => sum + s.count, 0);
  let rtp = 0;
  let hitRate = 0;
  for (const a of SYMBOLS)
    for (const b of SYMBOLS)
      for (const c of SYMBOLS) {
        const p = (a.count * b.count * c.count) / total ** 3;
        const mult = evaluateLine([a.id, b.id, c.id]);
        rtp += p * mult;
        if (mult > 0) hitRate += p;
      }
  return { rtp, hitRate };
}

/**
 * symbols.ts — desenha cada símbolo UMA vez e guarda como textura.
 *
 * Desenhar texto/emoji todo quadro é caro. Gerando a textura no início,
 * os rolos só trocam qual imagem cada Sprite mostra: muito mais leve,
 * principalmente no celular.
 */
import { Container, Graphics, Text, type Renderer, type Texture } from 'pixi.js';
import { SYMBOLS, type SymbolId } from '../core/paytable';

export const CELL = 132; // tamanho de cada casa do rolo, em pixels de design

export const DISPLAY_FONT = 'Bungee, "Arial Black", Impact, sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function buildSymbolTextures(renderer: Renderer): Map<SymbolId, Texture> {
  const textures = new Map<SymbolId, Texture>();

  for (const s of SYMBOLS) {
    const card = new Container();
    const inset = 8;
    const size = CELL - inset * 2;

    const bg = new Graphics()
      .roundRect(inset, inset, size, size, 18)
      .fill({ color: s.tint })
      .roundRect(inset, inset, size, size, 18)
      .stroke({ width: 3, color: 0xf2c46b, alpha: 0.35 });
    // Brilho suave na metade de cima, para parecer uma peça de verdade.
    const shine = new Graphics().roundRect(inset + 6, inset + 6, size - 12, size * 0.42, 14).fill({ color: 0xffffff, alpha: 0.07 });
    card.addChild(bg, shine);

    const glyph =
      s.id === 'seven'
        ? new Text({
            text: s.glyph,
            style: {
              fontFamily: DISPLAY_FONT,
              fontSize: 78,
              fill: 0xf7d27a,
              stroke: { color: 0x3a0d2e, width: 8 },
              dropShadow: { color: 0x000000, alpha: 0.45, blur: 4, distance: 4, angle: Math.PI / 2 },
            },
          })
        : new Text({ text: s.glyph, style: { fontFamily: EMOJI_FONT, fontSize: 64 } });
    glyph.anchor.set(0.5);
    glyph.position.set(CELL / 2, CELL / 2 + 2);
    card.addChild(glyph);

    // Área transparente garante que toda textura tenha exatamente CELL x CELL.
    const frame = new Graphics().rect(0, 0, CELL, CELL).fill({ color: 0x000000, alpha: 0.001 });
    card.addChildAt(frame, 0);

    textures.set(s.id, renderer.generateTexture({ target: card, resolution: Math.min(window.devicePixelRatio, 2) }));
    card.destroy({ children: true });
  }
  return textures;
}

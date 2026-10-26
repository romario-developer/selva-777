/**
 * GameCanvas.tsx — a ponte entre React e PixiJS.
 *
 * O React cuida da página; o Pixi desenha dentro de uma <div>.
 * O useEffect cria o jogo ao montar o componente e destrói ao desmontar
 * (sem isso, o canvas e as texturas ficariam na memória).
 */
import { useEffect, useRef } from 'react';
import { Game } from '../game/Game';
import { attachView, boot } from '../core/store';

export function GameCanvas({ onReady }: { onReady: (game: Game | null) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = new Game();
    let cancelled = false;

    game.init(hostRef.current!).then(() => {
      if (cancelled) return;
      attachView(game);
      onReady(game);
      boot();
    });

    return () => {
      cancelled = true;
      attachView(null);
      onReady(null);
      game.destroy();
    };
  }, [onReady]);

  return <div ref={hostRef} className="machine" aria-label="Rolos do caça-níquel" role="img" />;
}

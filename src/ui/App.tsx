/**
 * App.tsx — a interface em React em volta do jogo.
 *
 * Tudo que é botão, texto e lista fica aqui (React é ótimo nisso).
 * Tudo que se mexe a 60 quadros por segundo fica no Pixi (GameCanvas).
 */
import { useCallback, useEffect, useState } from 'react';
import type { Game, GameStats } from '../game/Game';
import { BET_OPTIONS, canSpin, refill, setBet, spin, useGameState } from '../core/store';
import { SYMBOLS, calculateRtp } from '../core/paytable';
import { FakeSocket, type BigWinEvent } from '../core/socket';
import { GameCanvas } from './GameCanvas';

const RTP = calculateRtp();
const fmt = (n: number) => n.toLocaleString('pt-BR');

export function App() {
  const state = useGameState();
  const [game, setGame] = useState<Game | null>(null);
  const [debug, setDebug] = useState(false);
  const onReady = useCallback((g: Game | null) => setGame(g), []);

  // Teclado: Espaço gira, D abre o painel de desempenho.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        spin();
      }
      if (e.key.toLowerCase() === 'd') setDebug((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const busy = state.phase !== 'idle';
  const betIndex = BET_OPTIONS.indexOf(state.bet);
  const outOfCredits = state.phase === 'idle' && state.balance < BET_OPTIONS[0];

  return (
    <div className="page">
      <header className="top">
        <div>
          <h1 className="brand">Selva 777</h1>
          <p className="tagline">Protótipo jogável de caça-níquel 2D · PixiJS + React + TypeScript</p>
        </div>
        <span className="chip">Créditos fictícios · sem dinheiro real</span>
      </header>

      <main className="layout">
        <section className="stage" aria-label="Jogo">
          <GameCanvas onReady={onReady} />

          <div className="controls">
            <div className="meter">
              <span className="label">Saldo</span>
              <output className="value" aria-live="polite">{fmt(state.balance)}</output>
            </div>

            <div className="bet" role="group" aria-label="Aposta">
              <button type="button" className="step" onClick={() => setBet(BET_OPTIONS[betIndex - 1])} disabled={busy || betIndex <= 0} aria-label="Diminuir aposta">−</button>
              <div className="meter">
                <span className="label">Aposta</span>
                <output className="value">{state.bet}</output>
              </div>
              <button type="button" className="step" onClick={() => setBet(BET_OPTIONS[betIndex + 1])} disabled={busy || betIndex >= BET_OPTIONS.length - 1} aria-label="Aumentar aposta">+</button>
            </div>

            <div className="meter">
              <span className="label">Prêmio</span>
              <output className={`value ${state.lastWin > 0 ? 'won' : ''}`}>{fmt(state.lastWin)}</output>
            </div>

            {outOfCredits ? (
              <button type="button" className="spin" onClick={refill}>Recarregar</button>
            ) : (
              <button type="button" className="spin" onClick={spin} disabled={!canSpin(state)}>
                {state.phase === 'spinning' || state.phase === 'stopping' ? 'Girando' : 'Girar'}
              </button>
            )}
          </div>

          <p className={`status ${state.error ? 'error' : ''}`} role="status">
            {state.error ?? state.message}
          </p>
          <p className="hint">
            <kbd>Espaço</kbd> gira · <kbd>D</kbd> mostra o painel de desempenho
          </p>
        </section>

        <aside className="side">
          {debug && <DebugPanel game={game} />}
          <LiveFeed />
          <Paytable />
          <History rows={state.history} />
        </aside>
      </main>

      <footer className="foot">
        Feito por Romário Alves ·{' '}
        <a href="https://github.com/romario-developer" target="_blank" rel="noreferrer">github.com/romario-developer</a>
      </footer>
    </div>
  );
}

function LiveFeed() {
  const [events, setEvents] = useState<BigWinEvent[]>([]);

  useEffect(() => {
    const socket = new FakeSocket();
    socket.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as BigWinEvent;
      setEvents((list) => [event, ...list].slice(0, 5));
    };
    return () => socket.close();
  }, []);

  return (
    <section className="panel">
      <h2>
        Ao vivo <span className="dot" aria-hidden="true" />
      </h2>
      <p className="note">Eventos por WebSocket (simulado)</p>
      {events.length === 0 ? (
        <p className="empty">Aguardando a primeira mensagem…</p>
      ) : (
        <ul className="feed">
          {events.map((e) => (
            <li key={e.at + e.player}>
              <span>{e.player}</span>
              <span className="amount">+{fmt(e.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Paytable() {
  return (
    <section className="panel">
      <h2>Pagamentos</h2>
      <p className="note">Linha do meio · multiplica a aposta</p>
      <table className="pays">
        <tbody>
          {[...SYMBOLS].reverse().map((s) => (
            <tr key={s.id}>
              <td className="glyph">{s.id === 'seven' ? <span className="seven">7</span> : s.glyph}</td>
              <td>3 × {s.name}</td>
              <td className="num">{s.pays3}x</td>
            </tr>
          ))}
          <tr>
            <td className="glyph">🍒</td>
            <td>2 cerejas (rolos 1 e 2)</td>
            <td className="num">3x</td>
          </tr>
          <tr>
            <td className="glyph">≡</td>
            <td>Outro par (rolos 1 e 2)</td>
            <td className="num">1x</td>
          </tr>
        </tbody>
      </table>
      <p className="note">
        RTP calculado: <strong>{(RTP.rtp * 100).toFixed(1)}%</strong> · chance de prêmio: {(RTP.hitRate * 100).toFixed(1)}%
      </p>
    </section>
  );
}

function History({ rows }: { rows: { roundId: number; bet: number; win: number }[] }) {
  return (
    <section className="panel">
      <h2>Últimas rodadas</h2>
      {rows.length === 0 ? (
        <p className="empty">Nenhuma rodada ainda.</p>
      ) : (
        <table className="pays history">
          <thead>
            <tr><th>#</th><th>Aposta</th><th className="num">Prêmio</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.roundId}>
                <td>{r.roundId}</td>
                <td>{r.bet}</td>
                <td className={`num ${r.win > 0 ? 'won' : ''}`}>{r.win > 0 ? `+${r.win}` : '0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function DebugPanel({ game }: { game: Game | null }) {
  const state = useGameState();
  const [stats, setStats] = useState<GameStats | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setStats(game?.getStats() ?? null), 500);
    return () => window.clearInterval(id);
  }, [game]);

  const res = state.lastResponse;
  return (
    <section className="panel debug">
      <h2>Desempenho</h2>
      <dl>
        <dt>FPS</dt><dd>{stats?.fps ?? '–'}</dd>
        <dt>Renderer</dt><dd>{stats?.renderer ?? '–'}</dd>
        <dt>Resolução</dt><dd>{stats ? `${stats.resolution}x · ${stats.canvas}` : '–'}</dd>
        <dt>Partículas</dt><dd>{stats?.particles ?? '–'}</dd>
        <dt>Estado</dt><dd>{state.phase}</dd>
        <dt>Latência API</dt><dd>{res ? `${res.latencyMs} ms` : '–'}</dd>
        <dt>Paradas</dt><dd>{res ? `[${res.stops.join(', ')}]` : '–'}</dd>
      </dl>
    </section>
  );
}

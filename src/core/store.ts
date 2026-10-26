/**
 * store.ts — o ESTADO do jogo e a máquina de estados da rodada.
 *
 * React (botões, saldo) e PixiJS (rolos) leem daqui. Ninguém altera o saldo
 * por conta própria: tudo passa por `setState`, então é fácil seguir o fluxo.
 *
 * Fluxo de uma rodada:
 *   idle --clicou girar--> spinning --API respondeu--> stopping --rolos pararam--> result --> idle
 *                              \--erro da API--> idle (com mensagem)
 */
import { useSyncExternalStore } from 'react';
import * as api from './api';

export type Phase = 'loading' | 'idle' | 'spinning' | 'stopping' | 'result';

export const BET_OPTIONS = [5, 10, 25, 50, 100];

export interface GameState {
  phase: Phase;
  balance: number;
  bet: number;
  lastWin: number;
  lastMultiplier: number;
  message: string;
  error: string | null;
  lastResponse: api.SpinResponse | null;
  history: { roundId: number; bet: number; win: number }[];
}

/** O que a parte visual (Pixi) precisa saber fazer. O store não conhece Pixi. */
export interface GameView {
  startSpin(): void;
  stopAt(stops: number[]): Promise<void>;
  celebrate(win: number, multiplier: number): Promise<void>;
  abortSpin(): void;
}

let state: GameState = {
  phase: 'loading',
  balance: 0,
  bet: 10,
  lastWin: 0,
  lastMultiplier: 0,
  message: 'Carregando…',
  error: null,
  lastResponse: null,
  history: [],
};

const listeners = new Set<() => void>();

function setState(patch: Partial<GameState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

export const store = {
  getState: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

/** Hook do React: o componente re-renderiza quando o estado muda. */
export function useGameState(): GameState {
  return useSyncExternalStore(store.subscribe, store.getState);
}

// ---------------------------------------------------------------- ações

let view: GameView | null = null;

export function attachView(v: GameView | null) {
  view = v;
}

export async function boot() {
  const balance = await api.getBalance();
  setState({ phase: 'idle', balance, message: 'Escolha a aposta e gire.' });
}

export function setBet(bet: number) {
  if (state.phase !== 'idle') return;
  setState({ bet });
}

export function canSpin(s: GameState = state) {
  return s.phase === 'idle' && s.bet <= s.balance && view !== null;
}

export async function spin() {
  if (!canSpin() || !view) return;
  const { bet } = state;

  // Mostra a aposta saindo do saldo na hora (resposta otimista).
  // O valor oficial chega depois, na resposta do servidor.
  setState({ phase: 'spinning', balance: state.balance - bet, lastWin: 0, error: null, message: 'Girando…' });
  view.startSpin();

  let res: api.SpinResponse;
  try {
    res = await api.spin(bet);
  } catch (err) {
    view.abortSpin();
    const balance = await api.getBalance();
    setState({ phase: 'idle', balance, error: (err as Error).message, message: 'Tente de novo.' });
    return;
  }

  setState({ phase: 'stopping', lastResponse: res });
  await view.stopAt(res.stops);

  setState({
    phase: 'result',
    balance: res.balance,
    lastWin: res.win,
    lastMultiplier: res.multiplier,
    message:
      res.multiplier > 1 ? `Ganhou ${res.win} créditos (${res.multiplier}x)` : res.multiplier === 1 ? 'Par! Aposta devolvida.' : 'Não foi dessa vez.',
    history: [{ roundId: res.roundId, bet, win: res.win }, ...state.history].slice(0, 8),
  });

  if (res.win > 0) await view.celebrate(res.win, res.multiplier);
  setState({ phase: 'idle' });
}

export async function refill() {
  if (state.phase !== 'idle') return;
  const balance = await api.refill();
  setState({ balance, error: null, message: 'Créditos recarregados.' });
}

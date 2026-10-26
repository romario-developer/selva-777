/**
 * api.ts — um "servidor" falso que imita uma REST API.
 *
 * Por que existe: em jogos de iGaming, quem decide o resultado é SEMPRE o
 * servidor (o cliente não é confiável). O front só pede "gira" e recebe
 * onde cada rolo deve parar. Aqui simulamos isso com Promise + atraso de rede,
 * então trocar por um fetch() de verdade depois é só mudar esta função.
 */
import { REEL_COUNT, STRIPS, evaluateLine, type SymbolId } from './paytable';

export interface SpinResponse {
  roundId: number;
  /** Índice da fita que fica na linha do meio, um por rolo. */
  stops: number[];
  line: SymbolId[];
  multiplier: number;
  win: number;
  balance: number;
  /** Tempo de resposta simulado, em ms (aparece no painel de debug). */
  latencyMs: number;
}

export class ApiError extends Error {}

const STARTING_BALANCE = 1000;

// Estado que, num jogo real, ficaria no banco de dados do servidor.
const server = { balance: STARTING_BALANCE, round: 0 };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Equivale a: GET /api/wallet */
export async function getBalance(): Promise<number> {
  await wait(150);
  return server.balance;
}

/** Equivale a: POST /api/spin  { bet } */
export async function spin(bet: number): Promise<SpinResponse> {
  const latencyMs = 250 + Math.round(Math.random() * 350);
  await wait(latencyMs);

  if (!Number.isInteger(bet) || bet <= 0) throw new ApiError('Aposta inválida.');
  if (bet > server.balance) throw new ApiError('Créditos insuficientes para essa aposta.');

  server.balance -= bet;
  server.round += 1;

  const stops = Array.from({ length: REEL_COUNT }, (_, r) => Math.floor(Math.random() * STRIPS[r].length));
  const line = stops.map((stop, r) => STRIPS[r][stop]);
  const multiplier = evaluateLine(line);
  const win = bet * multiplier;
  server.balance += win;

  return { roundId: server.round, stops, line, multiplier, win, balance: server.balance, latencyMs };
}

/** Equivale a: POST /api/wallet/refill — créditos fictícios para continuar jogando. */
export async function refill(): Promise<number> {
  await wait(200);
  server.balance = STARTING_BALANCE;
  return server.balance;
}

/**
 * socket.ts — um WebSocket falso para eventos em tempo real.
 *
 * A interface imita a do WebSocket do navegador (onmessage, close), então
 * trocar por `new WebSocket('wss://...')` depois muda quase nada no resto do
 * código. Aqui ele "recebe" grandes vitórias de outros jogadores fictícios.
 */

export interface BigWinEvent {
  type: 'big_win';
  player: string;
  amount: number;
  at: number;
}

export class FakeSocket {
  onmessage: ((event: { data: string }) => void) | null = null;
  private timer: number | undefined;

  constructor() {
    const tick = () => {
      this.emit();
      this.timer = window.setTimeout(tick, 2500 + Math.random() * 4000);
    };
    this.timer = window.setTimeout(tick, 1200);
  }

  private emit() {
    const event: BigWinEvent = {
      type: 'big_win',
      player: `Jogador#${1000 + Math.floor(Math.random() * 9000)}`,
      amount: [80, 120, 200, 350, 700, 1500][Math.floor(Math.random() * 6)],
      at: Date.now(),
    };
    // Mensagens de WebSocket chegam como texto, por isso o JSON.
    this.onmessage?.({ data: JSON.stringify(event) });
  }

  close() {
    window.clearTimeout(this.timer);
    this.onmessage = null;
  }
}

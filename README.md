# Selva 777 — mini caça-níquel 2D

Protótipo jogável de caça-níquel feito com **PixiJS 8, React 18 e TypeScript**.
Créditos fictícios, sem dinheiro real. Projeto de portfólio de **Romário Alves**.

**Jogue agora:** https://selva-777.romariotecla.workers.dev

## Como rodar

```bash
npm install
npm run dev          # abre em http://localhost:5173
npm run build        # gera a pasta dist/ para publicar
```

Atalhos: **Espaço** gira · **D** abre o painel de desempenho (FPS, renderer, latência da API).

## O que o projeto mostra

| Requisito da vaga | Onde está |
|---|---|
| Mecânicas e animações 2D com PixiJS | `src/game/Reel.ts`, `src/game/effects.ts` |
| Interface do jogo em React + TypeScript | `src/ui/App.tsx` |
| Estado do jogo integrado a REST API | `src/core/store.ts` + `src/core/api.ts` (API simulada) |
| Eventos em tempo real via WebSocket | `src/core/socket.ts` (WebSocket simulado, painel "Ao vivo") |
| Desempenho e telas diferentes | Texturas pré-geradas, filtro de blur só quando visível, resolução limitada a 2x, layout que escala do celular ao desktop |

## Arquitetura

```
src/
  core/          regras e estado (não sabe que o Pixi existe)
    paytable.ts  símbolos, fitas dos rolos, prêmios, cálculo do RTP
    api.ts       "servidor": decide o resultado e guarda o saldo
    socket.ts    eventos em tempo real (interface igual à do WebSocket)
    store.ts     estado do jogo + máquina de estados da rodada
  game/          tudo que é desenhado no canvas (PixiJS)
    Game.ts      cria o app Pixi, monta a máquina, escala na tela
    Reel.ts      um rolo: posição, giro, parada, desfoque
    symbols.ts   desenha cada símbolo uma vez como textura
    effects.ts   chuva de moedas (partículas)
    tween.ts     animação com easing, usando o Ticker do Pixi
  ui/            React
    App.tsx      controles, saldo, tabela, histórico, painel de debug
    GameCanvas.tsx  monta e desmonta o jogo Pixi dentro do React
```

### Fluxo de uma rodada

```
idle ─(clicou Girar)→ spinning ─(API respondeu)→ stopping ─(rolos pararam)→ result → idle
                         └─(erro da API)→ idle com mensagem
```

1. O jogador clica em **Girar** (React) e o `store` muda para `spinning`.
2. O `Game` (Pixi) começa a girar os rolos **antes** da resposta, para não parecer travado.
3. A API devolve onde cada rolo deve parar (`stops`). **Quem decide o resultado é o servidor**, nunca o front.
4. Cada rolo anima até a sua parada. Os da direita giram mais casas, por isso param em sequência.
5. Se ganhou, a linha acende, os símbolos pulsam, sobem moedas e o valor conta de 0 até o prêmio.

## Decisões técnicas (bom para explicar em entrevista)

- **Rolo = um número.** O rolo guarda só `position` (índice da fita na linha de cima). Quatro Sprites são reposicionados a partir dele a cada quadro, em vez de mover uma fita gigante.
- **Parada sem solavanco.** A curva `outBack` começa cerca de 4,4x mais rápida que a média, então a duração da parada é calculada para que a velocidade inicial bata com a do giro.
- **Texturas pré-geradas.** Emoji e texto são desenhados uma vez com `generateTexture`; depois os Sprites só trocam de textura.
- **Blur com custo controlado.** O `BlurFilter` só é aplicado quando a velocidade passa de um limite.
- **Resolução limitada a 2x.** Em celulares com tela 3x, isso reduz bastante o número de pixels renderizados.
- **`deltaMS` limitado a 50 ms.** Evita um "pulo" quando a aba volta do segundo plano.
- **RTP calculado, não chutado.** `calculateRtp()` percorre todas as combinações e mostra o retorno teórico (~94%) e a chance de prêmio (~20%).
- **API e WebSocket simulados com a mesma interface dos reais.** Trocar por `fetch()` e `new WebSocket()` muda só esses dois arquivos.

## Próximos passos

- Testes com Vitest para `evaluateLine` e `calculateRtp`.
- Sons (Web Audio) iniciados no primeiro clique.
- Backend real em Node com WebSocket.

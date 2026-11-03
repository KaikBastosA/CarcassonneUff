# CarcassonneUff
Repositório feito para a criação do trabalho de Projeto de Software

```sh
bun install
bun dev
```

Abra o endereço exibido pelo Vite. Configure de 2 a 5 jogadores locais, com nomes e cores diferentes, escolha o controle **Humano** ou **IA** de cada um e quem começa. A mesa pode conter somente IAs para observar seus comportamentos. Nos turnos humanos, posicione a peça comprada, escolha um seguidor opcional e confirme. A colocação pode ser desfeita antes da confirmação.

Os participantes são definidos na configuração da partida. O placar e o histórico apresentam os jogadores dessa sessão, e o cabeçalho identifica o modo **Partida local**.

A partida usa 72 cartelas distribuídas entre os 12 modelos disponíveis, com quantidades próprias do projeto. Uma cartela inicial é reservada e as outras 71 são embaralhadas. Peças sem encaixe em nenhuma orientação são descartadas automaticamente; ao esgotar a pilha, ocorre a apuração final. Em empate de pontos, vence quem tinha mais meeples na reserva antes dessa apuração. A contagem é registrada antes de devolver os seguidores; se pontos e reserva empatarem, os jogadores dividem a vitória. O botão **Nova partida** retorna à configuração. A sessão fica na memória do navegador; recarregar a página volta à configuração.

## Validação

```sh
bun run test
bun run check
bun run build
```

## Humanos e IA

Para jogar com dois humanos contra uma IA, escolha 3 jogadores e defina os controles como **Humano**, **Humano** e **IA**. Os humanos compartilham este dispositivo. A IA executa seu turno automaticamente, incluindo rotação, posição e seguidor opcional. Durante o cálculo, o painel mostra **IA pensando…** e as ações da jogada ficam bloqueadas. **Nova partida** continua disponível e cancela o cálculo anterior.

Cada jogador controlado por IA possui uma seleção de dificuldade:

- **Básico:** avalia a jogada atual, considerando encaixes, pontuação, maiorias, adversários e reserva de seguidores.
- **Estratégico:** compara quatro decisões promissoras em dois cenários de compras futuras, simulando as respostas dos adversários até a próxima vez da própria IA. Também estima o potencial de campos próximos a cidades ainda incompletas. A busca é limitada e não garante a melhor jogada ou vitória.

Para **IA vs IA**, configure todos os participantes como **IA**, escolha o nível de cada um e inicie. A partida avança automaticamente até o resultado final. É possível observar, navegar pelo tabuleiro ou usar **Nova partida** durante a execução.

Os níveis usam as mesmas regras e não conhecem a ordem futura da pilha. O estratégico estima as cartelas desconhecidas pelo catálogo, descontando as peças colocadas, a compra atual e os descartes públicos. Os adversários simulados usam a política básica. O cálculo ocorre em um Web Worker. Se ele falhar ou exceder 10 segundos, a partida usa uma jogada legal sem seguidor para continuar. **Nova partida** preserva a dificuldade escolhida de cada IA.

O modo em rede e a persistência ainda não estão implementados.

## Arquitetura

O `GameStore` implementa o contrato Observer e mantém a partida atual como única fonte de estado. Os comandos delegam às regras de `GameSession` e notificam os observadores após publicar uma alteração. O adaptador `GameObserver`, usado pelo hook `useGame`, acompanha essas notificações com `useSyncExternalStore`, atualizando mapa, placar e painel pelo mesmo snapshot. A assinatura é removida ao desmontar a interface; os cálculos de IA continuam com cancelamento e proteção contra respostas de uma partida anterior.

O catálogo inclui três cartelas com brasão: duas Cidades em curva e uma Cidade fechada, dentro do total de 72. Cada brasão acrescenta 2 pontos à cidade completa ou 1 ponto à cidade incompleta na apuração final. O símbolo acompanha a rotação e permanece na cartela após a devolução dos seguidores.

O ciclo da partida pertence a `MatchState` (`ConfigurationState`, `InProgressState`, `FinalScoringState` e `FinishedState`). `GameState.phase` descreve apenas o turno: `place` ou `meeple`. A fase exibida na interface é uma projeção de `GameSession.phase`.

`GameStore.getSnapshot()` devolve o `GameState` estável, e `getSession()` fornece a sessão para agendar e cancelar a IA. `BoardState` contém as cartelas, seguidores, limites e posições; `renderBoard()` projeta esses dados para o canvas. Os comandos usam `Position` e `FollowerAllocation`, e a alocação devolve uma nova `StructureMesh`. Cada `ScoringRecord` identifica um jogador e uma estrutura; empates de maioria produzem um registro por vencedor.

A nomenclatura das sequências mais recentes é prioritária: `GameSession.posicionarCartela()`, `selecionarSeguidor()`, `rotacionarCartela()` e `confirmarTurno()`. A malha expõe `podePosicionarSeguidor()`, `posicionarSeguidor()` e `avaliarEstruturasConcluidas()`. A apuração final avalia estradas, cidades, mosteiros e campos nessa ordem. `ApuracaoFinalState` é um nome alternativo para `FinalScoringState`. Os métodos ingleses dos diagramas de classes continuam disponíveis.

## Assets

As imagens de peças e meeples em `src/assets/` são derivadas de [tsaglam/Carcassonne](https://github.com/tsaglam/Carcassonne), licenciado sob a [Eclipse Public License 2.0](https://www.eclipse.org/legal/epl-2.0/). Os arquivos foram redimensionados e convertidos para WebP.

O símbolo de brasão em `src/assets/coat-of-arms.svg` foi criado para este projeto.

# Alinhamento aos diagramas do Carcassonne

O jogador continua configurando a mesa, posicionando peças, escolhendo seguidores, desfazendo antes da confirmação e jogando contra as duas IAs. Em empate de pontos, vence quem tinha mais meeples na reserva antes da apuração final; se a reserva também empatar, a vitória é compartilhada.

## Critérios atendidos

- Ciclo da partida em MatchState e fase do turno em TurnPhase; BoardState com cartelas, seguidores, limites e posições.
- Comandos com Position, FollowerAllocation e TileInstance; alocação devolve nova StructureMesh.
- Vencedores como Player[], registros de pontuação por jogador/estrutura e reserva pré-apuração imutável.
- Nomenclatura prioritária das duas imagens finais: GameSession, GameBoard e StructureMesh, com comandos em português.
- Observer publica o snapshot antes de notificar; React acompanha a sessão imutável; IA mantém cancelamento e rejeição de respostas atrasadas.

## ✅ Contratos e integração

**Antes:** o mapa visual era chamado BoardState e fases da partida se misturavam às fases do turno. A maioria e os vencedores eram ids. A apuração final varria todas as estruturas sem filtro de seguidores.

**Agora:** snapshots de domínio explícitos e projeções para React. A confirmação verifica estruturas concluídas e consolida pontos uma vez. O encerramento avalia estradas, cidades, mosteiros e campos, nessa ordem, e aplica o desempate confirmado pelo usuário.

Os comandos de entrada estão em [[a24de83:src/game/session.ts#GameSession]]. As consultas e avaliações pertencem a [[a24de83:src/game/mesh.ts#StructureMesh]], com pontuação polimórfica em [[a24de83:src/game/structures.ts#Structure]]. O armazenamento observável está em [[a24de83:src/game/store.ts#GameStore]] e sua integração React em [[a24de83:src/useGame.ts#useGame]].

O navegador real identificou que ler getSession() a partir de um store estável poderia memorizar uma fase antiga no React Compiler. O hook agora assina a própria sessão imutável; GameStore.getSnapshot continua devolvendo GameState como no diagrama.

```changes
a24de83
src/useGame.ts
src/game/session.ts
src/game/actions.ts
src/game/mesh.ts
src/game/scoring.ts
src/game/board-state.ts
src/game/store.ts
```

## Diferenças necessárias e retificações

Um seguidor sem alocação não possui papel. Uma estratégia humana não pode fabricar uma decisão automática. Consultas sem resultado e snapshots sem colocação anterior continuam usando ausência explícita. O Worker recebe dados serializáveis e reconstrói Position após structuredClone. Repetições de entradas inválidas são novos eventos da interface, permitindo que o usuário faça outra escolha.

Os métodos ingleses dos diagramas de classes continuam disponíveis; os métodos portugueses das duas sequências finais têm prioridade na integração. A mutação direta de Structure da sequência antiga foi superada pela alocação imutável na malha da imagem mais recente.

O relatório anterior transcreveu incorretamente o laço de descarte (a imagem já diz “não existe posição válida”) e afirmou que faltava a mensagem 13 (ela está presente). Também interpretou alguns retornos tracejados como métodos obrigatórios e tratou helpers omitidos como defeitos; a legenda GoF permite esses helpers. O novo relatório classifica individualmente seus 86 itens.

## Verificação concluída

A suíte automatizada citada abaixo foi executada antes de sua remoção posterior. A versão entregue mantém os comandos `bun run check` e `bun run build`.

- 157 testes aprovados, sem falhas, cancelamentos ou testes ignorados; TypeScript e build de produção aprovados.
- 24 partidas comparadas com a base 250a285: 1.703 turnos e 3.241 etapas; pontos, peças, seguidores, decisões e resultados equivalentes. A ordem dos eventos finais acompanha as quatro fases; registros antigos foram normalizados por vencedor. O novo desempate tem teste específico.
- Revisão adicional: quatro partidas com três IAs e mensagens serializadas, 283 turnos, conservação das 72 cartelas e dos seguidores e identidade correta dos jogadores na maioria.
- Chromium em 1280×720: colocar, selecionar, desfazer, confirmar, trocar jogador, reiniciar durante cálculo e concluir IA×IA. Em 390×844: resultado e configuração de cinco jogadores. Zero erros de execução nos fluxos finais.

## Referências

Três arquivos .drawio originais (domínio, GoF e GRASP), três imagens de sequência originais, texto complementar e as duas imagens finais “Executar Turno” e “Encerrar Partida”. A nomenclatura destas últimas tem prioridade por instrução expressa do usuário. A reserva para desempate é medida antes da apuração final, conforme confirmação expressa.

Relatório final: `carcassonne-alinhamento-final/relatorio-final.pdf`, em Downloads e anexado ao chat. O relatório inclui matriz dos 86 itens anteriores, testes, exceções e limites. Código-base 250a285; implementação a24de83. A suíte de testes foi removida em alteração posterior.

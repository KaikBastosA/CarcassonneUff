# CarcassonneUff
Repositório feito para a criação do trabalho de Projeto de Software

```sh
bun install
bun dev
```

Abra o endereço exibido pelo Vite. Configure de 2 a 5 jogadores locais, com nomes e cores diferentes, e escolha quem começa. Cada turno permite posicionar a peça comprada, escolher um seguidor opcional e confirmar. A colocação pode ser desfeita antes da confirmação.

A partida usa 72 cartelas distribuídas entre os 12 modelos disponíveis, com quantidades próprias do projeto. Uma cartela inicial é reservada e as outras 71 são embaralhadas. Peças sem encaixe em nenhuma orientação são descartadas automaticamente; ao esgotar a pilha, ocorre a apuração final. O botão **Nova partida** retorna à configuração. A sessão fica na memória do navegador; recarregar a página volta à configuração.

## Validação

```sh
bun run test
bun run check
bun run build
```

A IA e o modo em rede ainda não estão implementados.

O catálogo inclui três cartelas com brasão: duas Cidades em curva e uma Cidade fechada, dentro do total de 72. Cada brasão acrescenta 2 pontos à cidade completa ou 1 ponto à cidade incompleta na apuração final. O símbolo acompanha a rotação e permanece na cartela após a devolução dos seguidores.

## Assets

As imagens de peças e meeples em `src/assets/` são derivadas de [tsaglam/Carcassonne](https://github.com/tsaglam/Carcassonne), licenciado sob a [Eclipse Public License 2.0](https://www.eclipse.org/legal/epl-2.0/). Os arquivos foram redimensionados e convertidos para WebP.

O símbolo de brasão em `src/assets/coat-of-arms.svg` foi criado para este projeto.

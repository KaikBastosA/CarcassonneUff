import assert from 'node:assert/strict'
import { test } from 'node:test'
import { boardSnapshot, renderBoard } from '../src/game/board-state.ts'
import { playerColors } from '../src/game.ts'
import { getFollowerChoices } from '../src/game/actions.ts'
import { GameBoard } from '../src/game/board.ts'
import { createGameTiles, drawPlayableTile, shuffledTiles } from '../src/game/deck.ts'
import { StructureMesh } from '../src/game/mesh.ts'
import { Position } from '../src/game/position.ts'
import { ConfigurationState, FinalScoringState, FinishedState, GameSession, InProgressState } from '../src/game/session.ts'
import { createTileSet, TileInstance, tileCatalog, tileKinds } from '../src/game/tiles.ts'

function boardView(state) { return renderBoard(state.board, state.players) }

function configuration(count = 2, seed = 1, startingPlayerIndex = 0) {
  return { players: playerColors.slice(0, count).map((color, index) => ({ name: `Jogador ${index + 1}`, color })), seed, startingPlayerIndex }
}

function inventory(snapshot) {
  const next = snapshot.deckIndex + (snapshot.phase === 'meeple' ? 1 : 0)
  const tiles = [
    ...snapshot.model.placements.map(({ tile }) => tile),
    ...snapshot.discarded,
    ...snapshot.deck.slice(next),
  ]
  assert.equal(tiles.length, 72)
  assert.equal(new Set(tiles.map(({ id }) => id)).size, 72)
  assert.equal(tiles.reduce((total, tile) => total + tile.shields, 0), 3)
  for (const { tile, position } of snapshot.model.placements) assert.equal(boardView(snapshot)[position.key].variant ?? 'plain', tile.variant)
  for (const kind of tileKinds) assert.equal(tiles.filter((tile) => tile.kind === kind).length, tileCatalog[kind].quantity)
}

function orient(match, rotation) {
  for (let turn = 0; match.snapshot.rotation !== rotation && turn < 4; turn++) match = match.rotate(1)
  assert.equal(match.snapshot.rotation, rotation)
  return match
}

test('configuração bloqueia ações e início prepara 72 exemplares sem repetir a cartela inicial', () => {
  const empty = GameSession.configure()
  assert.ok(empty.state instanceof ConfigurationState)
  assert.equal(empty.phase, 'configure')
  assert.equal(empty.snapshot.model.size, 0)
  assert.equal(empty.place('0,0'), empty)
  assert.equal(empty.rotate(1), empty)
  assert.equal(empty.selectFollower('road'), empty)
  assert.equal(empty.undo(), empty)
  assert.equal(empty.confirm(), empty)
  const match = empty.start(configuration())
  assert.ok(match.state instanceof InProgressState)
  assert.equal(match.snapshot.phase, 'place')
  assert.equal(match.snapshot.model.size, 1)
  assert.equal(match.snapshot.deck.length, 71)
  assert.equal(match.snapshot.discarded.length, 0)
  assert.equal(match.snapshot.deckIndex, 0)
  const initial = match.snapshot.model.tileAt(new Position(0, 0))
  assert.equal(initial.id, 'city-road-1')
  assert.ok(match.snapshot.deck.every(({ id }) => id !== initial.id))
  assert.equal(match.start(configuration()), match)
  inventory(match.snapshot)
})

test('o embaralhamento é reproduzível, preserva os exemplares e não altera a entrada', () => {
  const input = createTileSet()
  const original = input.map(({ id }) => id)
  const first = shuffledTiles(input, 42)
  const second = shuffledTiles(input, 42)
  assert.deepEqual(first, second)
  assert.notDeepEqual(first, shuffledTiles(input, 43))
  assert.deepEqual(input.map(({ id }) => id), original)
  assert.equal(new Set(first.map(({ id }) => id)).size, 72)
  assert.ok(first.every((tile) => input.includes(tile)))
  assert.ok(Object.isFrozen(first))
  assert.deepEqual(createGameTiles(0), createGameTiles(0))
})

test('nomes, cores, quantidade, semente e jogador inicial são validados antes de começar', () => {
  const match = GameSession.configure()
  const config = configuration()
  const invalid = [
    { ...config, players: [] }, { ...config, players: config.players.slice(0, 1) },
    { ...config, players: [...configuration(5).players, { name: 'Extra', color: 'blue' }] },
    { ...config, players: [{ name: ' ', color: 'blue' }, config.players[1]] },
    { ...config, players: [{ name: 'a'.repeat(31), color: 'blue' }, config.players[1]] },
    { ...config, players: [{ name: 'Ana', color: 'blue' }, { name: ' ana ', color: 'red' }] },
    { ...config, players: [{ name: 'A', color: 'blue' }, { name: 'B', color: 'blue' }] },
    { ...config, players: [{ name: 'A', color: 'purple' }, config.players[1]] },
    ...[-1, 2, 0.5, NaN].map((startingPlayerIndex) => ({ ...config, startingPlayerIndex })),
    ...[-1, 4294967296, 0.5, NaN].map((seed) => ({ ...config, seed })),
  ]
  for (const candidate of invalid) {
    const result = match.start(candidate)
    assert.ok(result.state instanceof ConfigurationState)
    assert.equal(result.snapshot.model.size, 0)
    assert.equal(result.snapshot.deck.length, 0)
    assert.ok(result.snapshot.message)
  }
  const trimmed = match.start({ ...config, players: [{ name: '  Um  ', color: 'blue' }, { name: ' Dois ', color: 'red' }] })
  assert.deepEqual(trimmed.snapshot.players.map(({ name }) => name), ['Um', 'Dois'])
})

test('desfazer preserva a cartela comprada, a ordem da pilha e o jogador da vez', () => {
  const start = GameSession.configure().start(configuration(3, 17))
  const tile = start.snapshot.deck[start.snapshot.deckIndex]
  const move = start.snapshot.model.getValidMoves(tile)[0]
  const match = orient(start, move.tile.rotation)
  const placed = match.place(move.position)
  assert.equal(placed.snapshot.phase, 'meeple')
  assert.equal(placed.snapshot.model.tileAt(move.position).id, tile.id)
  assert.equal(placed.place('20,20'), placed)
  assert.equal(placed.rotate(1), placed)
  inventory(placed.snapshot)
  const choice = getFollowerChoices(placed.snapshot).find(({ available }) => available)
  const allocated = placed.selectFollower(choice.id)
  const undone = allocated.undo()
  assert.equal(undone.snapshot.phase, 'place')
  assert.equal(undone.snapshot.deckIndex, match.snapshot.deckIndex)
  assert.deepEqual(undone.snapshot.deck, match.snapshot.deck)
  assert.equal(undone.snapshot.currentPlayerIndex, match.snapshot.currentPlayerIndex)
  assert.equal(undone.snapshot.rotation, match.snapshot.rotation)
  assert.deepEqual(undone.snapshot.model.placements, match.snapshot.model.placements)
  assert.equal(undone.snapshot.players[0].meeples, 7)
  assert.deepEqual(undone.snapshot.scoring, [])
  inventory(undone.snapshot)
})

test('confirmar duas vezes não compra duas cartelas nem pula dois jogadores', () => {
  let match = GameSession.configure().start(configuration())
  assert.equal(match.confirm(), match)
  const tile = match.snapshot.deck[match.snapshot.deckIndex]
  const move = match.snapshot.model.getValidMoves(tile)[0]
  match = orient(match, move.tile.rotation).place(move.position).confirm()
  assert.equal(match.snapshot.currentPlayerIndex, 1)
  assert.equal(match.snapshot.deckIndex, 1)
  assert.equal(match.snapshot.phase, 'place')
  assert.equal(match.confirm(), match)
  assert.equal(match.undo(), match)
  assert.equal(match.selectFollower('road'), match)
  inventory(match.snapshot)
})

test('rodadas respeitam quem começou, mesmo quando não é o primeiro da lista', () => {
  let match = GameSession.configure().start(configuration(3, 9, 2))
  for (let turn = 0; turn < 3; turn++) {
    assert.equal(match.snapshot.currentPlayerIndex, (2 + turn) % 3)
    assert.equal(match.snapshot.round, 1)
    const tile = match.snapshot.deck[match.snapshot.deckIndex]
    const move = match.snapshot.model.getValidMoves(tile)[0]
    match = orient(match, move.tile.rotation).place(move.position).confirm()
  }
  assert.equal(match.snapshot.currentPlayerIndex, 2)
  assert.equal(match.snapshot.round, 2)
})

test('descarte usa todas as rotações e compra outra peça sem trocar jogador ou rodada', () => {
  const base = GameSession.configure().start(configuration())
  const model = new GameBoard().place(new TileInstance('start', 'monastery'), new Position(0, 0))
  const deck = [new TileInstance('unplayable', 'city-center'), new TileInstance('playable', 'road')]
  const before = { ...base.snapshot, model, mesh: new StructureMesh(model), board: boardSnapshot(model),
    deck, deckIndex: 0, discarded: [], currentPlayerIndex: 1, round: 4 }
  const after = drawPlayableTile(before)
  assert.equal(after.deckIndex, 1)
  assert.deepEqual(after.discarded.map(({ id }) => id), ['unplayable'])
  assert.equal(after.currentPlayerIndex, 1)
  assert.equal(after.round, 4)
  assert.equal(after.events[0].playerId, after.players[1].id)
  const roadBoard = new GameBoard().place(new TileInstance('start', 'road'), new Position(0, 0))
  const rotated = drawPlayableTile({ ...before, model: roadBoard, deck: [new TileInstance('road', 'road')], rotation: 90 })
  assert.equal(rotated.discarded.length, 0)
  assert.equal(rotated.deckIndex, 0)
  assert.ok(roadBoard.getValidPositions(new TileInstance('road', 'road', rotated.rotation)).length > 0)
})

test('esgotar as últimas peças impossíveis entra na apuração final uma única vez', () => {
  const base = GameSession.configure().start(configuration())
  const model = new GameBoard().place(new TileInstance('start', 'monastery'), new Position(0, 0))
  const players = base.snapshot.players.map((player, index) => index === 0 ? {
    ...player, meeples: 6, followers: player.followers.map((follower, item) => item === 0 ? follower.allocate('start', 'monastery', 'monk') : follower),
  } : player)
  const snapshot = { ...base.snapshot, model, players, mesh: new StructureMesh(model, players.flatMap(({ followers }) => followers), players),
    board: boardSnapshot(model, players.flatMap(({ followers }) => followers)),
    deck: [new TileInstance('unplayable', 'city-center')], deckIndex: 0, discarded: [] }
  const match = new InProgressState().enter(new GameSession(snapshot, new InProgressState(), base.configuration))
  assert.ok(match.state instanceof FinishedState)
  assert.equal(match.phase, 'finished')
  assert.equal(match.snapshot.discarded.length, 1)
  assert.equal(match.snapshot.deckIndex, 1)
  assert.equal(match.snapshot.players[0].score, 1)
  assert.equal(match.snapshot.players[0].meeples, 7)
  assert.equal(match.confirm(), match)
  assert.equal(new FinalScoringState().enter(match), match)
})

test('o estado de apuração não aceita comandos de turno', () => {
  const base = GameSession.configure().start(configuration())
  const match = new GameSession(base.snapshot, new FinalScoringState(), base.configuration)
  assert.equal(match.rotate(1), match)
  assert.equal(match.place('1,0'), match)
  assert.equal(match.undo(), match)
  assert.equal(match.confirm(), match)
  assert.equal(match.start(configuration()), match)
})

test('snapshots e configuração não podem ser alterados por referências externas', () => {
  const config = configuration(5)
  const match = GameSession.configure().start(config)
  config.players[0].name = 'Outro'
  assert.equal(match.snapshot.players[0].name, 'Jogador 1')
  assert.throws(() => { match.snapshot.deckIndex = 999 })
  assert.throws(() => match.snapshot.deck.pop())
  assert.throws(() => { match.snapshot.players[0].score = 100 })
  assert.throws(() => { match.snapshot.board.tiles[0].rotation = 90 })
  assert.throws(() => match.snapshot.board.tiles.pop())
  assert.throws(() => { match.snapshot.board.bounds.minX = 99 })
  assert.throws(() => { match.configuration.players[0].name = 'Outro' })
  assert.equal(new Set(match.snapshot.players.flatMap(({ followers }) => followers.map(({ id }) => id))).size, 35)
  assert.equal(match.snapshot.players[4].color, 'green')
})

test('nova partida durante uma colocação pendente não carrega seguidores ou pontuação anteriores', () => {
  let match = GameSession.configure().start(configuration(3, 11, 1))
  const tile = match.snapshot.deck[match.snapshot.deckIndex]
  const move = match.snapshot.model.getValidMoves(tile)[0]
  match = orient(match, move.tile.rotation).place(move.position)
  const choice = getFollowerChoices(match.snapshot).find(({ available }) => available)
  match = match.selectFollower(choice.id)
  assert.equal(match.snapshot.players[1].meeples, 6)
  const fresh = match.newGame()
  assert.equal(fresh.phase, 'configure')
  assert.equal(fresh.snapshot.pendingPosition, null)
  assert.equal(fresh.snapshot.previousBoard, null)
  assert.equal(fresh.configuration.startingPlayerIndex, 1)
  assert.deepEqual(fresh.configuration.players, match.configuration.players)
  assert.ok(fresh.snapshot.players.every(({ meeples, score, followers }) => meeples === 7 && score === 0 && followers.every(({ status }) => status === 'reserve')))
  const started = fresh.start({ ...fresh.configuration, seed: 0 })
  inventory(started.snapshot)
  assert.equal(started.snapshot.currentPlayerIndex, 1)
  assert.equal(started.snapshot.round, 1)
  assert.equal(match.snapshot.players[1].meeples, 6)
})

test('configuração inválida pode ser corrigida sem manter erro ou estado parcial', () => {
  const match = GameSession.configure()
  const invalid = match.start({ ...configuration(), startingPlayerIndex: -1 })
  assert.ok(invalid.snapshot.message)
  const corrected = invalid.start(configuration())
  assert.equal(corrected.snapshot.message, '')
  assert.equal(corrected.snapshot.phase, 'place')
  inventory(corrected.snapshot)
})

test('partidas completas conservam as 72 cartelas e todos os seguidores até o encerramento', () => {
  for (const [count, seed, starter] of [[2, 0, 0], [3, 1, 2], [5, 42, 4], [2, 4294967295, 1]]) {
    let match = GameSession.configure().start(configuration(count, seed, starter))
    let turns = 0
    while (match.state instanceof InProgressState) {
      const before = match
      inventory(before.snapshot)
      const tile = match.snapshot.deck[match.snapshot.deckIndex]
      const moves = match.snapshot.model.getValidMoves(tile)
      assert.ok(moves.length > 0)
      const move = moves[(turns * 13 + seed) % moves.length]
      match = orient(match, move.tile.rotation).place(move.position)
      assert.equal(match.snapshot.phase, 'meeple')
      const choice = getFollowerChoices(match.snapshot).find(({ available }) => available)
      if (choice && turns % 3 !== 0) match = match.selectFollower(choice.id)
      if (turns % 7 === 0) {
        const undone = match.undo()
        assert.deepEqual(undone.snapshot.players, before.snapshot.players)
        assert.deepEqual(undone.snapshot.model.placements, before.snapshot.model.placements)
        assert.equal(undone.snapshot.deckIndex, before.snapshot.deckIndex)
        match = undone.place(move.position)
      }
      inventory(match.snapshot)
      match = match.confirm()
      assert.ok(match.snapshot.deckIndex > before.snapshot.deckIndex)
      assert.ok(match.snapshot.deckIndex <= 71)
      for (const player of match.snapshot.players) {
        assert.equal(player.followers.length, 7)
        assert.equal(player.meeples, player.followers.filter(({ status }) => status === 'reserve').length)
        const total = match.snapshot.scoring.filter(({ playerId }) => playerId === player.id).reduce((sum, record) => sum + record.points, 0)
        assert.equal(player.score, total)
      }
      assert.equal(match.confirm(), match)
      assert.ok(++turns <= 71)
    }
    assert.ok(match.state instanceof FinishedState)
    assert.equal(match.snapshot.deckIndex, 71)
    assert.equal(turns + 1 + match.snapshot.discarded.length, 72)
    inventory(match.snapshot)
    assert.ok(match.snapshot.players.every(({ meeples }) => meeples === 7))
    const maximum = Math.max(...match.snapshot.players.map(({ score }) => score))
    assert.deepEqual(match.snapshot.winners, match.snapshot.players.filter(({ score }) => score === maximum))
    const restarted = match.newGame()
    assert.ok(restarted.state instanceof ConfigurationState)
    assert.equal(restarted.snapshot.model.size, 0)
    assert.equal(restarted.snapshot.deck.length, 0)
    assert.equal(restarted.snapshot.seed, 0)
    assert.equal(restarted.configuration.seed, undefined)
    assert.ok(restarted.snapshot.players.every(({ score, meeples }) => score === 0 && meeples === 7))
    assert.deepEqual(restarted.snapshot.scoring, [])
    assert.deepEqual(restarted.snapshot.events, [])
    assert.equal(restarted.snapshot.activity, '')
  }
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Worker } from 'node:worker_threads'
import { playerColors } from '../src/game.ts'
import { GameSession, InProgressState } from '../src/game/session.ts'
import { ComputerStrategy, StrategicComputerStrategy, decisionView } from '../src/game/strategy.ts'
import { lookAhead, unknownTiles } from '../src/game/planning.ts'
import { createTileSet } from '../src/game/tiles.ts'

const basic = new ComputerStrategy()
const strategic = new StrategicComputerStrategy()

function configuration(count = 3, seed = 7) {
  return { players: playerColors.slice(0, count).map((color, index) => ({
    name: `Jogador ${index + 1}`, color, control: index === 0 ? 'human' : 'computer', difficulty: index === 1 ? 'basic' : 'strategic',
  })), startingPlayerIndex: 0, seed }
}

function play(match, decision) {
  if (match.computerTurn) return match.playComputerTurn(decision)
  while (match.snapshot.rotation !== decision.rotation) match = match.rotate(1)
  match = match.place(decision.position)
  if (decision.regionId !== null) match = match.selectFollower(decision.regionId)
  return match.confirm()
}

function opening() {
  let match = GameSession.configure().start(configuration())
  for (const decision of [
    { tileId: 'city-11', position: '0,-1', rotation: 180, regionId: 'city' },
    { tileId: 'road-9', position: '1,0', rotation: 90, regionId: 'road' },
    { tileId: 'road-2', position: '-1,-1', rotation: 0, regionId: null },
  ]) match = play(match, decision)
  return match
}

function endgame() {
  const match = opening()
  const drawn = match.snapshot.deck[match.snapshot.deckIndex]
  const known = new Set([...match.snapshot.model.placements.map(({ tile }) => tile.id), drawn.id])
  const future = []
  for (const kind of ['road', 'monastery']) {
    const tile = createTileSet().find((tile) => tile.kind === kind && !known.has(tile.id))
    future.push(tile)
    known.add(tile.id)
  }
  const discarded = createTileSet().filter(({ id }) => !known.has(id))
  return new GameSession({ ...match.snapshot, deck: [drawn, ...future], deckIndex: 0, discarded }, new InProgressState(), match.configuration)
}

test('dificuldade é validada por assento, usa básico por padrão e sobrevive à nova partida', () => {
  const match = GameSession.configure().start(configuration())
  assert.deepEqual(match.snapshot.players.map(({ strategy }) => strategy.difficulty), [null, 'basic', 'strategic'])
  assert.ok(match.snapshot.players[2].strategy instanceof StrategicComputerStrategy)
  const fresh = match.newGame()
  assert.equal(fresh.configuration.players[2].difficulty, 'strategic')
  assert.equal(fresh.start().snapshot.players[2].strategy.difficulty, 'strategic')
  const invalid = configuration()
  invalid.players[2].difficulty = 'impossible'
  const rejected = GameSession.configure().start(invalid)
  assert.equal(rejected.snapshot.phase, 'configure')
  assert.match(rejected.snapshot.message, /Dificuldade/)
  const legacy = configuration(2)
  delete legacy.players[1].difficulty
  assert.equal(GameSession.configure().start(legacy).snapshot.players[1].strategy.difficulty, 'basic')
})

test('inventário desconhecido exclui cartelas públicas, descartes e brasões já vistos', () => {
  const match = endgame()
  const view = decisionView(match.snapshot)
  const pool = unknownTiles(view)
  assert.equal(pool.length, 2)
  assert.deepEqual(pool.map(({ kind, variant }) => [kind, variant]), [['road', 'plain'], ['monastery', 'plain']])
  const fresh = GameSession.configure().start(configuration())
  const initialView = decisionView(fresh.snapshot)
  assert.equal(unknownTiles(initialView).length, initialView.remainingTiles)
  assert.equal(unknownTiles(initialView).reduce((sum, tile) => sum + tile.shields, 0), 3 - (initialView.tile.variant === 'shield' ? 1 : 0))
})

test('a busca percorre adversários e a próxima vez da própria IA em cópias independentes', () => {
  const match = GameSession.configure().start(configuration())
  const view = decisionView(match.snapshot)
  const before = JSON.stringify(view)
  const candidates = basic.rankTurns(view, 2)
  const seats = []
  const decision = lookAhead(view, candidates, (future) => {
    seats.push(future.playerId)
    return basic.chooseTurn(future)
  }, decisionView)
  assert.ok(candidates.some((candidate) => candidate.decision === decision))
  assert.deepEqual(seats, Array.from({ length: 4 }, () => ['player-red', 'player-yellow', 'player-blue']).flat())
  assert.equal(JSON.stringify(view), before)
  assert.equal(match.snapshot.model.size, 1)
})

test('nível estratégico muda uma decisão imediata e melhora o resultado após as respostas futuras', () => {
  const match = endgame()
  const view = decisionView(match.snapshot)
  const immediate = basic.chooseTurn(view)
  const planned = strategic.chooseTurn(view)
  assert.notDeepEqual(planned, immediate)
  assert.equal(immediate.position, '0,-2')
  assert.equal(planned.position, '1,-1')
  const totals = [0, 0]
  for (const future of [match.snapshot.deck.slice(1), match.snapshot.deck.slice(1).reverse()]) {
    const base = new GameSession({ ...match.snapshot, deck: [match.snapshot.deck[0], ...future] }, new InProgressState(), match.configuration)
    for (const [index, decision] of [immediate, planned].entries()) {
      let result = play(base, decision)
      while (result.snapshot.phase !== 'finished') result = play(result, basic.chooseTurn(decisionView(result.snapshot)))
      totals[index] += result.snapshot.players.reduce((sum, player) => sum + player.score * (player.id === view.playerId ? 1 : -0.6), 0)
    }
  }
  assert.ok(totals[1] > totals[0], `${totals}`)
})

test('estratégico não consulta a ordem real, é reproduzível e continua legal no último turno', () => {
  const match = endgame()
  const view = decisionView(match.snapshot)
  const reversed = { ...match.snapshot, seed: 4294967295, deck: [match.snapshot.deck[0], ...match.snapshot.deck.slice(1).reverse()] }
  assert.deepEqual(decisionView(reversed), view)
  assert.deepEqual(strategic.chooseTurn(view), strategic.chooseTurn(decisionView(reversed)))
  const final = new GameSession({ ...match.snapshot, deck: [match.snapshot.deck[0]], discarded: [...match.snapshot.discarded, ...match.snapshot.deck.slice(1)] }, new InProgressState(), match.configuration)
  const decision = strategic.chooseTurn(decisionView(final.snapshot))
  assert.deepEqual(decision, basic.chooseTurn(decisionView(final.snapshot)))
  assert.equal(play(final, decision).snapshot.phase, 'finished')
})

test('uma partida completa com humano, IA básica e estratégica conserva regras e inventário', (context) => {
  let match = GameSession.configure().start(configuration())
  let turns = 0
  let strategicTurns = 0
  let slowest = 0
  while (match.snapshot.phase !== 'finished') {
    const before = match.snapshot
    const player = before.players[before.currentPlayerIndex]
    const observation = decisionView(before)
    assert.deepEqual(unknownTiles(observation).map(({ kind, variant }) => `${kind}:${variant}`).sort(),
      before.deck.slice(before.deckIndex + 1).map(({ kind, variant }) => `${kind}:${variant}`).sort())
    const started = performance.now()
    const decision = (player.strategy.automatic ? player.strategy : basic).chooseTurn(observation)
    if (player.strategy.difficulty === 'strategic') {
      strategicTurns++
      slowest = Math.max(slowest, performance.now() - started)
    }
    match = play(match, decision)
    const after = match.snapshot
    assert.ok(after.deckIndex > before.deckIndex)
    assert.equal(after.model.size, before.model.size + 1)
    if (after.phase !== 'finished') assert.equal(after.currentPlayerIndex, (before.currentPlayerIndex + 1) % 3)
    const inventory = [...after.model.placements.map(({ tile }) => tile), ...after.discarded, ...after.deck.slice(after.deckIndex)]
    assert.equal(inventory.length, 72)
    assert.equal(new Set(inventory.map(({ id }) => id)).size, 72)
    assert.equal(inventory.reduce((total, tile) => total + tile.shields, 0), 3)
    assert.equal(after.pendingPosition, null)
    for (const player of after.players) {
      assert.equal(player.followers.length, 7)
      assert.equal(player.meeples, player.followers.filter(({ status }) => status === 'reserve').length)
      assert.equal(player.score, after.scoring.filter(({ winners }) => winners.includes(player.id)).reduce((sum, record) => sum + record.points, 0))
    }
    assert.ok(++turns <= 71)
  }
  assert.ok(strategicTurns > 0)
  assert.ok(match.snapshot.players.every(({ meeples }) => meeples === 7))
  context.diagnostic(`Maior tempo de decisão estratégica: ${Math.round(slowest)} ms em ${strategicTurns} turnos`)
})

test('worker seleciona a dificuldade estratégica da solicitação e devolve a mesma decisão', async () => {
  const workerURL = new URL('../src/game/computer.worker.ts', import.meta.url)
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads')
    globalThis.self = { postMessage: (data) => parentPort.postMessage(data) }
    import(${JSON.stringify(workerURL.href)}).then(() => parentPort.on('message', (data) => self.onmessage({ data })))
  `, { eval: true })
  try {
    const view = { ...decisionView(endgame().snapshot), difficulty: 'strategic' }
    const response = new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject) })
    worker.postMessage(view)
    const decision = await response
    assert.deepEqual(decision, strategic.chooseTurn(view))
  } finally {
    await worker.terminate()
  }
})

test('estratégico lida com tabuleiro avançado de cinco jogadores sem ultrapassar as regras', (context) => {
  let match = GameSession.configure().start(configuration(5, 41))
  for (let turn = 0; turn < 50 && match.snapshot.phase !== 'finished'; turn++) {
    match = play(match, basic.chooseTurn(decisionView(match.snapshot)))
  }
  assert.equal(match.snapshot.phase, 'place')
  const before = match.snapshot
  const started = performance.now()
  const decision = strategic.chooseTurn(decisionView(before))
  context.diagnostic(`Decisão com cinco jogadores e ${before.model.size} cartelas: ${Math.round(performance.now() - started)} ms`)
  const after = play(match, decision).snapshot
  assert.equal(after.model.size, before.model.size + 1)
  assert.ok(after.deckIndex > before.deckIndex)
  assert.equal(before.model.size, 51)
})

test('estratégico não fabrica jogada quando nenhuma orientação tem encaixe', () => {
  const match = GameSession.configure().start(configuration())
  const view = decisionView(match.snapshot)
  const blocked = {
    ...view, tile: { id: 'blocked', kind: 'city-center', rotation: 0, variant: 'shield' },
    placements: [{ tile: { id: 'initial', kind: 'monastery', rotation: 0, variant: 'plain' }, x: 0, y: 0 }],
  }
  assert.equal(strategic.chooseTurn(blocked), null)
})

test('IA básica e estratégica disputam uma partida completa sem jogador humano', () => {
  const config = configuration(2, 17)
  config.players[0].control = 'computer'
  config.players[0].difficulty = 'strategic'
  config.startingPlayerIndex = 1
  let match = GameSession.configure().start(config)
  let turns = 0
  const played = new Set()
  while (match.snapshot.phase !== 'finished') {
    const before = match.snapshot
    const player = before.players[before.currentPlayerIndex]
    assert.ok(match.computerTurn)
    played.add(player.strategy.difficulty)
    const decision = player.strategy.chooseTurn(decisionView(before))
    match = match.playComputerTurn(decision)
    const after = match.snapshot
    assert.ok(after.deckIndex > before.deckIndex)
    assert.equal(after.model.size, before.model.size + 1)
    if (after.phase !== 'finished') assert.equal(after.currentPlayerIndex, 1 - before.currentPlayerIndex)
    assert.ok(++turns <= 71)
  }
  assert.deepEqual([...played].sort(), ['basic', 'strategic'])
  assert.equal(match.snapshot.deckIndex, 71)
  assert.equal(match.computerTurn, false)
  for (const player of match.snapshot.players) {
    assert.equal(player.meeples, 7)
    assert.equal(player.score, match.snapshot.scoring.filter(({ winners }) => winners.includes(player.id)).reduce((sum, record) => sum + record.points, 0))
  }
  const fresh = match.newGame()
  assert.deepEqual(fresh.configuration.players.map(({ difficulty }) => difficulty), ['strategic', 'basic'])
  assert.ok(fresh.start().computerTurn)
})

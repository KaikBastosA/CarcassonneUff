import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getFollowerChoices } from '../src/game/actions.ts'
import { GameBoard } from '../src/game/board.ts'
import { scheduleComputerTurn } from '../src/game/computer-turn.ts'
import { StructureMesh } from '../src/game/mesh.ts'
import { Position } from '../src/game/position.ts'
import { GameSession, InProgressState } from '../src/game/session.ts'
import { GameStore } from '../src/game/store.ts'
import { computerStrategies, firstLegalDecision, decisionView } from '../src/game/strategy.ts'
import { TileInstance } from '../src/game/tiles.ts'

const configuration = {
  players: [{ name: 'Um', color: 'blue' }, { name: 'Dois', color: 'red' }], startingPlayerIndex: 0, seed: 1,
}

function placeFirst(store) {
  const match = store.getSnapshot()
  const decision = firstLegalDecision(decisionView(match.snapshot))
  while (store.getSnapshot().snapshot.rotation !== decision.rotation) store.rotate(1)
  store.place(decision.position)
  return decision
}

function workerStub() {
  return { onmessage: null, onerror: null, view: null, terminated: false,
    terminate() { this.terminated = true }, postMessage(view) { this.view = structuredClone(view) },
  }
}

test('snapshot e adaptadores permanecem estáveis entre leituras e cada mesa é independente', () => {
  const store = new GameStore()
  const other = new GameStore()
  const initial = store.getSnapshot()
  const read = store.getSnapshot
  const subscribe = store.subscribe
  const start = store.start
  assert.equal(read(), initial)
  assert.equal(store.getSnapshot(), initial)
  start(configuration)
  assert.equal(read, store.getSnapshot)
  assert.equal(subscribe, store.subscribe)
  assert.notEqual(read(), initial)
  assert.equal(initial.snapshot.phase, 'configure')
  assert.equal(other.getSnapshot().snapshot.phase, 'configure')
  assert.ok(Object.isFrozen(read().snapshot))
  assert.throws(() => { read().snapshot.round = 99 })
})

test('observadores recebem o novo snapshot já publicado e remoção é idempotente', () => {
  const store = new GameStore()
  const map = []
  const scores = []
  const mapObserver = { update() { map.push(store.getSnapshot()) } }
  const scoreObserver = { update() { scores.push(store.getSnapshot()) } }
  const removeMap = store.add(mapObserver)
  store.add(mapObserver)
  store.add(scoreObserver)
  store.start(configuration)
  assert.equal(map.length, 1)
  assert.equal(scores.length, 1)
  assert.equal(map[0], store.getSnapshot())
  assert.equal(scores[0], map[0])
  removeMap()
  removeMap()
  store.rotate(1)
  assert.equal(map.length, 1)
  assert.equal(scores.length, 2)
  store.remove(scoreObserver)
  store.newGame()
  assert.equal(scores.length, 2)
  assert.equal(store.getSnapshot().snapshot.phase, 'configure')
})

test('comandos bloqueados não notificam e erros visíveis de validação notificam', () => {
  const store = new GameStore()
  const updates = []
  store.subscribe(() => updates.push(store.getSnapshot()))
  for (const command of [() => store.rotate(1), () => store.place('0,0'), () => store.selectFollower('city'), () => store.confirm(), () => store.undoPlacement()]) command()
  assert.equal(updates.length, 0)
  store.start({ ...configuration, players: [] })
  assert.equal(updates.length, 1)
  assert.ok(updates[0].snapshot.message)
  store.start(configuration)
  assert.equal(updates.length, 2)
  const before = store.getSnapshot()
  store.start(configuration)
  store.confirm()
  store.undoPlacement()
  assert.equal(store.getSnapshot(), before)
  assert.equal(updates.length, 2)
  store.place('0,0')
  assert.equal(updates.length, 3)
  assert.ok(store.getSnapshot().snapshot.message)
  assert.equal(store.getSnapshot().snapshot.model, before.snapshot.model)
})

test('inscrições e remoções durante a notificação só afetam observadores ainda ativos', () => {
  const store = new GameStore()
  const calls = []
  const late = { update() { calls.push('late') } }
  const removed = { update() { calls.push('removed') } }
  const first = { update() { calls.push('first'); store.add(late); store.remove(removed); store.remove(first) } }
  store.add(first)
  store.add(removed)
  store.start(configuration)
  assert.deepEqual(calls, ['first'])
  store.rotate(1)
  assert.deepEqual(calls, ['first', 'late'])
})

test('falha de um observador não impede os demais nem desfaz o snapshot publicado', () => {
  const store = new GameStore()
  const error = new Error('observador com falha')
  const seen = []
  const broken = { update() { throw error } }
  store.add(broken)
  store.subscribe(() => seen.push(store.getSnapshot()))
  assert.throws(() => store.start(configuration), (failure) => failure instanceof AggregateError && failure.errors[0] === error)
  assert.equal(seen.length, 1)
  assert.equal(seen[0], store.getSnapshot())
  assert.equal(seen[0].snapshot.phase, 'place')
  store.remove(broken)
  store.rotate(1)
  assert.equal(seen.length, 2)
})

test('inscrever, limpar e reinscrever não acumula notificações como na remontagem do StrictMode', () => {
  const store = new GameStore()
  let calls = 0
  const listener = () => { calls++ }
  const cleanup = store.subscribe(listener)
  cleanup()
  const activeCleanup = store.subscribe(listener)
  store.start(configuration)
  assert.equal(calls, 1)
  const initialRotation = store.getSnapshot().snapshot.rotation
  activeCleanup()
  activeCleanup()
  store.rotate(1)
  assert.equal(calls, 1)
  const newCleanup = store.subscribe(listener)
  assert.equal(store.getSnapshot().snapshot.rotation, (initialRotation + 90) % 360)
  store.rotate(1)
  assert.equal(calls, 2)
  newCleanup()
})

test('seguidores e desfazer são publicados e confirmar avança a vez uma única vez', () => {
  const store = new GameStore()
  store.start(configuration)
  const updates = []
  store.subscribe(() => updates.push(store.getSnapshot()))
  const before = store.getSnapshot()
  const decision = placeFirst(store)
  assert.equal(store.getSnapshot().snapshot.phase, 'meeple')
  const choice = getFollowerChoices(store.getSnapshot().snapshot).find(({ available }) => available)
  assert.ok(choice)
  store.selectFollower(choice.id)
  assert.equal(updates.at(-1).snapshot.players[0].meeples, 6)
  store.selectFollower(null)
  assert.equal(updates.at(-1).snapshot.players[0].meeples, 7)
  store.selectFollower(choice.id)
  store.undoPlacement()
  assert.equal(updates.at(-1).snapshot.model, before.snapshot.model)
  assert.equal(updates.at(-1).snapshot.players[0].meeples, 7)
  store.place(decision.position)
  const count = updates.length
  store.confirm()
  assert.equal(updates.length, count + 1)
  assert.equal(updates.at(-1).snapshot.currentPlayerIndex, 1)
  assert.equal(updates.at(-1).snapshot.pendingPosition, null)
  const settled = store.getSnapshot()
  store.confirm()
  assert.equal(store.getSnapshot(), settled)
  assert.equal(updates.length, count + 1)
})

test('pontuação final e devolução de seguidores chegam juntas aos observadores', () => {
  const base = GameSession.configure().start(configuration)
  const model = [['a', 90, 0, 0], ['b', 180, 1, 0], ['c', 270, 1, 1]].reduce((board, [id, rotation, x, y]) =>
    board.place(new TileInstance(id, 'city-corner', rotation), new Position(x, y)), new GameBoard())
  const board = Object.fromEntries(model.placements.map(({ tile, position }) => [position.key, { kind: tile.kind, rotation: tile.rotation }]))
  const match = new GameSession({ ...base.snapshot, model, board, mesh: new StructureMesh(model), rotation: 0, deck: [new TileInstance('last', 'city-corner', 0, 'shield')] }, new InProgressState(), base.configuration)
  const store = new GameStore(match)
  store.place('0,1')
  store.selectFollower('city')
  const updates = []
  store.subscribe(() => updates.push(store.getSnapshot().snapshot))
  store.confirm()
  assert.equal(updates.length, 1)
  assert.equal(updates[0].phase, 'finished')
  assert.equal(updates[0].players[0].score, 10)
  assert.equal(updates[0].players[0].meeples, 7)
  assert.equal(updates[0].board['0,1'].meeple, undefined)
  assert.equal(updates[0].board['0,1'].variant, 'shield')
})

test('decisões automáticas são publicadas uma vez e respostas após reinício são ignoradas', () => {
  const config = { ...configuration, players: configuration.players.map((player) => ({ ...player, control: 'computer' })) }
  const store = new GameStore()
  store.start(config)
  const updates = []
  store.subscribe(() => updates.push(store.getSnapshot()))
  const expected = store.getSnapshot()
  const decision = computerStrategies.basic.chooseTurn(decisionView(expected.snapshot))
  store.rotate(1)
  store.place(decision.position)
  store.confirm()
  assert.equal(updates.length, 0)
  store.playComputerTurn(expected, decision)
  assert.equal(updates.length, 1)
  assert.equal(updates[0].snapshot.phase, 'place')
  assert.equal(updates[0].snapshot.model.size, 2)
  assert.equal(updates[0].snapshot.currentPlayerIndex, 1)
  store.playComputerTurn(expected, decision)
  assert.equal(updates.length, 1)
  store.newGame()
  assert.equal(updates.length, 2)
  store.start(config)
  const restarted = store.getSnapshot()
  assert.equal(restarted.snapshot.deck[0].id, expected.snapshot.deck[0].id)
  const count = updates.length
  store.playComputerTurn(expected, decision)
  assert.equal(store.getSnapshot(), restarted)
  assert.equal(updates.length, count)
})

test('agendamento pode ser cancelado e remontado sobre o store sem executar dois turnos', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const config = { ...configuration, players: configuration.players.map((player) => ({ ...player, control: 'computer' })) }
  const store = new GameStore()
  store.start(config)
  let notifications = 0
  const unsubscribe = store.subscribe(() => { notifications++ })
  const expected = store.getSnapshot()
  const first = workerStub()
  const cleanup = scheduleComputerTurn(expected, (decision) => store.playComputerTurn(expected, decision), () => first)
  context.mock.timers.tick(450)
  cleanup()
  const second = workerStub()
  const stop = scheduleComputerTurn(expected, (decision) => store.playComputerTurn(expected, decision), () => second)
  context.mock.timers.tick(450)
  const decision = computerStrategies.basic.chooseTurn(second.view)
  first.onmessage({ data: decision })
  assert.equal(notifications, 0)
  second.onmessage({ data: decision })
  second.onmessage({ data: decision })
  assert.equal(notifications, 1)
  assert.equal(store.getSnapshot().snapshot.model.size, 2)
  stop()
  unsubscribe()
  assert.ok(first.terminated && second.terminated)
})

test('store observável conduz IA vs IA até o resultado sem publicar fases intermediárias', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  const config = { ...configuration, players: configuration.players.map((player) => ({ ...player, control: 'computer' })) }
  const store = new GameStore()
  const updates = []
  store.subscribe(() => updates.push(store.getSnapshot().snapshot))
  store.start(config)
  let turns = 0
  while (store.getSnapshot().snapshot.phase !== 'finished') {
    const expected = store.getSnapshot()
    const worker = workerStub()
    const cleanup = scheduleComputerTurn(expected, (decision) => store.playComputerTurn(expected, decision), () => worker)
    context.mock.timers.tick(450)
    worker.onmessage({ data: computerStrategies.basic.chooseTurn(worker.view) })
    cleanup()
    const current = store.getSnapshot().snapshot
    assert.equal(current.model.size, expected.snapshot.model.size + 1)
    assert.ok(current.deckIndex > expected.snapshot.deckIndex)
    assert.equal(current.pendingPosition, null)
    assert.ok(++turns <= 71)
  }
  assert.equal(updates.length, turns + 1)
  assert.ok(updates.every(({ phase }) => phase !== 'meeple'))
  const final = updates.at(-1)
  assert.equal(final.deckIndex, 71)
  assert.equal(final.model.size + final.discarded.length, 72)
  assert.ok(final.players.every(({ meeples }) => meeples === 7))
  for (const player of final.players) assert.equal(player.score, final.scoring.filter(({ winners }) => winners.includes(player.id)).reduce((sum, record) => sum + record.points, 0))
  const count = updates.length
  scheduleComputerTurn(store.getSnapshot(), () => assert.fail('turno após encerramento'), () => assert.fail('worker após encerramento'))
  context.mock.timers.tick(10000)
  assert.equal(updates.length, count)
})

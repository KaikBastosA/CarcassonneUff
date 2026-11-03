import assert from 'node:assert/strict'
import { test } from 'node:test'
import { comprarCartela, descartarCartela } from '../src/game/deck.ts'
import { StructureMesh } from '../src/game/mesh.ts'
import { GameObserver } from '../src/game/observer.ts'
import { Position } from '../src/game/position.ts'
import { GameSession, FinishedState } from '../src/game/session.ts'
import { GameStore } from '../src/game/store.ts'
import { TileInstance } from '../src/game/tiles.ts'

const config = { players: [{ name: 'Um', color: 'blue' }, { name: 'Dois', color: 'red' }], startingPlayerIndex: 0, seed: 1 }

function closingCity() {
  const match = GameSession.configure(config).start()
  const snapshot = { ...match.snapshot, deck: [new TileInstance('last', 'city', 180)], rotation: 180 }
  return match.withSnapshot(snapshot)
}

test('comandos das sequências preservam seleção imutável e pontuam ao confirmar', () => {
  const before = closingCity()
  const pending = before.posicionarCartela(new Position(0, -1))
  assert.equal(pending.phase, 'meeple')
  assert.equal(pending.snapshot.players[0].score, 0)
  const final = pending.selecionarSeguidor('city').confirmarTurno()
  assert.ok(final.state instanceof FinishedState)
  assert.equal(final.snapshot.players[0].score, 4)
  assert.equal(final.snapshot.players[0].meeples, 7)
  assert.equal(before.snapshot.model.size, 1)
  assert.equal(pending.snapshot.players[0].score, 0)
  assert.deepEqual(final.aplicarCriterioDesempate(), final.snapshot.winners)
})

test('entrada de seguidor inválida permite repetir sem confirmar, pontuar ou bloquear a interface', () => {
  const pending = closingCity().place(new Position(0, -1))
  const invalid = pending.selecionarSeguidor('missing')
  assert.equal(invalid.phase, 'meeple')
  assert.equal(invalid.snapshot.deckIndex, 0)
  assert.equal(invalid.snapshot.players[0].score, 0)
  assert.ok(invalid.snapshot.message)
  const final = invalid.selecionarSeguidor(null).confirmarTurno()
  assert.equal(final.phase, 'finished')
  assert.equal(final.snapshot.players[0].score, 0)
})

test('compra preserva a peça válida e encerramento só ocorre depois de esgotar a pilha', () => {
  const match = closingCity()
  const tile = comprarCartela(match.snapshot)
  assert.equal(tile.id, 'last')
  assert.equal(descartarCartela(match.snapshot), match.snapshot)
  assert.equal(match.encerrarPartida(), match)
  const final = match.place(new Position(0, -1)).selecionarSeguidor('city').confirmarTurno()
  assert.equal(final.encerrarPartida(), final)
  assert.equal(final.executarTurno(), final)
})

test('adaptador Observer lê o novo GameState publicado e remove inscrição sem vazamento', () => {
  const store = new GameStore()
  const observer = new GameObserver(store)
  const updates = []
  const unsubscribe = observer.subscribe(() => updates.push(observer.getSnapshot()))
  const initial = observer.getSnapshot()
  store.start(config)
  assert.equal(updates.length, 1)
  assert.equal(updates[0], store.getSnapshot())
  assert.notEqual(initial, updates[0])
  unsubscribe()
  unsubscribe()
  store.rotate(1)
  assert.equal(updates.length, 1)
  const stop = observer.subscribe(() => updates.push(observer.getSnapshot()))
  store.newGame()
  assert.equal(updates.length, 2)
  assert.equal(store.getSession().phase, 'configure')
  stop()
})

test('o desempate considera a reserva anterior à devolução dos meeples da apuração final', () => {
  const base = GameSession.configure(config).start()
  const players = base.snapshot.players.map((player, index) => {
    if (index === 1) return { ...player, score: 1 }
    const followers = [...player.followers]
    followers[0] = followers[0].allocate({ tileId: base.snapshot.model.placements[0].tile.id, regionId: 'city', role: 'knight' })
    return { ...player, followers, meeples: 6 }
  })
  const snapshot = { ...base.snapshot, players, deckIndex: base.snapshot.deck.length,
    mesh: new StructureMesh(base.snapshot.model, players.flatMap(({ followers }) => followers), players) }
  const final = base.withSnapshot(snapshot).encerrarPartida()
  assert.deepEqual(final.snapshot.players.map(({ score }) => score), [1, 1])
  assert.deepEqual(final.snapshot.players.map(({ meeples }) => meeples), [7, 7])
  assert.deepEqual(final.snapshot.tieBreakReserves, { 'player-blue': 6, 'player-red': 7 })
  assert.deepEqual(final.snapshot.winners.map(({ id }) => id), ['player-red'])
  assert.match(final.snapshot.message, /Desempate pela reserva antes/)
  assert.equal(final.snapshot.winners[0], final.snapshot.players[1])
  assert.ok(Object.isFrozen(final.snapshot.tieBreakReserves))
})

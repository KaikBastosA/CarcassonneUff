import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialGame, withTile } from './helpers/game.mjs'
import { getFollowerChoices, placeGameTile, selectGameFollower, undoGamePlacement } from '../src/game/actions.ts'

function pending(kind = 'road', rotation = 90, position = '1,0') {
  return placeGameTile(withTile(initialGame, kind, rotation), position)
}

test('a reserva real começa com sete seguidores e substitui os dados fictícios do placar', () => {
  for (const player of initialGame.players) {
    assert.equal(player.meeples, 7)
    assert.equal(player.followers.filter((follower) => follower.status === 'reserve').length, 7)
    assert.equal(player.score, 0)
  }
  assert.equal(initialGame.round, 1)
  assert.deepEqual(initialGame.activity, [])
})

test('selecionar, trocar de região e remover usa apenas um seguidor da reserva', () => {
  const state = pending()
  const selected = selectGameFollower(state, 'road')
  assert.equal(selected.players[0].meeples, 6)
  assert.equal(selected.players[0].followers[0].role, 'thief')
  assert.equal(selected.board['1,0'].meepleRegion, 'road')
  assert.equal(selected.mesh.structureAt('tile-0', 'road').followers.length, 1)
  assert.equal(state.players[0].meeples, 7)
  const moved = selectGameFollower(selected, 'field-east')
  assert.equal(moved.players[0].meeples, 6)
  assert.equal(moved.players[0].followers[0].role, 'farmer')
  assert.equal(moved.mesh.structureAt('tile-0', 'road').followers.length, 0)
  assert.equal(moved.mesh.structureAt('tile-0', 'field-east').followers.length, 1)
  assert.equal(moved.board['1,0'].meepleRegion, 'field-east')
  const removed = selectGameFollower(moved, 'field-east')
  assert.equal(removed.players[0].meeples, 7)
  assert.equal(removed.board['1,0'].meeple, undefined)
  assert.equal(removed.players[0].followers[0].role, 'none')
})

test('escolhas válidas refletem a seleção atual e preservam a seleção diante de erro', () => {
  const selected = selectGameFollower(pending(), 'road')
  const choices = getFollowerChoices(selected)
  assert.equal(choices.length, 3)
  assert.ok(choices.find((choice) => choice.id === 'road').selected)
  assert.ok(choices.every((choice) => choice.available))
  const invalid = selectGameFollower(selected, 'missing')
  assert.equal(invalid.mesh, selected.mesh)
  assert.equal(invalid.board, selected.board)
  assert.equal(invalid.players, selected.players)
  assert.ok(invalid.message)
})

test('seguidores só são selecionados na peça recém-jogada durante a etapa opcional', () => {
  assert.equal(selectGameFollower(initialGame, 'city'), initialGame)
  assert.deepEqual(getFollowerChoices(initialGame), [])
  const state = pending()
  const forged = { ...state, pendingPosition: '0,0' }
  assert.equal(selectGameFollower(forged, 'city'), forged)
  assert.deepEqual(getFollowerChoices(forged), [])
  const confirmed = { ...selectGameFollower(state, 'road'), phase: 'place', pendingPosition: null, previousBoard: null }
  assert.equal(selectGameFollower(confirmed, null), confirmed)
  assert.equal(confirmed.players[0].meeples, 6)
})

test('uma estrutura ocupada à distância bloqueia seguidores de qualquer jogador', () => {
  const first = selectGameFollower(pending(), 'road')
  const next = placeGameTile(withTile({
    ...first, phase: 'place', pendingPosition: null, previousBoard: null,
    currentPlayerIndex: 1, deckIndex: 1,
  }, 'road', 90), '2,0')
  assert.equal(next.phase, 'meeple')
  const option = getFollowerChoices(next).find((choice) => choice.id === 'road')
  assert.equal(option.available, false)
  const denied = selectGameFollower(next, 'road')
  assert.equal(denied.players, next.players)
  assert.ok(denied.message.includes('conectado'))
  const samePlayer = selectGameFollower({ ...next, currentPlayerIndex: 0 }, 'road')
  assert.ok(samePlayer.message.includes('conectado'))
  assert.equal(selectGameFollower(next, 'field-east').players[1].meeples, 6)
})

test('cidades distintas na mesma cartela continuam sendo escolhas independentes', () => {
  const state = pending('city-sides', 0, '0,-1')
  assert.equal(state.phase, 'meeple')
  const choices = getFollowerChoices(state)
  assert.equal(choices.filter((choice) => choice.terrain === 'city').length, 2)
  const selected = selectGameFollower(state, 'city-north')
  assert.equal(selected.players[0].followers[0].role, 'knight')
  assert.equal(selected.mesh.structureAt('tile-0', 'city-north').followers.length, 1)
  assert.equal(selected.mesh.structureAt('tile-0', 'city-south').followers.length, 0)
})

test('mosteiro e campo recebem monge e fazendeiro, respectivamente', () => {
  const state = pending('monastery', 0, '0,1')
  assert.equal(selectGameFollower(state, 'monastery').players[0].followers[0].role, 'monk')
  assert.equal(selectGameFollower(state, 'field').players[0].followers[0].role, 'farmer')
})

test('sem reserva nenhuma região pode receber outro seguidor', () => {
  const state = pending()
  const withoutReserve = { ...state, players: state.players.map((player, index) => index === 0 ? { ...player, followers: [], meeples: 0 } : player) }
  assert.ok(getFollowerChoices(withoutReserve).every((choice) => !choice.available))
  const result = selectGameFollower(withoutReserve, 'road')
  assert.equal(result.mesh, withoutReserve.mesh)
  assert.equal(result.players, withoutReserve.players)
  assert.ok(result.message.includes('reserva'))
})

test('desfazer devolve o seguidor e restaura a malha sem alocação órfã', () => {
  const selected = selectGameFollower(pending(), 'field-west')
  const undone = undoGamePlacement(selected)
  assert.equal(undone.model, initialGame.model)
  assert.equal(undone.players[0].meeples, 7)
  assert.ok(undone.players[0].followers.every((follower) => follower.status === 'reserve'))
  assert.ok(undone.mesh.structures.every((structure) => structure.followers.length === 0))
  assert.equal(undone.mesh.structureAt('tile-0', 'field-west'), undefined)
  assert.equal(selected.players[0].meeples, 6)
  assert.equal(selected.mesh.structureAt('tile-0', 'field-west').followers.length, 1)
})

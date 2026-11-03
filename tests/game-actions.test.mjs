import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderBoard } from '../src/game/board-state.ts'
import { initialGame, withTile } from './helpers/game.mjs'
import { placeGameTile, selectGameFollower, undoGamePlacement } from '../src/game/actions.ts'
import { Position } from '../src/game/position.ts'

function boardView(state) { return renderBoard(state.board, state.players) }

test('a nova interface começa com o mesmo tabuleiro válido do domínio', () => {
  assert.equal(initialGame.model.size, 1)
  assert.deepEqual(Object.keys(boardView(initialGame)), ['0,0'])
  assert.equal(initialGame.model.tileAt(new Position(0, 0)).kind, boardView(initialGame)['0,0'].kind)
})

test('a ação da interface recusa encaixes inválidos sem alterar o mapa ou a etapa', () => {
  const state = withTile(initialGame, 'road', 0)
  for (const position of ['1,0', '1,1', '20,20', '0,0', 'invalid', '1,2,3', '9007199254740992,0']) {
    const result = placeGameTile(state, position)
    assert.equal(result.board, state.board)
    assert.equal(result.model, state.model)
    assert.equal(result.phase, 'place')
    assert.equal(result.pendingPosition, null)
    assert.ok(result.message, position)
  }
})

test('colocar e desfazer mantém o mapa visual sincronizado com o modelo', () => {
  const state = withTile(initialGame, 'road', 90)
  const placed = placeGameTile(state, '1,0')
  assert.equal(placed.phase, 'meeple')
  assert.equal(placed.model.size, 2)
  assert.equal(placed.previousBoard, state.board)
  assert.equal(placed.pendingPosition.key, '1,0')
  assert.equal(placed.model.tileAt(new Position(1, 0)).rotation, 90)
  assert.deepEqual(boardView(placed)['1,0'], { kind: 'road', rotation: 90, variant: 'plain', meeple: undefined, meepleRegion: undefined })
  assert.equal(placeGameTile(placed, '2,0'), placed)

  const undone = undoGamePlacement(placed)
  assert.deepEqual(undone.model.placements, state.model.placements)
  assert.deepEqual(undone.board, state.board)
  assert.equal(undone.phase, 'place')
  assert.equal(undone.previousBoard, null)
  assert.equal(undone.pendingPosition, null)
  assert.equal(undoGamePlacement(state), state)
})

test('desfazer uma colocação com meeple devolve a reserva sem alterar o histórico', () => {
  const state = withTile(initialGame, 'road', 90)
  const placed = placeGameTile(state, '1,0')
  const withMeeple = selectGameFollower(placed, 'road')
  const undone = undoGamePlacement(withMeeple)
  assert.deepEqual(undone.players, state.players)
  assert.deepEqual(undone.board, state.board)
  assert.deepEqual(undone.model.placements, state.model.placements)
  assert.ok(boardView(withMeeple)['1,0'].meeple)
  assert.equal(withMeeple.model.size, 2)
})

test('os avisos de espaços sem encaixe são preservados pela nova ação da interface', () => {
  let state = initialGame
  const placements = [
    [0, -1, 'city-center', 0], [1, -1, 'city-center', 0],
    [2, -1, 'city-corner', 180], [2, 0, 'city', 0],
  ]
  for (const [x, y, currentKind, rotation] of placements) {
    const current = withTile({ ...state, phase: 'place' }, currentKind, rotation)
    state = placeGameTile(current, `${x},${y}`)
    assert.equal(state.phase, 'meeple')
    if (x === 2 && y === 0) {
      assert.ok(state.message.includes('(1,0)'))
      assert.ok(state.model.getUnfillablePositions().some((position) => position.key === '1,0'))
    }
    state = { ...state, deckIndex: state.deckIndex + 1 }
  }
})

test('snapshots do tabuleiro guardam cartelas, seguidores e limites sem misturar o mapa de renderização', () => {
  const placed = selectGameFollower(placeGameTile(withTile(initialGame, 'city', 180), new Position(0, -1)), 'city')
  assert.ok(placed.pendingPosition instanceof Position)
  assert.equal(placed.previousBoard, initialGame.board)
  assert.deepEqual(placed.board.tiles, placed.model.placements.map(({ tile }) => tile))
  assert.deepEqual(placed.board.followers, placed.players.flatMap(({ followers }) => followers))
  assert.deepEqual(placed.board.bounds, { minX: 0, minY: -1, maxX: 0, maxY: 0 })
  assert.equal(placed.board.followers.filter(({ allocation }) => allocation).length, 1)
  assert.ok(Object.isFrozen(placed.board))
  assert.ok(Object.isFrozen(placed.board.tiles))
  assert.ok(Object.isFrozen(placed.board.followers))
  assert.ok(Object.isFrozen(placed.board.bounds))
  assert.equal(placed.board['0,-1'], undefined)
  assert.equal(boardView(placed)['0,-1'].meeple, placed.players[0].color)
  const undone = undoGamePlacement(placed)
  assert.equal(undone.board, placed.previousBoard)
  assert.equal(undone.board.followers.filter(({ allocation }) => allocation).length, 0)
})

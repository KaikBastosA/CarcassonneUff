import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GameBoard } from '../src/game/board.ts'
import { boardSnapshot, renderBoard } from '../src/game/board-state.ts'
import { createGameTiles } from '../src/game/deck.ts'
import { StructureMesh } from '../src/game/mesh.ts'
import { Position } from '../src/game/position.ts'
import { GameSession, InProgressState } from '../src/game/session.ts'
import { createTileSet, rotations, sides, tileCatalog, TileInstance } from '../src/game/tiles.ts'

const configuration = { players: [{ name: 'Um', color: 'blue' }, { name: 'Dois', color: 'red' }], startingPlayerIndex: 0, seed: 1 }

function cityLoop(last = true) {
  const placements = [[0, 0, 90], [1, 0, 180], [1, 1, 270], [0, 1, 0]]
  return placements.slice(0, last ? 4 : 3).reduce((board, [x, y, rotation], index) => board.place(
    new TileInstance(`city-${index}`, 'city-corner', rotation, index === 3 ? 'shield' : 'plain'), new Position(x, y),
  ), new GameBoard())
}

test('o catálogo distribui três brasões entre os mesmos 72 exemplares', () => {
  const tiles = createTileSet()
  assert.equal(tiles.length, 72)
  assert.equal(new Set(tiles.map(({ id }) => id)).size, 72)
  assert.deepEqual(tiles.filter(({ variant }) => variant === 'shield').map(({ id }) => id).sort(), [
    'city-center-1', 'city-corner-7', 'city-corner-8',
  ])
  assert.equal(tiles.filter((tile) => tile.kind === 'city-corner' && tile.variant === 'plain').length, 6)
  assert.equal(tiles.reduce((total, tile) => total + tile.shields, 0), 3)
  for (const definition of Object.values(tileCatalog)) {
    const shield = definition.shield
    if (!shield) { assert.equal(definition.shieldVariant, undefined); continue }
    assert.equal(definition.shieldVariant, 'shield')
    assert.ok(Number.isInteger(shield.quantity) && shield.quantity > 0 && shield.quantity <= definition.quantity)
    assert.ok(definition.regions.some((region) => region.id === shield.regionId && region.terrain === 'city'))
    assert.ok(Object.isFrozen(shield) && Object.isFrozen(shield.anchor))
  }
  const game = createGameTiles(1)
  assert.equal(game.initial.variant, 'plain')
  assert.equal(game.initial.shields, 0)
  assert.equal(game.deck.reduce((total, tile) => total + tile.shields, 0), 3)
})

test('brasões pertencem somente à cidade indicada e acompanham todas as rotações', () => {
  for (const kind of ['city-corner', 'city-center']) for (const rotation of rotations) {
    const tile = new TileInstance('shield', kind, rotation, 'shield')
    const definition = tileCatalog[kind].shield
    assert.equal(tile.shields, 1)
    assert.equal(tile.regions.filter(({ shields }) => shields > 0).length, 1)
    assert.equal(tile.regions.find(({ shields }) => shields > 0).id, definition.regionId)
    assert.ok(tile.regions.every((region) => region.terrain === 'city' || region.shields === 0))
    let { x, y } = definition.anchor
    for (let turn = 0; turn < rotation / 90; turn++) [x, y] = [1 - y, x]
    assert.deepEqual(tile.markers, [{ x, y }])
    const rotated = tile.rotate().rotate().rotate().rotate()
    assert.equal(rotated.variant, 'shield')
    assert.equal(rotated.shields, 1)
    assert.equal(rotated.id, tile.id)
    assert.deepEqual(rotated.markers, tile.markers)
  }
  assert.deepEqual(new TileInstance('plain', 'city-corner').markers, [])
  assert.throws(() => new TileInstance('invalid', 'road', 0, 'shield'), /não possui/)
})

test('brasões não alteram encaixes e a geração de jogadas preserva a variante', () => {
  const board = new GameBoard().place(new TileInstance('start', 'city-road'), new Position(0, 0))
  const plain = new TileInstance('candidate', 'city-corner')
  const shield = new TileInstance('candidate', 'city-corner', 0, 'shield')
  const moves = board.getValidMoves(shield)
  assert.ok(moves.length > 0)
  assert.ok(moves.every(({ tile }) => tile.variant === 'shield' && tile.shields === 1))
  assert.deepEqual(moves.map(({ position, tile }) => [position.key, tile.rotation]),
    board.getValidMoves(plain).map(({ position, tile }) => [position.key, tile.rotation]))
  for (const side of sides) assert.equal(plain.terrainAt(side), shield.terrainAt(side))
})

test('a cidade concluída recebe os dois pontos adicionais do brasão real da cartela', () => {
  const mesh = new StructureMesh(cityLoop())
  const city = mesh.structureAt('city-0', 'city')
  assert.equal(city.tileIds.length, 4)
  assert.equal(city.isComplete, true)
  assert.equal(city.shields, 1)
  assert.equal(city.score(false), 10)
  const incomplete = new StructureMesh(new GameBoard().place(new TileInstance('shield', 'city-corner', 0, 'shield'), new Position(0, 0)))
    .structureAt('shield', 'city')
  assert.equal(incomplete.score(false), 0)
  assert.equal(incomplete.score(true), 2)
})

test('brasões de duas cartelas da mesma cidade se acumulam sem alterar a contagem de cartelas', () => {
  let board = new GameBoard()
  for (const [index, x, y, rotation] of [[0, 0, 0, 90], [1, 1, 0, 180], [2, 1, 1, 270], [3, 0, 1, 0]]) {
    board = board.place(new TileInstance(`city-${index}`, 'city-corner', rotation, index < 2 ? 'shield' : 'plain'), new Position(x, y))
  }
  const city = new StructureMesh(board).structureAt('city-0', 'city')
  assert.equal(city.tileIds.length, 4)
  assert.equal(city.shields, 2)
  assert.equal(city.score(false), 12)
})

test('colocação, seguidores, desfazer e pontuação preservam a variante exibida', () => {
  const base = GameSession.configure().start(configuration)
  const model = cityLoop(false)
  const board = boardSnapshot(model)
  const tile = new TileInstance('shield', 'city-corner', 0, 'shield')
  const match = new GameSession({ ...base.snapshot, model, board, mesh: new StructureMesh(model), deck: [tile], deckIndex: 0, rotation: 0 },
    new InProgressState(), base.configuration)
  const placed = match.place(new Position(0, 1))
  assert.equal(renderBoard(placed.snapshot.board, placed.snapshot.players)['0,1'].variant, 'shield')
  const selected = placed.selectFollower('city')
  assert.equal(renderBoard(selected.snapshot.board, selected.snapshot.players)['0,1'].variant, 'shield')
  const undone = selected.undo()
  assert.equal(undone.snapshot.deck[0].variant, 'shield')
  assert.deepEqual(undone.snapshot.model.placements, model.placements)
  const final = selected.confirm()
  assert.equal(final.phase, 'finished')
  assert.equal(final.snapshot.players[0].score, 10)
  assert.equal(final.snapshot.players[0].meeples, 7)
  assert.equal(renderBoard(final.snapshot.board, final.snapshot.players)['0,1'].variant, 'shield')
  assert.equal(renderBoard(final.snapshot.board, final.snapshot.players)['0,1'].meeple, undefined)
})

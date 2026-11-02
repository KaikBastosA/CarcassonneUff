import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GameBoard } from '../src/game/board.ts'
import { Position } from '../src/game/position.ts'
import { rotations, tileKinds, TileInstance } from '../src/game/tiles.ts'

function place(board, x, y, kind = 'monastery', rotation = 0) {
  return board.place(new TileInstance(`${x},${y}`, kind, rotation), new Position(x, y))
}

function ring() {
  let board = place(new GameBoard(), 0, 0)
  for (const [x, y, kind, rotation] of [
    [1, 0, 'city', 180], [2, 0, 'monastery', 0],
    [2, 1, 'city', 270], [2, 2, 'monastery', 0],
    [1, 2, 'city', 0], [0, 2, 'monastery', 0], [0, 1, 'city', 90],
  ]) board = place(board, x, y, kind, rotation)
  return board
}

test('posições usam coordenadas inteiras e vizinhos apenas ortogonais', () => {
  const position = new Position(-2, 3)
  assert.equal(position.key, '-2,3')
  assert.deepEqual(position.adjacent().map((neighbor) => neighbor.key), ['-2,2', '-1,3', '-2,4', '-3,3'])
  assert.ok(position.equals(new Position(-2, 3)))
  assert.ok(!position.equals(new Position(3, -2)))
  assert.ok(Object.isFrozen(position))
  for (const value of [0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => new Position(value, 0))
    assert.throws(() => new Position(0, value))
  }
})

test('o tabuleiro vazio ancora a primeira cartela na origem', () => {
  const board = new GameBoard()
  const tile = new TileInstance('start', 'city-road')
  assert.equal(board.size, 0)
  assert.equal(board.tileAt(new Position(0, 0)), undefined)
  assert.deepEqual(board.getValidPositions(tile).map((position) => position.key), ['0,0'])
  assert.equal(board.getValidMoves(tile).length, 4)
  assert.deepEqual(board.validatePlacement(tile, new Position(1, 0)), { valid: false, reason: 'starting-position' })
  assert.equal(board.place(tile, new Position(0, 0)).size, 1)
})

test('posições ocupadas, exemplares repetidos e peças desconectadas são recusados', () => {
  const tile = new TileInstance('start', 'road')
  const board = new GameBoard().place(tile, new Position(0, 0))
  const next = new TileInstance('next', 'road')
  for (const [candidate, position, reason] of [
    [next, new Position(0, 0), 'occupied'],
    [tile, new Position(0, 1), 'duplicate-tile'],
    [next, new Position(1, 1), 'disconnected'],
    [next, new Position(10, 0), 'disconnected'],
  ]) {
    assert.deepEqual(board.validatePlacement(candidate, position), { valid: false, reason })
    assert.throws(() => board.place(candidate, position))
  }
  assert.equal(board.size, 1)
  assert.deepEqual(board.getValidMoves(tile), [])
})

test('encaixes aceitam terrenos iguais e recusam estrada, cidade e campo incompatíveis', () => {
  const road = place(new GameBoard(), 0, 0, 'road')
  assert.equal(road.validatePlacement(new TileInstance('next', 'road'), new Position(0, 1)).valid, true)
  assert.equal(road.validatePlacement(new TileInstance('next', 'monastery'), new Position(1, 0)).valid, true)
  assert.equal(road.validatePlacement(new TileInstance('next', 'monastery'), new Position(0, 1)).valid, false)
  assert.equal(road.validatePlacement(new TileInstance('next', 'city'), new Position(0, 1)).valid, false)
  const city = place(new GameBoard(), 0, 0, 'city')
  assert.equal(city.validatePlacement(new TileInstance('next', 'city', 180), new Position(0, -1)).valid, true)
  assert.equal(city.validatePlacement(new TileInstance('next', 'monastery'), new Position(0, -1)).valid, false)
})

test('um encaixe precisa combinar com os quatro vizinhos presentes', () => {
  const board = ring()
  const center = new Position(1, 1)
  assert.equal(board.neighborsOf(center).length, 4)
  assert.equal(board.validatePlacement(new TileInstance('center', 'city-center'), center).valid, true)
  for (const rotation of rotations) {
    assert.deepEqual(board.validatePlacement(new TileInstance('center', 'city-corner', rotation), center), {
      valid: false, reason: 'terrain-mismatch',
    })
  }
  assert.equal(board.place(new TileInstance('center', 'city-center'), center).size, 9)
})

test('a geração inclui as rotações legais sem repetir posição e orientação', () => {
  const board = place(new GameBoard(), 0, 0, 'road')
  const moves = board.getValidMoves(new TileInstance('next', 'road', 90))
  assert.equal(moves.length, 8)
  assert.deepEqual([...new Set(moves.map(({ tile }) => tile.rotation))], [0, 180])
  assert.equal(new Set(moves.map(({ tile, position }) => `${position.key}:${tile.rotation}`)).size, moves.length)
  assert.ok(moves.every(({ tile }) => tile.id === 'next'))
  assert.deepEqual(board.getValidPositions(new TileInstance('next', 'road', 90)), [])
})

test('a geração encontra todos os encaixes de cada modelo e orientação em torno do tabuleiro', () => {
  const board = ring()
  for (const kind of tileKinds) {
    const tile = new TileInstance('next', kind)
    const expected = []
    for (const rotation of rotations) {
      const oriented = new TileInstance(tile.id, kind, rotation)
      const expectedPositions = []
      for (let x = -2; x <= 4; x++) {
        for (let y = -2; y <= 4; y++) {
          const position = new Position(x, y)
          if (board.validatePlacement(oriented, position).valid) {
            expected.push(`${position.key}:${rotation}`)
            expectedPositions.push(position.key)
          }
        }
      }
      assert.deepEqual(board.getValidPositions(oriented).map((position) => position.key).sort(), expectedPositions.sort())
    }
    const actual = board.getValidMoves(tile).map(({ tile, position }) => `${position.key}:${tile.rotation}`)
    assert.deepEqual(actual.sort(), expected.sort(), kind)
    assert.equal(new Set(actual).size, actual.length, kind)
  }
})

test('um modelo sem qualquer encaixe retorna uma lista vazia', () => {
  const board = place(new GameBoard(), 0, 0)
  const tile = new TileInstance('next', 'city-center')
  assert.deepEqual(board.getValidMoves(tile), [])
  assert.deepEqual(board.getValidPositions(tile), [])
})

test('o tabuleiro cresce em coordenadas negativas e além de nove casas sem alterar o histórico', () => {
  const initial = place(new GameBoard(), 0, 0)
  let board = initial
  for (let x = -1; x >= -12; x--) board = place(board, x, 0)
  for (let y = 1; y <= 12; y++) board = place(board, 0, y)
  assert.equal(board.size, 25)
  assert.equal(initial.size, 1)
  assert.equal(initial.tileAt(new Position(-1, 0)), undefined)
  assert.ok(board.tileAt(new Position(-12, 0)))
  assert.ok(board.tileAt(new Position(0, 12)))
  const placements = board.placements
  placements.pop()
  assert.equal(board.size, 25)
  assert.ok(Object.isFrozen(placements[0]))
})

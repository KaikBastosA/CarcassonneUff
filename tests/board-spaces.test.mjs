import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GameBoard } from '../src/game/board.ts'
import { Position } from '../src/game/position.ts'
import { rotations, tileKinds, TileInstance } from '../src/game/tiles.ts'

const screenshot = [
  [0, 0, 'city-road', 0],
  [0, -1, 'city-center', 0],
  [1, -1, 'city-center', 0],
  [2, -1, 'city-corner', 180],
  [2, 0, 'city', 0],
  [0, 1, 'monastery', 0],
  [1, 1, 'city', 0],
]

function makeBoard(placements) {
  return placements.reduce((board, [x, y, kind, rotation]) => board.place(
    new TileInstance(`${x},${y}`, kind, rotation), new Position(x, y),
  ), new GameBoard())
}

function rotatePlacements(placements, rotation) {
  return placements.map(([x, y, kind, orientation]) => {
    for (let turn = 0; turn < rotation / 90; turn++) [x, y] = [-y, x]
    return [x, y, kind, (orientation + rotation) % 360]
  })
}

test('o cenário da imagem permanece legal e o espaço (1,0) é sinalizado', () => {
  const board = makeBoard(screenshot)
  assert.equal(board.size, 7)
  assert.deepEqual(board.getFittingTiles(new Position(1, 0)), [])
  assert.ok(board.getUnfillablePositions().some((position) => position.key === '1,0'))
  const positions = board.getUnfillablePositions().map((position) => position.key)
  assert.equal(new Set(positions).size, positions.length)
})

test('o aviso antecipa o problema com três vizinhos em todas as rotações do cenário', () => {
  for (const rotation of rotations) {
    const placements = rotatePlacements(screenshot, rotation)
    const board = makeBoard(placements.slice(0, 4))
    const [x, y, kind, orientation] = placements[4]
    const tile = new TileInstance('next', kind, orientation)
    const position = new Position(x, y)
    const [target] = rotatePlacements([[1, 0, 'city', 0]], rotation)
    const key = `${target[0]},${target[1]}`
    assert.ok(!board.getUnfillablePositions().some((position) => position.key === key))
    assert.equal(board.validatePlacement(tile, position), true)
    assert.ok(board.place(tile, position).getNewUnfillablePositions().some((position) => position.key === key))
    assert.ok(board.getValidPositions(tile).some((candidate) => candidate.equals(position)))
    assert.ok(board.getValidMoves(tile).some((candidate) => candidate.position.equals(position) && candidate.tile.rotation === orientation))
    assert.ok(board.place(tile, position).getUnfillablePositions().some((position) => position.key === key))
    assert.equal(board.size, 4)
  }
})

test('o aviso também detecta combinações impossíveis com apenas dois vizinhos opostos', () => {
  const placements = [
    [0, 0, 'monastery', 0], [1, 0, 'city', 180],
    [-1, 0, 'monastery', 0], [-1, 1, 'monastery', 0], [-1, 2, 'monastery', 0],
    [-1, 3, 'monastery', 0], [0, 3, 'monastery', 0], [1, 3, 'monastery', 0],
    [1, 2, 'road-end', 180],
  ]
  for (const rotation of rotations) {
    const oriented = rotatePlacements(placements, rotation)
    const board = makeBoard(oriented.slice(0, -1))
    const [x, y, kind, angle] = oriented.at(-1)
    const tile = new TileInstance('next', kind, angle)
    const target = rotatePlacements([[1, 1, 'city', 0]], rotation)[0]
    const position = new Position(target[0], target[1])
    assert.equal(board.neighborsOf(position).length, 1)
    assert.ok(board.place(tile, new Position(x, y)).getNewUnfillablePositions().some((candidate) => candidate.equals(position)))
    const next = board.place(tile, new Position(x, y))
    assert.equal(next.neighborsOf(position).length, 2)
    assert.deepEqual(next.getFittingTiles(position), [])
  }
})

test('todas as 81 combinações de quatro bordas são comparadas com o catálogo inteiro', () => {
  const terrains = ['city', 'road', 'field']
  let impossible = 0
  for (const north of terrains) for (const east of terrains) for (const south of terrains) for (const west of terrains) {
    const requirement = [north, east, south, west]
    const orientations = { city: [180, 270, 0, 90], road: [0, 90, 180, 270], field: [0, 0, 0, 0] }
    const kinds = { city: 'city', road: 'road-end', field: 'monastery' }
    const border = (index) => [kinds[requirement[index]], orientations[requirement[index]][index]]
    const board = makeBoard([
      [0, 0, 'monastery', 0], [1, 0, ...border(0)], [2, 0, 'monastery', 0],
      [2, 1, ...border(1)], [2, 2, 'monastery', 0], [1, 2, ...border(2)],
      [0, 2, 'monastery', 0], [0, 1, ...border(3)],
    ])
    const position = new Position(1, 1)
    const expected = tileKinds.flatMap((kind) => rotations.flatMap((rotation) =>
      board.validatePlacement(new TileInstance('candidate', kind, rotation), position) ? [{ kind, rotation }] : []))
    const actual = board.getFittingTiles(position).map(({ kind, rotation }) => ({ kind, rotation }))
    assert.deepEqual(actual, expected, requirement.join(','))
    assert.equal(board.getUnfillablePositions().some((candidate) => candidate.equals(position)), expected.length === 0)
    if (expected.length === 0) impossible++
  }
  assert.equal(impossible, 50)
})

test('uma orientação incompatível da peça selecionada não torna o espaço impossível', () => {
  const board = makeBoard([[0, 0, 'road', 0]])
  const position = new Position(0, -1)
  assert.equal(board.validatePlacement(new TileInstance('next', 'road', 90), position), false)
  assert.ok(board.getFittingTiles(position).some(({ kind, rotation }) => kind === 'road' && rotation === 0))
  assert.deepEqual(board.getUnfillablePositions(), [])
  assert.deepEqual(board.getFittingTiles(new Position(0, 0)), [])
  assert.deepEqual(board.getFittingTiles(new Position(20, 20)), [])
})

test('avisos não repetem espaços antigos e deixam de existir ao desfazer a colocação', () => {
  const before = makeBoard(screenshot.slice(0, 4))
  const tile = new TileInstance('next', 'city')
  const after = before.place(tile, new Position(2, 0))
  assert.deepEqual(before.getUnfillablePositions(), [])
  assert.ok(after.getUnfillablePositions().some((position) => position.key === '1,0'))
  assert.deepEqual(after.place(new TileInstance('other', 'monastery'), new Position(0, 1)).getNewUnfillablePositions(), [])
  assert.deepEqual(before.getUnfillablePositions(), [])
  assert.throws(() => before.place(tile, new Position(0, 0)).getNewUnfillablePositions())
})

test('a análise ignora identidades e estoque, sem confundir modelos com exemplares', () => {
  const board = new GameBoard().place(new TileInstance('catalog', 'city-center'), new Position(0, 0))
  assert.ok(board.getFittingTiles(new Position(0, 1)).some(({ kind }) => kind === 'city-center'))
  assert.equal(new GameBoard().getFittingTiles(new Position(0, 0)).length, 48)
  assert.deepEqual(new GameBoard().getFittingTiles(new Position(1, 0)), [])
  assert.deepEqual(new GameBoard().getUnfillablePositions(), [])
})

test('uma única jogada pode avisar sobre dois espaços novos sem alterar a validade', () => {
  const board = makeBoard([
    [0, 0, 'city-road', 0], [0, -1, 'city', 180], [1, -1, 'road', 0],
    [2, -1, 'monastery', 0], [2, 0, 'monastery', 0], [2, 1, 'monastery', 0],
    [-1, 0, 'road', 90], [-1, 1, 'road', 90],
  ])
  const tile = new TileInstance('next', 'city-corner', 270)
  const position = new Position(1, 1)
  assert.equal(board.validatePlacement(tile, position), true)
  assert.deepEqual(board.place(tile, position).getNewUnfillablePositions().map((position) => position.key).sort(), ['0,1', '1,0'])
  assert.ok(board.getFittingTiles(new Position(0, 1)).length > 0)
  assert.ok(board.getFittingTiles(new Position(1, 0)).length > 0)
  assert.equal(board.place(tile, position).size, board.size + 1)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GameBoard } from '../src/game/board.ts'
import { Follower, createFollowers } from '../src/game/followers.ts'
import { StructureMesh } from '../src/game/mesh.ts'
import { Position } from '../src/game/position.ts'
import { City, Road, Field, Monastery } from '../src/game/structures.ts'
import { TileInstance, tileKinds, rotations } from '../src/game/tiles.ts'

function boardOf(placements) {
  return placements.reduce((board, [x, y, kind, rotation = 0]) => board.place(
    new TileInstance(`${x},${y}`, kind, rotation), new Position(x, y),
  ), new GameBoard())
}

test('cada região de cada modelo pertence a uma única estrutura nas quatro orientações', () => {
  assert.deepEqual(new StructureMesh(new GameBoard()).structures, [])
  const classes = { city: City, road: Road, field: Field, monastery: Monastery }
  const roles = { city: 'knight', road: 'thief', field: 'farmer', monastery: 'monk' }
  for (const kind of tileKinds) for (const rotation of rotations) {
    const board = boardOf([[0, 0, kind, rotation]])
    const tile = board.tileAt(new Position(0, 0))
    const mesh = new StructureMesh(board)
    assert.equal(mesh.structures.length, tile.regions.length)
    assert.equal(mesh.structuresOf(tile.id).length, tile.regions.length)
    for (const region of tile.regions) {
      const structure = mesh.structureAt(tile.id, region.id)
      assert.ok(structure instanceof classes[region.terrain])
      assert.equal(structure.role, roles[region.terrain])
      assert.equal(structure.regions.length, 1)
      assert.deepEqual(structure.majority(), [])
    }
    assert.equal(mesh.structureAt(tile.id, 'missing'), undefined)
  }
})

test('estradas e campos conectam pelos segmentos corretos sem cruzar a estrada', () => {
  const board = boardOf([[0, 0, 'road'], [0, 1, 'road']])
  const mesh = new StructureMesh(board)
  const road = mesh.structureAt('0,0', 'road')
  assert.equal(road, mesh.structureAt('0,1', 'road'))
  assert.equal(road.openEdges, 2)
  assert.equal(road.isComplete, false)
  assert.equal(mesh.structureAt('0,0', 'field-east'), mesh.structureAt('0,1', 'field-east'))
  assert.equal(mesh.structureAt('0,0', 'field-west'), mesh.structureAt('0,1', 'field-west'))
  assert.notEqual(mesh.structureAt('0,0', 'field-east'), mesh.structureAt('0,0', 'field-west'))
  const capped = board.place(new TileInstance('cap', 'road-end', 180), new Position(0, 2))
  const merged = new StructureMesh(capped)
  assert.equal(merged.structureAt('0,0', 'field-east'), merged.structureAt('0,0', 'field-west'))
})

test('as conexões de campos são espelhadas corretamente em uma estrada horizontal', () => {
  const mesh = new StructureMesh(boardOf([[0, 0, 'road', 90], [1, 0, 'road', 90]]))
  assert.equal(mesh.structureAt('0,0', 'field-east'), mesh.structureAt('1,0', 'field-east'))
  assert.notEqual(mesh.structureAt('0,0', 'field-east'), mesh.structureAt('1,0', 'field-west'))
})

test('uma cidade fechada em duas cartelas não funde cidades independentes da mesma peça', () => {
  const board = boardOf([[0, 0, 'city-sides'], [0, -1, 'city', 180]])
  const mesh = new StructureMesh(board)
  const south = mesh.structureAt('0,0', 'city-south')
  const north = mesh.structureAt('0,0', 'city-north')
  assert.notEqual(north, south)
  assert.equal(north, mesh.structureAt('0,-1', 'city'))
  assert.equal(north.isComplete, true)
  assert.equal(south.isComplete, false)
  assert.equal(north.openEdges, 0)
  assert.equal(north.shields, 0)
})

test('uma volta de estrada fecha e conta cada cartela uma única vez', () => {
  const mesh = new StructureMesh(boardOf([
    [0, 0, 'curve', 270], [1, 0, 'curve', 0], [1, 1, 'curve', 90], [0, 1, 'curve', 180],
  ]))
  const road = mesh.structureAt('0,0', 'road')
  assert.equal(road.tileIds.length, 4)
  assert.equal(road.regions.length, 4)
  assert.equal(road.openEdges, 0)
  assert.equal(road.isComplete, true)
  assert.equal(mesh.structuresOf('0,0').filter((structure) => structure instanceof Road).length, 1)
})

test('a bifurcação mantém três ramais independentes e a aldeia encerra cada um', () => {
  const board = boardOf([[0, 0, 'junction'], [1, 0, 'road-end', 90]])
  const mesh = new StructureMesh(board)
  const east = mesh.structureAt('0,0', 'road-east')
  assert.equal(east.isComplete, true)
  assert.notEqual(east, mesh.structureAt('0,0', 'road-west'))
  assert.notEqual(east, mesh.structureAt('0,0', 'road-south'))
})

test('campos referenciam cidades globais sem duplicação após a fusão', () => {
  const mesh = new StructureMesh(boardOf([[0, 0, 'city'], [1, 0, 'city']]))
  const field = mesh.structureAt('0,0', 'field')
  assert.equal(field, mesh.structureAt('1,0', 'field'))
  assert.equal(field.adjacentCityIds.length, 2)
  const cityRoad = new StructureMesh(boardOf([[0, 0, 'city-road']]))
  assert.equal(cityRoad.structureAt('0,0', 'field-north').adjacentCityIds.length, 1)
  assert.deepEqual(cityRoad.structureAt('0,0', 'field-south').adjacentCityIds, [])
})

test('mosteiros são independentes e consideram os oito vizinhos, incluindo diagonais', () => {
  let board = boardOf([[0, 0, 'monastery']])
  for (const [x, y] of [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1]]) {
    board = board.place(new TileInstance(`${x},${y}`, 'monastery'), new Position(x, y))
  }
  const before = new StructureMesh(board)
  assert.equal(before.structureAt('0,0', 'monastery').isComplete, false)
  assert.equal(before.structureAt('0,0', 'monastery').surroundingCount, 7)
  board = board.place(new TileInstance('-1,1', 'monastery'), new Position(-1, 1))
  const mesh = new StructureMesh(board)
  const monastery = mesh.structureAt('0,0', 'monastery')
  assert.equal(monastery.isComplete, true)
  assert.equal(monastery.surroundingCount, 8)
  assert.notEqual(monastery, mesh.structureAt('0,-1', 'monastery'))
  assert.ok(mesh.completedAfter(new Position(-1, 1)).includes(monastery))
})

test('a consulta de conclusão não repete estruturas antigas apenas por estarem perto', () => {
  const board = boardOf([[0, 0, 'city'], [0, -1, 'city', 180], [1, 0, 'monastery']])
  const mesh = new StructureMesh(board)
  assert.equal(mesh.structureAt('0,0', 'city').isComplete, true)
  assert.deepEqual(mesh.completedAfter(new Position(1, 0)), [])
  assert.deepEqual(mesh.completedAfter(new Position(20, 20)), [])
})

test('os sete seguidores possuem identidade, reserva e papel associados à estrutura', () => {
  const followers = createFollowers('blue')
  assert.equal(followers.length, 7)
  assert.equal(new Set(followers.map((follower) => follower.id)).size, 7)
  assert.ok(followers.every((follower) => follower.status === 'reserve' && follower.role === 'none'))
  const mesh = new StructureMesh(boardOf([[0, 0, 'city-road']]))
  const follower = mesh.allocateFollower(followers[0], '0,0', 'road')
  assert.equal(follower.ownerId, 'blue')
  assert.equal(follower.role, 'thief')
  assert.equal(follower.status, 'allocated')
  assert.equal(followers[0].status, 'reserve')
  assert.equal(follower.release().status, 'reserve')
  assert.throws(() => follower.allocate('0,0', 'city', 'knight'))
})

test('ocupação é bloqueada em toda a estrutura, inclusive para o dono original', () => {
  const board = boardOf([[0, 0, 'road'], [0, 1, 'road'], [0, 2, 'road']])
  const follower = new Follower('blue-1', 'blue').allocate('0,0', 'road', 'thief')
  const mesh = new StructureMesh(board, [follower])
  assert.throws(() => mesh.allocateFollower(new Follower('red-1', 'red'), '0,2', 'road'), /conectado/)
  assert.throws(() => mesh.allocateFollower(new Follower('blue-2', 'blue'), '0,2', 'road'), /conectado/)
  assert.equal(mesh.allocateFollower(new Follower('red-1', 'red'), '0,2', 'field-east').role, 'farmer')
  assert.deepEqual(mesh.structureAt('0,2', 'road').majority(), ['blue'])
})

test('uniões de estradas ocupadas preservam seguidores, maioria e empates', () => {
  const base = boardOf([
    [0, 0, 'road'], [1, 0, 'monastery'], [2, 0, 'road'],
    [0, 1, 'curve', 180], [2, 1, 'curve', 90],
  ])
  const blue = new Follower('blue-1', 'blue').allocate('0,0', 'road', 'thief')
  const red = new Follower('red-1', 'red').allocate('2,0', 'road', 'thief')
  const before = new StructureMesh(base, [blue, red])
  assert.notEqual(before.structureAt('0,0', 'road'), before.structureAt('2,0', 'road'))
  const board = base.place(new TileInstance('bridge', 'road', 90), new Position(1, 1))
  const mesh = new StructureMesh(board, [blue, red])
  const road = mesh.structureAt('bridge', 'road')
  assert.equal(road.followers.length, 2)
  assert.deepEqual([...road.majority()].sort(), ['blue', 'red'])
  assert.throws(() => mesh.allocateFollower(new Follower('third', 'blue'), 'bridge', 'road'), /conectado/)
  assert.equal(before.structureAt('0,0', 'road').followers.length, 1)
})

test('uniões de campos preservam fazendeiros antes separados pela estrada', () => {
  const base = boardOf([[0, 0, 'road'], [0, 1, 'road']])
  const east = new Follower('blue', 'blue').allocate('0,0', 'field-east', 'farmer')
  const west = new Follower('red', 'red').allocate('0,1', 'field-west', 'farmer')
  const before = new StructureMesh(base, [east, west])
  assert.notEqual(before.structureAt('0,0', 'field-east'), before.structureAt('0,0', 'field-west'))
  const capped = base.place(new TileInstance('cap', 'road-end', 180), new Position(0, 2))
  const mesh = new StructureMesh(capped, [east, west])
  assert.equal(mesh.structureAt('cap', 'field').followers.length, 2)
  assert.deepEqual([...mesh.structureAt('cap', 'field').majority()].sort(), ['blue', 'red'])
})

test('uma fusão de cidades não duplica cartelas nem cidades adjacentes aos campos', () => {
  const base = boardOf([
    [0, 0, 'city-sides'], [0, -1, 'city-corner', 90], [1, -1, 'city-center'], [2, -1, 'city-corner', 180],
    [0, 1, 'city-corner'], [1, 1, 'city-center'], [2, 1, 'city-corner', 270],
  ])
  const blue = new Follower('blue', 'blue').allocate('0,-1', 'city', 'knight')
  const red = new Follower('red', 'red').allocate('0,1', 'city', 'knight')
  const before = new StructureMesh(base, [blue, red])
  assert.notEqual(before.structureAt('0,0', 'city-north'), before.structureAt('0,0', 'city-south'))
  const board = base.place(new TileInstance('bridge', 'city-center'), new Position(2, 0))
  const mesh = new StructureMesh(board, [blue, red])
  const city = mesh.structureAt('0,0', 'city-north')
  assert.equal(city, mesh.structureAt('0,0', 'city-south'))
  assert.equal(city.tileIds.length, 8)
  assert.equal(city.regions.length, 9)
  assert.equal(city.followers.length, 2)
  assert.equal(mesh.structureAt('0,0', 'field').adjacentCityIds.length, 1)
  assert.deepEqual([...city.majority()].sort(), ['blue', 'red'])
})

test('a maioria considera vários seguidores do mesmo dono após unir três estradas', () => {
  const base = boardOf([
    [0, 0, 'road'], [1, 0, 'monastery'], [2, 0, 'road'], [3, 0, 'monastery'], [4, 0, 'road'],
    [0, 1, 'curve', 180], [4, 1, 'curve', 90], [1, 1, 'road', 90], [3, 1, 'road', 90],
  ])
  const followers = [
    new Follower('blue-1', 'blue').allocate('0,0', 'road', 'thief'),
    new Follower('blue-2', 'blue').allocate('4,0', 'road', 'thief'),
    new Follower('red', 'red').allocate('2,0', 'road', 'thief'),
  ]
  const mesh = new StructureMesh(base.place(new TileInstance('bridge', 'crossroads'), new Position(2, 1)), followers)
  assert.equal(mesh.structureAt('bridge', 'road').followers.length, 3)
  assert.deepEqual(mesh.structureAt('bridge', 'road').majority(), ['blue'])
})

test('a malha recusa referências de seguidores inválidas sem perder alocações', () => {
  const board = boardOf([[0, 0, 'city-road'], [1, 0, 'road', 90]])
  const follower = new Follower('one', 'blue').allocate('0,0', 'city', 'knight')
  assert.throws(() => new StructureMesh(board, [follower, follower]), /repetida/)
  assert.throws(() => new StructureMesh(board, [new Follower('x', 'red').allocate('missing', 'road', 'thief')]), /região/)
  assert.throws(() => new StructureMesh(board, [new Follower('x', 'red').allocate('0,0', 'city', 'farmer')]), /papel/)
  assert.throws(() => new StructureMesh(board, [follower, new Follower('two', 'red').allocate('0,0', 'road', 'thief')]), /apenas um/)
  const mesh = new StructureMesh(board, [follower])
  assert.throws(() => mesh.allocateFollower(new Follower('two', 'blue'), '0,0', 'field-south'), /já possui/)
  assert.throws(() => mesh.allocateFollower(new Follower('one', 'blue'), '1,0', 'field-east'), /alocado/)
  assert.throws(() => mesh.allocateFollower(new Follower('two', 'blue'), '1,0', 'missing'), /inválida/)
  assert.ok(Object.isFrozen(mesh.structures[0]))
  assert.ok(Object.isFrozen(mesh.structures[0].regions))
})

test('cidades que se tocam apenas pela diagonal não são fundidas', () => {
  const board = boardOf([
    [0, 0, 'city-corner'], [0, 1, 'monastery'], [1, 1, 'monastery'],
    [2, 1, 'monastery'], [2, 0, 'monastery'], [2, -1, 'monastery'], [1, -1, 'city-corner', 180],
  ])
  const mesh = new StructureMesh(board)
  assert.notEqual(mesh.structureAt('0,0', 'city'), mesh.structureAt('1,-1', 'city'))
  const blue = mesh.allocateFollower(new Follower('blue', 'blue'), '0,0', 'city')
  const occupied = new StructureMesh(board, [blue])
  assert.equal(occupied.allocateFollower(new Follower('red', 'red'), '1,-1', 'city').role, 'knight')
})

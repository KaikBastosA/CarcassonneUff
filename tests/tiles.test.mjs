import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import {
  createTileSet, oppositePort, ports, rotatePort, rotations,
  sides, tileCatalog, tileKinds, TileInstance,
} from '../src/game/tiles.ts'

test('cada modelo cobre a borda inteira sem sobrepor regiões', () => {
  for (const kind of tileKinds) {
    const { regions, quantity, imageRotations } = tileCatalog[kind]
    assert.equal(new Set(regions.map((region) => region.id)).size, regions.length, kind)
    assert.deepEqual(regions.flatMap((region) => region.ports).sort(), [...ports].sort(), kind)
    assert.ok(Number.isInteger(quantity) && quantity > 0, kind)
    assert.ok([1, 2, 4].includes(imageRotations), kind)

    for (const region of regions) {
      assert.ok(Number.isInteger(region.shields) && region.shields >= 0, kind)
      assert.ok(region.terrain === 'city' || region.shields === 0, kind)
      assert.equal(new Set(region.adjacentCities).size, region.adjacentCities.length, kind)
      assert.ok(region.terrain === 'field' || region.adjacentCities.length === 0, kind)
      for (const city of region.adjacentCities) {
        assert.ok(regions.some((candidate) => candidate.id === city && candidate.terrain === 'city'), kind)
      }
    }
  }
})

test('os pontos dos seguidores acompanham a rotação sem sair da região de seleção da peça', () => {
  for (const kind of tileKinds) {
    const original = new TileInstance('tile', kind)
    for (const rotation of rotations) {
      const tile = new TileInstance('tile', kind, rotation)
      for (const [index, region] of tile.regions.entries()) {
        let { x, y } = original.regions[index].anchor
        for (let turn = 0; turn < rotation / 90; turn++) [x, y] = [1 - y, x]
        assert.deepEqual(region.anchor, { x, y })
        assert.ok(x > 0 && x < 1 && y > 0 && y < 1)
        assert.ok(Object.isFrozen(tileCatalog[kind].regions[index].anchor))
      }
      assert.equal(new Set(tile.regions.map(({ anchor }) => `${anchor.x},${anchor.y}`)).size, tile.regions.length)
    }
  }
})

test('as arestas de todas as orientações correspondem aos modelos visuais', () => {
  const expected = {
    city: ['city', 'field', 'field', 'field'],
    'city-corner': ['city', 'city', 'field', 'field'],
    'city-sides': ['city', 'field', 'city', 'field'],
    'city-center': ['city', 'city', 'city', 'city'],
    'city-road': ['city', 'road', 'field', 'road'],
    road: ['road', 'field', 'road', 'field'],
    curve: ['field', 'field', 'road', 'road'],
    junction: ['field', 'road', 'road', 'road'],
    crossroads: ['road', 'road', 'road', 'road'],
    'road-end': ['field', 'field', 'road', 'field'],
    monastery: ['field', 'field', 'field', 'field'],
    'monastery-road': ['field', 'field', 'road', 'field'],
  }

  for (const kind of tileKinds) {
    for (const rotation of rotations) {
      const tile = new TileInstance('tile', kind, rotation)
      sides.forEach((side, index) => {
        assert.equal(tile.terrainAt(side), expected[kind][(index - rotation / 90 + 4) % 4], `${kind} ${rotation} ${side}`)
      })
      assert.deepEqual(tile.regions.flatMap((region) => region.ports).sort(), [...ports].sort())
    }
  }
})

test('rotações preservam identidade, regiões e o exemplar original', () => {
  for (const kind of tileKinds) {
    const original = new TileInstance('tile', kind)
    let rotated = original
    for (let turn = 0; turn < 4; turn++) rotated = rotated.rotate()
    assert.equal(rotated.id, original.id)
    assert.equal(rotated.kind, original.kind)
    assert.equal(rotated.shields, original.shields)
    assert.equal(rotated.rotation, 0)
    assert.deepEqual(rotated.regions, original.regions)
    assert.equal(original.rotate().rotation, 90)
    assert.equal(original.rotation, 0)
    assert.ok(Object.isFrozen(original))
  }
  assert.equal(rotatePort('north-west', 90), 'east-north')
  assert.equal(rotatePort('west-north', 90), 'north-east')
})

test('portas vizinhas espelham os segmentos de campo dos dois lados da estrada', () => {
  assert.equal(oppositePort('north'), 'south')
  assert.equal(oppositePort('north-west'), 'south-west')
  assert.equal(oppositePort('east-north'), 'west-north')
  assert.equal(oppositePort('east-south'), 'west-south')
  for (const port of ports) assert.equal(oppositePort(oppositePort(port)), port)
})

test('cidades separadas e campos adjacentes mantêm sua topologia', () => {
  const tile = new TileInstance('tile', 'city-sides')
  const cities = tile.regions.filter((region) => region.terrain === 'city')
  assert.equal(cities.length, 2)
  assert.deepEqual(tile.regions.find((region) => region.terrain === 'field').adjacentCities, cities.map((city) => city.id))
  const cityRoad = new TileInstance('tile', 'city-road')
  assert.deepEqual(cityRoad.regions.find((region) => region.id === 'field-north').adjacentCities, ['city'])
  assert.deepEqual(cityRoad.regions.find((region) => region.id === 'field-south').adjacentCities, [])
})

test('aldeias encerram ramais e pontas de estrada não dividem o campo', () => {
  const junction = tileCatalog.junction.regions
  assert.equal(junction.filter((region) => region.terrain === 'road').length, 3)
  assert.ok(junction.filter((region) => region.terrain === 'road').every((region) => region.ports.length === 1))
  assert.equal(tileCatalog.crossroads.regions.filter((region) => region.terrain === 'road').length, 1)
  for (const kind of ['road-end', 'monastery-road']) {
    assert.equal(tileCatalog[kind].regions.filter((region) => region.terrain === 'field').length, 1)
  }
  assert.equal(tileCatalog.monastery.regions.find((region) => region.terrain === 'monastery').ports.length, 0)
})

test('o conjunto contém 72 exemplares únicos nas quantidades do catálogo', () => {
  const tiles = createTileSet()
  assert.equal(tiles.length, 72)
  assert.equal(new Set(tiles.map((tile) => tile.id)).size, tiles.length)
  for (const kind of tileKinds) {
    assert.equal(tiles.filter((tile) => tile.kind === kind).length, tileCatalog[kind].quantity)
  }
  assert.ok(tiles.every((tile) => tile.rotation === 0))
  assert.equal(tiles.reduce((total, tile) => total + tile.shields, 0), 3)
  const anotherSet = createTileSet()
  assert.notEqual(tiles[0], anotherSet[0])
  assert.deepEqual(tiles, anotherSet)
})

test('o catálogo permanece protegido contra alterações e todas as imagens existem', () => {
  assert.ok(Object.isFrozen(tileCatalog))
  for (const kind of tileKinds) {
    const definition = tileCatalog[kind]
    assert.ok(Object.isFrozen(definition))
    assert.ok(Object.isFrozen(definition.regions))
    for (const region of definition.regions) {
      assert.ok(Object.isFrozen(region))
      assert.ok(Object.isFrozen(region.ports))
      assert.ok(Object.isFrozen(region.adjacentCities))
    }
    for (const rotation of rotations) {
      const index = rotation / 90 % definition.imageRotations
      assert.ok(existsSync(new URL(`../src/assets/pieces/${definition.source}${index}.webp`, import.meta.url)))
    }
    const tile = new TileInstance('tile', kind)
    tile.regions[0].ports.push('north')
    assert.equal(tile.regions[0].ports.length, definition.regions[0].ports.length)
  }
})

export const tileKinds = [
  'city',
  'city-corner',
  'city-sides',
  'city-center',
  'city-road',
  'road',
  'curve',
  'junction',
  'crossroads',
  'road-end',
  'monastery',
  'monastery-road',
] as const

export const sides = ['north', 'east', 'south', 'west'] as const
export const rotations = [0, 90, 180, 270] as const
export const ports = [
  'north-west', 'north', 'north-east',
  'east-north', 'east', 'east-south',
  'south-east', 'south', 'south-west',
  'west-south', 'west', 'west-north',
] as const

export type TileKind = (typeof tileKinds)[number]
export type Side = (typeof sides)[number]
export type Rotation = (typeof rotations)[number]
export type Port = (typeof ports)[number]
export type Terrain = 'city' | 'road' | 'field' | 'monastery'

export interface TileRegion {
  readonly id: string
  readonly terrain: Terrain
  readonly ports: readonly Port[]
  readonly shields: number
  readonly adjacentCities: readonly string[]
}

export interface TileDefinition {
  readonly name: string
  readonly source: string
  readonly imageRotations: number
  readonly quantity: number
  readonly regions: readonly TileRegion[]
}

function region(id: string, terrain: Terrain, connections: readonly Port[], adjacentCities: readonly string[] = []): TileRegion {
  return { id, terrain, ports: connections, shields: 0, adjacentCities }
}

export const tileCatalog: Readonly<Record<TileKind, TileDefinition>> = {
  city: {
    name: 'Cidade', source: 'CastleWall', imageRotations: 4, quantity: 14,
    regions: [
      region('city', 'city', ['north-west', 'north', 'north-east']),
      region('field', 'field', ports.slice(3), ['city']),
    ],
  },
  'city-corner': {
    name: 'Cidade em curva', source: 'CastleEdge', imageRotations: 4, quantity: 8,
    regions: [
      region('city', 'city', ports.slice(0, 6)),
      region('field', 'field', ports.slice(6), ['city']),
    ],
  },
  'city-sides': {
    name: 'Cidade dupla', source: 'CastleSides', imageRotations: 2, quantity: 4,
    regions: [
      region('city-north', 'city', ports.slice(0, 3)),
      region('city-south', 'city', ports.slice(6, 9)),
      region('field', 'field', [...ports.slice(3, 6), ...ports.slice(9)], ['city-north', 'city-south']),
    ],
  },
  'city-center': {
    name: 'Cidade fechada', source: 'CastleCenter', imageRotations: 1, quantity: 1,
    regions: [region('city', 'city', ports)],
  },
  'city-road': {
    name: 'Cidade e estrada', source: 'CastleWallRoad', imageRotations: 4, quantity: 8,
    regions: [
      region('city', 'city', ports.slice(0, 3)),
      region('road', 'road', ['east', 'west']),
      region('field-north', 'field', ['east-north', 'west-north'], ['city']),
      region('field-south', 'field', ['east-south', 'south-east', 'south', 'south-west', 'west-south']),
    ],
  },
  road: {
    name: 'Estrada', source: 'Road', imageRotations: 4, quantity: 12,
    regions: [
      region('road', 'road', ['north', 'south']),
      region('field-east', 'field', ['north-east', 'east-north', 'east', 'east-south', 'south-east']),
      region('field-west', 'field', ['south-west', 'west-south', 'west', 'west-north', 'north-west']),
    ],
  },
  curve: {
    name: 'Curva', source: 'RoadCurve', imageRotations: 4, quantity: 11,
    regions: [
      region('road', 'road', ['south', 'west']),
      region('field-inner', 'field', ['south-west', 'west-south']),
      region('field-outer', 'field', [...ports.slice(0, 7), 'west-north']),
    ],
  },
  junction: {
    name: 'Bifurcação', source: 'RoadJunctionSmall', imageRotations: 4, quantity: 4,
    regions: [
      region('road-east', 'road', ['east']),
      region('road-south', 'road', ['south']),
      region('road-west', 'road', ['west']),
      region('field-north', 'field', [...ports.slice(0, 4), 'west-north']),
      region('field-south-east', 'field', ['east-south', 'south-east']),
      region('field-south-west', 'field', ['south-west', 'west-south']),
    ],
  },
  crossroads: {
    name: 'Encruzilhada', source: 'RoadCrossLarge', imageRotations: 1, quantity: 1,
    regions: [
      region('road', 'road', sides),
      region('field-north-east', 'field', ['north-east', 'east-north']),
      region('field-south-east', 'field', ['east-south', 'south-east']),
      region('field-south-west', 'field', ['south-west', 'west-south']),
      region('field-north-west', 'field', ['west-north', 'north-west']),
    ],
  },
  'road-end': {
    name: 'Fim de estrada', source: 'RoadEnd', imageRotations: 4, quantity: 3,
    regions: [
      region('road', 'road', ['south']),
      region('field', 'field', ports.filter((port) => port !== 'south')),
    ],
  },
  monastery: {
    name: 'Mosteiro', source: 'Monastery', imageRotations: 1, quantity: 4,
    regions: [region('monastery', 'monastery', []), region('field', 'field', ports)],
  },
  'monastery-road': {
    name: 'Mosteiro e estrada', source: 'MonasteryRoad', imageRotations: 4, quantity: 2,
    regions: [
      region('monastery', 'monastery', []),
      region('road', 'road', ['south']),
      region('field', 'field', ports.filter((port) => port !== 'south')),
    ],
  },
}

function freezeDefinition(definition: TileDefinition) {
  for (const region of definition.regions) {
    Object.freeze(region.ports)
    Object.freeze(region.adjacentCities)
    Object.freeze(region)
  }
  Object.freeze(definition.regions)
  Object.freeze(definition)
}

Object.values(tileCatalog).forEach(freezeDefinition)
Object.freeze(tileCatalog)

export function rotatePort(port: Port, rotation: Rotation): Port {
  return ports[(ports.indexOf(port) + rotation / 90 * 3) % ports.length]
}

export function oppositePort(port: Port): Port {
  const index = ports.indexOf(port)
  return ports[((Math.floor(index / 3) + 2) % 4) * 3 + 2 - index % 3]
}

export class TileInstance {
  readonly id: string
  readonly kind: TileKind
  readonly rotation: Rotation

  constructor(id: string, kind: TileKind, rotation: Rotation = 0) {
    this.id = id
    this.kind = kind
    this.rotation = rotation
    Object.freeze(this)
  }

  get regions(): readonly TileRegion[] {
    return tileCatalog[this.kind].regions.map((region) => ({
      ...region,
      ports: region.ports.map((port) => rotatePort(port, this.rotation)),
    }))
  }

  get shields(): number {
    return tileCatalog[this.kind].regions.reduce((total, region) => total + region.shields, 0)
  }

  terrainAt(side: Side): Terrain {
    const port = rotatePort(side, ((360 - this.rotation) % 360) as Rotation)
    return tileCatalog[this.kind].regions.find((region) => region.ports.includes(port))!.terrain
  }

  rotate(): TileInstance {
    return new TileInstance(this.id, this.kind, ((this.rotation + 90) % 360) as Rotation)
  }
}

export function createTileSet(): TileInstance[] {
  return tileKinds.flatMap((kind) => Array.from(
    { length: tileCatalog[kind].quantity },
    (_, index) => new TileInstance(`${kind}-${index + 1}`, kind),
  ))
}

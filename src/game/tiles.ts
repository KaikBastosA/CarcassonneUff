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
export type Variant = 'plain' | 'shield'
export type TileVariant = Variant
export type Port = (typeof ports)[number]
export type Terrain = 'city' | 'road' | 'field' | 'monastery'

export interface RegionPoint {
  readonly x: number
  readonly y: number
}

export type Point = RegionPoint

export interface TileRegion {
  readonly id: string
  readonly terrain: Terrain
  readonly ports: readonly Port[]
  readonly shields: number
  readonly anchor: RegionPoint
  readonly adjacentCities: readonly string[]
}

export interface TileDefinition {
  readonly name: string
  readonly source: string
  readonly imageRotations: readonly Rotation[]
  readonly quantity: number
  readonly regions: readonly TileRegion[]
  readonly shieldVariant?: Variant
  readonly shield?: {
    readonly quantity: number
    readonly regionId: string
    readonly anchor: RegionPoint
  }
}

function region(id: string, terrain: Terrain, connections: readonly Port[], adjacentCities: readonly string[], anchor: RegionPoint): TileRegion {
  return { id, terrain, ports: connections, shields: 0, adjacentCities, anchor }
}

export const tileCatalog: Readonly<Record<TileKind, TileDefinition>> = {
  city: {
    name: 'Cidade', source: 'CastleWall', imageRotations: rotations, quantity: 14,
    regions: [
      region('city', 'city', ['north-west', 'north', 'north-east'], [], { x: 0.5, y: 0.16 }),
      region('field', 'field', ports.slice(3), ['city'], { x: 0.5, y: 0.65 }),
    ],
  },
  'city-corner': {
    name: 'Cidade em curva', source: 'CastleEdge', imageRotations: rotations, quantity: 8,
    shieldVariant: 'shield', shield: { quantity: 2, regionId: 'city', anchor: { x: 0.86, y: 0.52 } },
    regions: [
      region('city', 'city', ports.slice(0, 6), [], { x: 0.72, y: 0.24 }),
      region('field', 'field', ports.slice(6), ['city'], { x: 0.25, y: 0.75 }),
    ],
  },
  'city-sides': {
    name: 'Cidade dupla', source: 'CastleSides', imageRotations: [0, 90], quantity: 4,
    regions: [
      region('city-north', 'city', ports.slice(0, 3), [], { x: 0.5, y: 0.16 }),
      region('city-south', 'city', ports.slice(6, 9), [], { x: 0.5, y: 0.84 }),
      region('field', 'field', [...ports.slice(3, 6), ...ports.slice(9)], ['city-north', 'city-south'], { x: 0.5, y: 0.5 }),
    ],
  },
  'city-center': {
    name: 'Cidade fechada', source: 'CastleCenter', imageRotations: [0], quantity: 1,
    shieldVariant: 'shield', shield: { quantity: 1, regionId: 'city', anchor: { x: 0.76, y: 0.28 } },
    regions: [region('city', 'city', ports, [], { x: 0.5, y: 0.5 })],
  },
  'city-road': {
    name: 'Cidade e estrada', source: 'CastleWallRoad', imageRotations: rotations, quantity: 8,
    regions: [
      region('city', 'city', ports.slice(0, 3), [], { x: 0.5, y: 0.16 }),
      region('road', 'road', ['east', 'west'], [], { x: 0.5, y: 0.53 }),
      region('field-north', 'field', ['east-north', 'west-north'], ['city'], { x: 0.2, y: 0.37 }),
      region('field-south', 'field', ['east-south', 'south-east', 'south', 'south-west', 'west-south'], [], { x: 0.5, y: 0.82 }),
    ],
  },
  road: {
    name: 'Estrada', source: 'Road', imageRotations: rotations, quantity: 12,
    regions: [
      region('road', 'road', ['north', 'south'], [], { x: 0.5, y: 0.5 }),
      region('field-east', 'field', ['north-east', 'east-north', 'east', 'east-south', 'south-east'], [], { x: 0.8, y: 0.5 }),
      region('field-west', 'field', ['south-west', 'west-south', 'west', 'west-north', 'north-west'], [], { x: 0.2, y: 0.5 }),
    ],
  },
  curve: {
    name: 'Curva', source: 'RoadCurve', imageRotations: rotations, quantity: 11,
    regions: [
      region('road', 'road', ['south', 'west'], [], { x: 0.48, y: 0.55 }),
      region('field-inner', 'field', ['south-west', 'west-south'], [], { x: 0.18, y: 0.83 }),
      region('field-outer', 'field', [...ports.slice(0, 7), 'west-north'], [], { x: 0.72, y: 0.25 }),
    ],
  },
  junction: {
    name: 'Bifurcação', source: 'RoadJunctionSmall', imageRotations: rotations, quantity: 4,
    regions: [
      region('road-east', 'road', ['east'], [], { x: 0.85, y: 0.5 }),
      region('road-south', 'road', ['south'], [], { x: 0.5, y: 0.85 }),
      region('road-west', 'road', ['west'], [], { x: 0.15, y: 0.5 }),
      region('field-north', 'field', [...ports.slice(0, 4), 'west-north'], [], { x: 0.5, y: 0.18 }),
      region('field-south-east', 'field', ['east-south', 'south-east'], [], { x: 0.82, y: 0.82 }),
      region('field-south-west', 'field', ['south-west', 'west-south'], [], { x: 0.18, y: 0.82 }),
    ],
  },
  crossroads: {
    name: 'Encruzilhada', source: 'RoadCrossLarge', imageRotations: [0], quantity: 1,
    regions: [
      region('road', 'road', sides, [], { x: 0.5, y: 0.5 }),
      region('field-north-east', 'field', ['north-east', 'east-north'], [], { x: 0.8, y: 0.2 }),
      region('field-south-east', 'field', ['east-south', 'south-east'], [], { x: 0.8, y: 0.8 }),
      region('field-south-west', 'field', ['south-west', 'west-south'], [], { x: 0.2, y: 0.8 }),
      region('field-north-west', 'field', ['west-north', 'north-west'], [], { x: 0.2, y: 0.2 }),
    ],
  },
  'road-end': {
    name: 'Fim de estrada', source: 'RoadEnd', imageRotations: rotations, quantity: 3,
    regions: [
      region('road', 'road', ['south'], [], { x: 0.5, y: 0.8 }),
      region('field', 'field', ports.filter((port) => port !== 'south'), [], { x: 0.25, y: 0.3 }),
    ],
  },
  monastery: {
    name: 'Mosteiro', source: 'Monastery', imageRotations: [0], quantity: 4,
    regions: [region('monastery', 'monastery', [], [], { x: 0.5, y: 0.5 }), region('field', 'field', ports, [], { x: 0.18, y: 0.8 })],
  },
  'monastery-road': {
    name: 'Mosteiro e estrada', source: 'MonasteryRoad', imageRotations: rotations, quantity: 2,
    regions: [
      region('monastery', 'monastery', [], [], { x: 0.5, y: 0.5 }),
      region('road', 'road', ['south'], [], { x: 0.5, y: 0.85 }),
      region('field', 'field', ports.filter((port) => port !== 'south'), [], { x: 0.2, y: 0.3 }),
    ],
  },
}

function freezeDefinition(definition: TileDefinition) {
  if (definition.shield) {
    Object.freeze(definition.shield.anchor)
    Object.freeze(definition.shield)
  }
  Object.freeze(definition.imageRotations)
  for (const region of definition.regions) {
    Object.freeze(region.anchor)
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

export function rotatePoint(point: RegionPoint, rotation: Rotation): RegionPoint {
  let { x, y } = point
  for (let turn = 0; turn < rotation / 90; turn++) [x, y] = [1 - y, x]
  return { x, y }
}

export class TileInstance {
  readonly id: string
  readonly kind: TileKind
  readonly rotation: Rotation
  readonly variant: TileVariant

  constructor(id: string, kind: TileKind, rotation: Rotation = 0, variant: TileVariant = 'plain') {
    if (variant === 'shield' && !tileCatalog[kind].shieldVariant) throw new Error('Este modelo não possui variante com brasão.')
    this.id = id
    this.kind = kind
    this.rotation = rotation
    this.variant = variant
    Object.freeze(this)
  }

  get regions(): readonly TileRegion[] {
    return tileCatalog[this.kind].regions.map((region) => ({
      ...region,
      shields: region.shields + (this.variant === 'shield' && region.id === tileCatalog[this.kind].shield?.regionId ? 1 : 0),
      anchor: rotatePoint(region.anchor, this.rotation),
      ports: region.ports.map((port) => rotatePort(port, this.rotation)),
    }))
  }

  get shields(): number {
    return tileCatalog[this.kind].regions.reduce((total, region) => total + region.shields, this.variant === 'shield' ? 1 : 0)
  }

  get markers(): readonly RegionPoint[] {
    const shield = tileCatalog[this.kind].shield
    return this.variant === 'shield' && shield ? [rotatePoint(shield.anchor, this.rotation)] : []
  }

  get shieldMarkers(): readonly RegionPoint[] {
    return this.markers
  }

  terrainAt(side: Side): Terrain {
    const port = rotatePort(side, ((360 - this.rotation) % 360) as Rotation)
    return tileCatalog[this.kind].regions.find((region) => region.ports.includes(port))!.terrain
  }

  rotate(): TileInstance {
    return new TileInstance(this.id, this.kind, ((this.rotation + 90) % 360) as Rotation, this.variant)
  }
}

export function createTileSet(): TileInstance[] {
  return tileKinds.flatMap((kind) => Array.from(
    { length: tileCatalog[kind].quantity },
    (_, index) => new TileInstance(`${kind}-${index + 1}`, kind, 0,
      index >= tileCatalog[kind].quantity - (tileCatalog[kind].shield?.quantity ?? 0) ? 'shield' : 'plain'),
  ))
}

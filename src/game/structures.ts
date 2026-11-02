import type { Follower, FollowerRole } from './followers.ts'
import type { Position } from './position.ts'
import type { Terrain, TileRegion } from './tiles.ts'

export interface StructureRegion {
  readonly key: string
  readonly tileId: string
  readonly position: Position
  readonly region: TileRegion
}

export interface StructureData {
  readonly id: string
  readonly regions: readonly StructureRegion[]
  readonly followers: readonly Follower[]
  readonly openEdges: number
  readonly surroundingCount: number
  readonly adjacentCityIds: readonly string[]
  readonly completedCityCount: number
}

export abstract class Structure {
  abstract readonly terrain: Terrain
  abstract readonly role: FollowerRole
  abstract score(final: boolean): number
  readonly id: string
  readonly regions: readonly StructureRegion[]
  readonly followers: readonly Follower[]
  readonly tileIds: readonly string[]

  constructor(data: StructureData) {
    this.id = data.id
    this.regions = Object.freeze([...data.regions])
    this.followers = Object.freeze([...data.followers])
    this.tileIds = Object.freeze([...new Set(data.regions.map(({ tileId }) => tileId))])
  }

  canOccupy(): boolean {
    return this.followers.length === 0
  }

  majority(): readonly string[] {
    const counts = new Map<string, number>()
    for (const follower of this.followers) counts.set(follower.ownerId, (counts.get(follower.ownerId) ?? 0) + 1)
    const maximum = Math.max(0, ...counts.values())
    return [...counts].filter(([, count]) => count === maximum).map(([ownerId]) => ownerId)
  }
}

export abstract class CompletableStructure extends Structure {
  readonly openEdges: number

  constructor(data: StructureData) {
    super(data)
    this.openEdges = data.openEdges
  }

  get isComplete(): boolean {
    return this.openEdges === 0
  }
}

export class City extends CompletableStructure {
  readonly terrain = 'city'
  readonly role = 'knight'

  get shields(): number {
    return this.regions.reduce((total, { region }) => total + region.shields, 0)
  }

  score(final: boolean): number {
    const multiplier = this.isComplete ? 2 : final ? 1 : 0
    return multiplier * (this.tileIds.length + this.shields)
  }
}

export class Road extends CompletableStructure {
  readonly terrain = 'road'
  readonly role = 'thief'

  score(final: boolean): number {
    return this.isComplete || final ? this.tileIds.length : 0
  }
}

export class Monastery extends CompletableStructure {
  readonly terrain = 'monastery'
  readonly role = 'monk'
  readonly surroundingCount: number

  constructor(data: StructureData) {
    super(data)
    this.surroundingCount = data.surroundingCount
  }

  override get isComplete(): boolean {
    return this.surroundingCount === 8
  }

  score(final: boolean): number {
    return this.isComplete || final ? 1 + this.surroundingCount : 0
  }
}

export class Field extends Structure {
  readonly terrain = 'field'
  readonly role = 'farmer'
  readonly adjacentCityIds: readonly string[]
  readonly completedCityCount: number

  constructor(data: StructureData) {
    super(data)
    this.adjacentCityIds = Object.freeze([...data.adjacentCityIds])
    this.completedCityCount = data.completedCityCount
  }

  score(final: boolean): number {
    return final ? 3 * this.completedCityCount : 0
  }
}

export const structureFactories: Record<Terrain, (data: StructureData) => Structure> = {
  city: (data) => new City(data),
  road: (data) => new Road(data),
  monastery: (data) => new Monastery(data),
  field: (data) => new Field(data),
}

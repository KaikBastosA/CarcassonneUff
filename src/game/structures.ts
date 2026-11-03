import type { Player } from '../game.ts'
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
  readonly completedCityIds?: readonly string[]
  readonly players?: readonly Player[]
}

export abstract class Structure {
  abstract readonly terrain: Terrain
  abstract readonly role: FollowerRole
  abstract score(final: boolean): number
  readonly id: string
  readonly regions: readonly StructureRegion[]
  readonly followers: readonly Follower[]
  readonly tileIds: readonly string[]
  #players: readonly Player[]

  constructor(data: StructureData) {
    this.id = data.id
    this.#players = Object.freeze([...(data.players ?? [])])
    this.regions = Object.freeze([...data.regions])
    this.followers = Object.freeze([...data.followers])
    this.tileIds = Object.freeze([...new Set(data.regions.map(({ tileId }) => tileId))])
  }

  canOccupy(): boolean {
    return this.followers.length === 0
  }

  validarOcupacao(): boolean { return this.canOccupy() }
  determinarMaioria(): readonly Player[] { return this.majority() }
  pontuar(final: boolean): number { return this.score(final) }

  majority(): readonly Player[] {
    const ids = this.majorityIds()
    return ids.map((id) => this.#players.find((player) => player.id === id)).filter((player): player is Player => player !== undefined)
  }

  majorityIds(): readonly string[] {
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

  verificarConclusao(): boolean { return this.isComplete }
}

export class City extends CompletableStructure {
  readonly terrain = 'city'
  readonly role = 'knight'

  get shields(): number {
    return this.regions.reduce((total, { region }) => total + region.shields, 0)
  }

  score(final: boolean): number { return this.calcularPontosCidade(final) }

  calcularPontosCidade(final = true): number {
    const multiplier = this.isComplete ? 2 : final ? 1 : 0
    return multiplier * (this.tileIds.length + this.shields)
  }
}

export class Road extends CompletableStructure {
  readonly terrain = 'road'
  readonly role = 'thief'

  score(final: boolean): number { return this.calcularPontosEstrada(final) }

  calcularPontosEstrada(final = true): number {
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

  score(final: boolean): number { return this.calcularPontosMonasterio(final) }

  calcularPontosMonasterio(final = true): number {
    return this.isComplete || final ? 1 + this.surroundingCount : 0
  }
}

export class Field extends Structure {
  readonly terrain = 'field'
  readonly role = 'farmer'
  readonly adjacentCityIds: readonly string[]
  #completedCityIds: readonly string[]

  constructor(data: StructureData) {
    super(data)
    this.adjacentCityIds = Object.freeze([...data.adjacentCityIds])
    this.#completedCityIds = Object.freeze([...(data.completedCityIds ?? data.adjacentCityIds.slice(0, data.completedCityCount))])
  }

  get completedCityCount(): number {
    return this.adjacentCityIds.filter((id) => this.#completedCityIds.includes(id)).length
  }

  score(final: boolean): number { return this.calcularPontosCampo(final) }

  calcularPontosCampo(final = true): number {
    return final ? 3 * this.completedCityCount : 0
  }
}

export const structureFactories: Record<Terrain, (data: StructureData) => Structure> = {
  city: (data) => new City(data),
  road: (data) => new Road(data),
  monastery: (data) => new Monastery(data),
  field: (data) => new Field(data),
}

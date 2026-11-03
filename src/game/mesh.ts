import type { Player } from '../game.ts'
import { calculateScores } from './scoring.ts'
import type { ScoringRecord } from './scoring.ts'
import type { GameBoard } from './board.ts'
import type { Follower, FollowerAllocation } from './followers.ts'
import { Position } from './position.ts'
import { CompletableStructure, City, Field, Monastery, Road, structureFactories } from './structures.ts'
import type { Structure, StructureRegion } from './structures.ts'
import { oppositePort, ports, sides, TileInstance } from './tiles.ts'

function regionKey(tileId: string, regionId: string): string {
  return `${tileId}:${regionId}`
}

export class StructureMesh {
  #structures = new Map<string, Structure>()
  #regions = new Map<string, string>()
  #followers: readonly Follower[]
  #board: GameBoard
  #players: readonly Player[]

  constructor(board: GameBoard, followers: readonly Follower[] = [], players: readonly Player[] = []) {
    this.#board = board
    this.#players = Object.freeze([...players])
    this.#followers = Object.freeze([...followers])
    const nodes = new Map<string, StructureRegion>()
    const parents = new Map<string, string>()
    const portOwners = new Map<string, string>()
    for (const { tile, position } of board.placements) {
      for (const region of tile.regions) {
        const key = regionKey(tile.id, region.id)
        Object.freeze(region.ports)
        Object.freeze(region.adjacentCities)
        Object.freeze(region.anchor)
        nodes.set(key, Object.freeze({ key, tileId: tile.id, position, region: Object.freeze(region) }))
        parents.set(key, key)
        for (const port of region.ports) portOwners.set(`${position.key}:${port}`, key)
      }
    }

    const root = (key: string): string => {
      let current = key
      while (parents.get(current) !== current) current = parents.get(current)!
      while (key !== current) {
        const parent = parents.get(key)!
        parents.set(key, current)
        key = parent
      }
      return current
    }

    for (const node of nodes.values()) {
      for (const port of node.region.ports) {
        const side = sides[Math.floor(ports.indexOf(port) / 3)]
        const neighbor = portOwners.get(`${node.position.neighbor(side).key}:${oppositePort(port)}`)
        if (neighbor && nodes.get(neighbor)!.region.terrain === node.region.terrain) parents.set(root(neighbor), root(node.key))
      }
    }

    const groups = new Map<string, StructureRegion[]>()
    for (const node of nodes.values()) {
      const id = root(node.key)
      this.#regions.set(node.key, id)
      const group = groups.get(id) ?? []
      group.push(node)
      groups.set(id, group)
    }

    const assigned = new Map<string, Follower[]>()
    const ids = new Set<string>()
    const occupiedTiles = new Set<string>()
    for (const follower of followers) {
      if (ids.has(follower.id)) throw new Error('Identidade de seguidor repetida.')
      ids.add(follower.id)
      const allocation = follower.allocation
      if (!allocation) continue
      const id = this.#regions.get(regionKey(allocation.tileId, allocation.regionId))
      if (!id) throw new Error('O seguidor deve pertencer a uma região do tabuleiro.')
      if (occupiedTiles.has(allocation.tileId)) throw new Error('Uma cartela pode receber apenas um seguidor.')
      occupiedTiles.add(allocation.tileId)
      const group = assigned.get(id) ?? []
      group.push(follower)
      assigned.set(id, group)
    }

    const completedCities = new Set([...groups].filter(([, regions]) => regions[0].region.terrain === 'city'
      && regions.every((node) => sides.every((side) => !node.region.ports.includes(side) || board.tileAt(node.position.neighbor(side)))))
      .map(([id]) => id))

    for (const [id, regions] of groups) {
      const adjacentCityIds = new Set<string>()
      let openEdges = 0
      for (const node of regions) {
        for (const city of node.region.adjacentCities) adjacentCityIds.add(this.#regions.get(regionKey(node.tileId, city))!)
        for (const side of sides) {
          if (node.region.ports.includes(side) && !board.tileAt(node.position.neighbor(side))) openEdges++
        }
      }
      const { position } = regions[0]
      let surroundingCount = 0
      if (regions[0].region.terrain === 'monastery') {
        for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) {
          if ((x !== 0 || y !== 0) && board.tileAt(new Position(position.x + x, position.y + y))) surroundingCount++
        }
      }
      const structure = structureFactories[regions[0].region.terrain]({
        id, regions, followers: assigned.get(id) ?? [], openEdges, surroundingCount,
        adjacentCityIds: [...adjacentCityIds],
        completedCityCount: [...adjacentCityIds].filter((city) => completedCities.has(city)).length,
        completedCityIds: [...completedCities], players: this.#players,
      })
      if (structure.followers.some((follower) => follower.role !== structure.role)) throw new Error('O papel do seguidor não corresponde à estrutura.')
      Object.freeze(structure)
      this.#structures.set(id, structure)
    }
  }

  get structures(): readonly Structure[] {
    return [...this.#structures.values()]
  }

  get followers(): readonly Follower[] {
    return this.#followers
  }

  structureAt(region: StructureRegion): Structure | undefined
  /** @deprecated Pass a StructureRegion. */
  structureAt(tileId: string, regionId: string): Structure | undefined
  structureAt(region: StructureRegion | string, regionId?: string): Structure | undefined {
    const key = typeof region === 'string' ? regionKey(region, regionId!) : regionKey(region.tileId, region.region.id)
    const id = this.#regions.get(key)
    return id ? this.#structures.get(id) : undefined
  }

  structuresOf(tile: TileInstance): readonly Structure[]
  /** @deprecated Pass a TileInstance. */
  structuresOf(tileId: string): readonly Structure[]
  structuresOf(tile: TileInstance | string): readonly Structure[] {
    const tileId = typeof tile === 'string' ? tile : tile.id
    return this.structures.filter((structure) => structure.tileIds.includes(tileId))
  }

  allocateFollower(follower: Follower, allocation: FollowerAllocation): StructureMesh
  /** @deprecated Pass an allocation object to receive the updated immutable mesh. */
  allocateFollower(follower: Follower, tileId: string, regionId: string): Follower
  allocateFollower(follower: Follower, allocation: FollowerAllocation | string, regionId?: string): StructureMesh | Follower {
    const tileId = typeof allocation === 'string' ? allocation : allocation.tileId
    const targetRegion = typeof allocation === 'string' ? regionId! : allocation.regionId
    const structure = this.structureAt(tileId, targetRegion)
    if (!structure) throw new Error('Região inválida para o seguidor.')
    if (follower.status !== 'reserve') throw new Error('Este seguidor já está alocado.')
    const existing = this.#followers.find((item) => item.id === follower.id)
    if (existing?.ownerId !== undefined && existing.ownerId !== follower.ownerId) throw new Error('Dono de seguidor inválido.')
    if (existing?.status === 'allocated') throw new Error('Este seguidor já está alocado.')
    if (this.#followers.some((item) => item.allocation?.tileId === tileId)) throw new Error('Esta cartela já possui um seguidor.')
    if (!structure.canOccupy()) throw new Error('Esta estrutura já possui um seguidor conectado.')
    if (typeof allocation !== 'string' && allocation.role !== structure.role) throw new Error('O papel do seguidor não corresponde à estrutura.')
    const allocated = follower.allocate({ tileId, regionId: targetRegion, role: structure.role })
    if (typeof allocation === 'string') return allocated
    const followers = existing ? this.#followers.map((item) => item.id === follower.id ? allocated : item) : [...this.#followers, allocated]
    return new StructureMesh(this.#board, followers, this.#players)
  }

  completedAfter(tile: TileInstance): readonly CompletableStructure[]
  /** @deprecated Pass the placed TileInstance. */
  completedAfter(position: Position): readonly CompletableStructure[]
  completedAfter(tile: TileInstance | Position): readonly CompletableStructure[] {
    const position = tile instanceof Position ? tile : this.#board.placements.find((placement) => placement.tile.id === tile.id)?.position
    if (!position || !this.#board.tileAt(position)) return []
    return this.structures.filter((structure): structure is CompletableStructure => structure instanceof CompletableStructure
      && structure.isComplete
      && structure.regions.some((region) => region.position.equals(position)
        || (structure instanceof Monastery && Math.abs(region.position.x - position.x) <= 1 && Math.abs(region.position.y - position.y) <= 1)))
  }

  integrar(tile: TileInstance, board: GameBoard): StructureMesh {
    if (!board.placements.some((placement) => placement.tile.id === tile.id)) throw new Error('A cartela deve estar no tabuleiro antes da integração.')
    return new StructureMesh(board, this.#followers, this.#players)
  }

  incompletasComSeguidor(): readonly CompletableStructure[] {
    return this.structures.filter((structure): structure is CompletableStructure => structure instanceof CompletableStructure
      && !structure.isComplete && structure.followers.length > 0)
  }

  fieldsWithFarmers(): readonly Field[] {
    return this.structures.filter((structure): structure is Field => structure instanceof Field && structure.followers.length > 0)
  }

  devolverSeguidores(structures: readonly Structure[] = this.structures): StructureMesh {
    const released = new Set(structures.flatMap((structure) => structure.followers.map((follower) => follower.id)))
    return new StructureMesh(this.#board, this.#followers.map((follower) => released.has(follower.id) ? follower.release() : follower), this.#players)
  }

  podePosicionarSeguidor(tile: TileInstance, regionId: string): boolean {
    return this.structureAt(tile.id, regionId)?.canOccupy() === true
      && !this.#followers.some((follower) => follower.allocation?.tileId === tile.id)
  }

  posicionarSeguidor(tile: TileInstance, regionId: string, follower: Follower): StructureMesh {
    const structure = this.structureAt(tile.id, regionId)
    if (!structure) throw new Error('Região inválida para o seguidor.')
    return this.allocateFollower(follower, { tileId: tile.id, regionId, role: structure.role })
  }

  avaliarEstruturasConcluidas(previous: readonly ScoringRecord[] = []): readonly ScoringRecord[] {
    return calculateScores(this.structures, false, previous)
  }

  avaliarEstradasIncompletas(previous: readonly ScoringRecord[] = []): readonly ScoringRecord[] {
    return calculateScores(this.incompletasComSeguidor().filter((structure) => structure instanceof Road), true, previous)
  }

  avaliarCidadesIncompletas(previous: readonly ScoringRecord[] = []): readonly ScoringRecord[] {
    return calculateScores(this.incompletasComSeguidor().filter((structure) => structure instanceof City), true, previous)
  }

  avaliarMonasteriosIncompletos(previous: readonly ScoringRecord[] = []): readonly ScoringRecord[] {
    return calculateScores(this.incompletasComSeguidor().filter((structure) => structure instanceof Monastery), true, previous)
  }

  avaliarCamposEFazendeiros(previous: readonly ScoringRecord[] = []): readonly ScoringRecord[] {
    return calculateScores(this.fieldsWithFarmers(), true, previous)
  }

  verificarOcupacao(region: StructureRegion): Structure | undefined { return this.structureAt(region) }
  alocarSeguidor(follower: Follower, allocation: FollowerAllocation): StructureMesh { return this.allocateFollower(follower, allocation) }
}

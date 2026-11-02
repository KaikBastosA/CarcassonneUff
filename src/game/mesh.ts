import type { GameBoard } from './board.ts'
import type { Follower } from './followers.ts'
import { Position } from './position.ts'
import { CompletableStructure, Monastery, structureFactories } from './structures.ts'
import type { Structure, StructureRegion } from './structures.ts'
import { oppositePort, ports, sides } from './tiles.ts'

function regionKey(tileId: string, regionId: string): string {
  return `${tileId}:${regionId}`
}

export class StructureMesh {
  #structures = new Map<string, Structure>()
  #membership = new Map<string, string>()
  #followers: readonly Follower[]
  #board: GameBoard

  constructor(board: GameBoard, followers: readonly Follower[] = []) {
    this.#board = board
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
      this.#membership.set(node.key, id)
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
      const id = this.#membership.get(regionKey(allocation.tileId, allocation.regionId))
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
        for (const city of node.region.adjacentCities) adjacentCityIds.add(this.#membership.get(regionKey(node.tileId, city))!)
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
      })
      if (structure.followers.some((follower) => follower.role !== structure.role)) throw new Error('O papel do seguidor não corresponde à estrutura.')
      this.#structures.set(id, Object.freeze(structure))
    }
  }

  get structures(): readonly Structure[] {
    return [...this.#structures.values()]
  }

  structureAt(tileId: string, regionId: string): Structure | undefined {
    const id = this.#membership.get(regionKey(tileId, regionId))
    return id ? this.#structures.get(id) : undefined
  }

  structuresOf(tileId: string): readonly Structure[] {
    return this.structures.filter((structure) => structure.tileIds.includes(tileId))
  }

  allocateFollower(follower: Follower, tileId: string, regionId: string): Follower {
    const structure = this.structureAt(tileId, regionId)
    if (!structure) throw new Error('Região inválida para o seguidor.')
    if (follower.status !== 'reserve') throw new Error('Este seguidor já está alocado.')
    if (this.#followers.some((item) => item.id === follower.id && item.status === 'allocated')) throw new Error('Este seguidor já está alocado.')
    if (this.#followers.some((item) => item.allocation?.tileId === tileId)) throw new Error('Esta cartela já possui um seguidor.')
    if (!structure.canOccupy()) throw new Error('Esta estrutura já possui um seguidor conectado.')
    return follower.allocate(tileId, regionId, structure.role)
  }

  completedAfter(position: Position): readonly CompletableStructure[] {
    if (!this.#board.tileAt(position)) return []
    return this.structures.filter((structure): structure is CompletableStructure => structure instanceof CompletableStructure
      && structure.isComplete
      && structure.regions.some((region) => region.position.equals(position)
        || (structure instanceof Monastery && Math.abs(region.position.x - position.x) <= 1 && Math.abs(region.position.y - position.y) <= 1)))
  }
}

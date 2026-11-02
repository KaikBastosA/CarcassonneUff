import { Position } from './position.ts'
import { rotations, sides, tileKinds, TileInstance } from './tiles.ts'
import type { Rotation, Side, TileKind } from './tiles.ts'

export interface TilePlacement {
  readonly tile: TileInstance
  readonly position: Position
}

export interface TileOrientation {
  readonly kind: TileKind
  readonly rotation: Rotation
}

const catalogTiles = tileKinds.flatMap((kind) => rotations.map((rotation) => new TileInstance('catalog', kind, rotation)))

export type PlacementFailure = 'occupied' | 'duplicate-tile' | 'disconnected' | 'terrain-mismatch' | 'starting-position'
export type PlacementValidation = { readonly valid: true } | { readonly valid: false; readonly reason: PlacementFailure }

export const placementMessages: Record<PlacementFailure, string> = {
  occupied: 'Esta posição já contém uma peça.',
  'duplicate-tile': 'Esta cartela já está no tabuleiro.',
  disconnected: 'A peça deve tocar um lado de uma peça do tabuleiro.',
  'terrain-mismatch': 'Os terrenos devem combinar em todos os lados que tocam outras peças.',
  'starting-position': 'Coloque a primeira peça na posição 0,0.',
}

function oppositeSide(side: Side): Side {
  return sides[(sides.indexOf(side) + 2) % sides.length]
}

export class GameBoard {
  #grid = new Map<string, TilePlacement>()
  #tileIds = new Set<string>()

  get size(): number {
    return this.#grid.size
  }

  get placements(): readonly TilePlacement[] {
    return [...this.#grid.values()]
  }

  tileAt(position: Position): TileInstance | undefined {
    return this.#grid.get(position.key)?.tile
  }

  neighborsOf(position: Position): TilePlacement[] {
    return position.adjacent().flatMap((neighbor) => {
      const placement = this.#grid.get(neighbor.key)
      return placement ? [placement] : []
    })
  }

  validatePlacement(tile: TileInstance, position: Position): PlacementValidation {
    if (this.tileAt(position)) return { valid: false, reason: 'occupied' }
    if (this.#tileIds.has(tile.id)) {
      return { valid: false, reason: 'duplicate-tile' }
    }
    if (this.size === 0) {
      return position.equals(new Position(0, 0))
        ? { valid: true }
        : { valid: false, reason: 'starting-position' }
    }

    let connected = false
    for (const side of sides) {
      const neighbor = this.tileAt(position.neighbor(side))
      if (!neighbor) continue
      connected = true
      if (tile.terrainAt(side) !== neighbor.terrainAt(oppositeSide(side))) {
        return { valid: false, reason: 'terrain-mismatch' }
      }
    }
    return connected ? { valid: true } : { valid: false, reason: 'disconnected' }
  }

  place(tile: TileInstance, position: Position): GameBoard {
    const validation = this.validatePlacement(tile, position)
    if (!validation.valid) throw new Error(placementMessages[validation.reason])

    const next = new GameBoard()
    next.#grid = new Map(this.#grid)
    next.#grid.set(position.key, Object.freeze({ tile, position }))
    next.#tileIds = new Set(this.#tileIds).add(tile.id)
    return next
  }

  getValidPositions(tile: TileInstance): Position[] {
    return this.candidatePositions().filter((position) => this.validatePlacement(tile, position).valid)
  }

  getValidMoves(tile: TileInstance): TilePlacement[] {
    const positions = this.candidatePositions()
    return rotations.flatMap((rotation) => {
      const oriented = new TileInstance(tile.id, tile.kind, rotation, tile.variant)
      return positions.flatMap((position) => this.validatePlacement(oriented, position).valid
        ? [{ tile: oriented, position }]
        : [])
    })
  }

  getFittingTiles(position: Position): TileOrientation[] {
    if (this.tileAt(position)) return []
    if (this.size === 0) {
      return position.equals(new Position(0, 0))
        ? catalogTiles.map(({ kind, rotation }) => ({ kind, rotation }))
        : []
    }
    const neighbors = sides.flatMap((side) => {
      const tile = this.tileAt(position.neighbor(side))
      return tile ? [{ side, terrain: tile.terrainAt(oppositeSide(side)) }] : []
    })
    if (neighbors.length === 0) return []

    return catalogTiles
      .filter((tile) => neighbors.every(({ side, terrain }) => tile.terrainAt(side) === terrain))
      .map(({ kind, rotation }) => ({ kind, rotation }))
  }

  getUnfillablePositions(): Position[] {
    return this.candidatePositions().filter((position) => this.getFittingTiles(position).length === 0)
  }

  getNewUnfillablePositions(tile: TileInstance, position: Position): Position[] {
    const next = this.place(tile, position)
    return position.adjacent().filter((neighbor) => !next.tileAt(neighbor)
      && next.getFittingTiles(neighbor).length === 0
      && this.getFittingTiles(neighbor).length > 0)
  }

  private candidatePositions(): Position[] {
    if (this.size === 0) return [new Position(0, 0)]

    const candidates = new Map<string, Position>()
    for (const { position } of this.#grid.values()) {
      for (const neighbor of position.adjacent()) {
        if (!this.#grid.has(neighbor.key)) candidates.set(neighbor.key, neighbor)
      }
    }
    return [...candidates.values()]
  }
}

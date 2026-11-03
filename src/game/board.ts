import { Position } from './position.ts'
import { rotations, sides, TileInstance } from './tiles.ts'
import { fittingCatalogTiles } from './catalog.ts'
import type { TurnDecision } from './strategy.ts'
import type { Rotation, Side, TileKind } from './tiles.ts'

export interface TilePlacement {
  readonly tile: TileInstance
  readonly position: Position
}

export interface TileOrientation {
  readonly kind: TileKind
  readonly rotation: Rotation
}

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
  #tiles = new Map<string, TilePlacement>()
  #tileIds = new Set<string>()
  #previous: GameBoard | null = null
  #lastPosition: Position | null = null

  get size(): number {
    return this.#tiles.size
  }

  get placements(): readonly TilePlacement[] {
    return [...this.#tiles.values()]
  }

  tileAt(position: Position): TileInstance | undefined {
    return this.#tiles.get(position.key)?.tile
  }

  neighborsOf(position: Position): TileInstance[] {
    return position.adjacent().flatMap((neighbor) => {
      const placement = this.#tiles.get(neighbor.key)
      return placement ? [placement.tile] : []
    })
  }

  validatePlacement(tile: TileInstance, position: Position): boolean {
    return this.placementValidation(tile, position).valid
  }

  placementValidation(tile: TileInstance, position: Position): PlacementValidation {
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
    const validation = this.placementValidation(tile, position)
    if (!validation.valid) throw new Error(placementMessages[validation.reason])

    const next = new GameBoard()
    next.#tiles = new Map(this.#tiles)
    next.#tiles.set(position.key, Object.freeze({ tile, position }))
    next.#tileIds = new Set(this.#tileIds).add(tile.id)
    next.#previous = this
    next.#lastPosition = position
    return next
  }

  getValidPositions(tile: TileInstance): Position[] {
    return this.candidatePositions().filter((position) => this.validatePlacement(tile, position))
  }

  getValidMoves(tile: TileInstance): (TurnDecision & TilePlacement)[] {
    const positions = this.candidatePositions()
    return rotations.flatMap((rotation) => {
      const oriented = new TileInstance(tile.id, tile.kind, rotation, tile.variant)
      return positions.flatMap((position) => this.validatePlacement(oriented, position)
        ? [{ tileId: oriented.id, rotation: oriented.rotation, regionId: null, tile: oriented, position }]
        : [])
    })
  }

  getFittingTiles(position: Position): TileInstance[] {
    return fittingCatalogTiles(this, position)
  }

  getUnfillablePositions(): Position[] {
    return this.candidatePositions().filter((position) => this.getFittingTiles(position).length === 0)
  }

  getNewUnfillablePositions(): Position[]
  getNewUnfillablePositions(tile: TileInstance, position: Position): Position[]
  getNewUnfillablePositions(tile?: TileInstance, position?: Position): Position[] {
    if (tile && position) return this.place(tile, position).getNewUnfillablePositions()
    const previous = this.#previous
    if (!previous || !this.#lastPosition) return []
    return this.#lastPosition.adjacent().filter((neighbor) => !this.tileAt(neighbor)
      && this.getFittingTiles(neighbor).length === 0
      && previous.getFittingTiles(neighbor).length > 0)
  }

  validarAdjacencia(tile: TileInstance, position: Position): boolean { return this.validatePlacement(tile, position) }
  posicionarCartela(tile: TileInstance, position: Position): GameBoard { return this.place(tile, position) }
  obterPosicoesValidas(tile: TileInstance): Position[] {
    return [...new Map(this.getValidMoves(tile).map(({ position }) => [position.key, position])).values()]
  }

  private candidatePositions(): Position[] {
    if (this.size === 0) return [new Position(0, 0)]

    const candidates = new Map<string, Position>()
    for (const { position } of this.#tiles.values()) {
      for (const neighbor of position.adjacent()) {
        if (!this.#tiles.has(neighbor.key)) candidates.set(neighbor.key, neighbor)
      }
    }
    return [...candidates.values()]
  }
}

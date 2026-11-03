import type { GameBoard } from './board.ts'
import type { Position } from './position.ts'
import { rotations, sides, tileKinds, TileInstance } from './tiles.ts'

const catalogTiles = Object.freeze(tileKinds.flatMap((kind) => rotations.map((rotation) => new TileInstance(`catalog:${kind}:${rotation}`, kind, rotation))))

// Catalog queries ignore exemplar identity and remaining stock: a warning describes
// whether the geometry can ever be filled by one of the game's tile models.
export function fittingCatalogTiles(board: GameBoard, position: Position): TileInstance[] {
  if (board.tileAt(position)) return []
  if (board.size === 0) return position.x === 0 && position.y === 0 ? [...catalogTiles] : []
  const neighbors = sides.flatMap((side, index) => {
    const tile = board.tileAt(position.neighbor(side))
    return tile ? [{ side, terrain: tile.terrainAt(sides[(index + 2) % sides.length]) }] : []
  })
  if (neighbors.length === 0) return []
  return catalogTiles.filter((tile) => neighbors.every(({ side, terrain }) => tile.terrainAt(side) === terrain))
}

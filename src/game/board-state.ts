import type { Player } from '../game.ts'
import { GameBoard } from './board.ts'
import type { TilePlacement } from './board.ts'
import type { Follower } from './followers.ts'
import type { TileInstance } from './tiles.ts'
import type { RenderBoard } from '../tiles.ts'

export interface Rect {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}

export interface BoardState {
  readonly tiles: readonly TileInstance[]
  readonly followers: readonly Follower[]
  readonly bounds: Rect
  // Coordinates are required to restore and render a board snapshot.
  readonly placements: readonly TilePlacement[]
}

export function boardSnapshot(model: GameBoard, followers: readonly Follower[] = []): BoardState {
  const placements = model.placements
  const xs = placements.map(({ position }) => position.x)
  const ys = placements.map(({ position }) => position.y)
  return Object.freeze({
    tiles: Object.freeze(placements.map(({ tile }) => tile)),
    followers: Object.freeze([...followers]),
    bounds: Object.freeze({ minX: Math.min(0, ...xs), minY: Math.min(0, ...ys), maxX: Math.max(0, ...xs), maxY: Math.max(0, ...ys) }),
    placements: Object.freeze([...placements]),
  })
}

export function restoreBoard(snapshot: BoardState): GameBoard {
  return snapshot.placements.reduce((board, { tile, position }) => board.place(tile, position), new GameBoard())
}

export function renderBoard(snapshot: BoardState, players: readonly Player[]): RenderBoard {
  const owners = new Map(players.map((player) => [player.id, player.color]))
  const allocations = new Map(snapshot.followers.filter((follower) => follower.allocation).map((follower) => [follower.allocation!.tileId, follower]))
  return Object.fromEntries(snapshot.placements.map(({ tile, position }) => {
    const follower = allocations.get(tile.id)
    return [position.key, { kind: tile.kind, rotation: tile.rotation, variant: tile.variant,
      meeple: follower ? owners.get(follower.ownerId) : undefined, meepleRegion: follower?.allocation?.regionId }]
  }))
}

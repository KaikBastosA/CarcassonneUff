import type { GameBoard } from './game/board.ts'
import type { TileInstance } from './game/tiles.ts'
import type { Follower } from './game/followers.ts'
import type { StructureMesh } from './game/mesh.ts'
import type { ScoringRecord } from './game/scoring.ts'
import type { PlayerStrategy } from './game/strategy.ts'
import type { BoardState, PlayerColor, Rotation } from './tiles'

export type GamePhase = 'configure' | 'place' | 'meeple' | 'finished'

export interface Player {
  id: string
  name: string
  color: PlayerColor
  score: number
  meeples: number
  followers: readonly Follower[]
  strategy: PlayerStrategy
}

export interface GameEvent {
  id: number
  playerId: string
  text: string
  points?: number
  round: number
}

export interface GameState {
  players: readonly Player[]
  currentPlayerIndex: number
  startingPlayerIndex: number
  round: number
  phase: GamePhase
  board: BoardState
  model: GameBoard
  mesh: StructureMesh
  previousBoard: GameBoard | null
  message: string
  scoring: readonly ScoringRecord[]
  winners: readonly string[]
  rotation: Rotation
  deck: readonly TileInstance[]
  discarded: readonly TileInstance[]
  seed: number | null
  deckIndex: number
  pendingPosition: string | null
  activity: readonly GameEvent[]
}

export const roomCode = '7K2F'

export const playerColors: readonly PlayerColor[] = Object.freeze(['blue', 'red', 'yellow', 'black', 'green'])

export const playerHex: Record<PlayerColor, string> = {
  blue: '#32678c',
  red: '#b84f3d',
  yellow: '#c99a2e',
  black: '#464440',
  green: '#49844b',
}

export const playerAvatarInk: Record<PlayerColor, string> = {
  blue: '#f8f4e8',
  red: '#f8f4e8',
  yellow: '#2d2b24',
  black: '#f8f4e8',
  green: '#f8f4e8',
}

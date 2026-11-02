import { GameBoard } from './game/board.ts'
import { Position } from './game/position.ts'
import { TileInstance } from './game/tiles.ts'
import { createFollowers } from './game/followers.ts'
import type { Follower } from './game/followers.ts'
import { StructureMesh } from './game/mesh.ts'
import type { ScoringRecord } from './game/scoring.ts'
import type { BoardState, PlayerColor, Rotation, TileKind } from './tiles'

export type GamePhase = 'place' | 'meeple' | 'finished'

export interface Player {
  id: string
  name: string
  color: PlayerColor
  score: number
  meeples: number
  followers: readonly Follower[]
  local: boolean
}

export interface GameEvent {
  id: number
  playerId: string
  text: string
  points?: number
  round: number
}

export interface GameState {
  players: Player[]
  currentPlayerIndex: number
  round: number
  phase: GamePhase
  board: BoardState
  model: GameBoard
  mesh: StructureMesh
  previousBoard: GameBoard | null
  message: string
  scoring: readonly ScoringRecord[]
  winners: readonly string[]
  currentKind: TileKind
  rotation: Rotation
  deck: TileKind[]
  deckIndex: number
  pendingPosition: string | null
  activity: GameEvent[]
}

export const roomCode = '7K2F'

export const playerHex: Record<PlayerColor, string> = {
  blue: '#32678c',
  red: '#b84f3d',
  yellow: '#c99a2e',
  black: '#464440',
}

export const playerAvatarInk: Record<PlayerColor, string> = {
  blue: '#f8f4e8',
  red: '#f8f4e8',
  yellow: '#2d2b24',
  black: '#f8f4e8',
}

export const gameDeck: TileKind[] = [
  'city-sides',
  'curve',
  'monastery',
  'road',
  'city-corner',
  'road-end',
  'junction',
  'city-road',
  'curve',
  'monastery-road',
  'crossroads',
  'city',
  'curve',
  'road',
  'city-center',
  'city-road',
  'road',
  'monastery',
]

export const initialPlayers: Player[] = [
  { id: 'you', name: 'Você', color: 'blue', score: 0, meeples: 7, followers: createFollowers('you'), local: true },
  { id: 'ana', name: 'Ana', color: 'red', score: 0, meeples: 7, followers: createFollowers('ana'), local: false },
  { id: 'bruno', name: 'Bruno', color: 'yellow', score: 0, meeples: 7, followers: createFollowers('bruno'), local: false },
  { id: 'carla', name: 'Carla', color: 'black', score: 0, meeples: 7, followers: createFollowers('carla'), local: false },
]

export const initialActivity: GameEvent[] = []

const initialModel = new GameBoard().place(new TileInstance('start', 'city-road'), new Position(0, 0))

export const initialGame: GameState = {
  players: initialPlayers,
  currentPlayerIndex: 0,
  round: 1,
  phase: 'place',
  board: { '0,0': { kind: 'city-road', rotation: 0 } },
  model: initialModel,
  mesh: new StructureMesh(initialModel),
  previousBoard: null,
  message: '',
  scoring: [],
  winners: [],
  currentKind: gameDeck[0],
  rotation: 0,
  deck: gameDeck,
  deckIndex: 0,
  pendingPosition: null,
  activity: initialActivity,
}

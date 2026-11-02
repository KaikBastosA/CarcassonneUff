import { GameBoard } from './game/board.ts'
import { Position } from './game/position.ts'
import { TileInstance } from './game/tiles.ts'
import type { BoardState, PlayerColor, Rotation, TileKind } from './tiles'

export type GamePhase = 'place' | 'meeple'

export interface Player {
  id: string
  name: string
  color: PlayerColor
  score: number
  meeples: number
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
  previousBoard: GameBoard | null
  message: string
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
  { id: 'you', name: 'Você', color: 'blue', score: 42, meeples: 6, local: true },
  { id: 'ana', name: 'Ana', color: 'red', score: 37, meeples: 7, local: false },
  { id: 'bruno', name: 'Bruno', color: 'yellow', score: 31, meeples: 5, local: false },
  { id: 'carla', name: 'Carla', color: 'black', score: 26, meeples: 7, local: false },
]

export const initialActivity: GameEvent[] = [
  { id: 4, playerId: 'ana', text: 'completou uma cidade', points: 8, round: 2 },
  { id: 3, playerId: 'bruno', text: 'colocou um mosteiro', round: 2 },
  { id: 2, playerId: 'you', text: 'completou uma estrada', points: 4, round: 2 },
  { id: 1, playerId: 'carla', text: 'entrou na sala', round: 1 },
]

export const initialGame: GameState = {
  players: initialPlayers,
  currentPlayerIndex: 0,
  round: 3,
  phase: 'place',
  board: { '0,0': { kind: 'city-road', rotation: 0 } },
  model: new GameBoard().place(new TileInstance('start', 'city-road'), new Position(0, 0)),
  previousBoard: null,
  message: '',
  currentKind: gameDeck[0],
  rotation: 0,
  deck: gameDeck,
  deckIndex: 0,
  pendingPosition: null,
  activity: initialActivity,
}

import { GameBoard } from '../../src/game/board.ts'
import { Position } from '../../src/game/position.ts'
import { TileInstance } from '../../src/game/tiles.ts'
import { createFollowers } from '../../src/game/followers.ts'
import { StructureMesh } from '../../src/game/mesh.ts'
const kinds = [
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

export const initialPlayers = [
  { id: 'you', name: 'Você', color: 'blue', score: 0, meeples: 7, followers: createFollowers('you'), local: true },
  { id: 'ana', name: 'Ana', color: 'red', score: 0, meeples: 7, followers: createFollowers('ana'), local: false },
  { id: 'bruno', name: 'Bruno', color: 'yellow', score: 0, meeples: 7, followers: createFollowers('bruno'), local: false },
  { id: 'carla', name: 'Carla', color: 'black', score: 0, meeples: 7, followers: createFollowers('carla'), local: false },
]

export const initialActivity = []

const initialModel = new GameBoard().place(new TileInstance('start', 'city-road'), new Position(0, 0))

export const initialGame = {
  players: initialPlayers,
  currentPlayerIndex: 0,
  startingPlayerIndex: 0,
  round: 1,
  phase: 'place',
  board: { '0,0': { kind: 'city-road', rotation: 0 } },
  model: initialModel,
  mesh: new StructureMesh(initialModel),
  previousBoard: null,
  message: '',
  scoring: [],
  winners: [],
  rotation: 0,
  deck: kinds.map((kind, index) => new TileInstance(`tile-${index}`, kind)),
  discarded: [],
  seed: 1,
  deckIndex: 0,
  pendingPosition: null,
  activity: initialActivity,
}

export function withTile(state, kind, rotation = state.rotation) {
  const deck = [...state.deck]
  deck[state.deckIndex] = new TileInstance(deck[state.deckIndex]?.id ?? `tile-${state.deckIndex}`, kind)
  return { ...state, deck, rotation }
}

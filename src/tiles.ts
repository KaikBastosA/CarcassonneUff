export const tileKinds = [
  'city',
  'city-corner',
  'city-sides',
  'city-center',
  'city-road',
  'road',
  'curve',
  'junction',
  'crossroads',
  'road-end',
  'monastery',
  'monastery-road',
] as const

export type TileKind = (typeof tileKinds)[number]
export type Rotation = 0 | 90 | 180 | 270
export type PlayerColor = 'blue' | 'red' | 'yellow' | 'black'

export const tileNames: Record<TileKind, string> = {
  city: 'Cidade',
  'city-corner': 'Cidade em curva',
  'city-sides': 'Cidade dupla',
  'city-center': 'Cidade fechada',
  'city-road': 'Cidade e estrada',
  road: 'Estrada',
  curve: 'Curva',
  junction: 'Bifurcação',
  crossroads: 'Encruzilhada',
  'road-end': 'Fim de estrada',
  monastery: 'Mosteiro',
  'monastery-road': 'Mosteiro e estrada',
}

export const playerNames: Record<PlayerColor, string> = {
  blue: 'Azul',
  red: 'Vermelho',
  yellow: 'Amarelo',
  black: 'Preto',
}

export interface PlacedTile {
  kind: TileKind
  rotation: Rotation
  meeple?: PlayerColor
}

export type BoardState = Record<string, PlacedTile>

const tileSources: Record<TileKind, string> = {
  city: 'CastleWall',
  'city-corner': 'CastleEdge',
  'city-sides': 'CastleSides',
  'city-center': 'CastleCenter',
  'city-road': 'CastleWallRoad',
  road: 'Road',
  curve: 'RoadCurve',
  junction: 'RoadJunctionSmall',
  crossroads: 'RoadCrossLarge',
  'road-end': 'RoadEnd',
  monastery: 'Monastery',
  'monastery-road': 'MonasteryRoad',
}

const tileRotationLimits: Record<TileKind, number> = {
  city: 4,
  'city-corner': 4,
  'city-sides': 2,
  'city-center': 1,
  'city-road': 4,
  road: 4,
  curve: 4,
  junction: 4,
  crossroads: 1,
  'road-end': 4,
  monastery: 1,
  'monastery-road': 4,
}

const tileModules = import.meta.glob('./assets/pieces/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const tileImages = Object.fromEntries(
  Object.entries(tileModules).map(([path, source]) => [path.split('/').pop()?.replace('.webp', '') ?? '', source]),
)

export function tileImage(kind: TileKind, rotation: Rotation) {
  const index = (rotation / 90) % tileRotationLimits[kind]
  return tileImages[`${tileSources[kind]}${index}`]
}

export const boardSize = 9

export const initialBoard: BoardState = {
  '2,1': { kind: 'curve', rotation: 270 },
  '3,1': { kind: 'road', rotation: 90, meeple: 'red' },
  '4,1': { kind: 'road', rotation: 90 },
  '5,1': { kind: 'curve', rotation: 0 },
  '2,2': { kind: 'road', rotation: 0 },
  '3,2': { kind: 'city-corner', rotation: 90 },
  '4,2': { kind: 'city-corner', rotation: 180 },
  '5,2': { kind: 'junction', rotation: 270 },
  '2,3': { kind: 'junction', rotation: 90 },
  '3,3': { kind: 'city-corner', rotation: 0 },
  '4,3': { kind: 'city-corner', rotation: 270, meeple: 'blue' },
  '5,3': { kind: 'road', rotation: 0 },
  '2,4': { kind: 'curve', rotation: 180 },
  '3,4': { kind: 'road', rotation: 90 },
  '4,4': { kind: 'junction', rotation: 0 },
  '5,4': { kind: 'curve', rotation: 90 },
  '1,3': { kind: 'road-end', rotation: 270 },
  '6,1': { kind: 'city-corner', rotation: 90 },
  '7,1': { kind: 'city', rotation: 270 },
  '6,2': { kind: 'city-road', rotation: 0 },
  '7,2': { kind: 'curve', rotation: 0 },
  '7,3': { kind: 'road', rotation: 0 },
  '7,4': { kind: 'curve', rotation: 90 },
  '6,4': { kind: 'junction', rotation: 270 },
  '6,3': { kind: 'road-end', rotation: 0 },
  '4,5': { kind: 'road', rotation: 0 },
  '4,6': { kind: 'curve', rotation: 90 },
  '3,6': { kind: 'road', rotation: 90 },
  '2,6': { kind: 'road-end', rotation: 270 },
  '3,5': { kind: 'monastery', rotation: 0, meeple: 'yellow' },
  '6,5': { kind: 'monastery-road', rotation: 180 },
}

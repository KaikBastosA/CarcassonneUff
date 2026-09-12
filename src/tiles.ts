export const tileKinds = ['field', 'road', 'curve', 'crossroads', 'city', 'city-road', 'monastery'] as const
export type TileKind = (typeof tileKinds)[number]
export type Rotation = 0 | 90 | 180 | 270
export type PlayerColor = 'blue' | 'red' | 'yellow' | 'black'

export const tileNames: Record<TileKind, string> = {
  field: 'Campo',
  road: 'Estrada',
  curve: 'Curva',
  crossroads: 'Encruzilhada',
  city: 'Cidade',
  'city-road': 'Cidade e estrada',
  monastery: 'Mosteiro',
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

export const boardSize = 9
export const initialBoard: BoardState = {
  '4,4': { kind: 'city-road', rotation: 0 },
}

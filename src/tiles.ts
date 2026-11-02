import { tileCatalog, tileKinds } from './game/tiles'
import type { TileKind, Rotation, Terrain } from './game/tiles'

export { tileCatalog, tileKinds }
export type { TileKind, Rotation }
export type PlayerColor = 'blue' | 'red' | 'yellow' | 'black'

export const terrainNames: Record<Terrain, string> = {
  city: 'Cidade', road: 'Estrada', field: 'Campo', monastery: 'Mosteiro',
}

export const tileNames = Object.fromEntries(
  tileKinds.map((kind) => [kind, tileCatalog[kind].name]),
) as Record<TileKind, string>

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
  meepleRegion?: string
}

export type BoardState = Record<string, PlacedTile>

const tileModules = import.meta.glob('./assets/pieces/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const tileImages = Object.fromEntries(
  Object.entries(tileModules).map(([path, source]) => [path.split('/').pop()?.replace('.webp', '') ?? '', source]),
)

export function tileImage(kind: TileKind) {
  return tileImages[`${tileCatalog[kind].source}0`]
}

export const boardSize = 9

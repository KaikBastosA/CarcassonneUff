import type { PlayerColor } from '../tiles'

const meepleModules = import.meta.glob('../assets/meeples/*.webp', { eager: true, import: 'default' }) as Record<string, string>
const meepleImages = Object.fromEntries(
  Object.entries(meepleModules).map(([path, source]) => [path.split('/').pop()?.replace('.webp', '') ?? '', source]),
)

export function meepleImage(color: PlayerColor) {
  return meepleImages[`meeple_road_${color === 'green' ? 'blue' : color}`]
}

export function meepleFilter(color: PlayerColor): string {
  return color === 'green' ? 'hue-rotate(-90deg)' : 'none'
}

export default function Meeple({ color }: { color: PlayerColor }) {
  return <img className="meeple" src={meepleImage(color)} style={{ filter: meepleFilter(color) }} alt="" aria-hidden="true" draggable={false} />
}

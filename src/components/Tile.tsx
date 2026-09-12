import type { PlacedTile, TileKind } from '../tiles'
import Meeple from './Meeple'

const roadPaths: Partial<Record<TileKind, string>> = {
  road: 'M 50 0 V 100',
  curve: 'M 50 0 V 30 Q 50 50 70 50 H 100',
  crossroads: 'M 50 0 V 50 M 0 50 H 100 M 50 50 V 100',
  'city-road': 'M 0 50 H 100',
}

export function Field() {
  return <rect width="100" height="100" fill="#a8bb83" />
}

export function Road({ path }: { path: string }) {
  return (
    <g fill="none" strokeLinejoin="round">
      <path d={path} stroke="#7b785b" strokeWidth="13" />
      <path d={path} stroke="#eee0b9" strokeWidth="9" />
    </g>
  )
}

export function City() {
  return (
    <g>
      <path d="M 0 0 H 100 L 82 25 H 18 Z" fill="#c59471" />
      <path d="M 0 0 L 18 25 H 82 L 100 0" fill="none" stroke="#695b4b" strokeWidth="3" />
      <path d="M 20 24 V 18 H 27 V 24 M 39 24 V 18 H 46 V 24 M 58 24 V 18 H 65 V 24 M 76 24 V 18 H 82" fill="none" stroke="#695b4b" strokeWidth="2" />
      <path d="M 43 10 V 3 H 55 V 10" fill="#e0bc91" stroke="#826147" strokeWidth="1.5" />
    </g>
  )
}

export function Monastery() {
  return (
    <g stroke="#695b4b" strokeWidth="2" strokeLinejoin="round">
      <rect x="31" y="41" width="38" height="30" fill="#efe1bc" />
      <path d="M 27 42 L 50 24 L 73 42 Z" fill="#ad6c50" />
      <path d="M 47 71 V 58 Q 52 51 57 58 V 71" fill="#77684d" />
      <path d="M 36 48 V 55 M 64 48 V 55" />
      <path d="M 50 24 V 14 M 46 18 H 54" />
    </g>
  )
}

export default function Tile({ kind, rotation, meeple }: PlacedTile) {
  const road = roadPaths[kind]

  return (
    <span className="tile">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <g transform={`rotate(${rotation} 50 50)`}>
          <Field />
          {road && <Road path={road} />}
          {kind === 'crossroads' && <circle cx="50" cy="50" r="9" fill="#c59471" stroke="#695b4b" strokeWidth="2" />}
          {(kind === 'city' || kind === 'city-road') && <City />}
          {kind === 'monastery' && <Monastery />}
        </g>
        <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke="#3f4733" strokeOpacity="0.25" />
      </svg>
      {meeple && <span className="tile-meeple"><Meeple color={meeple} /></span>}
    </span>
  )
}

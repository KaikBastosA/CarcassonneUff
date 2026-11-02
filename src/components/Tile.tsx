import { tileImage } from '../tiles'
import type { PlacedTile } from '../tiles'
import Meeple from './Meeple'
import { TileInstance } from '../game/tiles'

export default function Tile({ kind, rotation, meeple, meepleRegion, art = true }: PlacedTile & { art?: boolean }) {
  const region = meeple && meepleRegion ? new TileInstance('view', kind, rotation).regions.find((item) => item.id === meepleRegion) : undefined
  return (
    <span className="tile">
      {art && <img className="tile-art" src={tileImage(kind)} style={{ transform: `rotate(${rotation}deg)` }} alt="" draggable={false} />}
      {meeple && <span className="tile-meeple" style={region ? {
        inset: 'auto', left: `${region.anchor.x * 100}%`, top: `${region.anchor.y * 100}%`, width: '30%', height: '30%',
        transform: `translate(-50%, -50%)${region.terrain === 'field' ? ' rotate(90deg)' : ''}`,
      } : undefined}><Meeple color={meeple} /></span>}
    </span>
  )
}

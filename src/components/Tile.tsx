import { shieldImage, tileImage } from '../tiles'
import type { PlacedTile } from '../tiles'
import Meeple from './Meeple'
import { TileInstance } from '../game/tiles'

export default function Tile({ kind, rotation, variant = 'plain', meeple, meepleRegion, art = true }: PlacedTile & { art?: boolean }) {
  const tile = new TileInstance('view', kind, rotation, variant)
  const region = meeple && meepleRegion ? tile.regions.find((item) => item.id === meepleRegion) : undefined
  return (
    <span className="tile">
      {art && <img className="tile-art" src={tileImage(kind)} style={{ transform: `rotate(${rotation}deg)` }} alt="" draggable={false} />}
      {art && tile.markers.map((anchor, index) => <img key={index} className="tile-shield" src={shieldImage}
        alt="Brasão" title="Brasão: +2 pontos na cidade completa ou +1 na incompleta ao final"
        draggable={false} style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%`, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }} />)}
      {meeple && <span className="tile-meeple" style={region ? {
        inset: 'auto', left: `${region.anchor.x * 100}%`, top: `${region.anchor.y * 100}%`, width: '30%', height: '30%',
        transform: `translate(-50%, -50%)${region.terrain === 'field' ? ' rotate(90deg)' : ''}`,
      } : undefined}><Meeple color={meeple} /></span>}
    </span>
  )
}

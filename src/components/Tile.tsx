import { tileImage } from '../tiles'
import type { PlacedTile } from '../tiles'
import Meeple from './Meeple'

export default function Tile({ kind, rotation, meeple }: PlacedTile) {
  return (
    <span className="tile">
      <img className="tile-art" src={tileImage(kind, rotation)} alt="" draggable={false} />
      {meeple && <span className="tile-meeple"><Meeple color={meeple} /></span>}
    </span>
  )
}

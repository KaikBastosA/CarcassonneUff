import { boardSize, playerNames, tileNames } from '../tiles'
import type { BoardState, PlacedTile } from '../tiles'
import Tile from './Tile'

interface BoardProps {
  tiles: BoardState
  preview: PlacedTile | null
  onCellClick: (position: string) => void
}

export default function Board({ tiles, preview, onCellClick }: BoardProps) {
  return (
    <div className="board-scroll" role="region" aria-label="Área do tabuleiro" tabIndex={0}>
      <div className="board" role="group" aria-label="Tabuleiro de montagem livre">
        {Array.from({ length: boardSize * boardSize }, (_, index) => {
          const x = index % boardSize
          const y = Math.floor(index / boardSize)
          const position = `${x},${y}`
          const tile = tiles[position]
          const coordinate = `${String.fromCharCode(65 + x)}${y + 1}`
          const description = tile
            ? `${tileNames[tile.kind]}, ${tile.rotation} graus${tile.meeple ? `, meeple ${playerNames[tile.meeple]}` : ''}`
            : 'vazia'

          return (
            <button
              type="button" key={position} className="cell"
              aria-label={`${coordinate}: ${description}`} onClick={() => onCellClick(position)}
            >
              {tile ? <Tile {...tile} /> : <>
                <span className="cell-coordinate" aria-hidden="true">{coordinate}</span>
                {preview && <span className="cell-preview"><Tile {...preview} /></span>}
              </>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

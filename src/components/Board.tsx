import { useLayoutEffect, useRef, useState } from 'react'
import { boardSize, playerNames, tileNames } from '../tiles'
import type { BoardState, PlacedTile } from '../tiles'
import Tile from './Tile'

interface BoardProps {
  tiles: BoardState
  preview: PlacedTile | null
  onCellClick: (position: string) => void
}

export default function Board({ tiles, preview, onCellClick }: BoardProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(28)

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return

    const update = () => {
      const style = getComputedStyle(frame)
      const width = frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      setCellSize(Math.max(28, Math.floor(width / boardSize)))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="board-scroll" ref={frameRef} role="region" aria-label="Área do tabuleiro" tabIndex={0}>
      <div
        className="board" role="group" aria-label="Tabuleiro de montagem livre"
        style={{ gridTemplateColumns: `repeat(${boardSize}, ${cellSize}px)`, gridAutoRows: `${cellSize}px` }}
      >
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

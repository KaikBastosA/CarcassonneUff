import { useLayoutEffect, useRef, useState } from 'react'
import type { GameBoard } from '../game/board'
import { Position } from '../game/position'
import { boardSize, playerNames, tileNames } from '../tiles'
import type { PlacedTile, PlayerColor } from '../tiles'
import Tile from './Tile'

interface BoardProps {
  board: GameBoard
  meeples: Readonly<Record<string, PlayerColor>>
  validPositions: readonly Position[]
  preview: PlacedTile | null
  onCellClick: (position: Position) => void
}

export default function Board({ board, meeples, validPositions, preview, onCellClick }: BoardProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(28)
  const positions = board.placements.map(({ position }) => position)
  const radius = Math.floor(boardSize / 2)
  const minX = Math.min(-radius, ...positions.map(({ x }) => x - 1))
  const maxX = Math.max(radius, ...positions.map(({ x }) => x + 1))
  const minY = Math.min(-radius, ...positions.map(({ y }) => y - 1))
  const maxY = Math.max(radius, ...positions.map(({ y }) => y + 1))
  const columns = maxX - minX + 1
  const rows = maxY - minY + 1
  const validKeys = new Set(validPositions.map((position) => position.key))

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
        className="board" role="group" aria-label="Tabuleiro com validação de encaixes"
        style={{ gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`, gridAutoRows: `${cellSize}px` }}
      >
        {Array.from({ length: columns * rows }, (_, index) => {
          const x = minX + index % columns
          const y = minY + Math.floor(index / columns)
          const position = new Position(x, y)
          const tile = board.tileAt(position)
          const meeple = meeples[position.key]
          const valid = preview !== null && validKeys.has(position.key)
          const coordinate = `(${x},${y})`
          const description = tile
            ? `${tileNames[tile.kind]}, ${tile.rotation} graus${meeple ? `, meeple ${playerNames[meeple]}` : ''}`
            : `vazia${valid ? ', encaixe permitido' : ''}`

          return (
            <button
              type="button" key={position.key} className={`cell${valid ? ' cell-valid' : ''}`}
              aria-label={`${coordinate}: ${description}`} onClick={() => onCellClick(position)}
            >
              {tile ? <Tile {...tile} meeple={meeple} /> : <>
                <span className="cell-coordinate" aria-hidden="true">{coordinate}</span>
                {valid && preview && <span className="cell-preview"><Tile {...preview} /></span>}
              </>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

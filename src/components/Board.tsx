import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { boardSize, playerNames, tileImage, tileNames } from '../tiles'
import type { BoardState, PlacedTile } from '../tiles'
import Tile from './Tile'

interface BoardProps {
  tiles: BoardState
  preview: PlacedTile | null
  pendingPosition: string | null
  pendingColor: string
  placing: boolean
  onCellClick: (position: string) => void
}

export default function Board({ tiles, preview, pendingPosition, pendingColor, placing, onCellClick }: BoardProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const images = useRef(new Map<string, HTMLImageElement>())
  const sprites = useRef(new Map<string, HTMLCanvasElement>())
  const [cellSize, setCellSize] = useState(28)
  const [imageVersion, setImageVersion] = useState(0)
  const [previewCell, setPreviewCell] = useState<{ x: number; y: number } | null>(null)
  const [dpr] = useState(() => Math.min(window.devicePixelRatio || 1, 2))

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

  useEffect(() => {
    const sources = new Set(Object.values(tiles).map((tile) => tileImage(tile.kind, tile.rotation)))
    const jobs: Promise<void>[] = []
    let pending = false

    for (const src of sources) {
      let image = images.current.get(src)
      if (!image) {
        image = new Image()
        images.current.set(src, image)
        image.src = src
        pending = true
      }
      if (image.complete && image.naturalWidth > 0) continue
      pending = true
      jobs.push(image.decode().catch(() => {}))
    }

    if (!pending) return
    let active = true
    Promise.all(jobs).then(() => {
      if (active) setImageVersion((version) => version + 1)
    })
    return () => {
      active = false
    }
  }, [tiles])

  useLayoutEffect(() => {
    sprites.current.clear()
  }, [cellSize, dpr])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const size = cellSize * boardSize
    const width = size * dpr
    const height = size * dpr
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, size, size)

    const overlap = 2
    const full = cellSize + overlap * 2

    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        const tile = tiles[`${x},${y}`]
        if (!tile) continue
        const src = tileImage(tile.kind, tile.rotation)
        const image = images.current.get(src)
        if (!image?.complete || image.naturalWidth === 0) continue

        const key = `${src}|${cellSize}|${dpr}`
        let sprite = sprites.current.get(key)
        if (!sprite) {
          sprite = document.createElement('canvas')
          sprite.width = full * dpr
          sprite.height = full * dpr
          const spriteContext = sprite.getContext('2d')
          if (!spriteContext) continue
          spriteContext.scale(dpr, dpr)
          spriteContext.drawImage(image, 0, 0, full, full)

          const horizontal = spriteContext.createLinearGradient(0, 0, full, 0)
          horizontal.addColorStop(0, 'rgba(0, 0, 0, 0)')
          horizontal.addColorStop(overlap / full, 'rgba(0, 0, 0, 1)')
          horizontal.addColorStop(1 - overlap / full, 'rgba(0, 0, 0, 1)')
          horizontal.addColorStop(1, 'rgba(0, 0, 0, 0)')
          spriteContext.globalCompositeOperation = 'destination-in'
          spriteContext.fillStyle = horizontal
          spriteContext.fillRect(0, 0, full, full)

          const vertical = spriteContext.createLinearGradient(0, 0, 0, full)
          vertical.addColorStop(0, 'rgba(0, 0, 0, 0)')
          vertical.addColorStop(overlap / full, 'rgba(0, 0, 0, 1)')
          vertical.addColorStop(1 - overlap / full, 'rgba(0, 0, 0, 1)')
          vertical.addColorStop(1, 'rgba(0, 0, 0, 0)')
          spriteContext.fillStyle = vertical
          spriteContext.fillRect(0, 0, full, full)

          sprites.current.set(key, sprite)
        }

        context.drawImage(sprite, x * cellSize - overlap, y * cellSize - overlap, full, full)
      }
    }
  }, [tiles, cellSize, dpr, imageVersion])

  return (
    <div className="board-scroll" ref={frameRef} role="region" aria-label="Mesa de jogo" tabIndex={0}>
      <div
        className={`board${placing ? ' is-placing' : ''}`} role="group" aria-label="Tabuleiro"
        style={{ gridTemplateColumns: `repeat(${boardSize}, ${cellSize}px)`, gridAutoRows: `${cellSize}px` }}
      >
        <canvas ref={canvasRef} className="board-canvas" aria-hidden="true" />
        {Array.from({ length: boardSize * boardSize }, (_, index) => {
          const x = index % boardSize
          const y = Math.floor(index / boardSize)
          const position = `${x},${y}`
          const tile = tiles[position]
          const coordinate = `${String.fromCharCode(65 + x)}${y + 1}`
          const pending = position === pendingPosition
          const description = tile
            ? `${tileNames[tile.kind]}, ${tile.rotation} graus${tile.meeple ? `, meeple ${playerNames[tile.meeple]}` : ''}`
            : 'vazia'

          return (
            <button
              type="button" key={position}
              className={`cell${tile ? ' filled' : ''}${pending ? ' pending' : ''}`}
              style={pending ? { boxShadow: `inset 0 0 0 2px ${pendingColor}` } : undefined}
              aria-label={`${coordinate}: ${description}`}
              onMouseEnter={() => { if (!tile && preview) setPreviewCell({ x, y }) }}
              onMouseLeave={() => setPreviewCell((current) => current?.x === x && current.y === y ? null : current)}
              onFocus={() => { if (!tile && preview) setPreviewCell({ x, y }) }}
              onBlur={() => setPreviewCell((current) => current?.x === x && current.y === y ? null : current)}
              onClick={() => {
                setPreviewCell(null)
                onCellClick(position)
              }}
            >
              {tile?.meeple && <Tile {...tile} art={false} />}
            </button>
          )
        })}
        {preview && previewCell && !tiles[`${previewCell.x},${previewCell.y}`] && (
          <span
            className="board-preview"
            style={{ left: previewCell.x * cellSize, top: previewCell.y * cellSize, width: cellSize, height: cellSize }}
          >
            <Tile {...preview} />
          </span>
        )}
      </div>
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import { meepleFilter, meepleImage } from './Meeple'
import { shieldImage, tileImage } from '../tiles'
import { drawTileImage } from '../game/rendering'
import type { Position } from '../game/position'
import type { RenderBoard, PlacedTile } from '../tiles'
import { TileInstance } from '../game/tiles'
import type { FollowerChoice } from '../game/actions'

interface BoardProps {
  tiles: RenderBoard
  preview: PlacedTile | null
  pendingPosition: string | null
  pendingColor: string
  placing: boolean
  validPositions: readonly Position[]
  unfillablePositions: readonly Position[]
  warnings: ReadonlyMap<string, readonly Position[]>
  followerChoices: readonly FollowerChoice[]
  theme: 'light' | 'dark'
  onCellClick: (position: string, regionId?: string) => void
}

interface Camera {
  x: number
  y: number
  zoom: number
}

interface Drag {
  id: number
  startX: number
  startY: number
  camera: Camera
  moved: boolean
}

interface Insets {
  top: number
  bottom: number
  left: number
  right: number
}

const BASE_CELL = 96
const SPRITE_SIZE = 268
const SPRITE_FEATHER = (2 / 100) * SPRITE_SIZE
const MIN_ZOOM = 0.35
const MAX_ZOOM = 2.6
const FIT_MAX_ZOOM = 1.2
const FIT_MAX_ZOOM_MOBILE = 1.7
const MOVE_THRESHOLD = 4
const SAFE_GUTTER = 8
const MIN_SAFE = 160
const SAFE_TARGETS = ['.game-header', '.ledger', '.turn'] as const

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

// A área visível do tabuleiro é o que sobra dos painéis sobrepostos. Medir é mais
// confiável do que manter faixas fixas no CSS: o painel da jogada muda de altura
// entre as fases e entre retrato/paisagem.
function measureSafeInsets(): Insets {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const insets: Insets = { top: 0, bottom: 0, left: 0, right: 0 }

  const reserve = (element: Element | null) => {
    if (!(element instanceof HTMLElement)) return
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    if (rect.width >= viewportWidth * 0.6) {
      if (rect.top + rect.height / 2 <= viewportHeight / 2) {
        insets.top = Math.max(insets.top, rect.bottom)
      } else {
        insets.bottom = Math.max(insets.bottom, viewportHeight - rect.top)
      }
      return
    }
    if (rect.left + rect.width / 2 >= viewportWidth / 2) {
      insets.right = Math.max(insets.right, viewportWidth - rect.left)
    } else {
      insets.left = Math.max(insets.left, rect.left + rect.width)
    }
  }

  for (const selector of SAFE_TARGETS) reserve(document.querySelector(selector))

  const controls = document.querySelector('.board-controls')
  if (controls instanceof HTMLElement) {
    const rect = controls.getBoundingClientRect()
    if (rect.width >= rect.height) {
      insets.bottom = Math.max(insets.bottom, viewportHeight - rect.top)
    } else if (rect.left + rect.width / 2 >= viewportWidth / 2) {
      insets.right = Math.max(insets.right, viewportWidth - rect.left)
    } else {
      insets.left = Math.max(insets.left, rect.left + rect.width)
    }
  }

  return {
    top: insets.top ? insets.top + SAFE_GUTTER : 0,
    bottom: insets.bottom ? insets.bottom + SAFE_GUTTER : 0,
    left: insets.left ? insets.left + SAFE_GUTTER : 0,
    right: insets.right ? insets.right + SAFE_GUTTER : 0,
  }
}

export default function Board({
  tiles,
  preview,
  pendingPosition,
  pendingColor,
  placing,
  validPositions,
  unfillablePositions,
  warnings,
  followerChoices,
  theme,
  onCellClick,
}: BoardProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const images = useRef(new Map<string, HTMLImageElement>())
  const sprites = useRef(new Map<string, HTMLCanvasElement>())
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const tilesRef = useRef(tiles)
  const drag = useRef<Drag | null>(null)
  const didFit = useRef(false)
  const safeCenter = useRef<{ x: number; y: number } | null>(null)
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 })
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null)
  const [imageVersion, setImageVersion] = useState(0)
  const [dpr] = useState(() => Math.min(window.devicePixelRatio || 1, 2))
  const validKeys = new Set<string>(validPositions.map((position) => position.key))
  const hoverWarning = hoverCell ? warnings.get(`${hoverCell.x},${hoverCell.y}`) : undefined
  const warningText = hoverWarning
    ? `Jogada permitida, mas deixa ${hoverWarning.map(({ x, y }) => `(${x},${y})`).join(', ')} sem encaixe no catálogo.`
    : undefined

  tilesRef.current = tiles

  function applyCamera(next: Camera) {
    cameraRef.current = next
    setCamera(next)
  }

  function cellAt(clientX: number, clientY: number) {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const rect = stage.getBoundingClientRect()
    const current = cameraRef.current
    return {
      x: Math.floor((clientX - rect.left - current.x) / (BASE_CELL * current.zoom)),
      y: Math.floor((clientY - rect.top - current.y) / (BASE_CELL * current.zoom)),
    }
  }

  function safeBox(stage: HTMLDivElement) {
    const insets = measureSafeInsets()
    const safeWidth = Math.max(MIN_SAFE, stage.clientWidth - insets.left - insets.right)
    const safeHeight = Math.max(MIN_SAFE, stage.clientHeight - insets.top - insets.bottom)
    return {
      safeWidth,
      safeHeight,
      centerX: insets.left + safeWidth / 2,
      centerY: insets.top + safeHeight / 2,
    }
  }

  function fitView() {
    const stage = stageRef.current
    if (!stage) return
    const { safeWidth, safeHeight, centerX, centerY } = safeBox(stage)
    safeCenter.current = { x: centerX, y: centerY }
    const cells = Object.keys(tilesRef.current).map((key) => key.split(',').map(Number))
    const minX = cells.length ? Math.min(...cells.map(([x]) => x)) : -1
    const maxX = cells.length ? Math.max(...cells.map(([x]) => x)) : 1
    const minY = cells.length ? Math.min(...cells.map(([, y]) => y)) : -1
    const maxY = cells.length ? Math.max(...cells.map(([, y]) => y)) : 1
    const cellsW = maxX - minX + 1
    const cellsH = maxY - minY + 1
    const zoom = clamp(
      Math.min(safeWidth / (cellsW * BASE_CELL), safeHeight / (cellsH * BASE_CELL)),
      MIN_ZOOM,
      window.innerWidth <= 720 ? FIT_MAX_ZOOM_MOBILE : FIT_MAX_ZOOM,
    )
    applyCamera({
      zoom,
      x: centerX - (minX + cellsW / 2) * BASE_CELL * zoom,
      y: centerY - (minY + cellsH / 2) * BASE_CELL * zoom,
    })
  }

  // Reenquadrar o tabuleiro a cada mudança de altura do painel seria um solavanco no
  // zoom do jogador. Aqui só deslocamos a câmera para o centro da nova área visível.
  function relayout() {
    const stage = stageRef.current
    if (!stage) return
    setViewport((current) => (
      current.width === stage.clientWidth && current.height === stage.clientHeight
        ? current
        : { width: stage.clientWidth, height: stage.clientHeight }
    ))
    if (!didFit.current) {
      didFit.current = true
      fitView()
      return
    }
    const { centerX, centerY } = safeBox(stage)
    const previous = safeCenter.current
    safeCenter.current = { x: centerX, y: centerY }
    if (!previous) return
    const dx = centerX - previous.x
    const dy = centerY - previous.y
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return
    const current = cameraRef.current
    applyCamera({ zoom: current.zoom, x: current.x + dx, y: current.y + dy })
  }

  function zoomBy(factor: number) {
    const stage = stageRef.current
    if (!stage) return
    const current = cameraRef.current
    const zoom = clamp(current.zoom * factor, MIN_ZOOM, MAX_ZOOM)
    const centerX = stage.clientWidth / 2
    const centerY = stage.clientHeight / 2
    const worldX = (centerX - current.x) / (BASE_CELL * current.zoom)
    const worldY = (centerY - current.y) / (BASE_CELL * current.zoom)
    applyCamera({
      zoom,
      x: centerX - worldX * BASE_CELL * zoom,
      y: centerY - worldY * BASE_CELL * zoom,
    })
  }

  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const observer = new ResizeObserver(() => relayout())
    observer.observe(stage)
    for (const selector of SAFE_TARGETS) {
      const panel = document.querySelector(selector)
      if (panel) observer.observe(panel)
    }
    const controls = document.querySelector('.board-controls')
    if (controls) observer.observe(controls)
    return () => observer.disconnect()
  }, [])

  // O painel da jogada muda de altura ao trocar de fase. Medir aqui (antes do paint)
  // evita o frame em que o tabuleiro fica atrás do painel esperando o ResizeObserver.
  useLayoutEffect(() => {
    if (drag.current) return
    relayout()
  })

  useEffect(() => {
    const sources = new Set<string>()
    for (const tile of Object.values(tiles)) {
      sources.add(tileImage(tile.kind))
      if (tile.variant === 'shield') sources.add(shieldImage)
      if (tile.meeple) sources.add(meepleImage(tile.meeple))
    }
    if (preview) sources.add(tileImage(preview.kind))
    if (preview?.variant === 'shield') sources.add(shieldImage)

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
  }, [tiles, preview])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const current = cameraRef.current
      const rect = stage.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const zoom = clamp(current.zoom * Math.exp(-event.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM)
      const worldX = (pointerX - current.x) / (BASE_CELL * current.zoom)
      const worldY = (pointerY - current.y) / (BASE_CELL * current.zoom)
      applyCamera({
        zoom,
        x: pointerX - worldX * BASE_CELL * zoom,
        y: pointerY - worldY * BASE_CELL * zoom,
      })
    }

    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [])

  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || viewport.width === 0 || viewport.height === 0) return
    const width = Math.round(viewport.width * dpr)
    const height = Math.round(viewport.height * dpr)
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) return
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, viewport.width, viewport.height)

    const cellPx = BASE_CELL * camera.zoom
    const featherPx = 2 * camera.zoom
    const drawPx = cellPx + featherPx * 2
    const drawShields = (tile: PlacedTile, screenX: number, screenY: number) => {
      if (tile.variant !== 'shield') return
      const image = images.current.get(shieldImage)
      if (!image?.complete || image.naturalWidth === 0) return
      const markers = new TileInstance('view', tile.kind, tile.rotation, tile.variant).shieldMarkers
      const size = cellPx * 0.22
      for (const anchor of markers) drawTileImage(context, image, screenX + anchor.x * cellPx - size / 2,
        screenY + anchor.y * cellPx - size / 2, size, tile.rotation)
    }

    if (placing) {
      const offsetX = ((camera.x % cellPx) + cellPx) % cellPx
      const offsetY = ((camera.y % cellPx) + cellPx) % cellPx
      context.beginPath()
      context.strokeStyle = theme === 'dark' ? 'rgba(243, 237, 225, 0.075)' : 'rgba(45, 43, 36, 0.07)'
      context.lineWidth = 1
      for (let x = offsetX; x < viewport.width; x += cellPx) {
        const line = Math.round(x) + 0.5
        context.moveTo(line, 0)
        context.lineTo(line, viewport.height)
      }
      for (let y = offsetY; y < viewport.height; y += cellPx) {
        const line = Math.round(y) + 0.5
        context.moveTo(0, line)
        context.lineTo(viewport.width, line)
      }
      context.stroke()
    }

    const highlight = (position: Position, color: string, marker = '') => {
      const x = camera.x + position.x * cellPx
      const y = camera.y + position.y * cellPx
      context.save()
      context.fillStyle = color
      context.fillRect(x + 1, y + 1, cellPx - 2, cellPx - 2)
      if (marker) {
        context.fillStyle = theme === 'dark' ? '#f0eadb' : '#79532f'
        context.font = `600 ${Math.max(14, cellPx * 0.25)}px sans-serif`
        context.textAlign = 'right'
        context.fillText(marker, x + cellPx - 6, y + cellPx - 6)
      }
      context.restore()
    }

    if (placing) {
      for (const position of validPositions) {
        const risky = warnings.has(position.key)
        highlight(position, risky ? 'rgba(201, 154, 46, 0.3)' : 'rgba(111, 153, 86, 0.22)', risky ? '!' : '')
      }
    }
    for (const position of unfillablePositions) highlight(position, 'rgba(184, 79, 61, 0.25)', '×')

    const getSprite = (src: string) => {
      const cached = sprites.current.get(src)
      if (cached) return cached
      const image = images.current.get(src)
      if (!image?.complete || image.naturalWidth === 0) return null
      const sprite = document.createElement('canvas')
      sprite.width = SPRITE_SIZE * dpr
      sprite.height = SPRITE_SIZE * dpr
      const spriteContext = sprite.getContext('2d')
      if (!spriteContext) return null
      spriteContext.scale(dpr, dpr)
      spriteContext.drawImage(image, 0, 0, SPRITE_SIZE, SPRITE_SIZE)

      const horizontal = spriteContext.createLinearGradient(0, 0, SPRITE_SIZE, 0)
      horizontal.addColorStop(0, 'rgba(0, 0, 0, 0)')
      horizontal.addColorStop(SPRITE_FEATHER / SPRITE_SIZE, 'rgba(0, 0, 0, 1)')
      horizontal.addColorStop(1 - SPRITE_FEATHER / SPRITE_SIZE, 'rgba(0, 0, 0, 1)')
      horizontal.addColorStop(1, 'rgba(0, 0, 0, 0)')
      spriteContext.globalCompositeOperation = 'destination-in'
      spriteContext.fillStyle = horizontal
      spriteContext.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)

      const vertical = spriteContext.createLinearGradient(0, 0, 0, SPRITE_SIZE)
      vertical.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vertical.addColorStop(SPRITE_FEATHER / SPRITE_SIZE, 'rgba(0, 0, 0, 1)')
      vertical.addColorStop(1 - SPRITE_FEATHER / SPRITE_SIZE, 'rgba(0, 0, 0, 1)')
      vertical.addColorStop(1, 'rgba(0, 0, 0, 0)')
      spriteContext.fillStyle = vertical
      spriteContext.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)

      sprites.current.set(src, sprite)
      return sprite
    }

    const entries = Object.entries(tiles)
      .map(([key, tile]) => {
        const [x, y] = key.split(',').map(Number)
        return { x, y, tile }
      })
      .sort((a, b) => a.y - b.y || a.x - b.x)

    for (const { x, y, tile } of entries) {
      const screenX = camera.x + x * cellPx
      const screenY = camera.y + y * cellPx
      if (screenX > viewport.width + drawPx || screenY > viewport.height + drawPx) continue
      if (screenX + cellPx < -drawPx || screenY + cellPx < -drawPx) continue
      const sprite = getSprite(tileImage(tile.kind))
      if (!sprite) continue
      drawTileImage(context, sprite, screenX - featherPx, screenY - featherPx, drawPx, tile.rotation)
      drawShields(tile, screenX, screenY)
    }

    for (const { x, y, tile } of entries) {
      if (!tile.meeple) continue
      const image = images.current.get(meepleImage(tile.meeple))
      if (!image?.complete || image.naturalWidth === 0) continue
      const screenX = camera.x + x * cellPx
      const screenY = camera.y + y * cellPx
      const region = new TileInstance('view', tile.kind, tile.rotation, tile.variant).regions.find((item) => item.id === tile.meepleRegion)
      const anchor = region?.anchor ?? { x: 0.5, y: 0.5 }
      const meeplePx = cellPx * 0.3
      context.save()
      context.filter = meepleFilter(tile.meeple)
      drawTileImage(context, image, screenX + anchor.x * cellPx - meeplePx / 2,
        screenY + anchor.y * cellPx - meeplePx / 2, meeplePx, region?.terrain === 'field' ? 90 : 0)
      context.restore()
    }

    if (pendingPosition) {
      const [pendingX, pendingY] = pendingPosition.split(',').map(Number)
      const screenX = camera.x + pendingX * cellPx
      const screenY = camera.y + pendingY * cellPx
      context.lineWidth = 3
      context.strokeStyle = theme === 'dark' ? 'rgba(247, 241, 229, 0.5)' : 'rgba(255, 252, 244, 0.8)'
      context.strokeRect(screenX + 1.5, screenY + 1.5, cellPx - 3, cellPx - 3)
      context.lineWidth = 2
      context.strokeStyle = pendingColor
      context.strokeRect(screenX + 1.5, screenY + 1.5, cellPx - 3, cellPx - 3)
      for (const [index, choice] of followerChoices.entries()) {
        if (choice.selected) continue
        const x = screenX + choice.anchor.x * cellPx
        const y = screenY + choice.anchor.y * cellPx
        context.save()
        context.beginPath()
        context.arc(x, y, Math.max(6, cellPx * 0.09), 0, Math.PI * 2)
        context.fillStyle = choice.available ? '#526846' : '#6c6c68'
        context.fill()
        context.fillStyle = '#fffef9'
        context.font = `600 ${Math.max(9, cellPx * 0.12)}px sans-serif`
        context.textAlign = 'center'
        context.textBaseline = 'middle'
        context.fillText(String(index + 1), x, y)
        context.restore()
      }
    }

    if (placing && preview && hoverCell) {
      const key = `${hoverCell.x},${hoverCell.y}`
      if (!tiles[key] && validKeys.has(key)) {
        const image = images.current.get(tileImage(preview.kind))
        if (image?.complete && image.naturalWidth > 0) {
          const screenX = camera.x + hoverCell.x * cellPx
          const screenY = camera.y + hoverCell.y * cellPx
          context.globalAlpha = 0.55
          drawTileImage(context, image, screenX, screenY, cellPx, preview.rotation)
          drawShields(preview, screenX, screenY)
          context.globalAlpha = 1
        }
      }
    }
  }, [tiles, preview, pendingPosition, pendingColor, placing, validPositions, unfillablePositions, warnings, followerChoices, theme, camera, viewport, imageVersion, dpr, hoverCell])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const stage = stageRef.current
    if (!stage) return
    drag.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      camera: cameraRef.current,
      moved: false,
    }
    stage.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (current && current.id === event.pointerId) {
      const dx = event.clientX - current.startX
      const dy = event.clientY - current.startY
      if (!current.moved && Math.hypot(dx, dy) > MOVE_THRESHOLD) current.moved = true
      if (current.moved) {
        applyCamera({ ...current.camera, x: current.camera.x + dx, y: current.camera.y + dy })
      }
      return
    }
    if (!placing) {
      setHoverCell((cell) => (cell ? null : cell))
      return
    }
    const cell = cellAt(event.clientX, event.clientY)
    setHoverCell((currentCell) => (
      currentCell?.x === cell.x && currentCell.y === cell.y ? currentCell : cell
    ))
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.id !== event.pointerId) return
    drag.current = null
    const stage = stageRef.current
    if (stage?.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId)
    if (current.moved) return
    const cell = cellAt(event.clientX, event.clientY)
    const key = `${cell.x},${cell.y}`
    if (!placing && key === pendingPosition && stage) {
      const rect = stage.getBoundingClientRect()
      const { x, y, zoom } = cameraRef.current
      const localX = (event.clientX - rect.left - x) / (BASE_CELL * zoom) - cell.x
      const localY = (event.clientY - rect.top - y) / (BASE_CELL * zoom) - cell.y
      const nearest = followerChoices.map((choice) => ({
        choice, distance: Math.hypot(choice.anchor.x - localX, choice.anchor.y - localY),
      })).sort((a, b) => a.distance - b.distance)[0]
      if (nearest && nearest.distance <= 0.16) {
        onCellClick(key, nearest.choice.id)
        return
      }
    }
    onCellClick(key)
  }

  function handlePointerCancel() {
    drag.current = null
    setHoverCell(null)
  }

  return (
    <>
      <div
        className="board-stage" ref={stageRef}
        role="region" aria-label="Mesa de Carcassonne"
        title={placing ? warningText : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => { if (!drag.current) setHoverCell(null) }}
      >
        <canvas ref={canvasRef} className="board-canvas" aria-hidden="true" />
      </div>
      <div className="board-controls" role="group" aria-label="Zoom e navegação">
        <button type="button" className="zoom-button" onClick={() => zoomBy(1 / 1.25)} aria-label="Diminuir zoom">
          <Minus size={15} aria-hidden="true" />
        </button>
        <span className="zoom-value">{Math.round(camera.zoom * 100)}%</span>
        <button type="button" className="zoom-button" onClick={() => zoomBy(1.25)} aria-label="Aumentar zoom">
          <Plus size={15} aria-hidden="true" />
        </button>
        <span className="zoom-divider" aria-hidden="true" />
        <button type="button" className="zoom-button" onClick={fitView} aria-label="Centralizar mesa">
          <LocateFixed size={15} aria-hidden="true" />
        </button>
      </div>
      <p className="board-hint">{placing && warningText ? warningText : 'Arraste para mover · scroll para zoom'}</p>
    </>
  )
}

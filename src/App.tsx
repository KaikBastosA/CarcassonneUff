import { useState } from 'react'
import Board from './components/Board'
import Meeple from './components/Meeple'
import Tile from './components/Tile'
import { GameBoard, placementMessages } from './game/board'
import { Position } from './game/position'
import { TileInstance } from './game/tiles'
import { playerNames, tileKinds, tileNames } from './tiles'
import type { PlayerColor, Rotation, TileKind } from './tiles'

type Tool = 'tile' | 'meeple'
interface BoardSnapshot {
  board: GameBoard
  meeples: Readonly<Record<string, PlayerColor>>
}

const initialSnapshot: BoardSnapshot = {
  board: new GameBoard().place(new TileInstance('start', 'city-road'), new Position(0, 0)),
  meeples: {},
}
const playerColors: PlayerColor[] = ['blue', 'red', 'yellow', 'black']

export default function App() {
  const [history, setHistory] = useState<BoardSnapshot[]>([initialSnapshot])
  const [kind, setKind] = useState<TileKind>('road')
  const [rotation, setRotation] = useState<Rotation>(0)
  const [color, setColor] = useState<PlayerColor>('blue')
  const [tool, setTool] = useState<Tool>('tile')
  const [message, setMessage] = useState('')
  const snapshot = history[history.length - 1]
  const { board, meeples } = snapshot
  const selectedTile = new TileInstance('preview', kind, rotation)
  const validPositions = board.getValidPositions(selectedTile)
  const unfillablePositions = board.getUnfillablePositions()
  const warnings = new Map(validPositions.flatMap((position) => {
    const affected = board.getNewUnfillablePositions(selectedTile, position)
    return affected.length > 0 ? [[position.key, affected] as const] : []
  }))
  const count = board.size

  function save(next: BoardSnapshot) {
    setHistory((previous) => [...previous, next])
    setMessage('')
  }

  function editCell(position: Position) {
    const current = board.tileAt(position)

    if (tool === 'meeple') {
      if (!current) return
      const next = { ...meeples }
      if (next[position.key] === color) delete next[position.key]
      else next[position.key] = color
      save({ board, meeples: next })
    } else {
      const tile = new TileInstance(`tile-${position.key}`, kind, rotation)
      const validation = board.validatePlacement(tile, position)
      if (!validation.valid) {
        setMessage(placementMessages[validation.reason])
        return
      }
      save({ board: board.place(tile, position), meeples })
      const affected = warnings.get(position.key)
      if (affected) {
        setMessage(`Peça colocada. Sem encaixe no catálogo: ${affected.map(({ x, y }) => `(${x},${y})`).join(', ')}. Essa jogada é permitida.`)
      }
    }
  }

  return (
    <main className="app">
      <header className="header">
        <h1>Carcassonne</h1>
        <span className="project-name">Projeto de Software - UFF</span>
      </header>

      <div className="workspace">
        <aside className="tools" aria-label="Ferramentas de montagem">
          <section aria-labelledby="pieces-heading">
            <h2 id="pieces-heading">Peças</h2>
            <div className="tile-picker">
              {tileKinds.map((tileKind) => (
                <button type="button" key={tileKind} className="tile-option"
                  aria-pressed={tool === 'tile' && kind === tileKind}
                  onClick={() => {
                    setKind(tileKind)
                    setRotation(0)
                    setTool('tile')
                    setMessage('')
                  }}>
                  <Tile kind={tileKind} rotation={0} />
                  <span>{tileNames[tileKind]}</span>
                </button>
              ))}
            </div>
            <div className="current-tile">
              <Tile kind={kind} rotation={rotation} />
              <div>
                <span>{rotation}°</span>
                <button type="button" onClick={() => {
                  setRotation((angle) => ((angle + 90) % 360) as Rotation)
                  setTool('tile')
                  setMessage('')
                }}>Girar peça ↻</button>
              </div>
            </div>
          </section>
          <section aria-labelledby="meeples-heading">
            <h2 id="meeples-heading">Meeples</h2>
            <div className="meeple-picker">
              {playerColors.map((playerColor) => (
                <button type="button" key={playerColor} aria-label={`Meeple ${playerNames[playerColor]}`}
                  aria-pressed={tool === 'meeple' && color === playerColor}
                  onClick={() => {
                    setColor(playerColor)
                    setTool('meeple')
                    setMessage('')
                  }}>
                  <Meeple color={playerColor} />
                </button>
              ))}
            </div>
            <p className="tool-help">Selecione uma cor e clique em uma peça.</p>
          </section>

        </aside>

        <section className="table" aria-label="Montagem do tabuleiro">
          <div className="board-toolbar">
            <span>{count} {count === 1 ? 'peça' : 'peças'} no tabuleiro</span>
            <div className="board-actions">
              <button type="button" disabled={history.length === 1} onClick={() => {
                setHistory((previous) => previous.slice(0, -1))
                setMessage('')
              }}>Desfazer</button>
              <button type="button" onClick={() => {
                save(initialSnapshot)
              }}>Reiniciar</button>
            </div>
          </div>
          <p className="board-status" role="status">{message || (tool === 'tile'
            ? `${validPositions.length} posições válidas para ${tileNames[kind]} a ${rotation}°. Gire a peça para testar outras orientações.${unfillablePositions.length > 0 ? ` ${unfillablePositions.length} espaços sem encaixe no catálogo.` : ''}`
            : 'Meeples livres para teste: clique em uma peça para colocar ou remover a cor selecionada.')}</p>
          <p className="board-legend">Verde: encaixe válido · Amarelo: cria espaço sem encaixe · ×: sem peça compatível no catálogo</p>
          <Board board={board} meeples={meeples} validPositions={validPositions}
            unfillablePositions={unfillablePositions} warnings={warnings}
            preview={tool === 'tile' ? { kind, rotation } : null} onCellClick={editCell} />
        </section>
      </div>

    </main>
  )
}

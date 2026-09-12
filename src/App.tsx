import { useState } from 'react'
import Board from './components/Board'
import Meeple from './components/Meeple'
import Tile from './components/Tile'
import { initialBoard, playerNames, tileKinds, tileNames } from './tiles'
import type { BoardState, PlayerColor, Rotation, TileKind } from './tiles'

type Tool = 'tile' | 'meeple' | 'erase'
const playerColors: PlayerColor[] = ['blue', 'red', 'yellow', 'black']

export default function App() {
  const [history, setHistory] = useState<BoardState[]>([initialBoard])
  const [kind, setKind] = useState<TileKind>('road')
  const [rotation, setRotation] = useState<Rotation>(0)
  const [color, setColor] = useState<PlayerColor>('blue')
  const [tool, setTool] = useState<Tool>('tile')
  const tiles = history[history.length - 1]
  const count = Object.keys(tiles).length

  function save(next: BoardState) {
    setHistory((previous) => [...previous, next])
  }

  function editCell(position: string) {
    const current = tiles[position]

    if (tool === 'erase') {
      if (!current) return
      const next = { ...tiles }
      delete next[position]
      save(next)
    } else if (tool === 'meeple') {
      if (!current) return
      const meeple = current.meeple === color ? undefined : color
      save({ ...tiles, [position]: { ...current, meeple } })
    } else {
      if (current) return
      save({ ...tiles, [position]: { kind, rotation } })
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
                  }}>
                  <Meeple color={playerColor} />
                </button>
              ))}
            </div>
            <p className="tool-help">Selecione uma cor e clique em uma peça.</p>
          </section>

          <button type="button" className="erase-button" aria-pressed={tool === 'erase'} onClick={() => {
            setTool('erase')
          }}>Apagar peça</button>
        </aside>

        <section className="table" aria-label="Montagem do tabuleiro">
          <div className="board-toolbar">
            <span>{count} {count === 1 ? 'peça' : 'peças'} no tabuleiro</span>
            <div className="board-actions">
              <button type="button" disabled={history.length === 1} onClick={() => {
                setHistory((previous) => previous.slice(0, -1))
              }}>Desfazer</button>
              <button type="button" disabled={count === 0} onClick={() => {
                save({})
              }}>Limpar</button>
            </div>
          </div>
          <Board tiles={tiles} preview={tool === 'tile' ? { kind, rotation } : null} onCellClick={editCell} />
        </section>
      </div>

    </main>
  )
}

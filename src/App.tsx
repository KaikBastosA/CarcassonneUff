import { useState } from 'react'
import Board from './components/Board'
import PlayerLedger from './components/PlayerLedger'
import RoomHeader from './components/RoomHeader'
import TurnPanel from './components/TurnPanel'
import { playerHex, roomCode } from './game'
import { useGame } from './useGame'
import type { PlacedTile } from './tiles'

export default function App() {
  const { state, rotate, place, toggleMeeple, undoPlacement, confirm } = useGame()
  const [copied, setCopied] = useState(false)
  const player = state.players[state.currentPlayerIndex]
  const pendingTile = state.pendingPosition ? state.board[state.pendingPosition] : undefined
  const preview: PlacedTile | null = state.phase === 'place'
    ? { kind: state.currentKind, rotation: state.rotation }
    : null

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}?sala=${roomCode}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  function handleCell(position: string) {
    if (state.phase === 'place') {
      place(position)
      return
    }
    if (position === state.pendingPosition) toggleMeeple()
  }

  return (
    <main className="app">
      <RoomHeader
        players={state.players} roomCode={roomCode}
        copied={copied} onCopyInvite={copyInvite}
      />
      <div className="game">
        <PlayerLedger
          players={state.players} currentPlayerId={player.id}
          activity={state.activity} round={state.round}
          copied={copied} onCopyInvite={copyInvite}
        />
        <section className="table-column" aria-label="Mesa">
          <div className="table-head">
            <div>
              <h2>Mesa</h2>
              <span>Rodada {state.round} · {Object.keys(state.board).length} peças</span>
            </div>
            <span className="table-turn">
              <span className="turn-dot" style={{ background: playerHex[player.color] }} aria-hidden="true" />
              {player.local ? 'Sua vez' : `Vez de ${player.name}`}
            </span>
          </div>
          <Board
            tiles={state.board}
            preview={preview}
            pendingPosition={state.pendingPosition}
            pendingColor={playerHex[player.color]}
            placing={state.phase === 'place'}
            onCellClick={handleCell}
          />
        </section>
        <TurnPanel
          player={player}
          phase={state.phase}
          kind={state.currentKind}
          rotation={state.rotation}
          deckCount={state.deck.length - state.deckIndex}
          pendingMeeple={Boolean(pendingTile?.meeple)}
          onRotate={rotate}
          onToggleMeeple={toggleMeeple}
          onUndo={undoPlacement}
          onConfirm={confirm}
        />
      </div>
      <footer className="app-footer">
        <span>Projeto de Software · UFF</span>
        <span>Prévia de interface · regras e rede ainda não implementadas</span>
      </footer>
    </main>
  )
}

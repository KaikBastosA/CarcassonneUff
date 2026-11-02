import { useEffect, useState } from 'react'
import Board from './components/Board'
import PlayerLedger from './components/PlayerLedger'
import RoomHeader from './components/RoomHeader'
import TurnPanel from './components/TurnPanel'
import { playerHex, roomCode } from './game'
import { themeStorageKey } from './theme'
import type { Theme } from './theme'
import { useGame } from './useGame'
import type { PlacedTile } from './tiles'

export default function App() {
  const { state, rotate, place, toggleMeeple, undoPlacement, confirm } = useGame()
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  ))
  const player = state.players[state.currentPlayerIndex]
  const pendingTile = state.pendingPosition ? state.board[state.pendingPosition] : undefined
  const preview: PlacedTile | null = state.phase === 'place'
    ? { kind: state.currentKind, rotation: state.rotation }
    : null

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(themeStorageKey, theme)
  }, [theme])

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

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  return (
    <main className="app">
      <Board
        tiles={state.board}
        preview={preview}
        pendingPosition={state.pendingPosition}
        pendingColor={playerHex[player.color]}
        placing={state.phase === 'place'}
        theme={theme}
        onCellClick={handleCell}
      />
      <RoomHeader
        players={state.players} theme={theme}
        onToggleTheme={toggleTheme}
      />
      <PlayerLedger
        players={state.players} currentPlayerId={player.id}
        activity={state.activity} round={state.round}
        copied={copied} onCopyInvite={copyInvite}
      />
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
      <p className="app-note">Projeto de Software · UFF<br />Prévia local · regras e rede ainda não implementadas</p>
    </main>
  )
}

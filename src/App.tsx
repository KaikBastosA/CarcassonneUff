import { useEffect, useMemo, useState } from 'react'
import Board from './components/Board'
import PlayerLedger from './components/PlayerLedger'
import RoomHeader from './components/RoomHeader'
import TurnPanel from './components/TurnPanel'
import GameSetup from './components/GameSetup'
import { playerHex, roomCode } from './game'
import { themeStorageKey } from './theme'
import type { Theme } from './theme'
import { useGame } from './useGame'
import { TileInstance } from './game/tiles'
import { getFollowerChoices } from './game/actions'
import type { PlacedTile } from './tiles'

export default function App() {
  const { state, configuration, start, rotate, place, selectFollower, undoPlacement, confirm, newGame } = useGame()
  const [copied, setCopied] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  ))
  const player = state.players[state.currentPlayerIndex]
  const pendingTile = state.pendingPosition ? state.board[state.pendingPosition] : undefined
  const followerChoices = getFollowerChoices(state)
  const drawn = state.deck[state.deckIndex]
  const preview: PlacedTile | null = state.phase === 'place' && drawn
    ? { kind: drawn.kind, rotation: state.rotation, variant: drawn.variant }
    : null
  const { validPositions, unfillablePositions, warnings } = useMemo(() => {
    const unfillablePositions = state.model.getUnfillablePositions()
    if (!drawn || state.phase !== 'place') return { validPositions: [], unfillablePositions, warnings: new Map() }
    const tile = new TileInstance(drawn.id, drawn.kind, state.rotation, drawn.variant)
    const validPositions = state.model.getValidPositions(tile)
    const warnings = new Map(validPositions.flatMap((position) => {
      const affected = state.model.getNewUnfillablePositions(tile, position)
      return affected.length > 0 ? [[position.key, affected] as const] : []
    }))
    return { validPositions, unfillablePositions, warnings }
  }, [state.model, drawn, state.rotation, state.phase])

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

  function handleCell(position: string, regionId?: string) {
    if (state.phase === 'place') {
      place(position)
      return
    }
    if (position === state.pendingPosition && regionId) selectFollower(regionId)
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  if (state.phase === 'configure') return (
    <main className="app">
      <RoomHeader players={state.players} theme={theme} onToggleTheme={toggleTheme} onNewGame={newGame} />
      <GameSetup configuration={configuration} message={state.message} onStart={start} />
    </main>
  )

  return (
    <main className="app">
      <Board
        tiles={state.board}
        preview={preview}
        pendingPosition={state.pendingPosition}
        pendingColor={playerHex[player.color]}
        placing={state.phase === 'place'}
        validPositions={validPositions}
        unfillablePositions={unfillablePositions}
        warnings={warnings}
        followerChoices={followerChoices}
        theme={theme}
        onCellClick={handleCell}
      />
      <RoomHeader
        players={state.players} theme={theme}
        onToggleTheme={toggleTheme}
        onNewGame={newGame}
      />
      <PlayerLedger
        players={state.players} currentPlayerId={state.phase === 'finished' ? '' : player.id}
        activity={state.activity} round={state.round}
        copied={copied} onCopyInvite={copyInvite}
      />
      <TurnPanel
        player={player}
        phase={state.phase}
        kind={drawn?.kind ?? 'city-road'}
        variant={drawn?.variant ?? 'plain'}
        rotation={state.rotation}
        deckCount={Math.max(0, state.deck.length - state.deckIndex - (drawn ? 1 : 0))}
        discardedCount={state.discarded.length}
        standings={[...state.players].sort((a, b) => b.score - a.score)}
        winners={state.winners}
        pendingMeeple={Boolean(pendingTile?.meeple)}
        followerChoices={followerChoices}
        message={state.message}
        validCount={validPositions.length}
        unfillableCount={unfillablePositions.length}
        onRotate={rotate}
        onSelectFollower={selectFollower}
        onUndo={undoPlacement}
        onConfirm={confirm}
      />
      <p className="app-note">Projeto de Software · UFF<br />Prévia local · rede e IA em desenvolvimento</p>
    </main>
  )
}

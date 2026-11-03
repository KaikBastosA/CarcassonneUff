import { useEffect, useMemo, useState } from 'react'
import Board from './components/Board'
import PlayerLedger from './components/PlayerLedger'
import GameHeader from './components/GameHeader'
import TurnPanel from './components/TurnPanel'
import GameSetup from './components/GameSetup'
import { playerHex } from './game'
import { themeStorageKey } from './theme'
import type { Theme } from './theme'
import { useGame } from './useGame'
import { TileInstance } from './game/tiles'
import { getFollowerChoices } from './game/actions'
import type { PlacedTile } from './tiles'
import { renderBoard } from './game/board-state'

export default function App() {
  const { state, phase, configuration, start, rotate, place, selectFollower, undoPlacement, confirm, newGame } = useGame()
  const [theme, setTheme] = useState<Theme>(() => (
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  ))
  const player = state.players[state.currentPlayerIndex]
  const automatic = player.strategy.automatic
  const board = useMemo(() => renderBoard(state.board, state.players), [state.board, state.players])
  const pendingTile = state.pendingPosition ? board[state.pendingPosition.key] : undefined
  const followerChoices = getFollowerChoices(state)
  const drawn = state.deck[state.deckIndex]
  const preview: PlacedTile | null = phase === 'place' && drawn && !automatic
    ? { kind: drawn.kind, rotation: state.rotation, variant: drawn.variant }
    : null
  const { validPositions, unfillablePositions, warnings } = useMemo(() => {
    const unfillablePositions = state.model.getUnfillablePositions()
    if (!drawn || phase !== 'place' || automatic) return { validPositions: [], unfillablePositions, warnings: new Map() }
    const tile = new TileInstance(drawn.id, drawn.kind, state.rotation, drawn.variant)
    const validPositions = state.model.getValidPositions(tile)
    const warnings = new Map(validPositions.flatMap((position) => {
      const affected = state.model.getNewUnfillablePositions(tile, position)
      return affected.length > 0 ? [[position.key, affected] as const] : []
    }))
    return { validPositions, unfillablePositions, warnings }
  }, [state.model, drawn, state.rotation, phase, automatic])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(themeStorageKey, theme)
  }, [theme])

  function handleCell(position: string, regionId?: string) {
    if (automatic) return
    if (phase === 'place') {
      place(position)
      return
    }
    if (position === state.pendingPosition?.key && regionId) selectFollower(regionId)
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  if (phase === 'configure') return (
    <main className="app">
      <GameHeader theme={theme} setup onToggleTheme={toggleTheme} onNewGame={newGame} />
      <GameSetup configuration={configuration} message={state.message} onStart={start} />
    </main>
  )

  return (
    <main className="app">
      <Board
        tiles={board}
        preview={preview}
        pendingPosition={state.pendingPosition?.key ?? null}
        pendingColor={playerHex[player.color]}
        placing={phase === 'place' && !automatic}
        validPositions={validPositions}
        unfillablePositions={unfillablePositions}
        warnings={warnings}
        followerChoices={automatic ? [] : followerChoices}
        theme={theme}
        onCellClick={handleCell}
      />
      <GameHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        onNewGame={newGame}
      />
      <PlayerLedger
        players={state.players} currentPlayerId={phase === 'finished' ? '' : player.id}
        activity={state.events} round={state.round}
      />
      <TurnPanel
        player={player}
        phase={phase}
        kind={drawn?.kind ?? 'city-road'}
        variant={drawn?.variant ?? 'plain'}
        rotation={state.rotation}
        deckCount={Math.max(0, state.deck.length - state.deckIndex - (drawn ? 1 : 0))}
        discardedCount={state.discarded.length}
        standings={[...state.players].sort((a, b) => b.score - a.score)}
        winners={state.winners.map(({ id }) => id)}
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
    </main>
  )
}

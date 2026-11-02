import { useState } from 'react'
import { initialGame } from './game'
import { placeGameTile, undoGamePlacement } from './game/actions'
import type { GameState } from './game'
import type { Rotation } from './tiles'

export function useGame() {
  const [state, setState] = useState<GameState>(initialGame)

  function rotate(direction: -1 | 1) {
    setState((current) => {
      if (current.phase !== 'place') return current
      const rotation = ((current.rotation + direction * 90 + 360) % 360) as Rotation
      return { ...current, rotation, message: '' }
    })
  }

  function place(position: string) {
    setState((current) => placeGameTile(current, position))
  }

  function toggleMeeple() {
    setState((current) => {
      if (current.phase !== 'meeple' || !current.pendingPosition) return current
      const player = current.players[current.currentPlayerIndex]
      const tile = current.board[current.pendingPosition]
      if (!tile) return current
      const hasMeeple = Boolean(tile.meeple)
      if (!hasMeeple && player.meeples === 0) return current
      const board = {
        ...current.board,
        [current.pendingPosition]: { ...tile, meeple: hasMeeple ? undefined : player.color },
      }
      const players = current.players.map((item, index) => (
        index === current.currentPlayerIndex
          ? { ...item, meeples: item.meeples + (hasMeeple ? 1 : -1) }
          : item
      ))
      return { ...current, board, players }
    })
  }

  function undoPlacement() {
    setState(undoGamePlacement)
  }

  function confirm() {
    setState((current) => {
      if (current.phase !== 'meeple' || !current.pendingPosition) return current
      const player = current.players[current.currentPlayerIndex]
      const nextPlayerIndex = (current.currentPlayerIndex + 1) % current.players.length
      const nextDeckIndex = current.deckIndex + 1
      const event = {
        id: Date.now(),
        playerId: player.id,
        text: 'colocou uma peça',
        round: current.round,
      }
      return {
        ...current,
        phase: 'place',
        pendingPosition: null,
        previousBoard: null,
        message: '',
        currentPlayerIndex: nextPlayerIndex,
        round: nextPlayerIndex === 0 ? current.round + 1 : current.round,
        deckIndex: nextDeckIndex,
        currentKind: current.deck[nextDeckIndex] ?? current.deck[0],
        rotation: 0,
        activity: [event, ...current.activity],
      }
    })
  }

  return { state, rotate, place, toggleMeeple, undoPlacement, confirm }
}

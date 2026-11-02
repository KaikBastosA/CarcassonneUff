import { useState } from 'react'
import { initialGame } from './game'
import { confirmGameTurn, placeGameTile, selectGameFollower, undoGamePlacement } from './game/actions'
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

  function selectFollower(regionId: string | null) {
    setState((current) => selectGameFollower(current, regionId))
  }

  function undoPlacement() {
    setState(undoGamePlacement)
  }

  function confirm() {
    setState(confirmGameTurn)
  }

  return { state, rotate, place, selectFollower, undoPlacement, confirm }
}

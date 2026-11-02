import { useEffect, useState } from 'react'
import { GameSession } from './game/session'
import type { MatchConfiguration } from './game/session'
import { applyComputerDecision, scheduleComputerTurn } from './game/computer-turn'

export function useGame() {
  const [match, setMatch] = useState(() => GameSession.configure())

  useEffect(() => scheduleComputerTurn(match, (decision) => {
    setMatch((current) => applyComputerDecision(current, match, decision))
  }), [match])

  function start(configuration: MatchConfiguration) {
    const config = { ...configuration, seed: configuration.seed ?? Math.floor(Math.random() * 4294967296) }
    setMatch((current) => current.start(config))
  }

  function rotate(direction: -1 | 1) {
    setMatch((current) => current.rotate(direction))
  }

  function place(position: string) {
    setMatch((current) => current.place(position))
  }

  function selectFollower(regionId: string | null) {
    setMatch((current) => current.selectFollower(regionId))
  }

  function undoPlacement() {
    setMatch((current) => current.undo())
  }

  function confirm() {
    setMatch((current) => current.confirm())
  }

  function newGame() {
    setMatch((current) => current.newGame())
  }

  return { state: match.snapshot, configuration: match.configuration, start, rotate, place, selectFollower, undoPlacement, confirm, newGame }
}

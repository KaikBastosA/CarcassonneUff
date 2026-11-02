import { useEffect, useState, useSyncExternalStore } from 'react'
import { scheduleComputerTurn } from './game/computer-turn'
import { GameStore } from './game/store'

export function useGame() {
  const [store] = useState(() => new GameStore())
  const match = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)

  useEffect(() => scheduleComputerTurn(match, (decision) => {
    store.playComputerTurn(match, decision)
  }), [store, match])

  return {
    state: match.snapshot, configuration: match.configuration,
    start: store.start, rotate: store.rotate, place: store.place, selectFollower: store.selectFollower,
    undoPlacement: store.undoPlacement, confirm: store.confirm, newGame: store.newGame,
  }
}

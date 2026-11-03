import { useEffect, useState, useSyncExternalStore } from 'react'
import { scheduleComputerTurn } from './game/computer-turn'
import { GameStore } from './game/store'
import { GameObserver } from './game/observer'

export function useGame() {
  const [observer] = useState(() => new GameObserver(new GameStore()))
  const store = observer.store
  // Subscribe to the immutable session too: lifecycle is outside GameState.
  const match = useSyncExternalStore(observer.subscribe, store.getSession, store.getSession)
  const state = match.snapshot
  useEffect(() => scheduleComputerTurn(match, (decision) => {
    store.playComputerTurn(match, decision)
  }), [store, match])
  return {
    state, phase: match.phase, configuration: match.configuration,
    subscribe: observer.subscribe, getSnapshot: observer.getSnapshot, update: observer.update,
    start: store.start, rotate: store.rotate, place: store.place, selectFollower: store.selectFollower,
    undoPlacement: store.undoPlacement, confirm: store.confirm, newGame: store.newGame,
  }
}

import type { GameState } from '../game.ts'
import type { Observer } from './observable.ts'
import type { GameStore } from './store.ts'

// React subscribes to this adapter; the store only knows the Observer contract.
export class GameObserver implements Observer {
  #listeners = new Set<() => void>()

  readonly store: GameStore

  constructor(store: GameStore) { this.store = store }

  getSnapshot = (): GameState => this.store.getSnapshot()

  update = (): void => {
    for (const listener of [...this.#listeners]) listener()
  }

  subscribe = (listener: () => void): (() => void) => {
    if (this.#listeners.size === 0) this.store.add(this)
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
      if (this.#listeners.size === 0) this.store.remove(this)
    }
  }
}

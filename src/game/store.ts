import { applyComputerDecision } from './computer-turn.ts'
import type { Observable, Observer } from './observable.ts'
import { GameSession } from './session.ts'
import type { MatchConfiguration } from './session.ts'
import type { TurnDecision } from './strategy.ts'

export class GameStore implements Observable {
  #match: GameSession
  #observers = new Set<Observer>()

  constructor(match: GameSession = GameSession.configure()) {
    this.#match = match
  }

  getSnapshot = (): GameSession => this.#match

  subscribe = (listener: () => void): (() => void) => this.add({ update: listener })

  add(observer: Observer): () => void {
    this.#observers.add(observer)
    return () => this.remove(observer)
  }

  remove(observer: Observer): void {
    this.#observers.delete(observer)
  }

  notify(): void {
    const errors: unknown[] = []
    for (const observer of [...this.#observers]) {
      if (!this.#observers.has(observer)) continue
      try {
        observer.update()
      } catch (error) {
        errors.push(error)
      }
    }
    if (errors.length > 0) throw new AggregateError(errors, 'Falha ao notificar observadores da partida.')
  }

  #publish(match: GameSession): void {
    if (match === this.#match) return
    this.#match = match
    this.notify()
  }

  start = (configuration: MatchConfiguration): void => this.#publish(this.#match.start(configuration))
  rotate = (direction: -1 | 1): void => this.#publish(this.#match.rotate(direction))
  place = (position: string): void => this.#publish(this.#match.place(position))
  selectFollower = (regionId: string | null): void => this.#publish(this.#match.selectFollower(regionId))
  undoPlacement = (): void => this.#publish(this.#match.undo())
  confirm = (): void => this.#publish(this.#match.confirm())
  newGame = (): void => this.#publish(this.#match.newGame())
  playComputerTurn = (expected: GameSession, decision: TurnDecision | null): void => this.#publish(applyComputerDecision(this.#match, expected, decision))
}

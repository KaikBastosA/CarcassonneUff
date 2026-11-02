import type { GameSession } from './session.ts'
import { decisionView, firstLegalDecision } from './strategy.ts'
import type { DecisionView, TurnDecision } from './strategy.ts'

export interface DecisionWorker {
  onmessage: ((event: MessageEvent<TurnDecision | null>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  postMessage(view: DecisionView): void
  terminate(): void
}

export function applyComputerDecision(current: GameSession, expected: GameSession, decision: TurnDecision | null): GameSession {
  if (current !== expected || !current.computerTurn) return current
  const next = current.playComputerTurn(decision)
  if (next !== current) return next
  const view = decisionView(current.snapshot)
  return view ? current.playComputerTurn(firstLegalDecision(view)) : current
}

export function scheduleComputerTurn(
  match: GameSession,
  complete: (decision: TurnDecision | null) => void,
  createWorker: () => DecisionWorker = () => new Worker(new URL('./computer.worker.ts', import.meta.url), { type: 'module' }),
): () => void {
  const view = match.computerTurn ? decisionView(match.snapshot) : null
  if (!view) return () => {}
  let active = true
  let worker: DecisionWorker | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  const finish = (decision: TurnDecision | null) => {
    if (!active) return
    active = false
    clearTimeout(timeout)
    worker?.terminate()
    complete(decision ?? firstLegalDecision(view))
  }
  const timer = setTimeout(() => {
    try {
      worker = createWorker()
      worker.onmessage = (event) => finish(event.data)
      worker.onerror = (event) => { event.preventDefault(); finish(null) }
      timeout = setTimeout(() => finish(null), 10000)
      worker.postMessage(view)
    } catch {
      finish(null)
    }
  }, 450)
  return () => {
    active = false
    clearTimeout(timer)
    clearTimeout(timeout)
    worker?.terminate()
  }
}

import { computerStrategies } from './strategy.ts'
import type { DecisionView } from './strategy.ts'

self.onmessage = (event: MessageEvent<DecisionView>) => {
  self.postMessage(computerStrategies[event.data.difficulty].chooseTurn(event.data))
}

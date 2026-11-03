import type { GameState } from '../game.ts'
import { withEvents } from './actions.ts'
import { createTileSet } from './tiles.ts'
import type { TileInstance } from './tiles.ts'

export function shuffledTiles(tiles: readonly TileInstance[], seed: number): readonly TileInstance[] {
  const result = [...tiles]
  let value = seed >>> 0
  for (let index = result.length - 1; index > 0; index--) {
    value = (value + 0x6d2b79f5) >>> 0
    let random = Math.imul(value ^ value >>> 15, value | 1)
    random ^= random + Math.imul(random ^ random >>> 7, random | 61)
    const selected = Math.floor(((random ^ random >>> 14) >>> 0) / 4294967296 * (index + 1))
    const tile = result[index]
    result[index] = result[selected]
    result[selected] = tile
  }
  return Object.freeze(result)
}

export function createGameTiles(seed: number): { initial: TileInstance; deck: readonly TileInstance[] } {
  const tiles = createTileSet()
  const initial = tiles.find((tile) => tile.kind === 'city-road')!
  return { initial, deck: shuffledTiles(tiles.filter(({ id }) => id !== initial.id), seed) }
}

export function comprarCartela(current: GameState): TileInstance | undefined {
  return current.deck[current.deckIndex]
}

export function descartarCartela(current: GameState): GameState {
  const tile = comprarCartela(current)
  if (current.phase !== 'place' || !tile || current.model.getValidMoves(tile).length > 0) return current
  const id = Math.max(0, ...current.events.map(({ id }) => id)) + 1
  return withEvents({ ...current, deckIndex: current.deckIndex + 1, discarded: [...current.discarded, tile] }, [{
    id, playerId: current.players[current.currentPlayerIndex].id,
    text: 'descartou uma peça sem encaixe', round: current.round,
  }, ...current.events])
}

export function drawPlayableTile(current: GameState): GameState {
  if (current.phase !== 'place') return current
  let next = current
  let tile = comprarCartela(next)
  while (tile) {
    const moves = next.model.getValidMoves(tile)
    if (moves.length > 0) return {
      ...next, rotation: moves[0].rotation,
      message: next.discarded.length > current.discarded.length
        ? `${next.discarded.length - current.discarded.length} cartelas sem encaixe descartadas. Nova peça comprada.`
        : current.message,
    }
    next = descartarCartela(next)
    tile = comprarCartela(next)
  }
  return { ...next, rotation: 0 }
}

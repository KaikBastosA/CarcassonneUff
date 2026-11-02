import type { GameState } from '../game.ts'
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

export function drawPlayableTile(current: GameState): GameState {
  if (current.phase !== 'place') return current
  let deckIndex = current.deckIndex
  const discarded = [...current.discarded]
  const activity = [...current.activity]
  let eventId = Math.max(0, ...activity.map(({ id }) => id))
  while (deckIndex < current.deck.length) {
    const tile = current.deck[deckIndex]
    const moves = current.model.getValidMoves(tile)
    if (moves.length > 0) return {
      ...current, deckIndex, discarded, activity, rotation: moves[0].tile.rotation,
      message: discarded.length > current.discarded.length
        ? `${discarded.length - current.discarded.length} cartelas sem encaixe descartadas. Nova peça comprada.`
        : current.message,
    }
    discarded.push(tile)
    activity.unshift({ id: ++eventId, playerId: current.players[current.currentPlayerIndex].id,
      text: 'descartou uma peça sem encaixe', round: current.round })
    deckIndex++
  }
  return { ...current, deckIndex, discarded, activity, rotation: 0 }
}

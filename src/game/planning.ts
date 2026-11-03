import type { GameState } from '../game.ts'
import { playerColors } from '../game.ts'
import { confirmGameTurn, placeGameTile, selectGameFollower } from './actions.ts'
import { GameBoard } from './board.ts'
import { boardSnapshot } from './board-state.ts'
import { drawPlayableTile, shuffledTiles } from './deck.ts'
import { Follower } from './followers.ts'
import { StructureMesh } from './mesh.ts'
import { Position } from './position.ts'
import { finalizeGame } from './scoring.ts'
import { CompletableStructure, Field } from './structures.ts'
import { createTileSet, TileInstance } from './tiles.ts'
import type { DecisionView, RankedDecision, TurnDecision } from './strategy.ts'

export function unknownTiles(view: DecisionView): readonly TileInstance[] {
  const counts = new Map<string, number>()
  for (const tile of [view.tile, ...view.placements.map(({ tile }) => tile), ...view.discardedTiles]) {
    const key = `${tile.kind}:${tile.variant}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return createTileSet().filter((tile) => {
    const key = `${tile.kind}:${tile.variant}`
    const count = counts.get(key) ?? 0
    if (count === 0) return true
    counts.set(key, count - 1)
    return false
  }).map((tile, index) => new TileInstance(`simulation-${index}`, tile.kind, 0, tile.variant))
}

function simulationState(view: DecisionView, future: readonly TileInstance[]): GameState {
  const model = view.placements.reduce((board, { tile, x, y }) => board.place(
    new TileInstance(tile.id, tile.kind, tile.rotation, tile.variant), new Position(x, y),
  ), new GameBoard())
  const players = view.playerIds.map((id, index) => {
    const followers = view.followers.filter(({ ownerId }) => ownerId === id).map(({ id, ownerId, allocation }) => new Follower(id, ownerId, allocation))
    return { id, name: id, color: playerColors[index], score: 0, followers,
      meeples: followers.filter(({ status }) => status === 'reserve').length,
      strategy: { automatic: false, difficulty: null, chooseTurn: () => null },
    }
  })
  return {
    players, currentPlayerIndex: view.playerIds.indexOf(view.playerId), startingPlayerIndex: view.playerIds.indexOf(view.playerId),
    round: 1, phase: 'place', model, mesh: new StructureMesh(model, players.flatMap(({ followers }) => followers), players),
    board: boardSnapshot(model, players.flatMap(({ followers }) => followers)),
    previousBoard: null, message: '', scoring: [], winners: [], tieBreakReserves: null, rotation: 0, deckIndex: 0, pendingPosition: null,
    activity: '', events: [], discarded: [], seed: 0,
    deck: [new TileInstance(view.tile.id, view.tile.kind, 0, view.tile.variant), ...future],
  }
}

function advance(state: GameState, decision: TurnDecision): GameState {
  let next = placeGameTile({ ...state, rotation: decision.rotation }, decision.position)
  if (next.phase !== 'meeple') return state
  if (decision.regionId != null) next = selectGameFollower(next, decision.regionId)
  next = drawPlayableTile(confirmGameTurn(next))
  return next.deckIndex >= next.deck.length ? finalizeGame(next) : next
}

function estimate(state: GameState, owner: string): number {
  const weight = (id: string) => id === owner ? 1 : -0.6
  let result = state.players.reduce((sum, player) => sum + player.score * weight(player.id), 0)
  for (const structure of state.mesh.structures) {
    const complete = structure instanceof CompletableStructure && structure.isComplete
    const potential = structure instanceof Field ? (structure.adjacentCityIds.length - structure.completedCityCount) * 0.8 : 0
    const points = structure.score(true) * (complete ? 1 : 0.65) + potential
    result += structure.majorityIds().reduce((sum, id) => sum + points * weight(id), 0)
  }
  for (const player of state.players) result += player.meeples * 0.35 * weight(player.id)
  return result
}

export function lookAhead(
  view: DecisionView,
  candidates: readonly RankedDecision[],
  choose: (view: DecisionView) => TurnDecision | null,
  observe: (state: GameState) => DecisionView | null,
): TurnDecision | null {
  const pool = unknownTiles(view)
  const seed = [...JSON.stringify(view)].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261)
  const totals = candidates.map(({ value }) => value * 0.15)
  for (let sample = 0; sample < 2; sample++) {
    const future = shuffledTiles(pool, (seed + sample * 2654435761) >>> 0).slice(0, view.remainingTiles)
    const initial = simulationState(view, future)
    for (const [index, { decision }] of candidates.entries()) {
      let state = advance(initial, decision)
      for (let turn = 0; turn < view.playerIds.length && state.winners.length === 0; turn++) {
        const observation = observe(state)
        const next = observation ? choose(observation) : null
        if (!next) break
        state = advance(state, next)
      }
      totals[index] += estimate(state, view.playerId) / 2
    }
  }
  const best = totals.reduce((selected, score, index) => score > totals[selected] ? index : selected, 0)
  return candidates[best]?.decision ?? null
}

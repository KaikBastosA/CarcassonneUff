import type { GameState } from '../game.ts'
import { GameBoard } from './board.ts'
import { Follower } from './followers.ts'
import type { FollowerAllocation } from './followers.ts'
import { StructureMesh } from './mesh.ts'
import { Position } from './position.ts'
import { CompletableStructure, Field } from './structures.ts'
import type { Structure } from './structures.ts'
import { TileInstance } from './tiles.ts'
import type { Rotation, TileKind, TileVariant } from './tiles.ts'
import { lookAhead } from './planning.ts'

export type PlayerControl = 'human' | 'computer'
export type ComputerDifficulty = 'basic' | 'strategic'

export const difficultyNames: Readonly<Record<ComputerDifficulty, string>> = Object.freeze({ basic: 'Básico', strategic: 'Estratégico' })

export interface TileData {
  readonly id: string
  readonly kind: TileKind
  readonly rotation: Rotation
  readonly variant: TileVariant
}

export interface DecisionView {
  readonly playerId: string
  readonly tile: TileData
  readonly placements: readonly { readonly tile: TileData; readonly x: number; readonly y: number }[]
  readonly followers: readonly { readonly id: string; readonly ownerId: string; readonly allocation: FollowerAllocation | null }[]
  readonly remainingTiles: number
  readonly playerIds: readonly string[]
  readonly discardedTiles: readonly TileData[]
  readonly difficulty: ComputerDifficulty
}

export interface TurnDecision {
  readonly tileId: string
  readonly position: string
  readonly rotation: Rotation
  readonly regionId: string | null
}

export interface PlayerStrategy {
  readonly automatic: boolean
  readonly difficulty: ComputerDifficulty | null
  chooseTurn(view: DecisionView): TurnDecision | null
}

export class HumanStrategy implements PlayerStrategy {
  readonly automatic = false
  readonly difficulty = null

  chooseTurn(_view: DecisionView): null { return null }
}

function restoreBoard(view: DecisionView): GameBoard {
  return view.placements.reduce((board, { tile, x, y }) => board.place(
    new TileInstance(tile.id, tile.kind, tile.rotation, tile.variant), new Position(x, y),
  ), new GameBoard())
}

function evaluateStructure(structure: Structure, owners: readonly string[], view: DecisionView): number {
  const complete = structure instanceof CompletableStructure && structure.isComplete
  const final = view.remainingTiles === 0
  const confidence = final || complete ? 1 : structure instanceof Field ? 0.55 : 0.65
  const points = structure.score(true)
  const advantage = owners.reduce((total, id) => total + (id === view.playerId ? 1 : -0.6), 0)
  const recovered = complete && !final ? structure.followers.reduce((total, follower) => total + (follower.ownerId === view.playerId ? 0.8 : -0.4), 0) : 0
  return points * confidence * advantage + recovered
}

export class ComputerStrategy implements PlayerStrategy {
  readonly automatic = true
  readonly difficulty: ComputerDifficulty = 'basic'

  chooseTurn(view: DecisionView): TurnDecision | null {
    return this.rankTurns(view, 1)[0]?.decision ?? null
  }

  rankTurns(view: DecisionView, limit: number, opportunities = false): RankedDecision[] {
    const board = restoreBoard(view)
    const followers = view.followers.map(({ id, ownerId, allocation }) => new Follower(id, ownerId, allocation))
    const reserve = followers.filter((follower) => follower.ownerId === view.playerId && follower.status === 'reserve').length
    const drawn = new TileInstance(view.tile.id, view.tile.kind, view.tile.rotation, view.tile.variant)
    const ranked: RankedDecision[] = []
    const seenMoves = new Set<string>()
    const geometries = new Map<string, string>()
    for (const { tile, position } of board.getValidMoves(drawn)) {
      const mesh = new StructureMesh(board.place(tile, position), followers)
      const evaluation = mesh.structures.reduce((total, structure) => total + evaluateStructure(structure, structure.majority(), view), 0)
      const choices: { regionId: string | null; gain: number }[] = [{ regionId: null, gain: 0 }]
      if (reserve > 0) {
        const seen = new Set<string>()
        for (const region of tile.regions) {
          const structure = mesh.structureAt(tile.id, region.id)!
          if (seen.has(structure.id) || !structure.canOccupy()) continue
          seen.add(structure.id)
          const complete = structure instanceof CompletableStructure && structure.isComplete
          const cost = view.remainingTiles === 0 || complete ? 0 : 0.7 + 2 / reserve + (structure instanceof Field ? 1.5 : 0)
          const potential = opportunities && structure instanceof Field && view.remainingTiles > 0
            ? (structure.adjacentCityIds.length - structure.completedCityCount) * 0.8 : 0
          choices.push({ regionId: region.id, gain: evaluateStructure(structure, [view.playerId], view) - cost + potential })
        }
      }
      for (const { regionId, gain } of choices) {
        const score = evaluation + gain
        if (ranked.length === limit && score <= ranked[limit - 1].value) continue
        if (limit > 1) {
          const orientation = `${tile.rotation}:${regionId}`
          let geometry = geometries.get(orientation)
          if (!geometry) {
            geometry = tile.regions.map((region) => `${region.terrain}:${[...region.ports].sort()}:${region.shields}:${region.id === regionId}`).sort().join('|')
            geometries.set(orientation, geometry)
          }
          const key = `${position.key}:${geometry}`
          if (seenMoves.has(key)) continue
          seenMoves.add(key)
        }
        ranked.push({ decision: { tileId: tile.id, position: position.key, rotation: tile.rotation, regionId }, value: score })
        ranked.sort((a, b) => b.value - a.value)
        if (ranked.length > limit) ranked.pop()
      }
    }
    return ranked
  }
}

export interface RankedDecision {
  readonly decision: TurnDecision
  readonly value: number
}

export class StrategicComputerStrategy extends ComputerStrategy {
  override readonly difficulty = 'strategic' as const

  override chooseTurn(view: DecisionView): TurnDecision | null {
    const candidates = this.rankTurns(view, 4, true)
    if (view.remainingTiles === 0 || candidates.length < 2) return candidates[0]?.decision ?? null
    const basic = new ComputerStrategy()
    return lookAhead(view, candidates, (future) => basic.chooseTurn(future), decisionView)
  }
}

export const computerStrategies: Readonly<Record<ComputerDifficulty, PlayerStrategy>> = Object.freeze({
  basic: Object.freeze(new ComputerStrategy()), strategic: Object.freeze(new StrategicComputerStrategy()),
})

export const playerStrategies: Readonly<Record<PlayerControl, PlayerStrategy>> = Object.freeze({
  human: Object.freeze(new HumanStrategy()), computer: computerStrategies.basic,
})

export function decisionView(state: GameState): DecisionView | null {
  const tile = state.deck[state.deckIndex]
  if (state.phase !== 'place' || !tile) return null
  return {
    playerId: state.players[state.currentPlayerIndex].id,
    tile: { id: tile.id, kind: tile.kind, rotation: tile.rotation, variant: tile.variant },
    placements: state.model.placements.map(({ tile, position }) => ({
      tile: { id: tile.id, kind: tile.kind, rotation: tile.rotation, variant: tile.variant }, x: position.x, y: position.y,
    })),
    followers: state.players.flatMap((player) => player.followers.map(({ id, ownerId, allocation }) => ({ id, ownerId, allocation }))),
    remainingTiles: Math.max(0, state.deck.length - state.deckIndex - 1),
    playerIds: state.players.map(({ id }) => id),
    discardedTiles: state.discarded.map(({ id, kind, rotation, variant }) => ({ id, kind, rotation, variant })),
    difficulty: state.players[state.currentPlayerIndex].strategy.difficulty ?? 'basic',
  }
}

export function firstLegalDecision(view: DecisionView): TurnDecision | null {
  const board = restoreBoard(view)
  const tile = new TileInstance(view.tile.id, view.tile.kind, view.tile.rotation, view.tile.variant)
  const move = board.getValidMoves(tile)[0]
  return move ? { tileId: tile.id, rotation: move.tile.rotation, position: move.position.key, regionId: null } : null
}

import type { GameState, Player } from '../game.ts'
import { StructureMesh } from './mesh.ts'
import type { Structure } from './structures.ts'
import { CompletableStructure } from './structures.ts'
import type { Terrain } from './tiles.ts'

export interface ScoringRecord {
  readonly id: string
  readonly terrain: Terrain
  readonly points: number
  readonly winners: readonly string[]
  readonly followerIds: readonly string[]
  readonly final: boolean
}

const scoringTexts: Record<Terrain, string> = {
  city: 'pontuou uma cidade',
  road: 'pontuou uma estrada',
  monastery: 'pontuou um mosteiro',
  field: 'pontuou um campo',
}

export function calculateScores(structures: readonly Structure[], final: boolean, previous: readonly ScoringRecord[] = []): readonly ScoringRecord[] {
  const scored = new Set(previous.map(({ id }) => id))
  return structures.flatMap((structure) => {
    if (!final && !(structure instanceof CompletableStructure && structure.isComplete)) return []
    const id = JSON.stringify(structure.regions.map(({ key }) => key).sort())
    if (scored.has(id)) return []
    scored.add(id)
    return [Object.freeze({
      id, terrain: structure.terrain, points: structure.score(final),
      winners: Object.freeze([...structure.majority()]),
      followerIds: Object.freeze(structure.followers.map(({ id }) => id)),
      final,
    })]
  })
}

export function applyScores(current: GameState, records: readonly ScoringRecord[]): GameState {
  const scored = new Set(current.scoring.map(({ id }) => id))
  records = records.filter(({ id }) => {
    if (scored.has(id)) return false
    scored.add(id)
    return true
  })
  if (records.length === 0) return current
  const points = new Map<string, number>()
  const released = new Set<string>()
  const releasedTiles = new Set<string>()
  let eventId = Math.max(0, ...current.activity.map(({ id }) => id))
  const events = []
  for (const record of records) {
    for (const id of record.followerIds) released.add(id)
    for (const playerId of record.winners) {
      points.set(playerId, (points.get(playerId) ?? 0) + record.points)
      if (record.points > 0) events.push({
        id: ++eventId, playerId, points: record.points, round: current.round,
        text: `${scoringTexts[record.terrain]}${record.final ? ' na apuração final' : ''}`,
      })
    }
  }
  const players = current.players.map((player) => {
    const followers = player.followers.map((follower) => {
      if (!released.has(follower.id)) return follower
      if (follower.allocation) releasedTiles.add(follower.allocation.tileId)
      return follower.release()
    })
    return { ...player, followers, score: player.score + (points.get(player.id) ?? 0),
      meeples: followers.filter((follower) => follower.status === 'reserve').length }
  })
  const board = { ...current.board }
  for (const { tile, position } of current.model.placements) {
    if (releasedTiles.has(tile.id)) board[position.key] = { kind: tile.kind, rotation: tile.rotation, variant: tile.variant }
  }
  return {
    ...current, players, board,
    mesh: new StructureMesh(current.model, players.flatMap((player) => player.followers)),
    scoring: [...current.scoring, ...records],
    activity: [...events.reverse(), ...current.activity],
  }
}

export function determineWinners(players: readonly Player[]): readonly string[] {
  if (players.length === 0) return []
  const maximum = Math.max(...players.map(({ score }) => score))
  return players.filter(({ score }) => score === maximum).map(({ id }) => id)
}

export function finalizeGame(current: GameState): GameState {
  if (current.phase !== 'place' || current.deckIndex < current.deck.length) return current
  const records = calculateScores(current.mesh.structures, true, current.scoring)
  const settled = applyScores(current, records)
  const winners = determineWinners(settled.players)
  const names = settled.players.filter(({ id }) => winners.includes(id)).map(({ name }) => name)
  return {
    ...settled, phase: 'finished', winners,
    pendingPosition: null, previousBoard: null,
    message: `${winners.length === 1 ? 'Vencedor' : 'Empate'}: ${names.join(', ')}.`,
  }
}

import type { GameState, Player } from '../game.ts'
import { withEvents } from './actions.ts'
import { boardSnapshot } from './board-state.ts'
import { StructureMesh } from './mesh.ts'
import type { Structure } from './structures.ts'
import { CompletableStructure } from './structures.ts'
import type { Terrain } from './tiles.ts'

export interface ScoringRecord {
  readonly playerId: string
  readonly structureId: string
  readonly points: number
  readonly final: boolean
  // Settlement metadata preserves terrain messages and releases minority followers too.
  readonly terrain: Terrain
  readonly followerIds: readonly string[]
}

const scoringTexts: Record<Terrain, string> = {
  city: 'pontuou uma cidade', road: 'pontuou uma estrada', monastery: 'pontuou um mosteiro', field: 'pontuou um campo',
}

export function calculateScores(structures: readonly Structure[], final: boolean, previous: readonly ScoringRecord[] = []): readonly ScoringRecord[] {
  const scored = new Set(previous.map(({ structureId }) => structureId))
  return structures.flatMap((structure) => {
    if (structure.followers.length === 0 || (!final && !(structure instanceof CompletableStructure && structure.isComplete))) return []
    const structureId = JSON.stringify(structure.regions.map(({ key }) => key).sort())
    if (scored.has(structureId)) return []
    scored.add(structureId)
    return structure.majority().map(({ id }) => id).map((playerId) => Object.freeze({
      playerId, structureId, terrain: structure.terrain, points: structure.score(final),
      followerIds: Object.freeze(structure.followers.map(({ id }) => id)), final,
    }))
  })
}

export function applyScores(current: GameState, records: readonly ScoringRecord[]): GameState {
  const key = (record: ScoringRecord) => JSON.stringify([record.structureId, record.playerId])
  const scored = new Set(current.scoring.map(key))
  records = records.filter((record) => { const id = key(record); if (scored.has(id)) return false; scored.add(id); return true })
  if (records.length === 0) return current
  const points = new Map<string, number>()
  const released = new Set<string>()
  let eventId = Math.max(0, ...current.events.map(({ id }) => id))
  const events = []
  for (const record of records) {
    for (const id of record.followerIds) released.add(id)
    points.set(record.playerId, (points.get(record.playerId) ?? 0) + record.points)
    if (record.points > 0) events.push({ id: ++eventId, playerId: record.playerId, points: record.points, round: current.round,
      text: `${scoringTexts[record.terrain]}${record.final ? ' na apuração final' : ''}` })
  }
  const players = current.players.map((player) => {
    const followers = player.followers.map((follower) => released.has(follower.id) ? follower.release() : follower)
    return { ...player, followers, score: player.score + (points.get(player.id) ?? 0), meeples: followers.filter(({ status }) => status === 'reserve').length }
  })
  const followers = players.flatMap(({ followers }) => followers)
  return withEvents({ ...current, players, board: boardSnapshot(current.model, followers),
    mesh: new StructureMesh(current.model, followers, players), scoring: [...current.scoring, ...records] }, [...events.reverse(), ...current.events])
}

export function determineWinners(players: readonly Player[], reserves?: Readonly<Record<string, number>>): readonly Player[] {
  if (players.length === 0) return []
  const maximum = Math.max(...players.map(({ score }) => score))
  const leaders = players.filter(({ score }) => score === maximum)
  const reserve = (player: Player) => reserves?.[player.id] ?? player.meeples
  const maximumReserve = Math.max(...leaders.map(reserve))
  return leaders.filter((player) => reserve(player) === maximumReserve)
}

export function finalizeGame(current: GameState): GameState {
  if (current.phase !== 'place' || current.deckIndex < current.deck.length || current.winners.length > 0) return current
  const tieBreakReserves = Object.freeze(Object.fromEntries(current.players.map(({ id, meeples }) => [id, meeples])))
  const roads = current.mesh.avaliarEstradasIncompletas(current.scoring)
  const cities = current.mesh.avaliarCidadesIncompletas([...current.scoring, ...roads])
  const monasteries = current.mesh.avaliarMonasteriosIncompletos([...current.scoring, ...roads, ...cities])
  const fields = current.mesh.avaliarCamposEFazendeiros([...current.scoring, ...roads, ...cities, ...monasteries])
  const settled = consolidarPontos(current, [...roads, ...cities, ...monasteries, ...fields])
  const winners = aplicarCriterioDesempate(settled.players, tieBreakReserves)
  const scoreLeaders = settled.players.filter(({ score }) => score === winners[0]?.score)
  const tieBreak = winners.length < scoreLeaders.length
    ? ` Desempate pela reserva antes da apuração final: ${tieBreakReserves[winners[0].id]} meeples.` : ''
  return { ...settled, winners, tieBreakReserves, pendingPosition: null, previousBoard: null,
    message: `${winners.length === 1 ? 'Vencedor' : 'Empate'}: ${winners.map(({ name }) => name).join(', ')}.${tieBreak}` }
}

export const calcularPontuacaoEstruturas = calculateScores
export const somarPontos = applyScores

export const consolidarPontos = applyScores
export const consolidarPontuacaoGeral = finalizeGame
export const aplicarCriterioDesempate = determineWinners

import type { GameState, GameEvent } from '../game.ts'
import { placementMessages } from './board.ts'
import { boardSnapshot, restoreBoard } from './board-state.ts'
import { Position } from './position.ts'
import { TileInstance } from './tiles.ts'
import type { RegionPoint, Terrain } from './tiles.ts'
import type { Follower, FollowerRole } from './followers.ts'
import { StructureMesh } from './mesh.ts'
import { consolidarPontos } from './scoring.ts'

export interface FollowerChoice {
  readonly id: string
  readonly terrain: Terrain
  readonly role: FollowerRole
  readonly anchor: RegionPoint
  readonly available: boolean
  readonly selected: boolean
}

export function withEvents(current: GameState, events: readonly GameEvent[]): GameState {
  return { ...current, events, activity: events.map((event) => `${current.players.find(({ id }) => id === event.playerId)?.name ?? 'Jogador'} ${event.text}`).join('\n') }
}

function allFollowers(current: GameState): readonly Follower[] {
  return current.players.flatMap((player) => player.followers)
}

function pendingTile(current: GameState): TileInstance | undefined {
  const last = current.model.placements.at(-1)
  const drawn = current.deck[current.deckIndex]
  return current.previousBoard && last?.position.equals(current.pendingPosition!) && last.tile.id === drawn?.id ? last.tile : undefined
}

export function getFollowerChoices(current: GameState): readonly FollowerChoice[] {
  if (current.phase !== 'meeple' || !current.pendingPosition) return []
  const tile = pendingTile(current)
  if (!tile) return []
  const player = current.players[current.currentPlayerIndex]
  const selected = player.followers.find((follower) => follower.allocation?.tileId === tile.id)
  const mesh = selected
    ? new StructureMesh(current.model, allFollowers(current).filter((follower) => follower.id !== selected.id), current.players)
    : current.mesh
  const hasReserve = Boolean(selected) || player.followers.some((follower) => follower.status === 'reserve')
  return tile.regions.map((region) => {
    const structure = mesh.structureAt({ key: `${tile.id}:${region.id}`, tileId: tile.id, position: current.pendingPosition!, region })!
    return { id: region.id, terrain: region.terrain, role: structure.role, anchor: region.anchor,
      available: hasReserve && mesh.podePosicionarSeguidor(tile, region.id), selected: selected?.allocation?.regionId === region.id }
  })
}

export function selectGameFollower(current: GameState, regionId: string | null): GameState {
  if (current.phase !== 'meeple' || !current.pendingPosition) return current
  const tile = pendingTile(current)
  if (!tile) return current
  const player = current.players[current.currentPlayerIndex]
  const selected = player.followers.find((follower) => follower.allocation?.tileId === tile.id)
  let followers = player.followers.map((follower) => follower === selected ? follower.release() : follower)
  if (selected?.allocation?.regionId === regionId) regionId = null
  if (regionId !== null) {
    const free = selected ? followers.find(({ id }) => id === selected.id) : followers.find(({ status }) => status === 'reserve')
    if (!free) return { ...current, message: 'Sem seguidores na reserva.' }
    const mesh = new StructureMesh(current.model, [
      ...current.players.filter(({ id }) => id !== player.id).flatMap(({ followers }) => followers), ...followers,
    ], current.players)
    const structure = mesh.structureAt(tile.id, regionId)
    if (!structure) return { ...current, message: 'Região inválida para o seguidor.' }
    try {
      const allocated = mesh.posicionarSeguidor(tile, regionId, free)
      followers = allocated.followers.filter(({ ownerId }) => ownerId === player.id)
    } catch (error) {
      return { ...current, message: error instanceof Error ? error.message : 'Não foi possível colocar o seguidor.' }
    }
  }
  const players = current.players.map((item) => item.id === player.id
    ? { ...item, followers, meeples: followers.filter(({ status }) => status === 'reserve').length } : item)
  const allocated = players.flatMap(({ followers }) => followers)
  return { ...current, players, board: boardSnapshot(current.model, allocated),
    mesh: new StructureMesh(current.model, allocated, players), message: '' }
}

export function placeGameTile(current: GameState, input: Position | string): GameState {
  if (current.phase !== 'place' || current.deckIndex >= current.deck.length || current.winners.length > 0) return current
  let position: Position
  try {
    if (typeof input === 'string') {
      if (!/^-?\d+,-?\d+$/.test(input)) throw new Error('Posição inválida.')
      const [x, y] = input.split(',').map(Number)
      position = new Position(x, y)
    } else position = new Position(input.x, input.y)
  } catch { return { ...current, message: 'Posição inválida.' } }
  const drawn = current.deck[current.deckIndex]
  const tile = new TileInstance(drawn.id, drawn.kind, current.rotation, drawn.variant)
  const validation = current.model.placementValidation(tile, position)
  if (!validation.valid) return { ...current, message: placementMessages[validation.reason] }
  const model = current.model.posicionarCartela(tile, position)
  const affected = model.getNewUnfillablePositions()
  const followers = allFollowers(current)
  return { ...current, board: boardSnapshot(model, followers), model,
    mesh: new StructureMesh(current.model, followers, current.players).integrar(tile, model),
    previousBoard: current.board, pendingPosition: position, phase: 'meeple',
    message: affected.length > 0 ? `Sem encaixe no catálogo: ${affected.map(({ x, y }) => `(${x},${y})`).join(', ')}. Essa jogada é permitida.` : '' }
}

export function undoGamePlacement(current: GameState): GameState {
  if (current.phase !== 'meeple' || !current.pendingPosition || !current.previousBoard) return current
  const instance = pendingTile(current)
  if (!instance) return current
  const players = current.players.map((player) => {
    const followers = player.followers.map((follower) => follower.allocation?.tileId === instance.id ? follower.release() : follower)
    return { ...player, followers, meeples: followers.filter(({ status }) => status === 'reserve').length }
  })
  const model = restoreBoard(current.previousBoard)
  return { ...current, board: current.previousBoard, players, model,
    mesh: new StructureMesh(model, players.flatMap(({ followers }) => followers), players),
    previousBoard: null, pendingPosition: null, phase: 'place', message: '' }
}

export function confirmGameTurn(current: GameState): GameState {
  if (current.phase !== 'meeple' || !current.pendingPosition || !pendingTile(current)) return current
  // All structures are checked, including monasteries beside the newly placed tile.
  const records = current.mesh.avaliarEstruturasConcluidas(current.scoring)
  const player = current.players[current.currentPlayerIndex]
  const eventId = Math.max(0, ...current.events.map(({ id }) => id)) + 1
  const settled = consolidarPontos(withEvents(current, [{
    id: eventId, playerId: player.id, text: 'colocou uma peça', round: current.round,
  }, ...current.events]), records)
  const deckIndex = current.deckIndex + 1
  const exhausted = deckIndex >= current.deck.length
  const currentPlayerIndex = exhausted ? current.currentPlayerIndex : (current.currentPlayerIndex + 1) % current.players.length
  return { ...settled, phase: 'place', pendingPosition: null, previousBoard: null, deckIndex, currentPlayerIndex,
    round: !exhausted && currentPlayerIndex === current.startingPlayerIndex ? current.round + 1 : current.round,
    rotation: 0, message: records.some(({ followerIds }) => followerIds.length > 0)
      ? 'Estruturas concluídas pontuadas. Seguidores devolvidos à reserva.' : '' }
}

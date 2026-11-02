import type { GameState } from '../game.ts'
import { placementMessages } from './board.ts'
import { Position } from './position.ts'
import { TileInstance } from './tiles.ts'

export function placeGameTile(current: GameState, key: string): GameState {
  if (current.phase !== 'place') return current
  if (!/^-?\d+,-?\d+$/.test(key)) return { ...current, message: 'Posição inválida.' }
  const [x, y] = key.split(',').map(Number)
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) return { ...current, message: 'Posição inválida.' }
  const position = new Position(x, y)
  const tile = new TileInstance(`tile-${current.deckIndex}`, current.currentKind, current.rotation)
  const validation = current.model.validatePlacement(tile, position)
  if (!validation.valid) return { ...current, message: placementMessages[validation.reason] }

  const affected = current.model.getNewUnfillablePositions(tile, position)
  return {
    ...current,
    board: { ...current.board, [position.key]: { kind: tile.kind, rotation: tile.rotation } },
    model: current.model.place(tile, position),
    previousBoard: current.model,
    pendingPosition: position.key,
    phase: 'meeple',
    message: affected.length > 0
      ? `Sem encaixe no catálogo: ${affected.map(({ x, y }) => `(${x},${y})`).join(', ')}. Essa jogada é permitida.`
      : '',
  }
}

export function undoGamePlacement(current: GameState): GameState {
  if (current.phase !== 'meeple' || !current.pendingPosition || !current.previousBoard) return current
  const tile = current.board[current.pendingPosition]
  if (!tile) return current
  const board = { ...current.board }
  delete board[current.pendingPosition]
  const players = tile.meeple
    ? current.players.map((player, index) => index === current.currentPlayerIndex
      ? { ...player, meeples: player.meeples + 1 }
      : player)
    : current.players

  return {
    ...current, board, players,
    model: current.previousBoard,
    previousBoard: null,
    pendingPosition: null,
    phase: 'place',
    message: '',
  }
}

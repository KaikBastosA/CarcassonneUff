import { playerColors } from '../game.ts'
import type { GameState, Player } from '../game.ts'
import type { PlayerColor, Rotation } from '../tiles.ts'
import { confirmGameTurn, getFollowerChoices, placeGameTile, selectGameFollower, undoGamePlacement } from './actions.ts'
import { GameBoard } from './board.ts'
import { createGameTiles, drawPlayableTile } from './deck.ts'
import { createFollowers } from './followers.ts'
import { StructureMesh } from './mesh.ts'
import { Position } from './position.ts'
import { finalizeGame } from './scoring.ts'
import { computerStrategies, playerStrategies } from './strategy.ts'
import type { ComputerDifficulty, PlayerControl, TurnDecision } from './strategy.ts'
import { rotations } from './tiles.ts'

export interface PlayerSettings {
  readonly name: string
  readonly color: PlayerColor
  readonly control?: PlayerControl
  readonly difficulty?: ComputerDifficulty
}

export interface MatchConfiguration {
  readonly players: readonly PlayerSettings[]
  readonly startingPlayerIndex: number
  readonly seed?: number
}

export const defaultConfiguration: MatchConfiguration = Object.freeze({
  players: Object.freeze([Object.freeze({ name: 'Jogador 1', color: 'blue' as const }), Object.freeze({ name: 'Jogador 2', color: 'red' as const })]),
  startingPlayerIndex: 0,
})

function validatedConfiguration(config: MatchConfiguration): MatchConfiguration {
  if (config.players.length < 2 || config.players.length > 5) throw new Error('Configure entre 2 e 5 jogadores.')
  const players = config.players.map(({ name, color, control = 'human', difficulty = 'basic' }) => Object.freeze({ name: name.trim(), color, control, difficulty }))
  if (players.some(({ control }) => control !== 'human' && control !== 'computer')) throw new Error('Controle de jogador inválido.')
  if (players.some(({ difficulty }) => difficulty !== 'basic' && difficulty !== 'strategic')) throw new Error('Dificuldade de IA inválida.')
  if (players.some(({ name }) => !name || name.length > 30)) throw new Error('Use nomes de 1 a 30 caracteres.')
  if (players.some(({ color }) => !playerColors.includes(color))) throw new Error('Cor de jogador inválida.')
  if (new Set(players.map(({ color }) => color)).size !== players.length) throw new Error('Escolha uma cor diferente para cada jogador.')
  if (new Set(players.map(({ name }) => name.toLocaleLowerCase('pt-BR'))).size !== players.length) throw new Error('Escolha nomes diferentes para os jogadores.')
  if (!Number.isInteger(config.startingPlayerIndex) || config.startingPlayerIndex < 0 || config.startingPlayerIndex >= players.length) {
    throw new Error('Escolha quem começa a partida.')
  }
  if (config.seed !== undefined && (!Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff)) {
    throw new Error('A semente deve ser um inteiro de 0 a 4294967295.')
  }
  return Object.freeze({ players: Object.freeze(players), startingPlayerIndex: config.startingPlayerIndex, seed: config.seed })
}

function createPlayers(config: MatchConfiguration): readonly Player[] {
  return config.players.map(({ name, color, control = 'human', difficulty = 'basic' }) => ({
    id: `player-${color}`, name, color, score: 0, meeples: 7,
    strategy: control === 'computer' ? computerStrategies[difficulty] : playerStrategies.human,
    followers: createFollowers(`player-${color}`),
  }))
}

function configurationSnapshot(config: MatchConfiguration): GameState {
  const model = new GameBoard()
  return {
    players: createPlayers(config), currentPlayerIndex: config.startingPlayerIndex, startingPlayerIndex: config.startingPlayerIndex, round: 1,
    phase: 'configure', board: {}, model, mesh: new StructureMesh(model), previousBoard: null,
    message: '', scoring: [], winners: [], rotation: 0, deck: [], discarded: [], seed: null,
    deckIndex: 0, pendingPosition: null, activity: [],
  }
}

function freezeSnapshot(snapshot: GameState): GameState {
  return Object.freeze({
    ...snapshot,
    board: Object.freeze(Object.fromEntries(Object.entries(snapshot.board).map(([key, tile]) => [key, Object.freeze({ ...tile })]))),
    players: Object.freeze(snapshot.players.map((player) => Object.freeze({ ...player, followers: Object.freeze([...player.followers]) }))),
    deck: Object.freeze([...snapshot.deck]), discarded: Object.freeze([...snapshot.discarded]),
    activity: Object.freeze(snapshot.activity.map((event) => Object.freeze({ ...event }))),
    scoring: Object.freeze([...snapshot.scoring]), winners: Object.freeze([...snapshot.winners]),
  })
}

export abstract class MatchState {
  abstract readonly name: string

  start(match: GameSession, _config: MatchConfiguration): GameSession { return match }
  place(match: GameSession, _position: string): GameSession { return match }
  selectFollower(match: GameSession, _regionId: string | null): GameSession { return match }
  undo(match: GameSession): GameSession { return match }
  rotate(match: GameSession, _direction: -1 | 1): GameSession { return match }
  confirm(match: GameSession): GameSession { return match }
}

export class ConfigurationState extends MatchState {
  readonly name = 'Configuração'

  override start(match: GameSession, config: MatchConfiguration): GameSession {
    let configuration: MatchConfiguration
    try {
      configuration = validatedConfiguration(config)
    } catch (error) {
      return match.withSnapshot({ ...match.snapshot, message: error instanceof Error ? error.message : 'Configuração inválida.' })
    }
    const seed = configuration.seed ?? Math.floor(Math.random() * 4294967296)
    const { initial, deck } = createGameTiles(seed)
    const model = new GameBoard().place(initial, new Position(0, 0))
    const snapshot: GameState = {
      ...configurationSnapshot(configuration), phase: 'place', seed, deck,
      model, mesh: new StructureMesh(model), board: { '0,0': { kind: initial.kind, rotation: 0 } },
    }
    const state = new InProgressState()
    return state.enter(new GameSession(snapshot, state, configuration))
  }
}

export class InProgressState extends MatchState {
  readonly name = 'Em andamento'

  enter(match: GameSession): GameSession {
    if (match.snapshot.phase !== 'place') return match
    const snapshot = drawPlayableTile(match.snapshot)
    if (snapshot.deckIndex >= snapshot.deck.length) {
      const state = new FinalScoringState()
      return state.enter(match.withSnapshot(snapshot, state))
    }
    return match.withSnapshot(snapshot)
  }

  override place(match: GameSession, position: string): GameSession {
    return match.withSnapshot(placeGameTile(match.snapshot, position))
  }

  override selectFollower(match: GameSession, regionId: string | null): GameSession {
    return match.withSnapshot(selectGameFollower(match.snapshot, regionId))
  }

  override undo(match: GameSession): GameSession {
    return match.withSnapshot(undoGamePlacement(match.snapshot))
  }

  override rotate(match: GameSession, direction: -1 | 1): GameSession {
    if (match.snapshot.phase !== 'place' || (direction !== 1 && direction !== -1)) return match
    const rotation = ((match.snapshot.rotation + direction * 90 + 360) % 360) as Rotation
    return match.withSnapshot({ ...match.snapshot, rotation, message: '' })
  }

  override confirm(match: GameSession): GameSession {
    const snapshot = confirmGameTurn(match.snapshot)
    if (snapshot === match.snapshot) return match
    return this.enter(match.withSnapshot(snapshot))
  }
}

export class FinalScoringState extends MatchState {
  readonly name = 'Apuração final'

  enter(match: GameSession): GameSession {
    const snapshot = finalizeGame(match.snapshot)
    return snapshot === match.snapshot ? match : new GameSession(snapshot, new FinishedState(), match.configuration)
  }
}

export class FinishedState extends MatchState {
  readonly name = 'Encerrada'
}

export class GameSession {
  readonly snapshot: GameState
  readonly state: MatchState
  readonly configuration: MatchConfiguration

  constructor(snapshot: GameState, state: MatchState, configuration: MatchConfiguration = defaultConfiguration) {
    this.snapshot = freezeSnapshot(snapshot)
    this.state = Object.freeze(state)
    this.configuration = validatedConfiguration(configuration)
    Object.freeze(this)
  }

  static configure(configuration: MatchConfiguration = defaultConfiguration): GameSession {
    const config = validatedConfiguration(configuration)
    return new GameSession(configurationSnapshot(config), new ConfigurationState(), config)
  }

  withSnapshot(snapshot: GameState, state: MatchState = this.state): GameSession {
    return snapshot === this.snapshot && state === this.state ? this : new GameSession(snapshot, state, this.configuration)
  }

  start(configuration: MatchConfiguration = this.configuration): GameSession { return this.state.start(this, configuration) }
  get computerTurn(): boolean {
    return this.snapshot.phase === 'place' && this.snapshot.players[this.snapshot.currentPlayerIndex].strategy.automatic
  }

  get humanTurn(): boolean {
    return !this.snapshot.players[this.snapshot.currentPlayerIndex].strategy.automatic
  }

  place(position: string): GameSession { return this.humanTurn ? this.state.place(this, position) : this }
  selectFollower(regionId: string | null): GameSession { return this.humanTurn ? this.state.selectFollower(this, regionId) : this }
  undo(): GameSession { return this.humanTurn ? this.state.undo(this) : this }
  rotate(direction: -1 | 1): GameSession { return this.humanTurn ? this.state.rotate(this, direction) : this }
  confirm(): GameSession { return this.humanTurn ? this.state.confirm(this) : this }

  playComputerTurn(decision: TurnDecision | null): GameSession {
    if (!this.computerTurn || !decision || decision.tileId !== this.snapshot.deck[this.snapshot.deckIndex]?.id
      || !rotations.includes(decision.rotation) || typeof decision.position !== 'string'
      || (decision.regionId !== null && typeof decision.regionId !== 'string')) return this
    let next = this.withSnapshot({ ...this.snapshot, rotation: decision.rotation })
    next = next.state.place(next, decision.position)
    if (next.snapshot.phase !== 'meeple') return this
    if (decision.regionId !== null) {
      if (!getFollowerChoices(next.snapshot).some((choice) => choice.id === decision.regionId && choice.available)) return this
      next = next.state.selectFollower(next, decision.regionId)
    }
    return next.state.confirm(next)
  }

  newGame(): GameSession {
    return GameSession.configure({ ...this.configuration, seed: undefined })
  }
}

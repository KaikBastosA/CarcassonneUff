import { playerColors } from '../game.ts'
import type { GameState, GamePhase, Player } from '../game.ts'
import type { PlayerColor, Rotation } from '../tiles.ts'
import { confirmGameTurn, getFollowerChoices, placeGameTile, selectGameFollower, undoGamePlacement } from './actions.ts'
import { GameBoard } from './board.ts'
import { boardSnapshot } from './board-state.ts'
import { comprarCartela, descartarCartela, createGameTiles, drawPlayableTile } from './deck.ts'
import { createFollowers } from './followers.ts'
import { StructureMesh } from './mesh.ts'
import { Position } from './position.ts'
import { aplicarCriterioDesempate, consolidarPontos, consolidarPontuacaoGeral } from './scoring.ts'
import type { ScoringRecord } from './scoring.ts'

import { computerStrategies, playerStrategies, decisionView } from './strategy.ts'
import type { Difficulty, ControlType, TurnDecision } from './strategy.ts'
import { rotations } from './tiles.ts'

export interface PlayerSettings {
  readonly name: string
  readonly color: PlayerColor
  readonly control?: ControlType
  readonly difficulty?: Difficulty
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
  const players = createPlayers(config)
  return {
    players, currentPlayerIndex: config.startingPlayerIndex, startingPlayerIndex: config.startingPlayerIndex, round: 1,
    phase: 'place', board: boardSnapshot(model, players.flatMap(({ followers }) => followers)), model, mesh: new StructureMesh(model, players.flatMap(({ followers }) => followers), players), previousBoard: null,
    message: '', scoring: [], winners: [], tieBreakReserves: null, rotation: 0, deck: [], discarded: [], seed: config.seed ?? 0,
    deckIndex: 0, pendingPosition: null, activity: '', events: [],
  }
}

function freezeSnapshot(snapshot: GameState): GameState {
  const players = Object.freeze(snapshot.players.map((player) => Object.isFrozen(player) ? player
    : Object.freeze({ ...player, followers: Object.freeze([...player.followers]) })))
  return Object.freeze({
    ...snapshot, players,
    mesh: new StructureMesh(snapshot.model, players.flatMap(({ followers }) => followers), players),
    deck: Object.freeze([...snapshot.deck]), discarded: Object.freeze([...snapshot.discarded]),
    events: Object.freeze(snapshot.events.map((event) => Object.freeze({ ...event }))),
    scoring: Object.freeze(snapshot.scoring.map((record) => Object.freeze({ ...record, followerIds: Object.freeze([...record.followerIds]) }))),
    tieBreakReserves: snapshot.tieBreakReserves ? Object.freeze({ ...snapshot.tieBreakReserves }) : null,
    winners: Object.freeze(snapshot.winners.map((winner) => players.find(({ id }) => id === winner.id)!)),
  })
}

export abstract class MatchState {
  abstract readonly name: string

  start(match: GameSession, _config: MatchConfiguration): GameSession { return match }
  place(match: GameSession, _position: Position): GameSession { return match }
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
    const base = configurationSnapshot(configuration)
    const followers = base.players.flatMap(({ followers }) => followers)
    const snapshot: GameState = { ...base, seed, deck, model, mesh: new StructureMesh(model, followers, base.players), board: boardSnapshot(model, followers) }
    const state = new InProgressState()
    return new GameSession(snapshot, state, configuration).executarTurno()
  }
}

export class InProgressState extends MatchState {
  readonly name = 'Em andamento'

  enter(match: GameSession): GameSession {
    if (match.snapshot.phase !== 'place') return match
    const snapshot = drawPlayableTile(match.snapshot)
    const next = match.withSnapshot(snapshot)
    return next.verificarPilhaVazia() ? next.encerrarPartida() : next
  }

  override place(match: GameSession, position: Position): GameSession {
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
    return match.withSnapshot(snapshot).executarTurno()
  }
}

export class FinalScoringState extends MatchState {
  readonly name = 'Apuração final'

  enter(match: GameSession): GameSession {
    const settled = match.consolidarPontuacaoGeral()
    return settled === match ? match : new GameSession(settled.snapshot, new FinishedState(), match.configuration)
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
    return this.state instanceof InProgressState && this.snapshot.phase === 'place' && this.snapshot.players[this.snapshot.currentPlayerIndex].strategy.automatic
  }

  get humanTurn(): boolean {
    return !this.snapshot.players[this.snapshot.currentPlayerIndex].strategy.automatic
  }

  posicionarCartela(position: Position | string): GameSession {
    if (!this.humanTurn) return this
    if (typeof position === 'string') {
      const [x, y] = position.split(',').map(Number)
      if (!/^-?\d+,-?\d+$/.test(position) || !Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
        return this.state instanceof InProgressState && this.snapshot.phase === 'place'
          ? this.withSnapshot({ ...this.snapshot, message: 'Posição inválida.' }) : this
      }
      position = new Position(x, y)
    }
    return this.state.place(this, position)
  }
  selecionarSeguidor(regionId: string | null): GameSession { return this.humanTurn ? this.state.selectFollower(this, regionId) : this }
  undo(): GameSession { return this.humanTurn ? this.state.undo(this) : this }
  rotacionarCartela(direction: -1 | 1 = 1): GameSession { return this.humanTurn ? this.state.rotate(this, direction) : this }
  confirmarTurno(): GameSession { return this.humanTurn ? this.state.confirm(this) : this }

  get phase(): GamePhase {
    if (this.state instanceof ConfigurationState) return 'configure'
    if (this.state instanceof FinishedState || this.state instanceof FinalScoringState) return 'finished'
    return this.snapshot.phase
  }

  playComputerTurn(decision?: TurnDecision | null): GameSession {
    if (!this.computerTurn) return this
    if (decision === undefined) {
      const view = decisionView(this.snapshot)
      decision = view ? this.snapshot.players[this.snapshot.currentPlayerIndex].strategy.chooseTurn(view) : null
    }
    if (!decision || decision.tileId !== this.snapshot.deck[this.snapshot.deckIndex]?.id
      || !rotations.includes(decision.rotation) || !decision.position
      || (decision.regionId != null && typeof decision.regionId !== 'string')) return this
    // Worker messages lose class prototypes through structured clone.
    let position: Position
    try { position = new Position(decision.position.x, decision.position.y) } catch { return this }
    let next = this.withSnapshot({ ...this.snapshot, rotation: decision.rotation })
    next = next.state.place(next, position)
    if (next.snapshot.phase !== 'meeple') return this
    if (decision.regionId != null) {
      if (!getFollowerChoices(next.snapshot).some((choice) => choice.id === decision.regionId && choice.available)) return this
      next = next.state.selectFollower(next, decision.regionId)
    }
    return next.state.confirm(next)
  }

  executarTurno(): GameSession { return this.state instanceof InProgressState ? this.state.enter(this) : this }
  verificarPilhaVazia(): boolean { return this.snapshot.deckIndex >= this.snapshot.deck.length }
  comprarCartela() { return comprarCartela(this.snapshot) }
  descartarCartela(cartela = this.comprarCartela()): GameSession {
    if (!(this.state instanceof InProgressState) || cartela?.id !== this.comprarCartela()?.id) return this
    return this.withSnapshot(descartarCartela(this.snapshot))
  }
  consolidarPontos(records: readonly ScoringRecord[]): GameSession { return this.withSnapshot(consolidarPontos(this.snapshot, records)) }
  consolidarPontuacaoGeral(): GameSession { return this.withSnapshot(consolidarPontuacaoGeral(this.snapshot)) }
  aplicarCriterioDesempate(reservaSeguidores = this.snapshot.tieBreakReserves ?? undefined): readonly Player[] {
    return aplicarCriterioDesempate(this.snapshot.players, reservaSeguidores)
  }

  // Class diagrams use these names; sequence diagrams take precedence at the UI boundary.
  place(position: Position | string): GameSession { return this.posicionarCartela(position) }
  selectFollower(regionId: string | null): GameSession { return this.selecionarSeguidor(regionId) }
  rotate(direction: -1 | 1 = 1): GameSession { return this.rotacionarCartela(direction) }
  confirm(): GameSession { return this.confirmarTurno() }

  encerrarPartida(): GameSession {
    if (!(this.state instanceof InProgressState) || this.snapshot.phase !== 'place' || this.snapshot.deckIndex < this.snapshot.deck.length) return this
    const state = new FinalScoringState()
    return state.enter(this.withSnapshot(this.snapshot, state))
  }

  newGame(): GameSession {
    return GameSession.configure({ ...this.configuration, seed: undefined })
  }
}

export { FinalScoringState as ApuracaoFinalState }

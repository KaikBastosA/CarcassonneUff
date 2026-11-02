import { Check, Layers, RotateCcw, RotateCw } from 'lucide-react'
import type { CSSProperties } from 'react'
import { playerHex } from '../game'
import type { GamePhase, Player } from '../game'
import { terrainNames, tileNames } from '../tiles'
import type { FollowerChoice } from '../game/actions'
import type { Rotation, TileKind, TileVariant } from '../tiles'
import Meeple from './Meeple'
import Tile from './Tile'

interface TurnPanelProps {
  player: Player
  phase: GamePhase
  kind: TileKind
  variant?: TileVariant
  rotation: Rotation
  deckCount: number
  discardedCount: number
  pendingMeeple: boolean
  followerChoices: readonly FollowerChoice[]
  message: string
  validCount: number
  unfillableCount: number
  onRotate: (direction: -1 | 1) => void
  onSelectFollower: (regionId: string | null) => void
  onUndo: () => void
  onConfirm: () => void
  standings: readonly Player[]
  winners: readonly string[]
}

export default function TurnPanel({
  player,
  phase,
  kind,
  variant = 'plain',
  rotation,
  deckCount,
  discardedCount,
  pendingMeeple,
  followerChoices,
  message,
  validCount,
  unfillableCount,
  onRotate,
  onSelectFollower,
  onUndo,
  onConfirm,
  standings,
  winners,
}: TurnPanelProps) {
  const placed = phase === 'meeple'
  const roleNames = { knight: 'Cavaleiro', thief: 'Ladrão', monk: 'Monge', farmer: 'Fazendeiro' }

  if (phase === 'finished') return (
    <section className="turn" aria-label="Resultado da partida">
      <h2 className="turn-title">Pontuação final</h2>
      <p className="turn-instruction" role="status">{message}</p>
      <ol className="final-standings">
        {standings.map((item) => <li key={item.id}>
          <span>{item.name}{winners.includes(item.id) ? ' · Vencedor' : ''}</span>
          <strong>{item.score} pts</strong>
        </li>)}
      </ol>
    </section>
  )

  return (
    <section className="turn" aria-label="Painel da jogada" style={{ '--player-color': playerHex[player.color] } as CSSProperties}>
      <div className="turn-head">
        <div>
          <div className="turn-kicker">{player.local ? 'Sua vez' : `Vez de ${player.name}`}</div>
          <h2 className="turn-title">{placed ? 'Confirme sua jogada' : 'Coloque sua peça'}</h2>
        </div>
        <span className="turn-player-dot" aria-hidden="true" />
      </div>

      <div className="tile-tray">
        <div className="tile-frame">
          <div className="region-preview">
            <Tile kind={kind} rotation={rotation} variant={variant} />
            {followerChoices.map((choice, index) => <span key={choice.id} className="region-number" aria-hidden="true"
              style={{ left: `${choice.anchor.x * 100}%`, top: `${choice.anchor.y * 100}%` }}>{index + 1}</span>)}
          </div>
        </div>
        <div className="tile-details">
          <div>
            <div className="tile-kicker">Peça atual</div>
            <div className="tile-name">{tileNames[kind]}{variant === 'shield' ? ' com brasão' : ''}</div>
          </div>
          <div className="rotation-row">
            <button
              type="button" className="icon-button" onClick={() => onRotate(-1)}
              disabled={placed} aria-label="Girar peça para a esquerda"
            >
              <RotateCcw size={16} aria-hidden="true" />
            </button>
            <button
              type="button" className="icon-button" onClick={() => onRotate(1)}
              disabled={placed} aria-label="Girar peça para a direita"
            >
              <RotateCw size={16} aria-hidden="true" />
            </button>
            <span className="rotation-value">{rotation}°</span>
          </div>
        </div>
      </div>

      <ol className="steps">
        <li className={`step${placed ? ' is-done' : ' is-active'}`}>
          <span className="step-mark">{placed ? <Check size={12} aria-hidden="true" /> : '1'}</span>
          <span>Colocar peça</span>
        </li>
        <li className={`step${placed ? ' is-active' : ''}${pendingMeeple ? ' is-done' : ''}`}>
          <span className="step-mark">{pendingMeeple ? <Check size={12} aria-hidden="true" /> : '2'}</span>
          <span>Meeple opcional</span>
        </li>
      </ol>

      <p className="turn-instruction" role="status">
        {message || (placed
          ? 'Escolha uma região da peça para seu seguidor ou confirme sem colocar.'
          : `${validCount} encaixes nesta orientação. Gire a peça para testar outras posições.`)}
      </p>
      <p className="board-legend">Verde: encaixe válido · Amarelo: cria espaço sem encaixe · ×: sem peça compatível no catálogo</p>
      {unfillableCount > 0 && <p className="board-legend">{unfillableCount} espaços sem encaixe no catálogo.</p>}

      {placed && (
        <div className="turn-actions">
          <div className="region-choices" role="group" aria-label="Região do seguidor">
            {followerChoices.map((choice, index) => <button key={choice.id} type="button"
              className="button secondary region-choice" aria-pressed={choice.selected}
              disabled={!choice.available && !choice.selected}
              onClick={() => onSelectFollower(choice.id)}>
              <span>{index + 1}. {terrainNames[choice.terrain]} · {roleNames[choice.role]}</span>
              <span>{choice.selected ? 'Selecionada' : choice.available ? 'Livre' : player.meeples > 0 ? 'Ocupada' : 'Sem reserva'}</span>
            </button>)}
          </div>
          <p className="board-legend">Escolha pelos números no painel ou na peça. Fazendeiros permanecem no campo até o fim do jogo.</p>
          {pendingMeeple && <button
            type="button" className="button secondary meeple-button"
            onClick={() => onSelectFollower(null)}
          >
            <Meeple color={player.color} />
            <span>Remover seguidor</span>
            <span className="meeple-left">{player.meeples > 0 ? `${player.meeples} restantes` : 'Sem meeples'}</span>
          </button>}
          <button type="button" className="button primary" onClick={onConfirm}>Confirmar jogada</button>
          <button type="button" className="button text" onClick={onUndo}>Desfazer colocação</button>
        </div>
      )}

      <div className="deck-row">
        <Layers size={14} aria-hidden="true" />
        <span>{deckCount} peças na pilha · {discardedCount} descartadas</span>
      </div>
    </section>
  )
}

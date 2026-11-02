import { Check, Layers, RotateCcw, RotateCw } from 'lucide-react'
import type { CSSProperties } from 'react'
import { playerHex } from '../game'
import type { GamePhase, Player } from '../game'
import { tileNames } from '../tiles'
import type { Rotation, TileKind } from '../tiles'
import Meeple from './Meeple'
import Tile from './Tile'

interface TurnPanelProps {
  player: Player
  phase: GamePhase
  kind: TileKind
  rotation: Rotation
  deckCount: number
  pendingMeeple: boolean
  onRotate: (direction: -1 | 1) => void
  onToggleMeeple: () => void
  onUndo: () => void
  onConfirm: () => void
}

export default function TurnPanel({
  player,
  phase,
  kind,
  rotation,
  deckCount,
  pendingMeeple,
  onRotate,
  onToggleMeeple,
  onUndo,
  onConfirm,
}: TurnPanelProps) {
  const placed = phase === 'meeple'
  const canPlaceMeeple = player.meeples > 0 || pendingMeeple

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
        <div className="tile-frame"><Tile kind={kind} rotation={rotation} /></div>
        <div className="tile-details">
          <div>
            <div className="tile-kicker">Peça atual</div>
            <div className="tile-name">{tileNames[kind]}</div>
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

      <p className="turn-instruction">
        {placed
          ? 'Coloque um meeple na peça ou confirme a jogada.'
          : 'Clique em uma casa livre do tabuleiro para colocar a peça.'}
      </p>

      {placed && (
        <div className="turn-actions">
          <button
            type="button" className="button secondary meeple-button"
            onClick={onToggleMeeple} disabled={!canPlaceMeeple}
          >
            <Meeple color={player.color} />
            <span>{pendingMeeple ? 'Remover meeple' : 'Colocar meeple'}</span>
            <span className="meeple-left">{player.meeples > 0 ? `${player.meeples} restantes` : 'Sem meeples'}</span>
          </button>
          <button type="button" className="button primary" onClick={onConfirm}>Confirmar jogada</button>
          <button type="button" className="button text" onClick={onUndo}>Desfazer colocação</button>
        </div>
      )}

      <div className="deck-row">
        <Layers size={14} aria-hidden="true" />
        <span>{deckCount} peças restantes</span>
      </div>
    </section>
  )
}

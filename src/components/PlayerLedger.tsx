import { Check, Plus } from 'lucide-react'
import type { CSSProperties } from 'react'
import { playerAvatarInk, playerHex } from '../game'
import type { GameEvent, Player } from '../game'
import Meeple from './Meeple'

interface PlayerLedgerProps {
  players: readonly Player[]
  currentPlayerId: string
  activity: readonly GameEvent[]
  round: number
  copied: boolean
  onCopyInvite: () => void
}

export default function PlayerLedger({ players, currentPlayerId, activity, round, copied, onCopyInvite }: PlayerLedgerProps) {
  const playersById = new Map(players.map((player) => [player.id, player]))

  return (
    <aside className="ledger" aria-label="Jogadores e histórico">
      <div className="ledger-head">
        <h2>Jogadores</h2>
        <span className="ledger-count">{players.length} de 5</span>
      </div>
      <div className="player-list">
        {players.map((player) => {
          const current = player.id === currentPlayerId
          return (
            <div
              key={player.id}
              className={`player-row${current ? ' is-current' : ''}`}
              style={{ '--player-color': playerHex[player.color] } as CSSProperties}
            >
              <span className="avatar" style={{ background: playerHex[player.color], color: playerAvatarInk[player.color] }}>
                {player.name.slice(0, 1)}
              </span>
              <div className="player-info">
                <div className="player-name">
                  {player.name}
                </div>
                <div className="player-meta">
                  <span className="meeple-count"><Meeple color={player.color} />{player.meeples}</span>
                  {current && <span className="turn-word">na vez</span>}
                </div>
              </div>
              <div className="player-score">
                <span className="score">{player.score}</span>
                <span className="score-unit">pts</span>
              </div>
            </div>
          )
        })}
        <button type="button" className="invite-row" onClick={onCopyInvite}>
          {copied ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
          <span>{copied ? 'Convite copiado' : 'Convidar jogador'}</span>
        </button>
      </div>
      <div className="ledger-divider" />
      <div className="log-head">
        <h2>Histórico</h2>
        <span>Rodada {round}</span>
      </div>
      <ol className="log-list">
        {activity.slice(0, 6).map((event) => {
          const player = playersById.get(event.playerId)
          return (
            <li key={event.id} className="log-item">
              <span
                className="log-dot"
                style={{ background: player ? playerHex[player.color] : 'var(--ink-muted)' }}
                aria-hidden="true"
              />
              <span className="log-text"><strong>{player?.name ?? 'Jogador'}</strong> {event.text}</span>
              {event.points
                ? <span className="log-points">+{event.points}</span>
                : <span className="log-round">R{event.round}</span>}
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

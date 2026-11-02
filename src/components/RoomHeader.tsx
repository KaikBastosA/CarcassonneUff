import { Check, Copy } from 'lucide-react'
import { playerAvatarInk, playerHex } from '../game'
import type { Player } from '../game'

interface RoomHeaderProps {
  players: Player[]
  roomCode: string
  copied: boolean
  onCopyInvite: () => void
}

export default function RoomHeader({ players, roomCode, copied, onCopyInvite }: RoomHeaderProps) {
  return (
    <header className="room-header">
      <div className="brand">
        <h1 className="wordmark">Carcassonne</h1>
        <span className="brand-divider" aria-hidden="true" />
        <button type="button" className="room-chip" onClick={onCopyInvite} aria-label="Copiar convite da sala">
          <span className="room-chip-label">Sala</span>
          <span className="room-code">{roomCode}</span>
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
        <span className="preview-tag">Prévia local</span>
      </div>
      <div className="presence">
        <div className="avatar-stack" aria-hidden="true">
          {players.map((player) => (
            <span
              key={player.id} className="avatar avatar-sm"
              style={{ background: playerHex[player.color], color: playerAvatarInk[player.color] }}
            >
              {player.name.slice(0, 1)}
            </span>
          ))}
        </div>
        <span className="presence-label">{players.length} de 5</span>
      </div>
      <span className="sr-only" aria-live="polite">{copied ? 'Convite copiado' : ''}</span>
    </header>
  )
}

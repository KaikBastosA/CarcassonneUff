import { Moon, Sun } from 'lucide-react'
import { playerAvatarInk, playerHex } from '../game'
import type { Player } from '../game'
import type { Theme } from '../theme'

interface RoomHeaderProps {
  players: Player[]
  theme: Theme
  onToggleTheme: () => void
}

export default function RoomHeader({
  players,
  theme,
  onToggleTheme,
}: RoomHeaderProps) {
  return (
    <header className="room-header">
      <div className="brand">
        <h1 className="wordmark">Carcassonne</h1>
        <span className="preview-tag">Prévia local</span>
      </div>
      <div className="presence">
        <button
          type="button" className="theme-toggle" onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
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
    </header>
  )
}

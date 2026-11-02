import { Moon, Sun } from 'lucide-react'
import type { Theme } from '../theme'

interface GameHeaderProps {
  theme: Theme
  onToggleTheme: () => void
  onNewGame: () => void
}

export default function GameHeader({
  theme,
  onToggleTheme,
  onNewGame,
}: GameHeaderProps) {
  return (
    <header className="game-header">
      <div className="brand">
        <h1 className="wordmark">Carcassonne</h1>
        <span className="game-mode">Partida local</span>
      </div>
      <div className="header-actions">
        <button type="button" className="new-game-button" onClick={onNewGame}>Nova partida</button>
        <button
          type="button" className="theme-toggle" onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
        >
          {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
        </button>
      </div>
    </header>
  )
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { playerColors } from '../game'
import { playerNames } from '../tiles'
import type { MatchConfiguration, PlayerSettings } from '../game/session'

interface GameSetupProps {
  configuration: MatchConfiguration
  message: string
  onStart: (configuration: MatchConfiguration) => void
}

export default function GameSetup({ configuration, message, onStart }: GameSetupProps) {
  const [players, setPlayers] = useState<readonly PlayerSettings[]>(configuration.players)
  const [startingPlayerIndex, setStartingPlayerIndex] = useState(configuration.startingPlayerIndex)

  function changeCount(count: number) {
    setPlayers((current) => {
      const next = current.slice(0, count)
      while (next.length < count) next.push({
        name: `Jogador ${next.length + 1}`,
        color: playerColors.find((color) => !next.some((player) => player.color === color))!,
      })
      return next
    })
    if (startingPlayerIndex >= count) setStartingPlayerIndex(0)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onStart({ players, startingPlayerIndex })
  }

  return (
    <section className="setup-screen" aria-label="Configurar partida">
      <form className="setup-card" onSubmit={submit}>
        <h2>Nova partida</h2>
        <p>De 2 a 5 jogadores, todos neste dispositivo. Escolha os nomes, as cores e quem começa.</p>
        <label>Quantidade de jogadores
          <select value={players.length} onChange={(event) => changeCount(Number(event.target.value))}>
            {[2, 3, 4, 5].map((count) => <option key={count} value={count}>{count}</option>)}
          </select>
        </label>
        <div className="setup-players">
          {players.map((player, index) => <div key={index} className="setup-player">
            <label>Jogador {index + 1}
              <input required maxLength={30} value={player.name} onChange={(event) => setPlayers((current) => current.map((item, position) =>
                position === index ? { ...item, name: event.target.value } : item))} />
            </label>
            <label>Cor do jogador {index + 1}
              <select value={player.color} onChange={(event) => setPlayers((current) => current.map((item, position) =>
                position === index ? { ...item, color: event.target.value as PlayerSettings['color'] } : item))}>
                {playerColors.map((color) => <option key={color} value={color}
                  disabled={players.some((item, position) => position !== index && item.color === color)}>{playerNames[color]}</option>)}
              </select>
            </label>
          </div>)}
        </div>
        <label>Quem começa
          <select value={startingPlayerIndex} onChange={(event) => setStartingPlayerIndex(Number(event.target.value))}>
            {players.map((player, index) => <option key={index} value={index}>{player.name || `Jogador ${index + 1}`}</option>)}
          </select>
        </label>
        {message && <p className="setup-error" role="alert">{message}</p>}
        <button type="submit" className="button primary">Iniciar partida</button>
      </form>
    </section>
  )
}

import { useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { playerColors, playerHex } from '../game'
import { playerNames } from '../tiles'
import type { MatchConfiguration, PlayerSettings } from '../game/session'
import { difficultyNames } from '../game/strategy'

interface GameSetupProps {
  configuration: MatchConfiguration
  message: string
  onStart: (configuration: MatchConfiguration) => void
}

export default function GameSetup({ configuration, message, onStart }: GameSetupProps) {
  const [players, setPlayers] = useState<readonly PlayerSettings[]>(configuration.players)
  const [startingPlayerIndex, setStartingPlayerIndex] = useState(configuration.startingPlayerIndex)
  const reduceMotion = useReducedMotion()
  const spring = reduceMotion ? { duration: 0 } : { type: 'spring' as const, duration: 0.3, bounce: 0 }
  const startPlayer = players[startingPlayerIndex] ?? players[0]
  const allComputer = players.every((player) => player.control === 'computer')
  const humanCount = players.filter((player) => player.control !== 'computer').length
  const computerCount = players.length - humanCount

  function changeCount(count: number) {
    setPlayers((current) => {
      const next = current.slice(0, count)
      while (next.length < count) next.push({
        name: `Jogador ${next.length + 1}`,
        color: playerColors.find((color) => !next.some((player) => player.color === color)) ?? playerColors[0],
      })
      return next
    })
    if (startingPlayerIndex >= count) setStartingPlayerIndex(0)
  }

  function updatePlayer(index: number, patch: Partial<PlayerSettings>) {
    setPlayers((current) => current.map((player, position) => (
      position === index ? { ...player, ...patch } : player
    )))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onStart({ players, startingPlayerIndex })
  }

  return (
    <section className="setup-screen" aria-label="Configurar partida">
      <form className="setup-shell" onSubmit={submit}>
        <div className="setup-main">
          <header className="setup-head">
            <div className="setup-title">
              <h2>Nova partida</h2>
              <p>2 a 5 jogadores neste dispositivo. Configure humanos ou IA, as cores e quem começa.</p>
            </div>
            <fieldset className="setup-count">
              <legend>Jogadores</legend>
              <div className="count-options">
                {[2, 3, 4, 5].map((count) => (
                  <label key={count} className="count-option">
                    <input
                      type="radio" name="player-count" value={count}
                      checked={players.length === count}
                      onChange={() => changeCount(count)}
                    />
                    {players.length === count && (
                      <motion.span layoutId="count-pill" className="count-pill" transition={spring} />
                    )}
                    <span className="count-number">{count}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </header>

          <div className="setup-roster" role="group" aria-label="Jogadores">
            <div className="roster-head" aria-hidden="true">
              <span>Jogador</span>
              <span>Cor</span>
              <span>Controle</span>
              <span>Dificuldade</span>
              <span>Começa</span>
            </div>
            <AnimatePresence initial={false}>
              {players.map((player, index) => (
                <motion.div
                  key={index} layout
                  className={`roster-row${startingPlayerIndex === index ? ' is-start' : ''}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={spring}
                >
                  <div className="roster-player">
                    <span className="roster-swatch" style={{ background: playerHex[player.color] }} aria-hidden="true" />
                    <div className="roster-name">
                      <input
                        id={`player-name-${index}`} aria-label={`Jogador ${index + 1}`} value={player.name} required maxLength={30}
                        onChange={(event) => updatePlayer(index, { name: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="roster-cell">
                    <span className="cell-label" aria-hidden="true">Cor</span>
                    <select
                      id={`player-color-${index}`} aria-label={`Cor do jogador ${index + 1}`} value={player.color}
                      onChange={(event) => updatePlayer(index, { color: event.target.value as PlayerSettings['color'] })}
                    >
                      {playerColors.map((color) => (
                        <option
                          key={color} value={color}
                          disabled={players.some((item, position) => position !== index && item.color === color)}
                        >
                          {playerNames[color]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="roster-cell">
                    <span className="cell-label" aria-hidden="true">Controle</span>
                    <select
                      id={`player-control-${index}`} aria-label={`Controle do jogador ${index + 1}`} value={player.control ?? 'human'}
                      onChange={(event) => updatePlayer(index, { control: event.target.value as PlayerSettings['control'] })}
                    >
                      <option value="human">Humano</option>
                      <option value="computer">IA</option>
                    </select>
                  </div>

                  <div className="roster-cell">
                    <span className="cell-label" aria-hidden="true">Dificuldade</span>
                    {player.control === 'computer' ? (
                      <>
                        <select
                          id={`player-difficulty-${index}`} aria-label={`Dificuldade do jogador ${index + 1}`} value={player.difficulty ?? 'basic'}
                          onChange={(event) => updatePlayer(index, { difficulty: event.target.value as PlayerSettings['difficulty'] })}
                        >
                          <option value="basic">{difficultyNames.basic}</option>
                          <option value="strategic">{difficultyNames.strategic}</option>
                        </select>
                      </>
                    ) : (
                      <span className="roster-none">—</span>
                    )}
                  </div>

                  <div className="roster-cell roster-start">
                    <span className="cell-label" aria-hidden="true">Começa</span>
                    <label className="start-radio">
                      <input
                        type="radio" name="starting-player"
                        checked={startingPlayerIndex === index}
                        onChange={() => setStartingPlayerIndex(index)}
                        aria-label={`Quem começa: jogador ${index + 1}`}
                      />
                      <span className="start-radio-mark" aria-hidden="true" />
                    </label>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        <aside className="setup-summary" aria-label="Resumo da partida">
          <div className="summary-count">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={players.length} className="summary-count-number"
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={spring}
              >
                {players.length}
              </motion.span>
            </AnimatePresence>
            <span className="summary-count-label">jogadores</span>
          </div>

          <div className="summary-meta">
            <span>
              {allComputer
                ? 'Partida automática'
                : humanCount === players.length ? 'Todos humanos' : `${humanCount} humanos · ${computerCount} IA`}
            </span>
            <span className="summary-colors" aria-hidden="true">
              {players.map((player, index) => (
                <span key={index} className="summary-dot" style={{ background: playerHex[player.color] }} />
              ))}
            </span>
          </div>

          <div className="setup-start-summary">
            <span>Quem começa</span>
            <strong>
              <span className="summary-dot" style={{ background: playerHex[startPlayer.color] }} aria-hidden="true" />
              {startPlayer.name || `Jogador ${startingPlayerIndex + 1}`}
            </strong>
          </div>

          {message && <p className="setup-error" role="alert">{message}</p>}
          <button type="submit" className="button primary setup-start-button">
            {allComputer ? 'Observar partida' : 'Iniciar partida'}
          </button>
        </aside>
      </form>
    </section>
  )
}

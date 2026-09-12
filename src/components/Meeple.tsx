import type { PlayerColor } from '../tiles'

const colors: Record<PlayerColor, string> = {
  blue: '#32678c',
  red: '#b84f3d',
  yellow: '#e4b640',
  black: '#464440',
}

export default function Meeple({ color }: { color: PlayerColor }) {
  return (
    <svg viewBox="0 0 40 44" className="meeple" aria-hidden="true">
      <path
        d="M 14 12 C 10 3 16 1 20 1 C 24 1 30 3 26 12 L 36 21 Q 38 24 35 27 L 28 24 L 28 29 L 34 41 L 23 41 L 20 33 L 17 41 L 6 41 L 12 29 L 12 24 L 5 27 Q 2 24 4 21 Z"
        fill={colors[color]} stroke="#36362e" strokeWidth="1.6" strokeLinejoin="round"
      />
    </svg>
  )
}

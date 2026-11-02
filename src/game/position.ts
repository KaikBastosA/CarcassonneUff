import { sides } from './tiles.ts'
import type { Side } from './tiles.ts'

const offsets: Record<Side, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
}

export class Position {
  readonly x: number
  readonly y: number

  constructor(x: number, y: number) {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
      throw new Error('A posição deve usar coordenadas inteiras seguras.')
    }
    this.x = x
    this.y = y
    Object.freeze(this)
  }

  get key(): string {
    return `${this.x},${this.y}`
  }

  neighbor(side: Side): Position {
    const [x, y] = offsets[side]
    return new Position(this.x + x, this.y + y)
  }

  adjacent(): Position[] {
    return sides.map((side) => this.neighbor(side))
  }

  equals(other: Position): boolean {
    return this.x === other.x && this.y === other.y
  }
}

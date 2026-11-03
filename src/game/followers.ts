export type FollowerRole = 'thief' | 'knight' | 'monk' | 'farmer'
export type FollowerStatus = 'reserve' | 'allocated'

export interface FollowerAllocation {
  readonly tileId: string
  readonly regionId: string
  readonly role: FollowerRole
}

export class Follower {
  readonly id: string
  readonly ownerId: string
  readonly allocation: FollowerAllocation | null

  constructor(id: string, ownerId: string, allocation: FollowerAllocation | null = null) {
    this.id = id
    this.ownerId = ownerId
    this.allocation = allocation ? Object.freeze({ ...allocation }) : null
    Object.freeze(this)
  }

  get status(): FollowerStatus {
    return this.allocation ? 'allocated' : 'reserve'
  }

  get role(): FollowerRole | undefined {
    return this.allocation?.role
  }

  allocate(allocation: FollowerAllocation): Follower
  /** @deprecated Pass a FollowerAllocation object. */
  allocate(tileId: string, regionId: string, role: FollowerRole): Follower
  allocate(allocation: FollowerAllocation | string, regionId?: string, role?: FollowerRole): Follower {
    if (this.allocation) throw new Error('Este seguidor já está alocado.')
    const target = typeof allocation === 'string' ? { tileId: allocation, regionId: regionId!, role: role! } : allocation
    if (!target.tileId || !target.regionId || !['thief', 'knight', 'monk', 'farmer'].includes(target.role)) {
      throw new Error('Alocação de seguidor inválida.')
    }
    return new Follower(this.id, this.ownerId, target)
  }

  release(): Follower {
    return new Follower(this.id, this.ownerId)
  }
}

export function createFollowers(ownerId: string): readonly Follower[] {
  return Object.freeze(Array.from({ length: 7 }, (_, index) => new Follower(`${ownerId}-${index + 1}`, ownerId)))
}

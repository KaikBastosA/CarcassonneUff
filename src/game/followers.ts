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

  get role(): FollowerRole | 'none' {
    return this.allocation?.role ?? 'none'
  }

  allocate(tileId: string, regionId: string, role: FollowerRole): Follower {
    if (this.allocation) throw new Error('Este seguidor já está alocado.')
    return new Follower(this.id, this.ownerId, { tileId, regionId, role })
  }

  release(): Follower {
    return new Follower(this.id, this.ownerId)
  }
}

export function createFollowers(ownerId: string): readonly Follower[] {
  return Object.freeze(Array.from({ length: 7 }, (_, index) => new Follower(`${ownerId}-${index + 1}`, ownerId)))
}

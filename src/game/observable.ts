export interface Observer {
  update(): void
}

export interface Observable {
  add(observer: Observer): void
  remove(observer: Observer): void
  notify(): void
}

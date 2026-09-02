export class GameplayEventStream {
  constructor(sourceId = 'authority') {
    this.sourceId = sourceId
    this.nextSequence = 1
    this.pending = []
    this.listeners = new Set()
  }

  emit(type, payload = {}, meta = {}) {
    if (!type) {
      throw new Error('Gameplay event type is required')
    }

    const event = {
      sourceId: this.sourceId,
      sequence: this.nextSequence,
      type,
      tick: meta.tick ?? null,
      time: meta.time ?? null,
      payload,
    }

    this.nextSequence += 1
    this.pending.push(event)

    for (const listener of this.listeners) {
      listener(event)
    }

    return event
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  drain() {
    const events = this.pending
    this.pending = []
    return events
  }

  peekNextSequence() {
    return this.nextSequence
  }
}

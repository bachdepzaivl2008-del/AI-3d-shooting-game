export class IntentBuffer {
  constructor() {
    this.pending = []
  }

  push(intent) {
    if (!intent || typeof intent !== 'object') {
      throw new Error('Intent must be an object')
    }

    if (typeof intent.type !== 'string' || intent.type.length === 0) {
      throw new Error('Intent type is required')
    }

    this.pending.push(intent)
  }

  drain() {
    if (this.pending.length === 0) {
      return []
    }

    const batch = this.pending
    this.pending = []
    return batch
  }

  get size() {
    return this.pending.length
  }
}

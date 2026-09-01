export class IntentSequencer {
  constructor(sourceId, startSequence = 1) {
    if (typeof sourceId !== 'string' || sourceId.length === 0) {
      throw new Error('IntentSequencer sourceId is required')
    }

    if (!Number.isInteger(startSequence) || startSequence < 0) {
      throw new Error('IntentSequencer startSequence must be a non-negative integer')
    }

    this.sourceId = sourceId
    this.nextSequence = startSequence
  }

  create(type, payload = {}) {
    if (typeof type !== 'string' || type.length === 0) {
      throw new Error('Intent type is required')
    }

    const intent = {
      type,
      sourceId: this.sourceId,
      sequence: this.nextSequence,
      payload,
    }

    this.nextSequence += 1
    return intent
  }

  peekNextSequence() {
    return this.nextSequence
  }
}

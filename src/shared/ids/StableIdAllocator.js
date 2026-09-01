export class StableIdAllocator {
  constructor(namespace = 'entity', startAt = 1) {
    this.namespace = namespace
    this.nextValue = startAt
  }

  next() {
    const value = this.nextValue
    this.nextValue += 1
    return `${this.namespace}:${String(value).padStart(6, '0')}`
  }

  peek() {
    return `${this.namespace}:${String(this.nextValue).padStart(6, '0')}`
  }
}

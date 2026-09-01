export class SeededRandom {
  constructor(seed = 1) {
    const normalizedSeed = Number(seed) >>> 0
    this.state = normalizedSeed === 0 ? 0x6d2b79f5 : normalizedSeed
  }

  nextUint32() {
    let value = this.state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state
  }

  nextFloat() {
    return this.nextUint32() / 0x100000000
  }
}

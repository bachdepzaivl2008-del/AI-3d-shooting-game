export class SimulationClock {
  constructor(fixedDeltaTime) {
    if (!Number.isFinite(fixedDeltaTime) || fixedDeltaTime <= 0) {
      throw new Error('fixedDeltaTime must be a positive finite number')
    }
    this.fixedDeltaTime = fixedDeltaTime
    this.tick = 0
    this.elapsedTime = 0
  }

  advance() {
    this.tick += 1
    this.elapsedTime = this.tick * this.fixedDeltaTime
    return this.getSnapshot()
  }

  reset() {
    this.tick = 0
    this.elapsedTime = 0
  }

  getSnapshot() {
    return {
      tick: this.tick,
      elapsedTime: this.elapsedTime,
      fixedDeltaTime: this.fixedDeltaTime,
    }
  }
}

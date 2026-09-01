import { createInitialGameState } from '../state/createInitialGameState.js'

export class Simulation {
  constructor(config) {
    this.config = config
    this.state = createInitialGameState(config)
  }

  update(deltaTime) {
    this.state.time += deltaTime

    this.state.cube.rotationY +=
      this.config.cube.spinSpeed * deltaTime

    if (this.state.cube.rotationY > Math.PI * 2) {
      this.state.cube.rotationY -= Math.PI * 2
    }
  }

  getState() {
    return this.state
  }
}

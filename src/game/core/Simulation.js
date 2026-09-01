import { createInitialGameState } from '../state/createInitialGameState.js'
import { SimulationClock } from '../../shared/simulation/SimulationClock.js'
import { SeededRandom } from '../../shared/random/SeededRandom.js'
import { StableIdAllocator } from '../../shared/ids/StableIdAllocator.js'

export class Simulation {
  constructor(config) {
    this.config = config

    this.clock = new SimulationClock(
      config.simulation.fixedDeltaTime
    )

    this.random = new SeededRandom(
      config.simulation.randomSeed
    )

    this.entityIds = new StableIdAllocator('entity')

    this.state = createInitialGameState(config, {
      cubeId: this.entityIds.next(),
    })
  }

  update(intents = []) {
    if (!Array.isArray(intents)) {
      throw new Error('Simulation intents must be an array')
    }

    const clockState = this.clock.advance()
    const deltaTime = clockState.fixedDeltaTime

    this.state.tick = clockState.tick
    this.state.time = clockState.elapsedTime

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

import { createInitialGameState } from '../state/createInitialGameState.js'
import { SimulationClock } from '../../shared/simulation/SimulationClock.js'
import { SeededRandom } from '../../shared/random/SeededRandom.js'
import { StableIdAllocator } from '../../shared/ids/StableIdAllocator.js'
import { PlayerMovementSystem } from '../systems/PlayerMovementSystem.js'

function latestPlayerInput(intents) {
  let latest = null

  for (const intent of intents) {
    if (intent?.type !== 'PLAYER_INPUT') {
      continue
    }

    if (
      latest === null ||
      intent.sequence > latest.sequence
    ) {
      latest = intent
    }
  }

  return latest
}

export class Simulation {
  static async create(config) {
    const movementSystem =
      await PlayerMovementSystem.create(config)

    return new Simulation(
      config,
      movementSystem
    )
  }

  constructor(config, movementSystem) {
    this.config = config
    this.movementSystem = movementSystem

    this.clock = new SimulationClock(
      config.simulation.fixedDeltaTime
    )

    this.random = new SeededRandom(
      config.simulation.randomSeed
    )

    this.entityIds = new StableIdAllocator('entity')

    this.state = createInitialGameState(config, {
      cubeId: this.entityIds.next(),
      playerId: this.entityIds.next(),
      playerPosition:
        this.movementSystem.getPosition(),
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

    const inputIntent = latestPlayerInput(intents)

    const movement =
      this.movementSystem.update(
        inputIntent?.payload ?? {},
        deltaTime
      )

    this.state.player.position = {
      x: movement.position.x,
      y: movement.position.y,
      z: movement.position.z,
    }

    this.state.player.grounded =
      movement.grounded

    if (inputIntent) {
      this.state.player.lastInputSequence =
        inputIntent.sequence
    }
  }

  getState() {
    return this.state
  }

  dispose() {
    this.movementSystem.dispose()
  }
}

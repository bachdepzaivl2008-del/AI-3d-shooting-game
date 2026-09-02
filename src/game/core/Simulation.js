import { createInitialGameState } from '../state/createInitialGameState.js'
import { SimulationClock } from '../../shared/simulation/SimulationClock.js'
import { SeededRandom } from '../../shared/random/SeededRandom.js'
import { createGameIdAllocators } from '../../shared/entities/FoundationRegistry.js'
import { GameplayEventStream } from '../../shared/events/GameplayEventStream.js'
import { PlayerMovementSystem } from '../systems/PlayerMovementSystem.js'
import { PlayerLookSystem } from '../systems/PlayerLookSystem.js'

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
    this.lookSystem =
      new PlayerLookSystem(config)

    this.clock = new SimulationClock(
      config.simulation.fixedDeltaTime
    )

    this.random = new SeededRandom(
      config.simulation.randomSeed
    )

    this.ids = createGameIdAllocators()

    this.events =
      new GameplayEventStream('simulation')

    this.state =
      createInitialGameState(config, {
        cubeId: this.ids.entity.next(),
        playerId: this.ids.entity.next(),
        playerPosition:
          this.movementSystem.getPosition(),
      })

    this.events.emit(
      'SIMULATION_CREATED',
      {},
      {
        tick: this.state.tick,
        time: this.state.time,
      }
    )
  }

  update(intents = []) {
    if (!Array.isArray(intents)) {
      throw new Error(
        'Simulation intents must be an array'
      )
    }

    const clockState =
      this.clock.advance()

    const deltaTime =
      clockState.fixedDeltaTime

    this.state.tick = clockState.tick
    this.state.time = clockState.elapsedTime

    this.state.cube.rotationY +=
      this.config.cube.spinSpeed * deltaTime

    if (
      this.state.cube.rotationY >
      Math.PI * 2
    ) {
      this.state.cube.rotationY -=
        Math.PI * 2
    }

    const inputIntent =
      latestPlayerInput(intents)

    const payload =
      inputIntent?.payload ?? {}

    this.state.player.orientation =
      this.lookSystem.update(
        this.state.player.orientation,
        payload
      )

    const movement =
      this.movementSystem.update(
        payload,
        deltaTime,
        this.state.player.orientation.yaw
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

  getEventStream() {
    return this.events
  }

  dispose() {
    this.movementSystem.dispose()
  }
}

import { gameConfig } from '../src/game/config/gameConfig.js'
import { PlayerMovementSystem } from '../src/game/systems/PlayerMovementSystem.js'

const BIASES = [
  0,
  0.00001,
  0.0001,
  0.001,
  0.005,
  0.01,
]

function cloneConfig({
  groundSnapBiasPerTick,
}) {
  return {
    ...gameConfig,
    collision: {
      ...gameConfig.collision,
      gravity: {
        ...gameConfig.collision.gravity,
      },
      character: {
        ...gameConfig.collision.character,
      },
    },
    movement: {
      ...gameConfig.movement,
      groundSnapBiasPerTick,
    },
    player: {
      ...gameConfig.player,
      spawnPosition: {
        ...gameConfig.player.spawnPosition,
      },
    },
    world: {
      ...gameConfig.world,
    },
    cube: {
      ...gameConfig.cube,
      startPosition: {
        ...gameConfig.cube.startPosition,
      },
    },
  }
}

async function runCase({
  name,
  bias,
  sprint,
}) {
  const config = cloneConfig({
    groundSnapBiasPerTick: bias,
  })

  const movement =
    await PlayerMovementSystem.create(config)

  const start = movement.getPosition()
  let previous = { ...start }

  let minPlanarStep = Infinity
  let minPlanarStepTick = null
  let lowStepCount = 0
  let groundedTrueCount = 0
  const anomalies = []

  for (let tick = 1; tick <= 60; tick += 1) {
    const result = movement.update(
      {
        moveX: 1,
        moveY: 0,
        sprint,
        fire: false,
        ads: false,
      },
      config.simulation.fixedDeltaTime,
      0
    )

    if (result.grounded) {
      groundedTrueCount += 1
    }

    const dx =
      result.position.x - previous.x

    const dz =
      result.position.z - previous.z

    const planarStep =
      Math.hypot(dx, dz)

    if (planarStep < minPlanarStep) {
      minPlanarStep = planarStep
      minPlanarStepTick = tick
    }

    const expectedStep =
      config.movement.baseSpeed *
      (sprint
        ? config.movement.sprintMultiplier
        : 1) *
      config.simulation.fixedDeltaTime

    if (planarStep < expectedStep * 0.9) {
      lowStepCount += 1

      anomalies.push({
        tick,
        planarStep,
        expectedStep,
        correctedMovement:
          result.correctedMovement,
        position: result.position,
        grounded: result.grounded,
      })
    }

    previous = {
      ...result.position,
    }
  }

  const end = movement.getPosition()

  const planarDistance =
    Math.hypot(
      end.x - start.x,
      end.z - start.z
    )

  const expectedDistance =
    config.movement.baseSpeed *
    (sprint
      ? config.movement.sprintMultiplier
      : 1)

  const output = {
    name,
    bias,
    sprint,
    expectedDistance,
    planarDistance,
    error:
      planarDistance - expectedDistance,
    minPlanarStep,
    minPlanarStepTick,
    lowStepCount,
    groundedTrueCount,
    finalGrounded:
      groundedTrueCount === 60,
    anomalies,
  }

  movement.dispose()
  return output
}

const results = []

for (const bias of BIASES) {
  results.push(
    await runCase({
      name: 'normal',
      bias,
      sprint: false,
    })
  )

  results.push(
    await runCase({
      name: 'sprint',
      bias,
      sprint: true,
    })
  )
}

console.dir(
  {
    probe:
      'ground-snap-bias-vs-planar-movement',
    baseSpeed:
      gameConfig.movement.baseSpeed,
    sprintMultiplier:
      gameConfig.movement.sprintMultiplier,
    results,
  },
  { depth: null }
)

console.log(
  'Movement grounding probe: COMPLETE'
)

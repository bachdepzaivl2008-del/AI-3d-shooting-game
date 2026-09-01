import { RapierCollisionWorld } from './RapierCollisionWorld.js'

function createCharacter(collision, config, position) {
  const character = config.collision.character

  return collision.createKinematicCapsule({
    position,
    totalHeight: character.standingHeight,
    radius: character.radius,
    controllerOffset: character.controllerOffset,
    maxSlopeClimbAngle:
      (character.maxSlopeDegrees * Math.PI) / 180,
    stepHeight: character.stepHeight,
    autostepMinWidth: character.autostepMinWidth,
    snapToGroundDistance: character.snapToGroundDistance,
  })
}

function standingCenterY(config, surfaceY = 0) {
  return (
    surfaceY +
    config.collision.character.standingHeight / 2 +
    config.collision.character.controllerOffset
  )
}

async function createWorld(config) {
  return RapierCollisionWorld.create({
    gravity: config.collision.gravity,
    fixedDeltaTime: config.simulation.fixedDeltaTime,
  })
}

async function runGroundWallDashScenario(config) {
  const collision = await createWorld(config)

  try {
    collision.createStaticBox({
      center: { x: 0, y: -0.5, z: 0 },
      halfExtents: { x: 10, y: 0.5, z: 5 },
    })

    collision.createStaticBox({
      center: { x: 2, y: 1, z: 0 },
      halfExtents: { x: 0.25, y: 1, z: 2 },
    })

    const character = createCharacter(collision, config, {
      x: 0,
      y: standingCenterY(config),
      z: 0,
    })

    collision.prepareQueries()

    const walk = collision.computeCharacterMovement(
      character,
      { x: 3, y: -0.02, z: 0 }
    )

    const dash = collision.computeCharacterMovement(
      character,
      { x: 7, y: 0, z: 0 }
    )

    const groundRay = collision.castRay(
      { x: 0, y: 2, z: 0 },
      { x: 0, y: -1, z: 0 },
      5,
      true
    )

    return {
      groundRayHit: groundRay !== null,
      grounded: walk.grounded,
      wallBlocked:
        walk.x > 0 &&
        walk.x < 3,
      dashSweepBlocked:
        dash.x > 0 &&
        dash.x < 7,
      walkCorrectedX: walk.x,
      dashCorrectedX: dash.x,
    }
  } finally {
    collision.dispose()
  }
}

async function runStepScenario(config) {
  const collision = await createWorld(config)

  try {
    collision.createStaticBox({
      center: { x: 0, y: -0.5, z: 0 },
      halfExtents: { x: 5, y: 0.5, z: 3 },
    })

    collision.createStaticBox({
      center: { x: 1.1, y: 0.17, z: 0 },
      halfExtents: { x: 0.5, y: 0.17, z: 1 },
    })

    const character = createCharacter(collision, config, {
      x: 0,
      y: standingCenterY(config),
      z: 0,
    })

    collision.prepareQueries()

    const movement = collision.computeCharacterMovement(
      character,
      { x: 1.5, y: -0.02, z: 0 }
    )

    return {
      stepHeight: 0.34,
      correctedX: movement.x,
      correctedY: movement.y,
      steppedUp:
        movement.x > 1.1 &&
        movement.y > 0.2,
    }
  } finally {
    collision.dispose()
  }
}

async function runRampScenario(config) {
  const collision = await createWorld(config)

  try {
    collision.createStaticBox({
      center: { x: 0, y: -0.5, z: 0 },
      halfExtents: { x: 8, y: 0.5, z: 3 },
    })

    const angleDegrees = 35
    const angle = (angleDegrees * Math.PI) / 180
    const rampStartX = 0.6
    const rampEndX = 3.4
    const rampWidth = 2
    const rise =
      Math.tan(angle) * (rampEndX - rampStartX)

    collision.createStaticTrimesh({
      vertices: [
        rampStartX, 0, -rampWidth,
        rampEndX, rise, -rampWidth,
        rampEndX, rise, rampWidth,
        rampStartX, 0, rampWidth,
      ],
      indices: [
        0, 1, 2,
        0, 2, 3,
      ],
    })

    collision.createStaticBox({
      center: {
        x: 5.2,
        y: rise - 0.5,
        z: 0,
      },
      halfExtents: {
        x: 1.8,
        y: 0.5,
        z: rampWidth,
      },
    })

    const character = createCharacter(collision, config, {
      x: 0,
      y: standingCenterY(config),
      z: 0,
    })

    collision.prepareQueries()

    let finalPosition = character.body.translation()
    let maxY = finalPosition.y
    let firstRiseTick = null

    for (let i = 0; i < 100; i += 1) {
      const movement = collision.computeCharacterMovement(
        character,
        { x: 0.03, y: -0.01, z: 0 }
      )

      finalPosition =
        collision.applyCharacterMovement(
          character,
          movement
        )

      maxY = Math.max(maxY, finalPosition.y)

      if (
        firstRiseTick === null &&
        finalPosition.y > standingCenterY(config) + 0.05
      ) {
        firstRiseTick = i + 1
      }
    }

    return {
      rampGeometry: 'trimesh',
      rampDegrees: angleDegrees,
      rampRise: rise,
      finalX: finalPosition.x,
      finalY: finalPosition.y,
      maxY,
      firstRiseTick,
      climbedWalkableRamp:
        finalPosition.x > 2.5 &&
        maxY > standingCenterY(config) + 0.5,
    }
  } finally {
    collision.dispose()
  }
}

async function runGroundSnapScenario(config) {
  const collision = await createWorld(config)

  try {
    collision.createStaticBox({
      center: { x: -0.75, y: -0.5, z: 0 },
      halfExtents: { x: 1.25, y: 0.5, z: 2 },
    })

    collision.createStaticBox({
      center: { x: 1.75, y: -0.6, z: 0 },
      halfExtents: { x: 1.25, y: 0.5, z: 2 },
    })

    const character = createCharacter(collision, config, {
      x: 0,
      y: standingCenterY(config),
      z: 0,
    })

    collision.prepareQueries()

    const movement = collision.computeCharacterMovement(
      character,
      { x: 1.2, y: -0.02, z: 0 }
    )

    return {
      dropHeight: 0.1,
      correctedX: movement.x,
      correctedY: movement.y,
      snappedDown:
        movement.x > 1 &&
        movement.y < -0.05,
    }
  } finally {
    collision.dispose()
  }
}

export async function runCharacterCollisionSuite(config) {
  const groundWallDash =
    await runGroundWallDashScenario(config)

  const step =
    await runStepScenario(config)

  const ramp =
    await runRampScenario(config)

  const groundSnap =
    await runGroundSnapScenario(config)

  return {
    groundWallDash,
    step,
    ramp,
    groundSnap,
  }
}

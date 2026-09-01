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

    // 0.34 m is intentionally just under the canonical 0.35 m step limit
    // so the test verifies the allowed side of the threshold without
    // depending on floating-point equality at the exact boundary.
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

    const angleDegrees = 40
    const angle = (angleDegrees * Math.PI) / 180
    const halfLength = 1.5
    const halfThickness = 0.1

    const center = {
      x:
        0.6 +
        halfLength * Math.cos(angle) +
        halfThickness * Math.sin(angle),
      y:
        halfLength * Math.sin(angle) -
        halfThickness * Math.cos(angle),
      z: 0,
    }

    collision.createStaticBox({
      center,
      halfExtents: {
        x: halfLength,
        y: halfThickness,
        z: 1,
      },
      rotation: {
        w: Math.cos(angle / 2),
        x: 0,
        y: 0,
        z: Math.sin(angle / 2),
      },
    })

    const character = createCharacter(collision, config, {
      x: 0,
      y: standingCenterY(config),
      z: 0,
    })

    collision.prepareQueries()

    const movement = collision.computeCharacterMovement(
      character,
      { x: 2.6, y: -0.05, z: 0 }
    )

    return {
      rampDegrees: angleDegrees,
      correctedX: movement.x,
      correctedY: movement.y,
      climbedWalkableRamp:
        movement.x > 2.0 &&
        movement.y > 0.5,
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

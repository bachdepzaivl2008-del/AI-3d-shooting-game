import { RapierCollisionWorld } from './RapierCollisionWorld.js'

export async function runSharedCollisionProbe(config) {
  const collision = await RapierCollisionWorld.create({
    gravity: config.collision.gravity,
    fixedDeltaTime: config.simulation.fixedDeltaTime,
  })

  try {
    collision.createStaticBox({
      center: { x: 0, y: -0.5, z: 0 },
      halfExtents: { x: 5, y: 0.5, z: 5 },
    })

    collision.createStaticBox({
      center: { x: 2, y: 1, z: 0 },
      halfExtents: { x: 0.25, y: 1, z: 2 },
    })

    collision.prepareQueries()

    const groundRay = collision.castRay(
      { x: 0, y: 2, z: 0 },
      { x: 0, y: -1, z: 0 },
      5,
      true
    )

    const characterConfig = config.collision.character

    const character = collision.createKinematicCapsule({
      position: {
        x: 0,
        y:
          characterConfig.standingHeight / 2 +
          characterConfig.controllerOffset,
        z: 0,
      },
      totalHeight: characterConfig.standingHeight,
      radius: characterConfig.radius,
      controllerOffset: characterConfig.controllerOffset,
      maxSlopeClimbAngle:
        (characterConfig.maxSlopeDegrees * Math.PI) / 180,
      stepHeight: characterConfig.stepHeight,
      autostepMinWidth:
        characterConfig.autostepMinWidth,
      snapToGroundDistance:
        characterConfig.snapToGroundDistance,
    })

    collision.prepareQueries()

    const desiredMovement = { x: 3, y: 0, z: 0 }

    const correctedMovement =
      collision.computeCharacterMovement(
        character,
        desiredMovement
      )

    return {
      groundRayHit: groundRay !== null,
      groundRayDistance:
        groundRay?.timeOfImpact ?? null,
      desiredMovementX: desiredMovement.x,
      correctedMovementX: correctedMovement.x,
      blockedByWall:
        correctedMovement.x > 0 &&
        correctedMovement.x < desiredMovement.x,
      grounded: correctedMovement.grounded,
    }
  } finally {
    collision.dispose()
  }
}

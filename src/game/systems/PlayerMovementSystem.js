import { RapierCollisionWorld } from '../../shared/collision/RapierCollisionWorld.js'

function clampAxis(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(-1, Math.min(1, value))
}

const DIRECTION_EPSILON = 1e-10

function canonicalizeDirectionComponent(value) {
  return Math.abs(value) < DIRECTION_EPSILON
    ? 0
    : value
}

function normalizePlanar(x, z) {
  const canonicalX =
    canonicalizeDirectionComponent(x)

  const canonicalZ =
    canonicalizeDirectionComponent(z)

  const length = Math.hypot(
    canonicalX,
    canonicalZ
  )

  if (length <= 1) {
    return {
      x: canonicalX,
      z: canonicalZ,
    }
  }

  return {
    x: canonicalX / length,
    z: canonicalZ / length,
  }
}

function cameraRelativeDirection(
  moveX,
  moveForward,
  yaw
) {
  const rightX = Math.cos(yaw)
  const rightZ = Math.sin(yaw)

  const forwardX = Math.sin(yaw)
  const forwardZ = -Math.cos(yaw)

  return normalizePlanar(
    rightX * moveX +
      forwardX * moveForward,
    rightZ * moveX +
      forwardZ * moveForward
  )
}

export class PlayerMovementSystem {
  static async create(config) {
    const collision = await RapierCollisionWorld.create({
      gravity: config.collision.gravity,
      fixedDeltaTime: config.simulation.fixedDeltaTime,
    })

    collision.createStaticBox({
      center: {
        x: 0,
        y: -0.5,
        z: 0,
      },
      halfExtents: {
        x: config.world.groundSize / 2,
        y: 0.5,
        z: config.world.groundSize / 2,
      },
    })

    collision.createStaticBox({
      center: {
        x: config.cube.startPosition.x,
        y: config.cube.startPosition.y,
        z: config.cube.startPosition.z,
      },
      halfExtents: {
        x: config.cube.size / 2,
        y: config.cube.size / 2,
        z: config.cube.size / 2,
      },
    })

    const characterConfig =
      config.collision.character

    const character =
      collision.createKinematicCapsule({
        position: config.player.spawnPosition,
        totalHeight:
          characterConfig.standingHeight,
        radius:
          characterConfig.radius,
        controllerOffset:
          characterConfig.controllerOffset,
        maxSlopeClimbAngle:
          (characterConfig.maxSlopeDegrees *
            Math.PI) /
          180,
        stepHeight:
          characterConfig.stepHeight,
        autostepMinWidth:
          characterConfig.autostepMinWidth,
        snapToGroundDistance:
          characterConfig.snapToGroundDistance,
      })

    collision.prepareQueries()

    return new PlayerMovementSystem(
      config,
      collision,
      character
    )
  }

  constructor(config, collision, character) {
    this.config = config
    this.collision = collision
    this.character = character
    this.lastGrounded = true
  }

  update(input, deltaTime, yaw) {
    const moveX =
      clampAxis(input?.moveX ?? 0)

    const moveForward =
      clampAxis(input?.moveY ?? 0)

    const direction =
      cameraRelativeDirection(
        moveX,
        moveForward,
        yaw
      )

    const distance =
      this.config.movement.baseSpeed *
      deltaTime

    const hasPlanarMovement =
      direction.x !== 0 ||
      direction.z !== 0

    if (!hasPlanarMovement) {
      // Critical invariant:
      // an idle/look-only simulation tick must not run the
      // character controller with a zero translation. Rapier can
      // slightly re-resolve the grounded contact in that case,
      // which perturbs the next movement sequence.
      //
      // We still step the physics world so future dynamic bodies
      // remain deterministic at the simulation tick rate.
      this.collision.step()

      return {
        position: this.getPosition(),
        grounded: this.lastGrounded,
        input: {
          moveX,
          moveY: moveForward,
        },
        correctedMovement: {
          x: 0,
          y: 0,
          z: 0,
        },
      }
    }

    const desiredMovement = {
      x: direction.x * distance,
      y:
        -this.config.movement
          .groundSnapBiasPerTick,
      z: direction.z * distance,
    }

    const corrected =
      this.collision.computeCharacterMovement(
        this.character,
        desiredMovement
      )

    const position =
      this.collision.applyCharacterMovement(
        this.character,
        corrected
      )

    this.lastGrounded =
      corrected.grounded

    return {
      position,
      grounded: this.lastGrounded,
      input: {
        moveX,
        moveY: moveForward,
      },
      correctedMovement: {
        x: corrected.x,
        y: corrected.y,
        z: corrected.z,
      },
    }
  }

  getPosition() {
    const position =
      this.character.body.translation()

    return {
      x: position.x,
      y: position.y,
      z: position.z,
    }
  }

  dispose() {
    this.collision.dispose()
  }
}

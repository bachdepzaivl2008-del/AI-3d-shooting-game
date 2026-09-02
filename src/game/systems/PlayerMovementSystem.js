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
    this.crouched = false
  }

  updateStance(crouchRequested) {
    const characterConfig =
      this.config.collision.character

    if (
      crouchRequested &&
      this.lastGrounded &&
      !this.crouched
    ) {
      this.collision.setCharacterHeight(
        this.character,
        characterConfig.crouchHeight
      )

      this.crouched = true

      return {
        crouched: true,
        standBlocked: false,
      }
    }

    if (
      !crouchRequested &&
      this.crouched
    ) {
      const canStand =
        this.collision.canResizeCharacterHeight(
          this.character,
          characterConfig.standingHeight
        )

      if (canStand) {
        this.collision.setCharacterHeight(
          this.character,
          characterConfig.standingHeight
        )

        this.crouched = false

        return {
          crouched: false,
          standBlocked: false,
        }
      }

      return {
        crouched: true,
        standBlocked: true,
      }
    }

    return {
      crouched: this.crouched,
      standBlocked: false,
    }
  }

  update(input, deltaTime, yaw) {
    const moveX =
      clampAxis(input?.moveX ?? 0)

    const moveForward =
      clampAxis(input?.moveY ?? 0)

    const crouchRequested =
      input?.crouch === true

    const stance =
      this.updateStance(
        crouchRequested
      )

    const direction =
      cameraRelativeDirection(
        moveX,
        moveForward,
        yaw
      )

    const hasPlanarMovement =
      direction.x !== 0 ||
      direction.z !== 0

    const sprintRequested =
      input?.sprint === true &&
      input?.fire !== true &&
      input?.ads !== true

    const sprinting =
      hasPlanarMovement &&
      sprintRequested &&
      !stance.crouched

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
        sprinting: false,
        crouched: stance.crouched,
        standBlocked: stance.standBlocked,
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

    const speedMultiplier =
      stance.crouched
        ? this.config.movement
            .crouchMultiplier
        : sprinting
          ? this.config.movement
              .sprintMultiplier
          : 1

    const distance =
      this.config.movement.baseSpeed *
      speedMultiplier *
      deltaTime

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
      sprinting,
      crouched: stance.crouched,
      standBlocked: stance.standBlocked,
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
    return this.collision.getCharacterPosition(
      this.character
    )
  }

  dispose() {
    this.collision.dispose()
  }
}

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

function clampPlanarMagnitude(
  x,
  z,
  maxMagnitude
) {
  const magnitude = Math.hypot(x, z)

  if (
    magnitude <= maxMagnitude ||
    magnitude <= DIRECTION_EPSILON
  ) {
    return { x, z }
  }

  const scale =
    maxMagnitude / magnitude

  return {
    x: x * scale,
    z: z * scale,
  }
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

    this.jumpHeld = false
    this.verticalVelocity = 0

    this.airVelocity = {
      x: 0,
      z: 0,
    }

    this.airborneSpeedCap =
      config.movement.baseSpeed
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

  tryStandForJump(stance) {
    if (!stance.crouched) {
      return true
    }

    const standingHeight =
      this.config.collision.character
        .standingHeight

    const canStand =
      this.collision.canResizeCharacterHeight(
        this.character,
        standingHeight
      )

    if (!canStand) {
      stance.standBlocked = true
      return false
    }

    this.collision.setCharacterHeight(
      this.character,
      standingHeight
    )

    this.crouched = false
    stance.crouched = false
    stance.standBlocked = false

    return true
  }

  computeGroundSpeed({
    sprinting,
    crouched,
  }) {
    if (crouched) {
      return (
        this.config.movement.baseSpeed *
        this.config.movement
          .crouchMultiplier
      )
    }

    if (sprinting) {
      return (
        this.config.movement.baseSpeed *
        this.config.movement
          .sprintMultiplier
      )
    }

    return this.config.movement.baseSpeed
  }

  updateAirVelocity(
    direction,
    requestedSpeed,
    deltaTime
  ) {
    const hasInput =
      direction.x !== 0 ||
      direction.z !== 0

    if (!hasInput) {
      return {
        ...this.airVelocity,
      }
    }

    const cappedRequestedSpeed =
      Math.min(
        requestedSpeed,
        this.airborneSpeedCap
      )

    const target = {
      x:
        direction.x *
        cappedRequestedSpeed,
      z:
        direction.z *
        cappedRequestedSpeed,
    }

    const alpha = Math.min(
      1,
      this.config.movement
        .airSteeringRate *
        deltaTime
    )

    const steered =
      clampPlanarMagnitude(
        this.airVelocity.x +
          (target.x -
            this.airVelocity.x) *
            alpha,
        this.airVelocity.z +
          (target.z -
            this.airVelocity.z) *
            alpha,
        this.airborneSpeedCap
      )

    this.airVelocity = steered

    return {
      ...steered,
    }
  }

  update(input, deltaTime, yaw) {
    const moveX =
      clampAxis(input?.moveX ?? 0)

    const moveForward =
      clampAxis(input?.moveY ?? 0)

    const crouchRequested =
      input?.crouch === true

    const jumpRequested =
      input?.jump === true

    const jumpPressed =
      jumpRequested &&
      !this.jumpHeld

    this.jumpHeld =
      jumpRequested

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

    let sprinting =
      hasPlanarMovement &&
      sprintRequested &&
      !stance.crouched &&
      this.lastGrounded

    let jumpedThisTick = false

    if (
      jumpPressed &&
      this.lastGrounded
    ) {
      const canLaunch =
        this.tryStandForJump(
          stance
        )

      if (canLaunch) {
        jumpedThisTick = true
        sprinting =
          hasPlanarMovement &&
          sprintRequested

        const takeoffSpeed =
          this.computeGroundSpeed({
            sprinting,
            crouched: false,
          })

        this.airVelocity = {
          x:
            direction.x *
            takeoffSpeed,
          z:
            direction.z *
            takeoffSpeed,
        }

        this.airborneSpeedCap =
          Math.max(
            takeoffSpeed,
            Math.hypot(
              this.airVelocity.x,
              this.airVelocity.z
            )
          )

        this.verticalVelocity =
          this.config.movement
            .jumpVerticalVelocity

        this.lastGrounded = false
      }
    }

    const airborne =
      !this.lastGrounded ||
      jumpedThisTick

    if (
      !hasPlanarMovement &&
      !airborne
    ) {
      this.collision.step()

      return {
        position: this.getPosition(),
        grounded: this.lastGrounded,
        sprinting: false,
        crouched: stance.crouched,
        standBlocked:
          stance.standBlocked,
        jumpedThisTick: false,
        verticalVelocity: 0,
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

    const requestedGroundSpeed =
      this.computeGroundSpeed({
        sprinting,
        crouched:
          stance.crouched,
      })

    let planarVelocity

    if (airborne) {
      planarVelocity =
        this.updateAirVelocity(
          direction,
          requestedGroundSpeed,
          deltaTime
        )
    } else {
      planarVelocity = {
        x:
          direction.x *
          requestedGroundSpeed,
        z:
          direction.z *
          requestedGroundSpeed,
      }
    }

    const desiredMovement = {
      x:
        planarVelocity.x *
        deltaTime,
      y:
        airborne
          ? (
              this.verticalVelocity -
              0.5 *
                this.config.movement
                  .gravity *
                deltaTime
            ) *
            deltaTime
          : 0,
      z:
        planarVelocity.z *
        deltaTime,
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

    const landed =
      corrected.grounded &&
      this.verticalVelocity <= 0 &&
      airborne

    if (landed) {
      this.lastGrounded = true
      this.verticalVelocity = 0

      this.airVelocity = {
        x:
          corrected.x /
          deltaTime,
        z:
          corrected.z /
          deltaTime,
      }
    } else if (airborne) {
      this.lastGrounded = false

      this.verticalVelocity -=
        this.config.movement.gravity *
        deltaTime

      this.airVelocity = {
        x:
          corrected.x /
          deltaTime,
        z:
          corrected.z /
          deltaTime,
      }
    } else {
      this.lastGrounded =
        corrected.grounded
    }

    return {
      position,
      grounded: this.lastGrounded,
      sprinting:
        this.lastGrounded
          ? sprinting
          : false,
      crouched: stance.crouched,
      standBlocked:
        stance.standBlocked,
      jumpedThisTick,
      verticalVelocity:
        this.verticalVelocity,
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

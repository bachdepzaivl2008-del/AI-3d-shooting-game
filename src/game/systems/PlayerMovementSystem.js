import { RapierCollisionWorld } from '../../shared/collision/RapierCollisionWorld.js'
import { DashController } from '../movement/DashController.js'

function clampAxis(value) {
  if (!Number.isFinite(value)) return 0
  return Math.max(-1, Math.min(1, value))
}

const DIRECTION_EPSILON = 1e-10
const DASH_BLOCK_EPSILON = 1e-5

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

export function computeSlideSlopeAcceleration(
  correctedMovement,
  gravity
) {
  if (!correctedMovement?.grounded) {
    return 0
  }

  const horizontalDistance =
    Math.hypot(
      correctedMovement.x,
      correctedMovement.z
    )

  const pathDistance =
    Math.hypot(
      horizontalDistance,
      correctedMovement.y
    )

  if (pathDistance <= DIRECTION_EPSILON) {
    return 0
  }

  const slopeSin =
    Math.max(
      -1,
      Math.min(
        1,
        correctedMovement.y /
          pathDistance
      )
    )

  // Uphill => positive Y => negative acceleration.
  // Downhill => negative Y => positive acceleration.
  // This is gravity projected along the traversed surface,
  // not a hidden slope-speed bonus.
  return -gravity * slopeSin
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

    this.landingRecoveryRemaining = 0
    this.landingRecoveryDuration = 0
    this.landingRecoveryStartMultiplier = 1
    this.landingType = 'none'
    this.lastLandingImpactSpeed = 0

    this.airborneStartY = null
    this.airborneMinY = null
    this.airborneMaxY = null

    this.lastPlanarVelocity = {
      x: 0,
      z: 0,
    }

    this.slideEntryArmed = true
    this.sliding = false
    this.slideDirection = {
      x: 0,
      z: 0,
    }
    this.slideSpeed = 0
    this.slideElapsed = 0
    this.slideExitReason = 'none'
    this.slideSlopeAcceleration = 0

    this.dashController =
      new DashController(
        config.movement
      )

    this.dashHeld = false
    this.dashAttackLockedThisTick = false
  }

  beginAirborneTracking(y) {
    this.airborneStartY = y
    this.airborneMinY = y
    this.airborneMaxY = y
  }

  updateAirborneTracking(y) {
    if (this.airborneStartY === null) {
      this.beginAirborneTracking(y)
      return
    }

    this.airborneMinY =
      Math.min(
        this.airborneMinY,
        y
      )

    this.airborneMaxY =
      Math.max(
        this.airborneMaxY,
        y
      )
  }

  getAirborneVerticalRange() {
    if (
      this.airborneMinY === null ||
      this.airborneMaxY === null
    ) {
      return 0
    }

    return (
      this.airborneMaxY -
      this.airborneMinY
    )
  }

  resetAirborneTracking() {
    this.airborneStartY = null
    this.airborneMinY = null
    this.airborneMaxY = null
  }

  getLandingRecoveryMultiplier() {
    if (
      this.landingRecoveryRemaining <= 0 ||
      this.landingRecoveryDuration <= 0
    ) {
      return 1
    }

    const progress =
      1 -
      this.landingRecoveryRemaining /
        this.landingRecoveryDuration

    return (
      this.landingRecoveryStartMultiplier +
      (1 -
        this.landingRecoveryStartMultiplier) *
        progress
    )
  }

  advanceLandingRecovery(deltaTime) {
    if (
      this.landingRecoveryRemaining <= 0
    ) {
      return
    }

    this.landingRecoveryRemaining =
      Math.max(
        0,
        this.landingRecoveryRemaining -
          deltaTime
      )

    if (
      this.landingRecoveryRemaining === 0
    ) {
      this.landingRecoveryDuration = 0
      this.landingRecoveryStartMultiplier = 1
      this.landingType = 'none'
    }
  }

  triggerLandingRecovery(impactSpeed) {
    const movementConfig =
      this.config.movement

    const hardLanding =
      impactSpeed >=
      movementConfig.hardLandingImpactSpeed

    this.landingType =
      hardLanding
        ? 'hard'
        : 'standard'

    this.lastLandingImpactSpeed =
      impactSpeed

    this.landingRecoveryStartMultiplier =
      hardLanding
        ? movementConfig
            .hardLandingRetainMultiplier
        : movementConfig
            .standardLandingRetainMultiplier

    this.landingRecoveryDuration =
      hardLanding
        ? movementConfig
            .hardLandingRecoverySeconds
        : movementConfig
            .standardLandingRecoverySeconds

    this.landingRecoveryRemaining =
      this.landingRecoveryDuration
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
    landingRecoveryMultiplier = 1,
  }) {
    let baseSpeed =
      this.config.movement.baseSpeed

    if (crouched) {
      baseSpeed *=
        this.config.movement
          .crouchMultiplier
    } else if (sprinting) {
      baseSpeed *=
        this.config.movement
          .sprintMultiplier
    }

    return (
      baseSpeed *
      landingRecoveryMultiplier
    )
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

  getLastPlanarSpeed() {
    return Math.hypot(
      this.lastPlanarVelocity.x,
      this.lastPlanarVelocity.z
    )
  }

  setLastPlanarVelocity(
    x,
    z
  ) {
    this.lastPlanarVelocity = {
      x:
        canonicalizeDirectionComponent(x),
      z:
        canonicalizeDirectionComponent(z),
    }
  }

  startSlide() {
    const currentSpeed =
      this.getLastPlanarSpeed()

    if (
      currentSpeed <
      this.config.movement.slideEntrySpeed
    ) {
      return false
    }

    const direction =
      normalizePlanar(
        this.lastPlanarVelocity.x /
          currentSpeed,
        this.lastPlanarVelocity.z /
          currentSpeed
      )

    this.sliding = true
    this.slideDirection = direction
    this.slideSpeed =
      Math.min(
        currentSpeed +
          this.config.movement
            .slideInitialBoost,
        this.config.movement
          .slideInitialMaxSpeed
      )

    this.slideElapsed = 0
    this.slideExitReason = 'none'
    this.slideSlopeAcceleration = 0

    return true
  }

  stopSlide(reason) {
    this.sliding = false
    this.slideSpeed = 0
    this.slideSlopeAcceleration = 0
    this.slideExitReason = reason
  }

  getSlideState() {
    return {
      sliding: this.sliding,
      slideSpeed: this.slideSpeed,
      slideElapsed: this.slideElapsed,
      slideExitReason:
        this.slideExitReason,
      slideSlopeAcceleration:
        this.slideSlopeAcceleration,
    }
  }

  createResult({
    position,
    grounded,
    sprinting,
    stance,
    jumpedThisTick,
    landedThisTick,
    verticalVelocity,
    correctedMovement,
    moveX,
    moveForward,
  }) {
    return {
      position,
      grounded,
      sprinting,
      crouched: stance.crouched,
      standBlocked:
        stance.standBlocked,
      jumpedThisTick,
      landedThisTick,
      verticalVelocity,
      landingType:
        this.landingType,
      landingRecoveryMultiplier:
        this.getLandingRecoveryMultiplier(),
      landingRecoveryRemaining:
        this.landingRecoveryRemaining,
      landingImpactSpeed:
        this.lastLandingImpactSpeed,
      ...this.getSlideState(),
      ...this.dashController.getState(),
      dashAttackLocked:
        this.dashAttackLockedThisTick ||
        this.dashController.active,
      input: {
        moveX,
        moveY: moveForward,
      },
      correctedMovement,
    }
  }

  update(input, deltaTime, yaw) {
    let landedThisTick = false
    let jumpedThisTick = false

    this.dashAttackLockedThisTick = false

    const landingRecoveryMultiplier =
      this.getLandingRecoveryMultiplier()

    const moveX =
      clampAxis(input?.moveX ?? 0)

    const moveForward =
      clampAxis(input?.moveY ?? 0)

    const crouchRequested =
      input?.crouch === true

    const crouchPressed =
      crouchRequested &&
      this.slideEntryArmed

    if (crouchRequested) {
      this.slideEntryArmed = false
    } else {
      this.slideEntryArmed = true
    }

    const jumpRequested =
      input?.jump === true

    const jumpPressed =
      jumpRequested &&
      !this.jumpHeld

    this.jumpHeld =
      jumpRequested

    const dashRequested =
      input?.dash === true

    const dashPressed =
      dashRequested &&
      !this.dashHeld

    this.dashHeld =
      dashRequested

    if (
      this.sliding &&
      !crouchRequested
    ) {
      this.stopSlide(
        'crouch_released'
      )
    }

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
      this.lastGrounded &&
      !this.sliding &&
      !this.dashController.active

    if (dashPressed) {
      const dashDirection =
        hasPlanarMovement
          ? direction
          : cameraRelativeDirection(
              0,
              1,
              yaw
            )

      const activation =
        this.dashController.tryActivate(
          dashDirection
        )

      if (activation.activated) {
        if (this.sliding) {
          this.stopSlide('dash')
        }

        sprinting = false
      }
    }

    // Existing Slide + Jump is an allowed transition.
    // The carried horizontal speed is capped at current Sprint speed.
    if (
      jumpPressed &&
      this.lastGrounded &&
      this.sliding &&
      !this.dashController.active
    ) {
      const canLaunch =
        this.tryStandForJump(
          stance
        )

      if (canLaunch) {
        const slideCarrySpeed =
          Math.min(
            this.slideSpeed,
            this.config.movement
              .baseSpeed *
              this.config.movement
                .sprintMultiplier
          )

        const slideCarryDirection = {
          ...this.slideDirection,
        }

        this.stopSlide('jump')

        jumpedThisTick = true
        sprinting = false

        this.airVelocity = {
          x:
            slideCarryDirection.x *
            slideCarrySpeed,
          z:
            slideCarryDirection.z *
            slideCarrySpeed,
        }

        this.airborneSpeedCap =
          slideCarrySpeed

        this.verticalVelocity =
          this.config.movement
            .jumpVerticalVelocity

        this.beginAirborneTracking(
          this.getPosition().y
        )

        this.lastGrounded = false
      }
    }

    // Normal grounded Jump takes priority over a new Slide entry
    // if Space and Crouch are pressed on the same tick.
    if (
      jumpPressed &&
      this.lastGrounded &&
      !this.sliding &&
      !this.dashController.active &&
      !jumpedThisTick
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
            landingRecoveryMultiplier,
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
          Math.hypot(
            this.airVelocity.x,
            this.airVelocity.z
          )

        this.verticalVelocity =
          this.config.movement
            .jumpVerticalVelocity

        this.beginAirborneTracking(
          this.getPosition().y
        )

        this.lastGrounded = false
      }
    }

    if (
      !jumpedThisTick &&
      !this.sliding &&
      !this.dashController.active &&
      crouchPressed &&
      crouchRequested &&
      this.lastGrounded
    ) {
      const enteredSlide =
        this.startSlide()

      if (enteredSlide) {
        sprinting = false
      }
    }

    const airborne =
      !this.lastGrounded ||
      jumpedThisTick

    if (this.dashController.active) {
      this.dashAttackLockedThisTick = true

      const dashStep =
        this.dashController.getMovementStep(
          deltaTime
        )

      const wasAirborne =
        !this.lastGrounded

      const desiredMovement = {
        x: dashStep.x,
        y:
          wasAirborne
            ? (
                this.verticalVelocity -
                0.5 *
                  this.config.movement
                    .gravity *
                  deltaTime
              ) *
              deltaTime
            : 0,
        z: dashStep.z,
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

      const correctedPlanarVelocity = {
        x:
          corrected.x /
          deltaTime,
        z:
          corrected.z /
          deltaTime,
      }

      this.setLastPlanarVelocity(
        correctedPlanarVelocity.x,
        correctedPlanarVelocity.z
      )

      const actualPlanarDistance =
        Math.hypot(
          corrected.x,
          corrected.z
        )

      const blocked =
        actualPlanarDistance +
          DASH_BLOCK_EPSILON <
        dashStep.requestedDistance

      if (wasAirborne) {
        this.updateAirborneTracking(
          position.y
        )

        const landed =
          corrected.grounded &&
          this.verticalVelocity <= 0

        if (landed) {
          const characterConfig =
            this.config.collision.character

          const realAirborneLanding =
            this.getAirborneVerticalRange() >
            characterConfig.stepHeight +
              characterConfig.controllerOffset

          landedThisTick =
            realAirborneLanding

          const impactSpeed =
            Math.max(
              0,
              -(
                this.verticalVelocity -
                this.config.movement.gravity *
                  deltaTime
              )
            )

          if (realAirborneLanding) {
            this.triggerLandingRecovery(
              impactSpeed
            )
          }

          this.resetAirborneTracking()
          this.lastGrounded = true
          this.verticalVelocity = 0
        } else {
          this.lastGrounded = false

          this.verticalVelocity -=
            this.config.movement.gravity *
            deltaTime
        }
      } else {
        this.lastGrounded =
          corrected.grounded

        if (!corrected.grounded) {
          this.beginAirborneTracking(
            position.y
          )

          this.verticalVelocity = 0
        }
      }

      this.airVelocity = {
        ...correctedPlanarVelocity,
      }

      this.airborneSpeedCap =
        Math.hypot(
          this.airVelocity.x,
          this.airVelocity.z
        )

      this.dashController.finishMovementStep({
        stepTime:
          dashStep.stepTime,
        requestedDistance:
          dashStep.requestedDistance,
        blocked,
      })

      if (!landedThisTick) {
        this.advanceLandingRecovery(
          deltaTime
        )
      }

      this.dashController.advanceTimers(
        deltaTime
      )

      return this.createResult({
        position,
        grounded:
          this.lastGrounded,
        sprinting: false,
        stance,
        jumpedThisTick: false,
        landedThisTick,
        verticalVelocity:
          this.verticalVelocity,
        correctedMovement: {
          x: corrected.x,
          y: corrected.y,
          z: corrected.z,
        },
        moveX,
        moveForward,
      })
    }

    if (this.sliding) {
      const desiredMovement = {
        x:
          this.slideDirection.x *
          this.slideSpeed *
          deltaTime,
        y: 0,
        z:
          this.slideDirection.z *
          this.slideSpeed *
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

      const correctedPlanarVelocity = {
        x:
          corrected.x /
          deltaTime,
        z:
          corrected.z /
          deltaTime,
      }

      this.setLastPlanarVelocity(
        correctedPlanarVelocity.x,
        correctedPlanarVelocity.z
      )

      if (!corrected.grounded) {
        const carriedSpeed =
          Math.hypot(
            correctedPlanarVelocity.x,
            correctedPlanarVelocity.z
          )

        this.stopSlide('ground_lost')

        this.lastGrounded = false
        this.verticalVelocity = 0

        this.airVelocity = {
          ...correctedPlanarVelocity,
        }

        this.airborneSpeedCap =
          carriedSpeed

        this.beginAirborneTracking(
          position.y
        )
      } else {
        this.lastGrounded = true

        const actualPlanarSpeed =
          Math.hypot(
            correctedPlanarVelocity.x,
            correctedPlanarVelocity.z
          )

        this.slideSlopeAcceleration =
          computeSlideSlopeAcceleration(
            corrected,
            this.config.movement.gravity
          )

        const collisionLimitedSpeed =
          Math.min(
            this.slideSpeed,
            actualPlanarSpeed
          )

        this.slideSpeed =
          Math.max(
            0,
            collisionLimitedSpeed +
              (
                this.slideSlopeAcceleration -
                this.config.movement
                  .slideFlatDeceleration
              ) *
                deltaTime
          )

        this.slideElapsed +=
          deltaTime

        if (
          this.slideSpeed <
          this.config.movement
            .slideExitSpeed
        ) {
          this.stopSlide(
            'speed_below_exit'
          )
        } else if (
          this.slideElapsed >=
          this.config.movement
            .slideMaxDuration
        ) {
          this.stopSlide(
            'max_duration'
          )
        }
      }

      this.advanceLandingRecovery(
        deltaTime
      )

      this.dashController.advanceTimers(
        deltaTime
      )

      return this.createResult({
        position,
        grounded:
          this.lastGrounded,
        sprinting: false,
        stance,
        jumpedThisTick: false,
        landedThisTick: false,
        verticalVelocity:
          this.verticalVelocity,
        correctedMovement: {
          x: corrected.x,
          y: corrected.y,
          z: corrected.z,
        },
        moveX,
        moveForward,
      })
    }

    if (
      !hasPlanarMovement &&
      !airborne
    ) {
      this.collision.step()
      this.advanceLandingRecovery(
        deltaTime
      )

      this.setLastPlanarVelocity(
        0,
        0
      )

      this.dashController.advanceTimers(
        deltaTime
      )

      return this.createResult({
        position: this.getPosition(),
        grounded:
          this.lastGrounded,
        sprinting: false,
        stance,
        jumpedThisTick: false,
        landedThisTick: false,
        verticalVelocity: 0,
        correctedMovement: {
          x: 0,
          y: 0,
          z: 0,
        },
        moveX,
        moveForward,
      })
    }

    const requestedGroundSpeed =
      this.computeGroundSpeed({
        sprinting,
        crouched:
          stance.crouched,
        landingRecoveryMultiplier,
      })

    const requestedAirSpeed =
      this.computeGroundSpeed({
        sprinting:
          hasPlanarMovement &&
          sprintRequested,
        crouched: false,
      })

    let planarVelocity

    if (airborne) {
      planarVelocity =
        this.updateAirVelocity(
          direction,
          requestedAirSpeed,
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

    const correctedPlanarVelocity = {
      x:
        corrected.x /
        deltaTime,
      z:
        corrected.z /
        deltaTime,
    }

    this.setLastPlanarVelocity(
      correctedPlanarVelocity.x,
      correctedPlanarVelocity.z
    )

    if (airborne) {
      this.updateAirborneTracking(
        position.y
      )
    }

    const landed =
      corrected.grounded &&
      this.verticalVelocity <= 0 &&
      airborne

    if (landed) {
      const characterConfig =
        this.config.collision.character

      const realAirborneLanding =
        this.getAirborneVerticalRange() >
        characterConfig.stepHeight +
          characterConfig.controllerOffset

      landedThisTick =
        realAirborneLanding

      const impactSpeed =
        Math.max(
          0,
          -(
            this.verticalVelocity -
            this.config.movement.gravity *
              deltaTime
          )
        )

      if (realAirborneLanding) {
        this.triggerLandingRecovery(
          impactSpeed
        )
      }

      this.resetAirborneTracking()

      this.lastGrounded = true
      this.verticalVelocity = 0

      this.airVelocity = {
        ...correctedPlanarVelocity,
      }
    } else if (airborne) {
      this.lastGrounded = false

      this.verticalVelocity -=
        this.config.movement.gravity *
        deltaTime

      this.airVelocity = {
        ...correctedPlanarVelocity,
      }
    } else {
      this.lastGrounded =
        corrected.grounded

      if (!corrected.grounded) {
        this.beginAirborneTracking(
          position.y
        )

        this.airVelocity = {
          ...correctedPlanarVelocity,
        }

        this.airborneSpeedCap =
          Math.hypot(
            this.airVelocity.x,
            this.airVelocity.z
          )

        this.verticalVelocity = 0
      }
    }

    if (!landedThisTick) {
      this.advanceLandingRecovery(
        deltaTime
      )
    }

    this.dashController.advanceTimers(
      deltaTime
    )

    return this.createResult({
      position,
      grounded:
        this.lastGrounded,
      sprinting:
        this.lastGrounded
          ? sprinting
          : false,
      stance,
      jumpedThisTick,
      landedThisTick,
      verticalVelocity:
        this.verticalVelocity,
      correctedMovement: {
        x: corrected.x,
        y: corrected.y,
        z: corrected.z,
      },
      moveX,
      moveForward,
    })
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

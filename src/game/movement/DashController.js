const EPSILON = 1e-9

export class DashController {
  constructor(movementConfig) {
    this.config = movementConfig

    this.rechargeTimers =
      Array.from(
        {
          length:
            movementConfig.dashCharges,
        },
        () => 0
      )

    this.active = false

    this.direction = {
      x: 0,
      z: -1,
    }

    this.remainingTime = 0
    this.remainingDistance = 0

    this.activationLockRemaining = 0

    this.exitReason = 'none'
    this.lastConsumedChargeIndex = null
  }

  getAvailableCharges() {
    return this.rechargeTimers.filter(
      (timer) => timer <= EPSILON
    ).length
  }

  canActivate() {
    return (
      !this.active &&
      this.activationLockRemaining <=
        EPSILON &&
      this.getAvailableCharges() > 0
    )
  }

  tryActivate(direction) {
    if (!this.canActivate()) {
      return {
        activated: false,
        chargeIndex: null,
      }
    }

    const chargeIndex =
      this.rechargeTimers.findIndex(
        (timer) => timer <= EPSILON
      )

    if (chargeIndex < 0) {
      return {
        activated: false,
        chargeIndex: null,
      }
    }

    this.rechargeTimers[
      chargeIndex
    ] =
      this.config
        .dashRechargeSeconds

    this.active = true

    this.direction = {
      x: direction.x,
      z: direction.z,
    }

    this.remainingTime =
      this.config.dashDuration

    this.remainingDistance =
      this.config.dashDistance

    this.activationLockRemaining =
      this.config.dashMinInterval

    this.exitReason = 'none'

    this.lastConsumedChargeIndex =
      chargeIndex

    return {
      activated: true,
      chargeIndex,
    }
  }

  getMovementStep(deltaTime) {
    if (!this.active) {
      return null
    }

    const stepTime =
      Math.min(
        deltaTime,
        this.remainingTime
      )

    const dashSpeed =
      this.config.dashDistance /
      this.config.dashDuration

    const requestedDistance =
      Math.min(
        this.remainingDistance,
        dashSpeed * stepTime
      )

    return {
      stepTime,
      requestedDistance,
      x:
        this.direction.x *
        requestedDistance,
      z:
        this.direction.z *
        requestedDistance,
    }
  }

  finishMovementStep({
    stepTime,
    requestedDistance,
    blocked = false,
  }) {
    if (!this.active) {
      return
    }

    this.remainingTime =
      Math.max(
        0,
        this.remainingTime -
          stepTime
      )

    this.remainingDistance =
      Math.max(
        0,
        this.remainingDistance -
          requestedDistance
      )

    if (blocked) {
      this.stop('blocked')
      return
    }

    if (
      this.remainingTime <= EPSILON ||
      this.remainingDistance <= EPSILON
    ) {
      this.stop('complete')
    }
  }

  stop(reason) {
    this.active = false
    this.remainingTime = 0
    this.remainingDistance = 0
    this.exitReason = reason
  }

  advanceTimers(deltaTime) {
    this.activationLockRemaining =
      Math.max(
        0,
        this.activationLockRemaining -
          deltaTime
      )

    for (
      let index = 0;
      index <
      this.rechargeTimers.length;
      index += 1
    ) {
      this.rechargeTimers[index] =
        Math.max(
          0,
          this.rechargeTimers[index] -
            deltaTime
        )
    }
  }

  getState() {
    return {
      dashing: this.active,
      dashCharges:
        this.getAvailableCharges(),
      dashRechargeTimers: [
        ...this.rechargeTimers,
      ],
      dashRemainingTime:
        this.remainingTime,
      dashRemainingDistance:
        this.remainingDistance,
      dashActivationLockRemaining:
        this.activationLockRemaining,
      dashExitReason:
        this.exitReason,
      dashAttackLocked:
        this.active,
    }
  }
}

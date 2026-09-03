function fixed(value, digits = 2) {
  return Number.isFinite(value)
    ? value.toFixed(digits)
    : '0.00'
}

function cleanVelocityComponent(value) {
  if (!Number.isFinite(value)) return 0

  return Math.abs(value) < 0.01
    ? 0
    : value
}

export class DebugOverlay {
  constructor(clientProfile = null) {
    this.clientProfile =
      clientProfile
    this.element = document.createElement('pre')
    Object.assign(this.element.style, {
      position: 'fixed',
      top: '10px',
      left: '10px',
      zIndex: '10',
      pointerEvents: 'none',
      margin: '0',
      padding: '8px 10px',
      borderRadius: '6px',
      background: 'rgba(0,0,0,0.58)',
      color: '#fff',
      font: '12px/1.35 monospace',
      whiteSpace: 'pre',
      userSelect: 'none',
    })

    document.body.appendChild(this.element)

    this.lastRenderTime = performance.now()
    this.smoothedFps = 0
    this.previousPlayerPosition = null
    this.previousSimulationTime = null
  }

  update(state, now = performance.now()) {
    const renderDeltaMs =
      Math.max(0.001, now - this.lastRenderTime)

    this.lastRenderTime = now

    const currentFps = 1000 / renderDeltaMs

    this.smoothedFps =
      this.smoothedFps === 0
        ? currentFps
        : this.smoothedFps * 0.9 +
          currentFps * 0.1

    const player = state.player
    const p = player.position
    const rawVelocity =
      player.velocity ?? {
        x: 0,
        y: 0,
        z: 0,
      }

    // Hide sub-centimeter-per-second floating/contact noise in
    // telemetry without changing authoritative simulation state.
    const velocity = {
      x: cleanVelocityComponent(rawVelocity.x),
      y: cleanVelocityComponent(rawVelocity.y),
      z: cleanVelocityComponent(rawVelocity.z),
    }

    const planarSpeed =
      Math.hypot(
        rawVelocity.x,
        rawVelocity.z
      )

    const orientation = player.orientation

    this.element.textContent = [
      `FPS: ${fixed(this.smoothedFps, 0)}`,
      `INPUT MODE: ${this.clientProfile?.inputMode ?? 'unknown'}`,
      `SIM TICK: ${state.tick}`,
      `POS: ${fixed(p.x)}  ${fixed(p.y)}  ${fixed(p.z)}`,
      `VEL XYZ: ${fixed(velocity.x)}  ${fixed(velocity.y)}  ${fixed(velocity.z)}`,
      `SPEED: ${fixed(planarSpeed)} m/s`,
      `YAW/PITCH: ${fixed(
        orientation.yaw * 180 / Math.PI,
        1
      )}° / ${fixed(
        orientation.pitch * 180 / Math.PI,
        1
      )}°`,
      `GROUNDED: ${player.grounded}`,
      `AIRBORNE: ${!player.grounded}`,
      `SPRINTING: ${player.sprinting}`,
      `CROUCHED: ${player.crouched}`,
      `SLIDING: ${player.sliding}`,
      `SLIDE SPEED: ${fixed(player.slideSpeed, 2)} m/s`,
      `SLIDE TIME: ${fixed(player.slideElapsed, 2)} s`,
      `SLIDE EXIT: ${player.slideExitReason}`,
      `SLIDE SLOPE A: ${fixed(player.slideSlopeAcceleration, 2)} m/s²`,
      `DASHING: ${player.dashing}`,
      `DASH CHARGES: ${player.dashCharges}`,
      `DASH TIMERS: ${(player.dashRechargeTimers ?? []).map((value) => fixed(value, 2)).join(' / ')}`,
      `DASH REMAIN: ${fixed(player.dashRemainingDistance, 2)} m / ${fixed(player.dashRemainingTime, 2)} s`,
      `DASH LOCK: ${fixed(player.dashActivationLockRemaining, 2)} s`,
      `DASH EXIT: ${player.dashExitReason}`,
      `DASH ATTACK LOCK: ${player.dashAttackLocked}`,
      `DASH ENEMY: ${player.dashEnemyContactId ?? 'none'}`,
      `ENEMY SEP: ${player.enemySeparationContacts}`,
      `STAND BLOCKED: ${player.standBlocked}`,
      `LANDING: ${player.landingType}`,
      `LAND MULT: ${fixed(player.landingRecoveryMultiplier, 2)}`,
      `LAND RECOVERY: ${fixed(player.landingRecoveryRemaining, 2)} s`,
      `IMPACT Y: ${fixed(player.landingImpactSpeed, 2)} m/s`,
      `INPUT SEQ: ${player.lastInputSequence}`,
    ].join('\n')
  }

  dispose() {
    this.element.remove()
  }
}

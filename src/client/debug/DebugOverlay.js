function fixed(value, digits = 2) {
  return Number.isFinite(value)
    ? value.toFixed(digits)
    : '0.00'
}

export class DebugOverlay {
  constructor() {
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

    let velocity = { x: 0, y: 0, z: 0 }

    if (
      this.previousPlayerPosition &&
      this.previousSimulationTime !== null
    ) {
      const dt =
        state.time - this.previousSimulationTime

      if (dt > 0) {
        velocity = {
          x:
            (p.x - this.previousPlayerPosition.x) /
            dt,
          y:
            (p.y - this.previousPlayerPosition.y) /
            dt,
          z:
            (p.z - this.previousPlayerPosition.z) /
            dt,
        }
      }
    }

    this.previousPlayerPosition = {
      x: p.x,
      y: p.y,
      z: p.z,
    }

    this.previousSimulationTime = state.time

    const orientation = player.orientation

    this.element.textContent = [
      `FPS: ${fixed(this.smoothedFps, 0)}`,
      `SIM TICK: ${state.tick}`,
      `POS: ${fixed(p.x)}  ${fixed(p.y)}  ${fixed(p.z)}`,
      `VEL: ${fixed(velocity.x)}  ${fixed(velocity.y)}  ${fixed(velocity.z)}`,
      `YAW/PITCH: ${fixed(
        orientation.yaw * 180 / Math.PI,
        1
      )}° / ${fixed(
        orientation.pitch * 180 / Math.PI,
        1
      )}°`,
      `GROUNDED: ${player.grounded}`,
      `SPRINTING: ${player.sprinting}`,
      `INPUT SEQ: ${player.lastInputSequence}`,
    ].join('\n')
  }

  dispose() {
    this.element.remove()
  }
}

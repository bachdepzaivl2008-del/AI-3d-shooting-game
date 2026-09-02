function wrapRadians(value) {
  const twoPi = Math.PI * 2
  let wrapped = value % twoPi

  if (wrapped > Math.PI) {
    wrapped -= twoPi
  } else if (wrapped < -Math.PI) {
    wrapped += twoPi
  }

  return wrapped
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export class PlayerLookSystem {
  constructor(config) {
    this.sensitivity =
      config.look.mouseSensitivityRadiansPerPixel

    this.maxPitchRadians =
      (config.look.maxPitchDegrees * Math.PI) / 180
  }

  update(orientation, input) {
    const deltaX =
      Number.isFinite(input?.lookDeltaX)
        ? input.lookDeltaX
        : 0

    const deltaY =
      Number.isFinite(input?.lookDeltaY)
        ? input.lookDeltaY
        : 0

    const yaw = wrapRadians(
      orientation.yaw +
        deltaX * this.sensitivity
    )

    const pitch = clamp(
      orientation.pitch -
        deltaY * this.sensitivity,
      -this.maxPitchRadians,
      this.maxPitchRadians
    )

    return {
      yaw,
      pitch,
    }
  }
}

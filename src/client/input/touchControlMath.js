export function normalizeTouchJoystick(
  deltaX,
  deltaY,
  radius
) {
  const safeRadius =
    Math.max(
      1,
      Number.isFinite(radius)
        ? radius
        : 1
    )

  const length =
    Math.hypot(
      deltaX,
      deltaY
    )

  const scale =
    length > safeRadius
      ? safeRadius / length
      : 1

  const clampedX =
    deltaX * scale

  const clampedY =
    deltaY * scale

  return {
    moveX:
      clampedX / safeRadius,
    moveY:
      -clampedY / safeRadius,
    magnitude:
      Math.min(
        1,
        length / safeRadius
      ),
    clampedX,
    clampedY,
  }
}

export function shouldAutoSprint(
  magnitude,
  threshold
) {
  if (
    !Number.isFinite(magnitude) ||
    !Number.isFinite(threshold)
  ) {
    return false
  }

  return (
    magnitude >= threshold
  )
}

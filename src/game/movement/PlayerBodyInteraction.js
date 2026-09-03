const EPSILON = 1e-9

export function verticalCapsuleBandsOverlap({
  centerY,
  totalHeight,
  otherCenterY,
  otherTotalHeight,
}) {
  const halfHeight =
    totalHeight / 2

  const otherHalfHeight =
    otherTotalHeight / 2

  return (
    Math.abs(
      centerY - otherCenterY
    ) <
    halfHeight +
      otherHalfHeight
  )
}

export function resolveEnemySoftSeparation({
  proposedPosition,
  playerRadius,
  playerTotalHeight,
  actors,
  playerTeam = 'blue',
  fallbackDirection = {
    x: 1,
    z: 0,
  },
}) {
  let x =
    proposedPosition.x

  let z =
    proposedPosition.z

  let contacts = 0

  for (const actor of actors) {
    if (
      !actor?.alive ||
      actor.team === playerTeam
    ) {
      continue
    }

    const verticalOverlap =
      verticalCapsuleBandsOverlap({
        centerY:
          proposedPosition.y,
        totalHeight:
          playerTotalHeight,
        otherCenterY:
          actor.position.y,
        otherTotalHeight:
          actor.totalHeight,
      })

    if (!verticalOverlap) {
      continue
    }

    const dx =
      x - actor.position.x

    const dz =
      z - actor.position.z

    const distance =
      Math.hypot(dx, dz)

    const minimumDistance =
      playerRadius +
      actor.radius

    if (
      distance >=
        minimumDistance ||
      minimumDistance <= EPSILON
    ) {
      continue
    }

    let directionX
    let directionZ

    if (distance > EPSILON) {
      directionX =
        dx / distance

      directionZ =
        dz / distance
    } else {
      const fallbackLength =
        Math.hypot(
          fallbackDirection.x,
          fallbackDirection.z
        )

      if (fallbackLength > EPSILON) {
        directionX =
          fallbackDirection.x /
          fallbackLength

        directionZ =
          fallbackDirection.z /
          fallbackLength
      } else {
        directionX = 1
        directionZ = 0
      }
    }

    const correction =
      minimumDistance -
      distance

    x +=
      directionX *
      correction

    z +=
      directionZ *
      correction

    contacts += 1
  }

  return {
    correction: {
      x:
        x -
        proposedPosition.x,
      z:
        z -
        proposedPosition.z,
    },
    contacts,
    position: {
      x,
      y:
        proposedPosition.y,
      z,
    },
  }
}

function segmentCircleFirstHit({
  startX,
  startZ,
  deltaX,
  deltaZ,
  centerX,
  centerZ,
  radius,
}) {
  const offsetX =
    startX - centerX

  const offsetZ =
    startZ - centerZ

  const c =
    offsetX * offsetX +
    offsetZ * offsetZ -
    radius * radius

  if (c <= 0) {
    return 0
  }

  const a =
    deltaX * deltaX +
    deltaZ * deltaZ

  if (a <= EPSILON) {
    return null
  }

  const b =
    2 *
    (
      offsetX * deltaX +
      offsetZ * deltaZ
    )

  const discriminant =
    b * b -
    4 * a * c

  if (discriminant < 0) {
    return null
  }

  const sqrtDiscriminant =
    Math.sqrt(discriminant)

  const t =
    (
      -b -
      sqrtDiscriminant
    ) /
    (2 * a)

  if (
    t < 0 ||
    t > 1
  ) {
    return null
  }

  return t
}

export function sweepDashAgainstEnemies({
  startPosition,
  desiredMovement,
  playerRadius,
  playerTotalHeight,
  actors,
  playerTeam = 'blue',
}) {
  let earliest = null

  for (const actor of actors) {
    if (
      !actor?.alive ||
      actor.team === playerTeam
    ) {
      continue
    }

    const hitT =
      segmentCircleFirstHit({
        startX:
          startPosition.x,
        startZ:
          startPosition.z,
        deltaX:
          desiredMovement.x,
        deltaZ:
          desiredMovement.z,
        centerX:
          actor.position.x,
        centerZ:
          actor.position.z,
        radius:
          playerRadius +
          actor.radius,
      })

    if (hitT === null) {
      continue
    }

    const contactY =
      startPosition.y +
      desiredMovement.y *
        hitT

    const verticalOverlap =
      verticalCapsuleBandsOverlap({
        centerY: contactY,
        totalHeight:
          playerTotalHeight,
        otherCenterY:
          actor.position.y,
        otherTotalHeight:
          actor.totalHeight,
      })

    if (!verticalOverlap) {
      continue
    }

    if (
      earliest === null ||
      hitT < earliest.t
    ) {
      earliest = {
        t: hitT,
        actorId: actor.id,
      }
    }
  }

  if (earliest === null) {
    return null
  }

  return {
    ...earliest,
    movement: {
      x:
        desiredMovement.x *
        earliest.t,
      y:
        desiredMovement.y,
      z:
        desiredMovement.z *
        earliest.t,
    },
  }
}

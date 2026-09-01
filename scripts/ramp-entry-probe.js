import { loadRapier } from '../src/shared/collision/loadRapier.js'

const RAPIER = await loadRapier()

const FIXED_DT = 1 / 60
const MAX_SLOPE_DEGREES = 45
const PROBE_SLOPE_DEGREES = 35

const CHARACTER = {
  standingHeight: 1.8,
  radius: 0.35,
  controllerOffset: 0.01,
  snapDistance: 0.2,
}

const RAMP = {
  halfLength: 3,
  halfThickness: 0.1,
  halfWidth: 1.5,
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function rampRotation(angle) {
  return {
    w: Math.cos(angle / 2),
    x: 0,
    y: 0,
    z: Math.sin(angle / 2),
  }
}

function rampCenterForLowerTopPoint(entryX, entryY, angle) {
  return {
    x:
      entryX +
      RAMP.halfLength * Math.cos(angle) +
      RAMP.halfThickness * Math.sin(angle),
    y:
      entryY +
      RAMP.halfLength * Math.sin(angle) -
      RAMP.halfThickness * Math.cos(angle),
    z: 0,
  }
}

function createController(world) {
  const controller =
    world.createCharacterController(
      CHARACTER.controllerOffset
    )

  controller.setSlideEnabled(true)
  controller.setMaxSlopeClimbAngle(
    toRadians(MAX_SLOPE_DEGREES)
  )
  controller.enableSnapToGround(
    CHARACTER.snapDistance
  )

  return controller
}

function createCharacter(world, position) {
  const halfHeight = Math.max(
    0,
    (CHARACTER.standingHeight -
      CHARACTER.radius * 2) /
      2
  )

  return world.createCollider(
    RAPIER.ColliderDesc.capsule(
      halfHeight,
      CHARACTER.radius
    ).setTranslation(
      position.x,
      position.y,
      position.z
    )
  )
}

function moveCollider(
  world,
  controller,
  collider,
  desired
) {
  controller.computeColliderMovement(
    collider,
    desired
  )

  const corrected =
    controller.computedMovement()

  const current = collider.translation()

  collider.setTranslation({
    x: current.x + corrected.x,
    y: current.y + corrected.y,
    z: current.z + corrected.z,
  })

  world.step()

  const position = collider.translation()

  return {
    position: {
      x: position.x,
      y: position.y,
      z: position.z,
    },
    corrected: {
      x: corrected.x,
      y: corrected.y,
      z: corrected.z,
    },
    grounded:
      controller.computedGrounded(),
  }
}

async function runCase({
  name,
  entryX,
  entryY,
  groundEndX,
}) {
  const angle =
    toRadians(PROBE_SLOPE_DEGREES)

  const world = new RAPIER.World({
    x: 0,
    y: -20,
    z: 0,
  })

  world.timestep = FIXED_DT

  const groundStartX = -4
  const groundHalfLength =
    (groundEndX - groundStartX) / 2

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      groundHalfLength,
      0.5,
      2
    ).setTranslation(
      groundStartX + groundHalfLength,
      -0.5,
      0
    )
  )

  const rampCenter =
    rampCenterForLowerTopPoint(
      entryX,
      entryY,
      angle
    )

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      RAMP.halfLength,
      RAMP.halfThickness,
      RAMP.halfWidth
    )
      .setTranslation(
        rampCenter.x,
        rampCenter.y,
        rampCenter.z
      )
      .setRotation(
        rampRotation(angle)
      )
  )

  const character = createCharacter(
    world,
    {
      x: -1.5,
      y:
        CHARACTER.standingHeight / 2 +
        CHARACTER.controllerOffset,
      z: 0,
    }
  )

  const controller =
    createController(world)

  world.step()

  let state = null
  let maxY =
    character.translation().y
  let firstRiseTick = null
  let firstGroundLossTick = null
  const samples = []

  for (let tick = 1; tick <= 240; tick += 1) {
    state = moveCollider(
      world,
      controller,
      character,
      {
        x: 0.03,
        y: -0.01,
        z: 0,
      }
    )

    maxY = Math.max(
      maxY,
      state.position.y
    )

    if (
      firstRiseTick === null &&
      state.position.y >
        CHARACTER.standingHeight / 2 +
          CHARACTER.controllerOffset +
          0.05
    ) {
      firstRiseTick = tick
    }

    if (
      firstGroundLossTick === null &&
      !state.grounded
    ) {
      firstGroundLossTick = tick
    }

    if (
      tick === 1 ||
      tick === 60 ||
      tick === 120 ||
      tick === 180 ||
      tick === 240
    ) {
      samples.push({
        tick,
        position: state.position,
        corrected: state.corrected,
        grounded: state.grounded,
      })
    }
  }

  const final = state.position
  const horizontalProgress =
    final.x - (-1.5)

  const verticalGain =
    maxY -
    (CHARACTER.standingHeight / 2 +
      CHARACTER.controllerOffset)

  const pass =
    horizontalProgress > 3 &&
    verticalGain > 0.5

  world.removeCharacterController(
    controller
  )
  world.free()

  return {
    name,
    entryX,
    entryY,
    groundEndX,
    horizontalProgress,
    verticalGain,
    firstRiseTick,
    firstGroundLossTick,
    final,
    pass,
    samples,
  }
}

const cases = [
  {
    name: 'flush-no-overlap',
    entryX: 0.8,
    entryY: 0,
    groundEndX: 0.8,
  },
  {
    name: 'embedded-5cm-overlap-30cm',
    entryX: 0.8,
    entryY: -0.05,
    groundEndX: 1.1,
  },
  {
    name: 'embedded-10cm-overlap-50cm',
    entryX: 0.8,
    entryY: -0.1,
    groundEndX: 1.3,
  },
]

const results = []

for (const probeCase of cases) {
  results.push(
    await runCase(probeCase)
  )
}

console.dir(
  {
    probe:
      'flat-ground-to-ramp-transition',
    slopeDegrees:
      PROBE_SLOPE_DEGREES,
    maxAllowedSlopeDegrees:
      MAX_SLOPE_DEGREES,
    results,
  },
  { depth: null }
)

const passingCases =
  results.filter((item) => item.pass)

if (passingCases.length > 0) {
  console.log(
    'Ramp entry probe: PASS'
  )
  console.log(
    'Passing construction(s):',
    passingCases.map(
      (item) => item.name
    )
  )
  process.exitCode = 0
} else {
  console.log(
    'Ramp entry probe: BLOCKED'
  )
  process.exitCode = 1
}

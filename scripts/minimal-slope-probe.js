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
  center: { x: 0, y: 2, z: 0 },
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function makeRampRotation(angleRadians) {
  return {
    w: Math.cos(angleRadians / 2),
    x: 0,
    y: 0,
    z: Math.sin(angleRadians / 2),
  }
}

function rampTopPoint(localX, angleRadians) {
  const c = Math.cos(angleRadians)
  const s = Math.sin(angleRadians)

  return {
    x:
      RAMP.center.x +
      localX * c -
      RAMP.halfThickness * s,
    y:
      RAMP.center.y +
      localX * s +
      RAMP.halfThickness * c,
    z: 0,
  }
}

function createWorld() {
  return new RAPIER.World({ x: 0, y: -20, z: 0 })
}

function createController(world) {
  const controller = world.createCharacterController(
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

  const corrected = controller.computedMovement()
  const current = collider.translation()

  collider.setTranslation({
    x: current.x + corrected.x,
    y: current.y + corrected.y,
    z: current.z + corrected.z,
  })

  world.step()

  return {
    corrected: {
      x: corrected.x,
      y: corrected.y,
      z: corrected.z,
    },
    position: {
      x: collider.translation().x,
      y: collider.translation().y,
      z: collider.translation().z,
    },
    grounded: controller.computedGrounded(),
  }
}

const angle = toRadians(PROBE_SLOPE_DEGREES)
const world = createWorld()
world.timestep = FIXED_DT

world.createCollider(
  RAPIER.ColliderDesc.cuboid(
    RAMP.halfLength,
    RAMP.halfThickness,
    RAMP.halfWidth
  )
    .setTranslation(
      RAMP.center.x,
      RAMP.center.y,
      RAMP.center.z
    )
    .setRotation(makeRampRotation(angle))
)

const startSurface = rampTopPoint(-1.5, angle)

const character = createCharacter(world, {
  x: startSurface.x,
  y:
    startSurface.y +
    CHARACTER.standingHeight / 2 +
    0.25,
  z: 0,
})

const controller = createController(world)

world.step()

let state = null

// Settle vertically onto the ramp without crossing an entry seam.
for (let i = 0; i < 30; i += 1) {
  state = moveCollider(
    world,
    controller,
    character,
    { x: 0, y: -0.05, z: 0 }
  )
}

const settled = { ...state.position }
let maxY = settled.y
let minX = settled.x
let maxX = settled.x
let groundedTicks = 0
const samples = []

// Move horizontally while applying a small downward component.
// This isolates pure slope traversal from ramp-entry geometry.
for (let tick = 1; tick <= 240; tick += 1) {
  state = moveCollider(
    world,
    controller,
    character,
    { x: 0.03, y: -0.01, z: 0 }
  )

  maxY = Math.max(maxY, state.position.y)
  minX = Math.min(minX, state.position.x)
  maxX = Math.max(maxX, state.position.x)

  if (state.grounded) {
    groundedTicks += 1
  }

  if (
    tick === 1 ||
    tick === 30 ||
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

const result = {
  probe: 'minimal-direct-rapier-slope',
  slopeDegrees: PROBE_SLOPE_DEGREES,
  maxAllowedSlopeDegrees: MAX_SLOPE_DEGREES,
  settled,
  final: state.position,
  horizontalProgress: maxX - settled.x,
  verticalGain: maxY - settled.y,
  groundedTicks,
  samples,
}

console.dir(result, { depth: null })

const climbed =
  result.horizontalProgress > 2 &&
  result.verticalGain > 0.5

if (climbed) {
  console.log('Minimal slope probe: PASS')
  process.exitCode = 0
} else {
  console.log('Minimal slope probe: BLOCKED')
  process.exitCode = 1
}

world.removeCharacterController(controller)
world.free()

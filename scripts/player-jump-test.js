import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'
import { PlayerMovementSystem } from '../src/game/systems/PlayerMovementSystem.js'

const testConfig = {
  ...gameConfig,
  cube: {
    ...gameConfig.cube,
    startPosition: {
      x: 100,
      y: gameConfig.cube.startPosition.y,
      z: 100,
    },
  },
}

const DT =
  testConfig.simulation.fixedDeltaTime

function nearlyEqual(
  actual,
  expected,
  epsilon
) {
  return (
    Math.abs(actual - expected) <=
    epsilon
  )
}

function createIntent(
  sequencer,
  overrides = {}
) {
  return sequencer.create(
    'PLAYER_INPUT',
    {
      moveX: 0,
      moveY: 0,
      lookDeltaX: 0,
      lookDeltaY: 0,
      sprint: false,
      crouch: false,
      jump: false,
      ...overrides,
    }
  )
}

const authority =
  await LocalAuthorityHost.create(
    testConfig
  )

const sequencer =
  new IntentSequencer(
    'test:jump-gravity'
  )

const startY =
  authority.getState()
    .player.position.y

authority.submitIntent(
  createIntent(
    sequencer,
    {
      jump: true,
    }
  )
)

authority.step()

let player =
  authority.getState().player

assert.equal(
  player.grounded,
  false,
  'Jump press from grounded state must enter airborne state'
)

assert.ok(
  player.velocity.y > 6,
  'Jump launch must produce strong positive Y velocity'
)

let maxY =
  player.position.y

let landingTick = null
let secondJumpAttempted = false
let velocityBeforeSecondJump = null
let velocityAfterSecondJump = null

for (
  let tick = 2;
  tick <= 180;
  tick += 1
) {
  let jump = true

  // Release once, then make a new press while still airborne.
  // This must NOT produce a Double Jump.
  if (tick >= 7 && tick <= 11) {
    jump = false
  }

  if (tick === 12) {
    secondJumpAttempted = true
    velocityBeforeSecondJump =
      authority.getState()
        .player.velocity.y
  }

  authority.submitIntent(
    createIntent(
      sequencer,
      {
        jump,
      }
    )
  )

  authority.step()

  player =
    authority.getState().player

  maxY = Math.max(
    maxY,
    player.position.y
  )

  if (tick === 12) {
    velocityAfterSecondJump =
      player.velocity.y
  }

  if (
    tick > 10 &&
    player.grounded
  ) {
    landingTick = tick
    break
  }
}

assert.equal(
  secondJumpAttempted,
  true
)

assert.ok(
  velocityAfterSecondJump <
    velocityBeforeSecondJump,
  'A second airborne Jump press must not reset upward velocity'
)

assert.notEqual(
  landingTick,
  null,
  'Gravity must return the player to ground'
)

const apexHeight =
  maxY - startY

assert.ok(
  nearlyEqual(
    apexHeight,
    1.09,
    0.08
  ),
  `Jump apex must remain near canonical ~1.09 m; got ${apexHeight}`
)

player =
  authority.getState().player

assert.ok(
  nearlyEqual(
    player.position.y,
    startY,
    0.03
  ),
  'Landing must return player to original level-ground height'
)

assert.equal(
  player.velocity.y,
  0,
  'Grounded gameplay Y velocity must return to zero on landing'
)

// Keep Space held after landing.
// It must not auto-jump because there was no new press edge.
for (
  let tick = 0;
  tick < 20;
  tick += 1
) {
  authority.submitIntent(
    createIntent(
      sequencer,
      {
        jump: true,
      }
    )
  )

  authority.step()

  assert.equal(
    authority.getState()
      .player.grounded,
    true,
    'Holding Space through landing must not auto-repeat Jump'
  )
}

// Release, then new press: Jump becomes legal again.
authority.submitIntent(
  createIntent(
    sequencer,
    {
      jump: false,
    }
  )
)
authority.step()

authority.submitIntent(
  createIntent(
    sequencer,
    {
      jump: true,
    }
  )
)
authority.step()

assert.equal(
  authority.getState()
    .player.grounded,
  false,
  'A new Jump press after release must work after landing'
)

authority.dispose()

// Airborne horizontal-speed contract:
// taking off at normal speed must not gain Sprint speed in air.
const airAuthority =
  await LocalAuthorityHost.create(
    testConfig
  )

const airSequencer =
  new IntentSequencer(
    'test:jump-air-steering'
  )

airAuthority.submitIntent(
  createIntent(
    airSequencer,
    {
      moveY: 1,
      jump: true,
      sprint: false,
    }
  )
)
airAuthority.step()

let airPlayer =
  airAuthority.getState().player

const takeoffPlanarSpeed =
  Math.hypot(
    airPlayer.velocity.x,
    airPlayer.velocity.z
  )

assert.ok(
  nearlyEqual(
    takeoffPlanarSpeed,
    testConfig.movement.baseSpeed,
    0.05
  ),
  'Normal-speed Jump must carry Normal planar speed into air'
)

airAuthority.submitIntent(
  createIntent(
    airSequencer,
    {
      moveY: 1,
      sprint: true,
      jump: false,
    }
  )
)
airAuthority.step()

airPlayer =
  airAuthority.getState().player

const airborneSprintAttemptSpeed =
  Math.hypot(
    airPlayer.velocity.x,
    airPlayer.velocity.z
  )

assert.ok(
  airborneSprintAttemptSpeed <=
    takeoffPlanarSpeed + 0.05,
  'Air input must not create horizontal speed gain above takeoff speed'
)

// Change direction in air.
// Reduced steering means it must not snap instantly to full rightward velocity.
airAuthority.submitIntent(
  createIntent(
    airSequencer,
    {
      moveX: 1,
      moveY: 0,
      sprint: false,
      jump: false,
    }
  )
)
airAuthority.step()

airPlayer =
  airAuthority.getState().player

assert.ok(
  Math.abs(airPlayer.velocity.x) <
    testConfig.movement.baseSpeed -
      0.2,
  'Reduced air steering must not instantly snap to full new-axis speed'
)

assert.ok(
  Math.abs(airPlayer.velocity.z) >
    0.2,
  'Reduced air steering must preserve some carried momentum during direction change'
)

airAuthority.dispose()

// Stationary takeoff carries zero planar speed.
// Air steering may redirect carried momentum, but it must not create
// horizontal speed from nothing.
const stationaryAuthority =
  await LocalAuthorityHost.create(
    testConfig
  )

const stationarySequencer =
  new IntentSequencer(
    'test:jump-stationary-air-cap'
  )

stationaryAuthority.submitIntent(
  createIntent(
    stationarySequencer,
    {
      jump: true,
    }
  )
)
stationaryAuthority.step()

stationaryAuthority.submitIntent(
  createIntent(
    stationarySequencer,
    {
      moveX: 1,
      jump: false,
    }
  )
)
stationaryAuthority.step()

const stationaryAirPlayer =
  stationaryAuthority.getState().player

const stationaryAirSpeed =
  Math.hypot(
    stationaryAirPlayer.velocity.x,
    stationaryAirPlayer.velocity.z
  )

assert.ok(
  stationaryAirSpeed <= 0.05,
  'Stationary Jump must not create new horizontal speed from airborne input'
)

stationaryAuthority.dispose()

// Sprint takeoff must be allowed to carry Sprint speed.
const sprintAirAuthority =
  await LocalAuthorityHost.create(
    testConfig
  )

const sprintAirSequencer =
  new IntentSequencer(
    'test:jump-sprint-carry'
  )

sprintAirAuthority.submitIntent(
  createIntent(
    sprintAirSequencer,
    {
      moveY: 1,
      sprint: true,
      jump: true,
    }
  )
)
sprintAirAuthority.step()

sprintAirAuthority.submitIntent(
  createIntent(
    sprintAirSequencer,
    {
      moveY: 1,
      sprint: true,
      jump: false,
    }
  )
)
sprintAirAuthority.step()

const sprintAirPlayer =
  sprintAirAuthority.getState().player

const sprintAirSpeed =
  Math.hypot(
    sprintAirPlayer.velocity.x,
    sprintAirPlayer.velocity.z
  )

const expectedSprintSpeed =
  testConfig.movement.baseSpeed *
  testConfig.movement.sprintMultiplier

assert.ok(
  nearlyEqual(
    sprintAirSpeed,
    expectedSprintSpeed,
    0.05
  ),
  'Sprint Jump must preserve carried Sprint speed while the same input continues'
)

sprintAirAuthority.dispose()

// Crouch + low ceiling:
// Jump may not force a standing capsule through blocked head clearance.
const blockedMovement =
  await PlayerMovementSystem.create(
    testConfig
  )

blockedMovement.update(
  {
    moveX: 0,
    moveY: 0,
    sprint: false,
    crouch: true,
    jump: false,
  },
  DT,
  0
)

const crouchedPosition =
  blockedMovement.getPosition()

blockedMovement.collision.createStaticBox({
  center: {
    x: crouchedPosition.x,
    y: 1.5,
    z: crouchedPosition.z,
  },
  halfExtents: {
    x: 1,
    y: 0.1,
    z: 1,
  },
})

blockedMovement.collision.step()

const blockedJump =
  blockedMovement.update(
    {
      moveX: 0,
      moveY: 0,
      sprint: false,
      crouch: true,
      jump: true,
    },
    DT,
    0
  )

assert.equal(
  blockedJump.grounded,
  true,
  'Blocked crouch-to-stand clearance must prevent Jump launch'
)

assert.equal(
  blockedJump.crouched,
  true,
  'Blocked Jump attempt must keep crouched stance'
)

assert.equal(
  blockedJump.standBlocked,
  true,
  'Blocked Jump attempt must report standing clearance failure'
)

assert.equal(
  blockedJump.jumpedThisTick,
  false,
  'Blocked Jump attempt must not create a Jump event'
)

blockedMovement.dispose()

console.log(
  'Authoritative Jump + Gravity test: PASS'
)

console.log({
  gravity:
    testConfig.movement.gravity,
  jumpVerticalVelocity:
    testConfig.movement
      .jumpVerticalVelocity,
  apexHeight,
  landingTick,
  noDoubleJump: true,
  heldJumpNoAutoRepeat: true,
  airborneSpeedGainBlocked: true,
  stationaryAirGainBlocked: true,
  sprintTakeoffSpeedPreserved: true,
  reducedAirSteering: true,
  lowCeilingJumpBlocked: true,
})

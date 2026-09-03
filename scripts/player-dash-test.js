import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'
import {
  PlayerMovementSystem,
  isDashTranslationBlocked,
} from '../src/game/systems/PlayerMovementSystem.js'

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
  epsilon = 0.05
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
      dash: false,
      ...overrides,
    }
  )
}

async function createAuthority(
  sourceId
) {
  return {
    authority:
      await LocalAuthorityHost.create(
        testConfig
      ),
    sequencer:
      new IntentSequencer(sourceId),
  }
}

async function stepIntent(
  authority,
  sequencer,
  overrides = {}
) {
  authority.submitIntent(
    createIntent(
      sequencer,
      overrides
    )
  )

  authority.step()

  return authority.getState().player
}

// 1) Spawn contract: exactly two ready charges.
const main =
  await createAuthority(
    'test:dash-main'
  )

let player =
  main.authority.getState().player

assert.equal(
  player.dashCharges,
  2,
  'Player must spawn with exactly two Dash Charges'
)

assert.deepEqual(
  player.dashRechargeTimers,
  [0, 0],
  'Both Dash Charges must begin ready'
)

const start = {
  ...player.position,
}

// 2) No movement input => camera-forward Dash.
// yaw=0 forward is -Z.
player =
  await stepIntent(
    main.authority,
    main.sequencer,
    {
      dash: true,
    }
  )

assert.equal(
  player.dashing,
  true,
  'Dash press must activate when a charge is ready'
)

assert.equal(
  player.dashCharges,
  1,
  'Dash activation must immediately consume one charge'
)

assert.equal(
  player.dashAttackLocked,
  true,
  'Attack lock must be authoritative during a Dash movement tick'
)

assert.ok(
  player.position.z < start.z,
  'No-input Dash must default camera-forward'
)

assert.ok(
  nearlyEqual(
    player.position.x,
    start.x,
    0.02
  ),
  'No-input yaw=0 Dash must not create sideways drift'
)

let dashTicks = 1

while (
  main.authority.getState()
    .player.dashing &&
  dashTicks < 60
) {
  player =
    await stepIntent(
      main.authority,
      main.sequencer,
      {
        dash: false,
      }
    )

  dashTicks += 1
}

assert.ok(
  dashTicks < 60,
  'Dash must terminate within its canonical duration'
)

assert.equal(
  player.dashExitReason,
  'complete',
  'Unblocked Dash must complete normally'
)

const dashDistance =
  Math.hypot(
    player.position.x - start.x,
    player.position.z - start.z
  )

assert.ok(
  nearlyEqual(
    dashDistance,
    testConfig.movement.dashDistance,
    0.03
  ),
  `Unblocked Dash must travel canonical 7.0 m; got ${dashDistance}`
)

assert.equal(
  player.grounded,
  true,
  'Flat-ground Dash must remain grounded'
)

assert.equal(
  player.velocity.y,
  0,
  'Grounded Dash must add no vertical velocity'
)

// 3) Minimum 0.25 s activation interval.
// The first Dash finishes at ~0.233 s, so an immediate new press must fail.
player =
  await stepIntent(
    main.authority,
    main.sequencer,
    {
      dash: true,
    }
  )

assert.equal(
  player.dashing,
  false,
  'Second Dash must be rejected before the canonical 0.25 s minimum interval'
)

assert.equal(
  player.dashCharges,
  1,
  'Rejected Dash must not consume a charge'
)

// Release one fixed tick; this crosses the minimum interval.
await stepIntent(
  main.authority,
  main.sequencer,
  {
    dash: false,
  }
)

player =
  await stepIntent(
    main.authority,
    main.sequencer,
    {
      moveY: -1,
      dash: true,
    }
  )

assert.equal(
  player.dashing,
  true,
  'Second Dash must activate once the 0.25 s interval has elapsed'
)

assert.equal(
  player.dashCharges,
  0,
  'Second legal Dash must consume the second charge'
)

assert.ok(
  player.dashRechargeTimers[0] <
    player.dashRechargeTimers[1],
  'Each consumed charge must own an independent recharge timer'
)

const independentTimerGap =
  player.dashRechargeTimers[1] -
  player.dashRechargeTimers[0]

assert.ok(
  independentTimerGap >=
    testConfig.movement.dashMinInterval -
      DT * 2,
  'Independent timers must preserve the real activation-time gap'
)

// Let second Dash finish.
while (
  main.authority.getState()
    .player.dashing
) {
  await stepIntent(
    main.authority,
    main.sequencer,
    {
      dash: false,
    }
  )
}

// Wait out minimum interval, then verify no third Dash exists while both timers run.
for (
  let tick = 0;
  tick < 4;
  tick += 1
) {
  await stepIntent(
    main.authority,
    main.sequencer,
    {
      dash: false,
    }
  )
}

player =
  await stepIntent(
    main.authority,
    main.sequencer,
    {
      dash: true,
    }
  )

assert.equal(
  player.dashing,
  false,
  'Dash must not activate with zero available charges'
)

assert.equal(
  player.dashCharges,
  0
)

// 4) First charge must recharge before the second one.
await stepIntent(
  main.authority,
  main.sequencer,
  {
    dash: false,
  }
)

let sawIndependentRecharge = false

for (
  let tick = 0;
  tick < 360;
  tick += 1
) {
  player =
    await stepIntent(
      main.authority,
      main.sequencer
    )

  if (
    player.dashCharges === 1 &&
    player.dashRechargeTimers[0] === 0 &&
    player.dashRechargeTimers[1] > 0
  ) {
    sawIndependentRecharge = true
    break
  }
}

assert.equal(
  sawIndependentRecharge,
  true,
  'First Dash Charge must independently become ready while the later charge is still recharging'
)

for (
  let tick = 0;
  tick < 360 &&
  player.dashCharges < 2;
  tick += 1
) {
  player =
    await stepIntent(
      main.authority,
      main.sequencer
    )
}

assert.equal(
  player.dashCharges,
  2,
  'Both independently consumed charges must eventually recharge'
)

main.authority.dispose()


// 5) Holding Dash must consume only one charge.
// A new press edge is required for the second activation.
const held =
  await createAuthority(
    'test:dash-held-edge'
  )

for (
  let tick = 0;
  tick < 40;
  tick += 1
) {
  player =
    await stepIntent(
      held.authority,
      held.sequencer,
      {
        dash: true,
      }
    )
}

assert.equal(
  player.dashCharges,
  1,
  'Holding Dash must not automatically consume the second charge'
)

held.authority.dispose()

// 6) Camera-relative direction at yaw +90 degrees.
// Forward input must Dash along +X instead of world -Z.
const directional =
  await PlayerMovementSystem.create(
    testConfig
  )

const directionalResult =
  directional.update(
    {
      moveX: 0,
      moveY: 1,
      sprint: false,
      crouch: false,
      jump: false,
      dash: true,
    },
    DT,
    Math.PI / 2
  )

assert.ok(
  directionalResult.correctedMovement.x >
    0.4,
  'Yaw +90° forward Dash must move camera-relative +X'
)

assert.ok(
  Math.abs(
    directionalResult.correctedMovement.z
  ) < 0.05,
  'Yaw +90° forward Dash must not remain locked to world -Z'
)

directional.dispose()

// 7) Air Dash: no vertical boost and gravity continues.
const air =
  await createAuthority(
    'test:dash-air'
  )

player =
  await stepIntent(
    air.authority,
    air.sequencer,
    {
      jump: true,
    }
  )

assert.equal(
  player.grounded,
  false
)

const preAirDashYVelocity =
  player.velocity.y

player =
  await stepIntent(
    air.authority,
    air.sequencer,
    {
      jump: false,
      dash: true,
    }
  )

assert.equal(
  player.dashing,
  true,
  'Dash must be legal while airborne'
)

assert.equal(
  player.grounded,
  false
)

assert.ok(
  player.velocity.y <
    preAirDashYVelocity,
  'Gravity must continue during Air Dash instead of Dash adding vertical boost'
)

assert.ok(
  player.velocity.y > 0,
  'Early ascending Air Dash must preserve the existing jump/fall state rather than resetting it'
)

air.authority.dispose()

// 8) Swept world collision: blocked Dash stops and charge stays consumed.
const blocked =
  await PlayerMovementSystem.create(
    testConfig
  )

const blockedStart =
  blocked.getPosition()

blocked.collision.createStaticBox({
  center: {
    x: blockedStart.x,
    y: 1,
    z: blockedStart.z - 0.7,
  },
  halfExtents: {
    x: 2,
    y: 1,
    z: 0.1,
  },
})

blocked.collision.step()

const blockedResult =
  blocked.update(
    {
      moveX: 0,
      moveY: 0,
      sprint: false,
      crouch: false,
      jump: false,
      dash: true,
    },
    DT,
    0
  )

const blockedTravel =
  Math.hypot(
    blockedResult.correctedMovement.x,
    blockedResult.correctedMovement.z
  )

const firstDashRequestedDistance =
  (
    testConfig.movement.dashDistance /
    testConfig.movement.dashDuration
  ) * DT

assert.equal(
  blockedResult.dashing,
  false,
  'World-blocked Dash must stop immediately'
)

assert.equal(
  blockedResult.dashExitReason,
  'blocked'
)

assert.equal(
  blockedResult.dashCharges,
  1,
  'Blocked Dash must still consume its charge'
)

assert.ok(
  blockedTravel <
    firstDashRequestedDistance,
  'Swept character collision must shorten a Dash before the wall'
)

blocked.dispose()

// 9) Dash overrides Slide.
const slideDash =
  await createAuthority(
    'test:dash-slide-override'
  )

for (
  let tick = 0;
  tick < 8;
  tick += 1
) {
  await stepIntent(
    slideDash.authority,
    slideDash.sequencer,
    {
      moveY: 1,
      sprint: true,
    }
  )
}

player =
  await stepIntent(
    slideDash.authority,
    slideDash.sequencer,
    {
      moveY: 1,
      sprint: true,
      crouch: true,
    }
  )

assert.equal(
  player.sliding,
  true,
  'Fixture must enter Slide before testing Dash override'
)

player =
  await stepIntent(
    slideDash.authority,
    slideDash.sequencer,
    {
      moveY: 1,
      crouch: true,
      dash: true,
    }
  )

assert.equal(
  player.sliding,
  false,
  'Dash must cancel/override Slide'
)

assert.equal(
  player.slideExitReason,
  'dash'
)

assert.equal(
  player.dashing,
  true
)

slideDash.authority.dispose()


// 10) Technical collision classification:
// slope correction is not a solid-world block, but shortened path is.
assert.equal(
  isDashTranslationBlocked(
    {
      x: 0.424264,
      y: 0.318198,
      z: 0,
    },
    0.53033
  ),
  false,
  'Walkable slope correction must not be misclassified as a blocked Dash'
)

assert.equal(
  isDashTranslationBlocked(
    {
      x: 0.18,
      y: 0,
      z: 0,
    },
    0.53033
  ),
  true,
  'Shortened swept translation into a wall must classify as blocked'
)

console.log(
  'Authoritative Dash test: PASS'
)

console.log({
  charges:
    testConfig.movement.dashCharges,
  distance:
    testConfig.movement.dashDistance,
  duration:
    testConfig.movement.dashDuration,
  rechargeSeconds:
    testConfig.movement.dashRechargeSeconds,
  minInterval:
    testConfig.movement.dashMinInterval,
  unblockedDistance:
    dashDistance,
  dashTicks,
  independentTimerGap,
  independentRecharge:
    sawIndependentRecharge,
  heldInputConsumesOneCharge: true,
  cameraRelativeDirection: true,
  airDashGravityContinues: true,
  blockedConsumesCharge: true,
  slideOverride: true,
  slopeTraversalNotBlocked: true,
})

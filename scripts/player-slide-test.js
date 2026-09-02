import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'
import {
  PlayerMovementSystem,
  computeSlideSlopeAcceleration,
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
      ...overrides,
    }
  )
}

async function createAuthority(sourceId) {
  return {
    authority:
      await LocalAuthorityHost.create(
        testConfig
      ),
    sequencer:
      new IntentSequencer(sourceId),
  }
}

async function primeSprint(
  authority,
  sequencer,
  ticks = 10
) {
  for (
    let tick = 0;
    tick < ticks;
    tick += 1
  ) {
    authority.submitIntent(
      createIntent(
        sequencer,
        {
          moveY: 1,
          sprint: true,
        }
      )
    )

    authority.step()
  }
}

// Entry gate: normal 5.5 m/s is below the canonical 6.0 m/s threshold.
const normal =
  await createAuthority(
    'test:slide-normal-gate'
  )

for (
  let tick = 0;
  tick < 5;
  tick += 1
) {
  normal.authority.submitIntent(
    createIntent(
      normal.sequencer,
      {
        moveY: 1,
      }
    )
  )

  normal.authority.step()
}

normal.authority.submitIntent(
  createIntent(
    normal.sequencer,
    {
      moveY: 1,
      crouch: true,
    }
  )
)

normal.authority.step()

let player =
  normal.authority.getState().player

assert.equal(
  player.sliding,
  false,
  'Normal 5.5 m/s movement must not enter Slide below the 6.0 m/s threshold'
)

assert.equal(
  player.crouched,
  true,
  'Below-threshold crouch input should enter normal Crouch'
)

normal.authority.dispose()

// Canonical Sprint 6.875 m/s + Crouch press must enter Slide.
const slide =
  await createAuthority(
    'test:slide-entry'
  )

await primeSprint(
  slide.authority,
  slide.sequencer
)

const preSlidePlayer =
  slide.authority.getState().player

const preSlideSpeed =
  Math.hypot(
    preSlidePlayer.velocity.x,
    preSlidePlayer.velocity.z
  )

assert.ok(
  nearlyEqual(
    preSlideSpeed,
    testConfig.movement.baseSpeed *
      testConfig.movement.sprintMultiplier,
    0.05
  ),
  'Sprint priming must reach canonical Sprint speed before Slide entry'
)

slide.authority.submitIntent(
  createIntent(
    slide.sequencer,
    {
      moveY: 1,
      sprint: true,
      crouch: true,
    }
  )
)

slide.authority.step()

player =
  slide.authority.getState().player

const firstSlidePlanarSpeed =
  Math.hypot(
    player.velocity.x,
    player.velocity.z
  )

const expectedInitialSlideSpeed =
  Math.min(
    preSlideSpeed +
      testConfig.movement
        .slideInitialBoost,
    testConfig.movement
      .slideInitialMaxSpeed
  )

assert.equal(
  player.sliding,
  true,
  'Grounded Sprint + crouch press at >=6.0 m/s must enter Slide'
)

assert.equal(
  player.crouched,
  true,
  'Slide must use the crouched character envelope'
)

assert.equal(
  player.sprinting,
  false,
  'Sprint state must end while Sliding'
)

assert.ok(
  nearlyEqual(
    firstSlidePlanarSpeed,
    expectedInitialSlideSpeed,
    0.05
  ),
  'Initial Slide movement must equal current horizontal speed +0.4 m/s, capped at 9.0 m/s'
)

// Flat-ground momentum must decay monotonically at the canonical 2.5 m/s².
let previousSlideSpeed =
  player.slideSpeed

for (
  let tick = 0;
  tick < 8;
  tick += 1
) {
  slide.authority.submitIntent(
    createIntent(
      slide.sequencer,
      {
        moveY: 1,
        sprint: true,
        crouch: true,
      }
    )
  )

  slide.authority.step()

  player =
    slide.authority.getState().player

  assert.equal(
    player.sliding,
    true,
    'Slide should still be active early in its flat-ground decay'
  )

  assert.ok(
    player.slideSpeed <
      previousSlideSpeed,
    'Flat-ground Slide speed must decay every fixed tick'
  )

  previousSlideSpeed =
    player.slideSpeed
}

// Releasing crouch must cancel Slide immediately.
slide.authority.submitIntent(
  createIntent(
    slide.sequencer,
    {
      moveY: 1,
      sprint: true,
      crouch: false,
    }
  )
)

slide.authority.step()

player =
  slide.authority.getState().player

assert.equal(
  player.sliding,
  false,
  'Releasing crouch must exit Slide'
)

assert.equal(
  player.slideExitReason,
  'crouch_released'
)

assert.equal(
  player.crouched,
  false,
  'Clear-space crouch release after Slide must restore standing stance'
)

slide.authority.dispose()

// Holding crouch after speed-based exit must not instantly re-enter Slide.
// A new crouch press is required, but there is no hard cooldown.
const speedExit =
  await createAuthority(
    'test:slide-speed-exit'
  )

await primeSprint(
  speedExit.authority,
  speedExit.sequencer
)

speedExit.authority.submitIntent(
  createIntent(
    speedExit.sequencer,
    {
      moveY: 1,
      sprint: true,
      crouch: true,
    }
  )
)

speedExit.authority.step()

let exitTick = null

for (
  let tick = 1;
  tick <= 120;
  tick += 1
) {
  speedExit.authority.submitIntent(
    createIntent(
      speedExit.sequencer,
      {
        moveY: 1,
        sprint: true,
        crouch: true,
      }
    )
  )

  speedExit.authority.step()

  player =
    speedExit.authority
      .getState()
      .player

  if (!player.sliding) {
    exitTick = tick
    break
  }
}

assert.notEqual(
  exitTick,
  null,
  'Flat-ground Slide must exit by speed or maximum duration'
)

assert.ok(
  [
    'speed_below_exit',
    'max_duration',
  ].includes(
    player.slideExitReason
  ),
  'Slide must expose a canonical automatic exit reason'
)

const automaticExitReason =
  player.slideExitReason

speedExit.authority.submitIntent(
  createIntent(
    speedExit.sequencer,
    {
      moveY: 1,
      sprint: true,
      crouch: true,
    }
  )
)

speedExit.authority.step()

assert.equal(
  speedExit.authority
    .getState()
    .player
    .sliding,
  false,
  'Holding crouch after automatic Slide exit must not immediately re-enter'
)

// Release crouch to re-arm, regain Sprint, then new crouch press.
// This verifies "no hard cooldown" without permitting same-hold looping.
speedExit.authority.submitIntent(
  createIntent(
    speedExit.sequencer,
    {
      moveY: 1,
      sprint: true,
      crouch: false,
    }
  )
)
speedExit.authority.step()

await primeSprint(
  speedExit.authority,
  speedExit.sequencer,
  3
)

speedExit.authority.submitIntent(
  createIntent(
    speedExit.sequencer,
    {
      moveY: 1,
      sprint: true,
      crouch: true,
    }
  )
)
speedExit.authority.step()

assert.equal(
  speedExit.authority
    .getState()
    .player
    .sliding,
  true,
  'A new crouch press may enter Slide again immediately once speed requirement is restored'
)

speedExit.authority.dispose()

// Slide Jump must end Slide and cap carried horizontal speed at current Sprint speed.
const slideJump =
  await createAuthority(
    'test:slide-jump'
  )

await primeSprint(
  slideJump.authority,
  slideJump.sequencer
)

slideJump.authority.submitIntent(
  createIntent(
    slideJump.sequencer,
    {
      moveY: 1,
      sprint: true,
      crouch: true,
    }
  )
)
slideJump.authority.step()

slideJump.authority.submitIntent(
  createIntent(
    slideJump.sequencer,
    {
      moveY: 1,
      sprint: false,
      crouch: true,
      jump: true,
    }
  )
)
slideJump.authority.step()

player =
  slideJump.authority.getState().player

const slideJumpPlanarSpeed =
  Math.hypot(
    player.velocity.x,
    player.velocity.z
  )

const sprintSpeed =
  testConfig.movement.baseSpeed *
  testConfig.movement.sprintMultiplier

assert.equal(
  player.sliding,
  false,
  'Jump during Slide must exit Slide'
)

assert.equal(
  player.slideExitReason,
  'jump'
)

assert.equal(
  player.grounded,
  false,
  'Allowed Slide Jump must enter airborne state'
)

assert.ok(
  slideJumpPlanarSpeed <=
    sprintSpeed + 0.05,
  'Slide Jump horizontal carry must be capped at current Sprint speed'
)

slideJump.authority.dispose()

// Initial speed cap: the +0.4 boost cannot start a Slide above 9.0 m/s.
const capSystem =
  await PlayerMovementSystem.create(
    testConfig
  )

capSystem.setLastPlanarVelocity(
  12,
  0
)

assert.equal(
  capSystem.startSlide(),
  true
)

assert.ok(
  nearlyEqual(
    capSystem.slideSpeed,
    testConfig.movement
      .slideInitialMaxSpeed,
    1e-6
  ),
  'Initial Slide speed must cap at canonical 9.0 m/s'
)

capSystem.dispose()

// Slope model: downhill can preserve/extend momentum,
// uphill increases momentum loss, flat adds no slope acceleration.
const flatSlopeAcceleration =
  computeSlideSlopeAcceleration(
    {
      x: 0.1,
      y: 0,
      z: 0,
      grounded: true,
    },
    testConfig.movement.gravity
  )

const uphillAcceleration =
  computeSlideSlopeAcceleration(
    {
      x: 0.1,
      y: 0.05,
      z: 0,
      grounded: true,
    },
    testConfig.movement.gravity
  )

const downhillAcceleration =
  computeSlideSlopeAcceleration(
    {
      x: 0.1,
      y: -0.05,
      z: 0,
      grounded: true,
    },
    testConfig.movement.gravity
  )

assert.ok(
  nearlyEqual(
    flatSlopeAcceleration,
    0,
    1e-9
  )
)

assert.ok(
  uphillAcceleration < 0,
  'Uphill surface travel must increase Slide momentum loss'
)

assert.ok(
  downhillAcceleration > 0,
  'Downhill surface travel must preserve or extend Slide momentum through gravity projection'
)

console.log(
  'Authoritative Slide test: PASS'
)

console.log({
  entryThreshold:
    testConfig.movement.slideEntrySpeed,
  firstSlidePlanarSpeed,
  expectedInitialSlideSpeed,
  flatDeceleration:
    testConfig.movement
      .slideFlatDeceleration,
  automaticExitReason,
  automaticExitTick:
    exitTick,
  slideJumpPlanarSpeed,
  sprintSpeed,
  initialSpeedCap:
    testConfig.movement
      .slideInitialMaxSpeed,
  slopeAcceleration: {
    flat:
      flatSlopeAcceleration,
    uphill:
      uphillAcceleration,
    downhill:
      downhillAcceleration,
  },
  noHardCooldown: true,
  noSameHoldReentry: true,
  slideJumpSpeedAccumulationBlocked: true,
})

import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'
import { PlayerMovementSystem } from '../src/game/systems/PlayerMovementSystem.js'

const flatConfig = {
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
  flatConfig.simulation.fixedDeltaTime

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

function planarSpeed(player) {
  return Math.hypot(
    player.velocity.x,
    player.velocity.z
  )
}

async function createAuthority(
  config,
  sourceId
) {
  return {
    authority:
      await LocalAuthorityHost.create(
        config
      ),
    sequencer:
      new IntentSequencer(sourceId),
  }
}

async function runUntilLanding({
  config,
  sourceId,
  firstIntent,
  airIntent,
  maxTicks = 240,
}) {
  const {
    authority,
    sequencer,
  } = await createAuthority(
    config,
    sourceId
  )

  authority.submitIntent(
    createIntent(
      sequencer,
      firstIntent
    )
  )

  authority.step()

  let landingState = null
  let landingTick = null

  for (
    let tick = 2;
    tick <= maxTicks;
    tick += 1
  ) {
    authority.submitIntent(
      createIntent(
        sequencer,
        airIntent
      )
    )

    authority.step()

    const player =
      authority.getState().player

    if (player.landedThisTick) {
      landingState = {
        ...player,
        position: {
          ...player.position,
        },
        velocity: {
          ...player.velocity,
        },
      }

      landingTick = tick
      break
    }
  }

  return {
    authority,
    sequencer,
    landingState,
    landingTick,
  }
}

// STANDARD LANDING: normal running Jump should land below
// the hard-impact threshold and start 0.85x / 0.18 s recovery.
const standard =
  await runUntilLanding({
    config: flatConfig,
    sourceId:
      'test:landing-standard',
    firstIntent: {
      moveY: 1,
      jump: true,
    },
    airIntent: {
      moveY: 1,
      jump: false,
    },
  })

assert.notEqual(
  standard.landingState,
  null,
  'Normal Jump must produce a real airborne-to-ground landing'
)

assert.equal(
  standard.landingState.landingType,
  'standard',
  'Normal Jump landing must classify as Standard Landing'
)

assert.ok(
  standard.landingState
    .landingImpactSpeed <
    flatConfig.movement
      .hardLandingImpactSpeed,
  'Standard Landing impact must remain below Hard Landing threshold'
)

assert.ok(
  nearlyEqual(
    standard.landingState
      .landingRecoveryMultiplier,
    flatConfig.movement
      .standardLandingRetainMultiplier,
    0.001
  ),
  'Standard Landing must begin at canonical 0.85x retain multiplier'
)

assert.ok(
  nearlyEqual(
    standard.landingState
      .landingRecoveryRemaining,
    flatConfig.movement
      .standardLandingRecoverySeconds,
    0.001
  ),
  'Standard Landing must begin with canonical 0.18 s recovery'
)

standard.authority.submitIntent(
  createIntent(
    standard.sequencer,
    {
      moveY: 1,
    }
  )
)

standard.authority.step()

let standardPlayer =
  standard.authority
    .getState()
    .player

const expectedStandardFirstSpeed =
  flatConfig.movement.baseSpeed *
  flatConfig.movement
    .standardLandingRetainMultiplier

assert.ok(
  nearlyEqual(
    planarSpeed(standardPlayer),
    expectedStandardFirstSpeed,
    0.05
  ),
  'First grounded movement tick after Standard Landing must use 0.85x speed'
)

let previousStandardSpeed =
  planarSpeed(standardPlayer)

for (
  let tick = 0;
  tick < 30;
  tick += 1
) {
  standard.authority.submitIntent(
    createIntent(
      standard.sequencer,
      {
        moveY: 1,
      }
    )
  )

  standard.authority.step()

  standardPlayer =
    standard.authority
      .getState()
      .player

  const speed =
    planarSpeed(standardPlayer)

  assert.ok(
    speed + 0.02 >=
      previousStandardSpeed,
    'Standard Landing recovery must not reduce speed further while input stays constant'
  )

  previousStandardSpeed =
    speed

  if (
    standardPlayer
      .landingRecoveryRemaining === 0
  ) {
    break
  }
}

assert.equal(
  standardPlayer
    .landingRecoveryRemaining,
  0,
  'Standard Landing recovery must complete'
)

assert.equal(
  standardPlayer.landingType,
  'none',
  'Landing type must clear when recovery completes'
)

// Recovery state advances at the end of a fixed tick, while that
// tick's movement used the multiplier sampled at its beginning.
// Therefore the first fully unpenalized movement sample is the
// following tick. This is a fixed-step boundary semantic, not
// additional recovery duration.
standard.authority.submitIntent(
  createIntent(
    standard.sequencer,
    {
      moveY: 1,
    }
  )
)

standard.authority.step()

standardPlayer =
  standard.authority
    .getState()
    .player

assert.ok(
  nearlyEqual(
    planarSpeed(standardPlayer),
    flatConfig.movement.baseSpeed,
    0.05
  ),
  'Standard Landing must use full normal speed on the first tick after recovery expires'
)

standard.authority.dispose()

// HARD LANDING: elevated spawn is forced to leave ground and
// fall far enough to exceed the canonical >=10 m/s threshold.
const hardConfig = {
  ...flatConfig,
  player: {
    ...flatConfig.player,
    spawnPosition: {
      ...flatConfig.player
        .spawnPosition,
      y:
        flatConfig.player
          .spawnPosition.y +
        5,
    },
  },
}

const hard =
  await runUntilLanding({
    config: hardConfig,
    sourceId:
      'test:landing-hard',
    firstIntent: {
      moveX: 1,
    },
    airIntent: {
      moveX: 1,
    },
    maxTicks: 300,
  })

assert.notEqual(
  hard.landingState,
  null,
  'Elevated fall must produce a real landing'
)

assert.equal(
  hard.landingState.landingType,
  'hard',
  'Impact >=10 m/s must classify as Hard Landing'
)

assert.ok(
  hard.landingState
    .landingImpactSpeed >=
    hardConfig.movement
      .hardLandingImpactSpeed,
  'Hard Landing must meet canonical impact threshold'
)

assert.ok(
  nearlyEqual(
    hard.landingState
      .landingRecoveryMultiplier,
    hardConfig.movement
      .hardLandingRetainMultiplier,
    0.001
  ),
  'Hard Landing must begin at canonical 0.70x retain multiplier'
)

assert.ok(
  nearlyEqual(
    hard.landingState
      .landingRecoveryRemaining,
    hardConfig.movement
      .hardLandingRecoverySeconds,
    0.001
  ),
  'Hard Landing must begin with canonical 0.30 s recovery'
)

hard.authority.submitIntent(
  createIntent(
    hard.sequencer,
    {
      moveX: 1,
    }
  )
)

hard.authority.step()

let hardPlayer =
  hard.authority
    .getState()
    .player

const expectedHardFirstSpeed =
  hardConfig.movement.baseSpeed *
  hardConfig.movement
    .hardLandingRetainMultiplier

assert.ok(
  nearlyEqual(
    planarSpeed(hardPlayer),
    expectedHardFirstSpeed,
    0.05
  ),
  'First grounded movement tick after Hard Landing must use 0.70x speed'
)

for (
  let tick = 0;
  tick < 40;
  tick += 1
) {
  hard.authority.submitIntent(
    createIntent(
      hard.sequencer,
      {
        moveX: 1,
      }
    )
  )

  hard.authority.step()

  hardPlayer =
    hard.authority
      .getState()
      .player

  if (
    hardPlayer
      .landingRecoveryRemaining === 0
  ) {
    break
  }
}

assert.equal(
  hardPlayer
    .landingRecoveryRemaining,
  0,
  'Hard Landing recovery must complete'
)

hard.authority.submitIntent(
  createIntent(
    hard.sequencer,
    {
      moveX: 1,
    }
  )
)

hard.authority.step()

hardPlayer =
  hard.authority
    .getState()
    .player

assert.ok(
  nearlyEqual(
    planarSpeed(hardPlayer),
    hardConfig.movement.baseSpeed,
    0.05
  ),
  'Hard Landing must use full normal speed on the first tick after recovery expires'
)

hard.authority.dispose()

// ORDINARY STEP TRAVERSAL:
// A canonical 0.34 m step must not create Landing Slowdown.
const stepMovement =
  await PlayerMovementSystem.create(
    flatConfig
  )

stepMovement.collision.createStaticBox({
  center: {
    x: 1.2,
    y: 0.17,
    z: 5,
  },
  halfExtents: {
    x: 0.5,
    y: 0.17,
    z: 0.5,
  },
})

stepMovement.collision.step()

let maxStepY =
  stepMovement.getPosition().y

let stepLandingTriggered = false

for (
  let tick = 0;
  tick < 12;
  tick += 1
) {
  const result =
    stepMovement.update(
      {
        moveX: 1,
        moveY: 0,
        sprint: false,
        crouch: false,
        jump: false,
      },
      DT,
      0
    )

  maxStepY =
    Math.max(
      maxStepY,
      result.position.y
    )

  stepLandingTriggered =
    stepLandingTriggered ||
    result.landedThisTick ||
    result.landingRecoveryRemaining > 0
}

assert.ok(
  maxStepY >
    flatConfig.player
      .spawnPosition.y +
      0.2,
  'Step fixture must actually exercise autostep traversal'
)

assert.equal(
  stepLandingTriggered,
  false,
  'Ordinary step traversal must not trigger Landing Slowdown'
)

stepMovement.dispose()

console.log(
  'Authoritative Landing Slowdown test: PASS'
)

console.log({
  standard: {
    landingTick:
      standard.landingTick,
    impactSpeed:
      standard.landingState
        .landingImpactSpeed,
    retain:
      flatConfig.movement
        .standardLandingRetainMultiplier,
    recoverySeconds:
      flatConfig.movement
        .standardLandingRecoverySeconds,
  },
  hard: {
    landingTick:
      hard.landingTick,
    impactSpeed:
      hard.landingState
        .landingImpactSpeed,
    retain:
      hardConfig.movement
        .hardLandingRetainMultiplier,
    recoverySeconds:
      hardConfig.movement
        .hardLandingRecoverySeconds,
  },
  ordinaryStepTriggersLanding:
    stepLandingTriggered,
  recoveryInterpolation:
    'linear implementation-owned',
})

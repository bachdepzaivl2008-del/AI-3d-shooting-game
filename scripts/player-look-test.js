import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'

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

const authority =
  await LocalAuthorityHost.create(
    gameConfig
  )

const sequencer =
  new IntentSequencer(
    'test:look'
  )

const sensitivity =
  gameConfig.look
    .mouseSensitivityRadiansPerPixel

const quarterTurnPixels =
  (Math.PI / 2) /
  sensitivity

authority.submitIntent(
  sequencer.create(
    'PLAYER_INPUT',
    {
      moveX: 0,
      moveY: 0,
      lookDeltaX:
        quarterTurnPixels,
      lookDeltaY: 0,
    }
  )
)

authority.step()

let state =
  authority.getState()

assert.ok(
  nearlyEqual(
    state.player.orientation.yaw,
    Math.PI / 2,
    1e-6
  ),
  'Mouse X must update authoritative yaw'
)

authority.submitIntent(
  sequencer.create(
    'PLAYER_INPUT',
    {
      moveX: 0,
      moveY: 0,
      lookDeltaX: 0,
      lookDeltaY: -1000000,
    }
  )
)

authority.step()

state =
  authority.getState()

const maxPitch =
  (gameConfig.look.maxPitchDegrees *
    Math.PI) /
  180

assert.ok(
  nearlyEqual(
    state.player.orientation.pitch,
    maxPitch,
    1e-6
  ),
  'Authoritative pitch must clamp at the configured limit'
)

const movementAuthority =
  await LocalAuthorityHost.create(
    gameConfig
  )

const movementSequencer =
  new IntentSequencer(
    'test:camera-relative'
  )

movementAuthority.submitIntent(
  movementSequencer.create(
    'PLAYER_INPUT',
    {
      moveX: 0,
      moveY: 0,
      lookDeltaX:
        quarterTurnPixels,
      lookDeltaY: 0,
    }
  )
)

movementAuthority.step()

const start = {
  ...movementAuthority
    .getState()
    .player
    .position,
}

const stepSamples = []
let previousPosition = { ...start }

for (
  let tick = 0;
  tick < 60;
  tick += 1
) {
  movementAuthority.submitIntent(
    movementSequencer.create(
      'PLAYER_INPUT',
      {
        moveX: 0,
        moveY: 1,
        lookDeltaX: 0,
        lookDeltaY: 0,
      }
    )
  )

  movementAuthority.step()

  const current =
    movementAuthority
      .getState()
      .player
      .position

  if (
    tick < 5 ||
    tick === 59
  ) {
    stepSamples.push({
      tick: tick + 1,
      deltaX:
        current.x -
        previousPosition.x,
      deltaZ:
        current.z -
        previousPosition.z,
      position: {
        x: current.x,
        y: current.y,
        z: current.z,
      },
      grounded:
        movementAuthority
          .getState()
          .player
          .grounded,
    })
  }

  previousPosition = {
    x: current.x,
    y: current.y,
    z: current.z,
  }
}

const moved =
  movementAuthority
    .getState()
    .player

const movementDiagnostic = {
  yaw:
    moved.orientation.yaw,
  pitch:
    moved.orientation.pitch,
  start,
  end:
    moved.position,
  deltaX:
    moved.position.x -
    start.x,
  deltaZ:
    moved.position.z -
    start.z,
  expectedDistance:
    gameConfig.movement.baseSpeed,
  yawDegrees:
    (moved.orientation.yaw *
      180) /
    Math.PI,
  stepSamples,
}

console.log(
  'Camera-relative movement diagnostic',
  movementDiagnostic
)

assert.ok(
  nearlyEqual(
    moved.position.x -
      start.x,
    gameConfig.movement.baseSpeed,
    0.05
  ),
  'Forward input after a 90° right yaw must move along +X'
)

assert.ok(
  nearlyEqual(
    moved.position.z,
    start.z,
    0.05
  ),
  'Camera-relative forward movement must not retain world-forward Z drift'
)

assert.ok(
  nearlyEqual(
    moved.orientation.yaw,
    Math.PI / 2,
    1e-6
  ),
  'Movement must preserve authoritative yaw'
)

authority.dispose()
movementAuthority.dispose()

console.log(
  'Authoritative look test: PASS'
)

console.log(
  'Camera-relative movement test: PASS'
)

console.log({
  yaw:
    moved.orientation.yaw,
  pitch:
    moved.orientation.pitch,
  start,
  end:
    moved.position,
})

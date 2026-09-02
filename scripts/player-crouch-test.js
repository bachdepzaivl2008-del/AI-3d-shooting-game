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

const expectedStandingCenterY =
  testConfig.collision.character
    .standingHeight / 2 +
  testConfig.collision.character
    .controllerOffset

const expectedCrouchCenterY =
  testConfig.collision.character
    .crouchHeight / 2 +
  testConfig.collision.character
    .controllerOffset

const expectedCrouchSpeed =
  testConfig.movement.baseSpeed *
  testConfig.movement.crouchMultiplier

function nearlyEqual(
  actual,
  expected,
  epsilon = 0.03
) {
  return (
    Math.abs(actual - expected) <=
    epsilon
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

const {
  authority,
  sequencer,
} = await createAuthority(
  'test:crouch-authority'
)

const standingStart = {
  ...authority.getState()
    .player.position,
}

authority.submitIntent(
  sequencer.create(
    'PLAYER_INPUT',
    {
      moveX: 0,
      moveY: 0,
      lookDeltaX: 0,
      lookDeltaY: 0,
      sprint: false,
      crouch: true,
      jump: false,
    }
  )
)

authority.step()

let player =
  authority.getState().player

assert.equal(
  player.crouched,
  true,
  'Crouch input must set authoritative crouched state'
)

assert.equal(
  player.sprinting,
  false,
  'Crouch must not coexist with Sprint'
)

assert.ok(
  nearlyEqual(
    player.position.y,
    expectedCrouchCenterY
  ),
  'Crouch must preserve feet while reducing capsule center height'
)

const crouchMoveStart = {
  ...player.position,
}

for (
  let tick = 0;
  tick < 60;
  tick += 1
) {
  authority.submitIntent(
    sequencer.create(
      'PLAYER_INPUT',
      {
        moveX: 1,
        moveY: 0,
        lookDeltaX: 0,
        lookDeltaY: 0,
        sprint: true,
        crouch: true,
        jump: false,
      }
    )
  )

  authority.step()
}

player =
  authority.getState().player

const crouchDistance =
  player.position.x -
  crouchMoveStart.x

assert.ok(
  nearlyEqual(
    crouchDistance,
    expectedCrouchSpeed,
    0.05
  ),
  'Crouch movement must use 0.60x Normal Movement Speed'
)

assert.equal(
  player.crouched,
  true
)

assert.equal(
  player.sprinting,
  false,
  'Holding Shift while crouched must not activate Sprint'
)

authority.submitIntent(
  sequencer.create(
    'PLAYER_INPUT',
    {
      moveX: 0,
      moveY: 0,
      lookDeltaX: 0,
      lookDeltaY: 0,
      sprint: false,
      crouch: false,
      jump: false,
    }
  )
)

authority.step()

player =
  authority.getState().player

assert.equal(
  player.crouched,
  false,
  'Releasing crouch in clear space must restore standing state'
)

assert.equal(
  player.standBlocked,
  false
)

assert.ok(
  nearlyEqual(
    player.position.y,
    expectedStandingCenterY
  ),
  'Standing must restore canonical standing capsule center height'
)

assert.ok(
  nearlyEqual(
    standingStart.y,
    expectedStandingCenterY
  ),
  'Standing spawn center must match canonical standing envelope'
)

authority.dispose()

const movement =
  await PlayerMovementSystem.create(
    testConfig
  )

movement.update(
  {
    moveX: 0,
    moveY: 0,
    sprint: false,
    crouch: true,
  },
  DT,
  0
)

const crouchedPosition =
  movement.getPosition()

movement.collision.createStaticBox({
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

movement.collision.step()

const blocked =
  movement.update(
    {
      moveX: 0,
      moveY: 0,
      sprint: false,
      crouch: false,
    },
    DT,
    0
  )

assert.equal(
  blocked.crouched,
  true,
  'Player must remain crouched when standing capsule lacks head clearance'
)

assert.equal(
  blocked.standBlocked,
  true,
  'Blocked stand attempt must be exposed in authoritative movement result'
)

assert.ok(
  nearlyEqual(
    blocked.position.y,
    expectedCrouchCenterY
  ),
  'Blocked stand attempt must preserve crouch capsule position'
)

assert.ok(
  nearlyEqual(
    movement.character.totalHeight,
    testConfig.collision.character
      .crouchHeight,
    1e-6
  ),
  'Blocked stand attempt must keep canonical 1.20 m crouch capsule'
)

movement.dispose()

const standingEyeOffset =
  testConfig.player.standingEyeHeight -
  testConfig.collision.character
    .standingHeight / 2 -
  testConfig.collision.character
    .controllerOffset

const crouchEyeOffset =
  testConfig.player.crouchEyeHeight -
  testConfig.collision.character
    .crouchHeight / 2 -
  testConfig.collision.character
    .controllerOffset

assert.ok(
  nearlyEqual(
    expectedStandingCenterY +
      standingEyeOffset,
    testConfig.player
      .standingEyeHeight,
    1e-6
  )
)

assert.ok(
  nearlyEqual(
    expectedCrouchCenterY +
      crouchEyeOffset,
    testConfig.player
      .crouchEyeHeight,
    1e-6
  )
)

console.log(
  'Authoritative Crouch test: PASS'
)

console.log({
  standingHeight:
    testConfig.collision.character
      .standingHeight,
  crouchHeight:
    testConfig.collision.character
      .crouchHeight,
  standingEyeHeight:
    testConfig.player
      .standingEyeHeight,
  crouchEyeHeight:
    testConfig.player
      .crouchEyeHeight,
  crouchSpeed:
    expectedCrouchSpeed,
  standClearanceBlocked:
    blocked.standBlocked,
})

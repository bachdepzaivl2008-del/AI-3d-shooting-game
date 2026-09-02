import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'

function nearlyEqual(actual, expected, epsilon = 0.05) {
  return Math.abs(actual - expected) <= epsilon
}

async function createHarness(sourceId) {
  return {
    authority: await LocalAuthorityHost.create(gameConfig),
    sequencer: new IntentSequencer(sourceId),
  }
}

async function runOneSecond({
  sourceId,
  moveX,
  moveY,
  sprint,
}) {
  const { authority, sequencer } =
    await createHarness(sourceId)

  const start = {
    ...authority.getState().player.position,
  }

  for (let tick = 0; tick < 60; tick += 1) {
    authority.submitIntent(
      sequencer.create('PLAYER_INPUT', {
        moveX,
        moveY,
        lookDeltaX: 0,
        lookDeltaY: 0,
        sprint,
        jump: false,
        crouch: false,
      })
    )

    authority.step()
  }

  const player = authority.getState().player
  const deltaX = player.position.x - start.x
  const deltaZ = player.position.z - start.z
  const planarDistance =
    Math.hypot(deltaX, deltaZ)

  const result = {
    planarDistance,
    sprinting: player.sprinting,
    grounded: player.grounded,
  }

  authority.dispose()
  return result
}

const expectedNormal =
  gameConfig.movement.baseSpeed

const expectedSprint =
  gameConfig.movement.baseSpeed *
  gameConfig.movement.sprintMultiplier

const normal = await runOneSecond({
  sourceId: 'test:sprint-normal',
  moveX: 1,
  moveY: 0,
  sprint: false,
})

assert.ok(
  nearlyEqual(
    normal.planarDistance,
    expectedNormal
  ),
  'Normal movement must use canonical AR/Base Normal Ground Speed'
)

assert.equal(normal.sprinting, false)

const sprint = await runOneSecond({
  sourceId: 'test:sprint-right',
  moveX: 1,
  moveY: 0,
  sprint: true,
})

assert.ok(
  nearlyEqual(
    sprint.planarDistance,
    expectedSprint
  ),
  'Sprint must use the configured Sprint multiplier'
)

assert.equal(
  sprint.sprinting,
  true,
  'Authoritative state must report Sprint while moving with Shift'
)

const diagonal = await runOneSecond({
  sourceId: 'test:sprint-diagonal',
  moveX: 1,
  moveY: -1,
  sprint: true,
})

assert.ok(
  nearlyEqual(
    diagonal.planarDistance,
    expectedSprint
  ),
  'Diagonal Sprint must be normalized'
)

const idle =
  await createHarness('test:sprint-idle')

const idleStart = {
  ...idle.authority.getState().player.position,
}

idle.authority.submitIntent(
  idle.sequencer.create('PLAYER_INPUT', {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    sprint: true,
    jump: false,
    crouch: false,
  })
)

idle.authority.step()

const idlePlayer =
  idle.authority.getState().player

assert.deepEqual(
  idlePlayer.position,
  idleStart,
  'Holding Sprint while idle must not move the player'
)

assert.equal(
  idlePlayer.sprinting,
  false,
  'Sprint state requires horizontal movement'
)

idle.authority.dispose()

const release =
  await createHarness('test:sprint-release')

const releaseStart = {
  ...release.authority.getState().player.position,
}

for (let tick = 0; tick < 30; tick += 1) {
  release.authority.submitIntent(
    release.sequencer.create('PLAYER_INPUT', {
      moveX: 1,
      moveY: 0,
      lookDeltaX: 0,
      lookDeltaY: 0,
      sprint: true,
      jump: false,
      crouch: false,
    })
  )

  release.authority.step()
}

for (let tick = 0; tick < 30; tick += 1) {
  release.authority.submitIntent(
    release.sequencer.create('PLAYER_INPUT', {
      moveX: 1,
      moveY: 0,
      lookDeltaX: 0,
      lookDeltaY: 0,
      sprint: false,
      jump: false,
      crouch: false,
    })
  )

  release.authority.step()
}

const releasePlayer =
  release.authority.getState().player

const releaseDistance =
  releasePlayer.position.x -
  releaseStart.x

const expectedReleaseDistance =
  expectedSprint * 0.5 +
  expectedNormal * 0.5

assert.ok(
  nearlyEqual(
    releaseDistance,
    expectedReleaseDistance
  ),
  'Releasing Shift must return movement to Normal speed'
)

assert.equal(
  releasePlayer.sprinting,
  false,
  'Sprint state must clear after Shift release'
)

release.authority.dispose()

console.log('Authoritative Sprint test: PASS')
console.log({
  normalDistance: normal.planarDistance,
  expectedNormal,
  sprintDistance: sprint.planarDistance,
  expectedSprint,
  diagonalSprintDistance:
    diagonal.planarDistance,
  releaseDistance,
  expectedReleaseDistance,
  unlimitedStamina: true,
})

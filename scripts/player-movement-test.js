import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'

function nearlyEqual(actual, expected, epsilon = 0.05) {
  return Math.abs(actual - expected) <= epsilon
}

const authority =
  await LocalAuthorityHost.create(gameConfig)

const sequencer =
  new IntentSequencer('test:movement')

const start = {
  ...authority.getState().player.position,
}

for (let tick = 0; tick < 60; tick += 1) {
  authority.submitIntent(
    sequencer.create('PLAYER_INPUT', {
      moveX: 1,
      moveY: 0,
      jump: false,
      sprint: false,
      crouch: false,
    })
  )

  authority.step()
}

const state = authority.getState()
const player = state.player

assert.ok(
  nearlyEqual(
    player.position.x - start.x,
    gameConfig.movement.baseSpeed
  ),
  'One second of rightward input should move at the configured base speed'
)

assert.ok(
  nearlyEqual(
    player.position.z,
    start.z
  ),
  'Pure rightward movement should not drift on Z'
)

assert.equal(
  player.lastInputSequence,
  60,
  'Authoritative state must retain the latest processed input sequence'
)

assert.equal(
  player.grounded,
  true,
  'Player should remain grounded during flat movement'
)

authority.dispose()

console.log('Authoritative player movement test: PASS')
console.log({
  start,
  end: player.position,
  distanceX:
    player.position.x - start.x,
  lastInputSequence:
    player.lastInputSequence,
  grounded: player.grounded,
})

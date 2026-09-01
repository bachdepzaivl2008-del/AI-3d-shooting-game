import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { SeededRandom } from '../src/shared/random/SeededRandom.js'
import { StableIdAllocator } from '../src/shared/ids/StableIdAllocator.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'

function nearlyEqual(actual, expected, epsilon = 1e-9) {
  return Math.abs(actual - expected) <= epsilon
}

assert.equal(
  typeof globalThis.window,
  'undefined',
  'Headless test must not depend on a browser window'
)

const sequencer = new IntentSequencer('test:input')

const firstIntent = sequencer.create('ARCHITECTURE_TEST', {})
const secondIntent = sequencer.create('ARCHITECTURE_TEST', {})

assert.equal(firstIntent.sourceId, 'test:input')
assert.equal(firstIntent.sequence, 1)
assert.equal(secondIntent.sequence, 2)
assert.equal(sequencer.peekNextSequence(), 3)

const authority =
  await LocalAuthorityHost.create(gameConfig)

authority.submitIntent(firstIntent)
authority.submitIntent(secondIntent)
authority.step()

assert.equal(
  authority.getLastProcessedIntentCount(),
  2,
  'Authority host must drain submitted intents into one simulation step'
)

for (let i = 1; i < 60; i += 1) {
  authority.step()
}

const state = authority.getState()

assert.equal(state.tick, 60)
assert.ok(nearlyEqual(state.time, 1))
assert.ok(nearlyEqual(state.cube.rotationY, 1.5))
assert.equal(state.cube.id, 'entity:000001')
assert.equal(state.player.id, 'entity:000002')
assert.equal(state.player.grounded, true)

const randomA =
  new SeededRandom(
    gameConfig.simulation.randomSeed
  )

const randomB =
  new SeededRandom(
    gameConfig.simulation.randomSeed
  )

for (let i = 0; i < 8; i += 1) {
  assert.equal(
    randomA.nextUint32(),
    randomB.nextUint32()
  )
}

const ids = new StableIdAllocator('test')
assert.equal(ids.next(), 'test:000001')
assert.equal(ids.next(), 'test:000002')
assert.equal(ids.peek(), 'test:000003')

authority.dispose()

console.log('Headless simulation test: PASS')
console.log('Authority boundary test: PASS')
console.log('Input sequencing test: PASS')
console.log({
  tick: state.tick,
  time: state.time,
  cubeId: state.cube.id,
  playerId: state.player.id,
  playerPosition: state.player.position,
})

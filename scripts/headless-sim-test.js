import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { SeededRandom } from '../src/shared/random/SeededRandom.js'
import { StableIdAllocator } from '../src/shared/ids/StableIdAllocator.js'

function nearlyEqual(actual, expected, epsilon = 1e-9) {
  return Math.abs(actual - expected) <= epsilon
}

assert.equal(
  typeof globalThis.window,
  'undefined',
  'Headless test must not depend on a browser window'
)

const authority = new LocalAuthorityHost(gameConfig)

authority.submitIntent({
  type: 'ARCHITECTURE_TEST',
  sourceId: 'test:000001',
  sequence: 1,
  payload: {},
})

authority.step()

assert.equal(
  authority.getLastProcessedIntentCount(),
  1,
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

const randomA = new SeededRandom(gameConfig.simulation.randomSeed)
const randomB = new SeededRandom(gameConfig.simulation.randomSeed)

for (let i = 0; i < 8; i += 1) {
  assert.equal(randomA.nextUint32(), randomB.nextUint32())
}

const ids = new StableIdAllocator('test')
assert.equal(ids.next(), 'test:000001')
assert.equal(ids.next(), 'test:000002')
assert.equal(ids.peek(), 'test:000003')

console.log('Headless simulation test: PASS')
console.log('Authority boundary test: PASS')
console.log({
  tick: state.tick,
  time: state.time,
  cubeId: state.cube.id,
  cubeRotationY: state.cube.rotationY,
})

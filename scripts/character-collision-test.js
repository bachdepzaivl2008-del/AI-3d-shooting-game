import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { runCharacterCollisionSuite } from '../src/shared/collision/runCharacterCollisionSuite.js'

assert.equal(
  typeof globalThis.window,
  'undefined',
  'Character collision test must remain headless-compatible'
)

const result = await runCharacterCollisionSuite(gameConfig)

console.dir(result, { depth: null })

assert.equal(
  result.groundWallDash.groundRayHit,
  true,
  'Ground collision must be queryable'
)

assert.equal(
  result.groundWallDash.grounded,
  true,
  'Standing capsule must report grounded on the floor'
)

assert.equal(
  result.groundWallDash.wallBlocked,
  true,
  'Standing capsule must be blocked by a wall'
)

assert.equal(
  result.groundWallDash.dashSweepBlocked,
  true,
  'A long dash translation must be swept and blocked by the wall'
)

assert.equal(
  result.step.steppedUp,
  true,
  'Autostep must climb a step just below the 0.35 m canonical limit'
)

assert.equal(
  result.ramp.climbedWalkableRamp,
  true,
  'Character controller must climb a representative slope below the 45 degree limit'
)

assert.equal(
  result.groundSnap.snappedDown,
  true,
  'Snap-to-ground must keep the character attached across a small drop'
)

console.log('Character collision foundation test: PASS')
console.dir(result, { depth: null })

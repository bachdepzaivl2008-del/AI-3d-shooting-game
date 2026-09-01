import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { runSharedCollisionProbe } from '../src/shared/collision/runSharedCollisionProbe.js'

assert.equal(
  typeof globalThis.window,
  'undefined',
  'Collision headless test must not depend on a browser window'
)

const result = await runSharedCollisionProbe(gameConfig)

assert.equal(
  result.groundRayHit,
  true,
  'Ground ray must hit shared collision geometry'
)

assert.equal(
  result.blockedByWall,
  true,
  'Character capsule sweep must be blocked by the wall'
)

assert.ok(
  result.correctedMovementX < result.desiredMovementX,
  'Corrected movement must be shorter than the desired wall-crossing movement'
)

console.log('Shared collision headless test: PASS')
console.log(result)

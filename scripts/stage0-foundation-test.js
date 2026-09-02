import assert from 'node:assert/strict'

import { StableIdAllocator } from '../src/shared/ids/StableIdAllocator.js'
import {
  createGameIdAllocators,
  EntityRegistry,
} from '../src/shared/entities/FoundationRegistry.js'
import { GameplayEventStream } from '../src/shared/events/GameplayEventStream.js'
import { DeveloperLogger } from '../src/shared/logging/DeveloperLogger.js'

assert.equal(
  typeof globalThis.window,
  'undefined'
)

const ids = createGameIdAllocators()

assert.equal(ids.entity.next(), 'entity:000001')
assert.equal(
  ids.combatSlot.next(),
  'combat-slot:000001'
)
assert.equal(
  ids.spawnPoint.next(),
  'spawn-point:000001'
)
assert.equal(
  ids.worldItem.next(),
  'world-item:000001'
)

const registry =
  new EntityRegistry(
    new StableIdAllocator('dummy')
  )

const entity =
  registry.create({ kind: 'test' })

assert.equal(entity.id, 'dummy:000001')
assert.equal(registry.has(entity.id), true)
assert.equal(
  registry.get(entity.id)?.kind,
  'test'
)
assert.equal(
  registry.destroy(entity.id),
  true
)
assert.equal(registry.size, 0)

const stream =
  new GameplayEventStream(
    'foundation-test'
  )

const received = []

const unsubscribe =
  stream.subscribe((event) => {
    received.push(event)
  })

const created =
  stream.emit(
    'ENTITY_CREATED',
    { entityId: 'dummy:000001' },
    { tick: 12, time: 0.2 }
  )

const destroyed =
  stream.emit(
    'ENTITY_DESTROYED',
    { entityId: 'dummy:000001' },
    { tick: 13, time: 13 / 60 }
  )

assert.equal(created.sequence, 1)
assert.equal(destroyed.sequence, 2)
assert.equal(created.tick, 12)
assert.equal(created.time, 0.2)
assert.equal(received.length, 2)
assert.equal(stream.drain().length, 2)
assert.equal(stream.drain().length, 0)
assert.equal(stream.peekNextSequence(), 3)

unsubscribe()

const logger =
  new DeveloperLogger(
    'foundation-test'
  )

assert.equal(
  logger.format('ready'),
  '[foundation-test] ready'
)

console.log(
  'Stage 0 foundation utilities test: PASS'
)

console.log({
  specializedIds: true,
  entityCreateDestroy: true,
  gameplayEventStream: true,
  deterministicEventSequence: true,
  headlessLogger: true,
})

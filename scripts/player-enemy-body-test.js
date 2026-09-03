import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'
import {
  resolveEnemySoftSeparation,
  sweepDashAgainstEnemies,
} from '../src/game/movement/PlayerBodyInteraction.js'

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
  testArena: {
    ...gameConfig.testArena,
    enemyDummy: {
      ...gameConfig.testArena.enemyDummy,
      position: {
        x: 0,
        y: gameConfig.player.spawnPosition.y,
        z: 4,
      },
    },
  },
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
      dash: false,
      ...overrides,
    }
  )
}

async function createAuthority(sourceId) {
  const authority =
    await LocalAuthorityHost.create(
      testConfig
    )

  return {
    authority,
    sequencer:
      new IntentSequencer(sourceId),
  }
}

async function step(
  authority,
  sequencer,
  overrides = {}
) {
  authority.submitIntent(
    createIntent(
      sequencer,
      overrides
    )
  )

  authority.step()

  return authority.getState()
}

const radius =
  testConfig.collision.character.radius

const standingHeight =
  testConfig.collision.character
    .standingHeight

const minimumEnemyDistance =
  radius * 2

// Pure soft-separation geometry:
// a deep overlap is resolved horizontally only.
const separation =
  resolveEnemySoftSeparation({
    proposedPosition: {
      x: 0,
      y: 0.91,
      z: 3.2,
    },
    playerRadius: radius,
    playerTotalHeight:
      standingHeight,
    actors: [
      {
        id: 'enemy',
        team: 'red',
        alive: true,
        position: {
          x: 0,
          y: 0.91,
          z: 3,
        },
        totalHeight:
          standingHeight,
        radius,
      },
    ],
    playerTeam: 'blue',
    fallbackDirection: {
      x: 0,
      z: 1,
    },
  })

assert.equal(
  separation.contacts,
  1,
  'Deep enemy overlap must be detected'
)

assert.equal(
  separation.correction.x,
  0,
  'Soft separation must not invent sideways correction for a centered forward overlap'
)

assert.equal(
  separation.position.y,
  0.91,
  'Soft separation must never alter vertical position'
)

assert.ok(
  Math.abs(
    Math.hypot(
      separation.position.x,
      separation.position.z - 3
    ) -
    minimumEnemyDistance
  ) < 1e-9,
  'Soft separation must resolve to capsule-radius contact without deep overlap'
)

// Ordinary locomotion: enemy is NOT registered as rigid world geometry,
// but post-movement horizontal separation must prevent deep overlap.
const ordinary =
  await createAuthority(
    'test:enemy-soft-separation'
  )

let state =
  ordinary.authority.getState()

const enemyId =
  state.enemyDummy.id

let sawSoftSeparation = false

for (
  let tick = 0;
  tick < 90;
  tick += 1
) {
  state =
    await step(
      ordinary.authority,
      ordinary.sequencer,
      {
        moveY: 1,
      }
    )

  if (
    state.player
      .enemySeparationContacts > 0
  ) {
    sawSoftSeparation = true
  }
}

const ordinaryDistance =
  Math.hypot(
    state.player.position.x -
      state.enemyDummy.position.x,
    state.player.position.z -
      state.enemyDummy.position.z
  )

assert.equal(
  sawSoftSeparation,
  true,
  'Ordinary locomotion into an enemy must invoke soft separation'
)

assert.ok(
  ordinaryDistance >=
    minimumEnemyDistance - 0.02,
  'Ordinary locomotion must not leave the player deeply overlapped with the enemy capsule'
)

assert.equal(
  state.player.velocity.y,
  0,
  'Enemy soft separation must not create vertical velocity transfer'
)

assert.equal(
  state.player.dashEnemyContactId,
  null,
  'Ordinary contact must not be reported as Dash enemy contact'
)

ordinary.authority.dispose()

// Dash sweep: first living enemy capsule contact must stop Dash,
// consume the charge and never cross through the enemy.
const dash =
  await createAuthority(
    'test:dash-enemy-contact'
  )

state =
  await step(
    dash.authority,
    dash.sequencer,
    {
      dash: true,
    }
  )

assert.equal(
  state.player.dashing,
  false,
  'Enemy contact on the first Dash tick must immediately stop Dash'
)

assert.equal(
  state.player.dashExitReason,
  'enemy_blocked',
  'Enemy body contact must have a distinct Dash exit reason'
)

assert.equal(
  state.player.dashCharges,
  1,
  'Dash charge must remain consumed when an enemy body blocks Dash'
)

assert.equal(
  state.player.dashEnemyContactId,
  enemyId,
  'Authoritative Dash contact must identify the living enemy capsule'
)

const dashEnemyDistance =
  Math.hypot(
    state.player.position.x -
      state.enemyDummy.position.x,
    state.player.position.z -
      state.enemyDummy.position.z
  )

assert.ok(
  dashEnemyDistance >=
    minimumEnemyDistance - 0.02,
  'Dash must stop before deep enemy overlap'
)

assert.ok(
  state.player.position.z >
    state.enemyDummy.position.z,
  'Forward Dash must not phase through to the far side of the enemy'
)

assert.equal(
  state.player.velocity.y,
  0,
  'Grounded Dash enemy contact must not cause vertical launch'
)

dash.authority.dispose()

// Pure sweep should ignore a vertically separated enemy body.
const highSweep =
  sweepDashAgainstEnemies({
    startPosition: {
      x: 0,
      y: 5,
      z: 5,
    },
    desiredMovement: {
      x: 0,
      y: 0,
      z: -3,
    },
    playerRadius: radius,
    playerTotalHeight:
      standingHeight,
    actors: [
      {
        id: 'low-enemy',
        team: 'red',
        alive: true,
        position: {
          x: 0,
          y: 0.91,
          z: 3,
        },
        totalHeight:
          standingHeight,
        radius,
      },
    ],
    playerTeam: 'blue',
  })

assert.equal(
  highSweep,
  null,
  'A vertically non-overlapping enemy capsule must not block an Air Dash passing above it'
)

console.log(
  'Enemy body + Dash non-phase-through test: PASS'
)

console.log({
  enemyId,
  minimumEnemyDistance,
  ordinaryDistance,
  dashEnemyDistance,
  softSeparationObserved:
    sawSoftSeparation,
  dashExitReason:
    'enemy_blocked',
  chargeConsumedOnEnemyBlock: true,
  noVerticalTransfer: true,
  highAirDashPassesAbove: true,
})

import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'
import {
  resolveLivingBodySoftSeparation,
  sweepDashAgainstLivingActors,
} from '../src/game/movement/PlayerBodyInteraction.js'

const radius =
  gameConfig.collision.character.radius

const standingHeight =
  gameConfig.collision.character
    .standingHeight

const minimumBodyDistance =
  radius * 2

function actor({
  id,
  team,
  controllerType,
  x = 0,
  y = 0.91,
  z = 0,
  alive = true,
}) {
  return {
    id,
    team,
    controllerType,
    alive,
    position: { x, y, z },
    totalHeight:
      standingHeight,
    radius,
  }
}

function separationAgainst(otherActor) {
  return resolveLivingBodySoftSeparation({
    proposedPosition: {
      x: 0,
      y: 0.91,
      z: 0.2,
    },
    playerRadius: radius,
    playerTotalHeight:
      standingHeight,
    actors: [otherActor],
    selfActorId:
      'local-player',
    fallbackDirection: {
      x: 0,
      z: 1,
    },
  })
}

const sameTeamHuman =
  actor({
    id: 'blue-human',
    team: 'blue',
    controllerType: 'human',
  })

const sameTeamBot =
  actor({
    id: 'blue-bot',
    team: 'blue',
    controllerType: 'bot',
  })

const enemyHuman =
  actor({
    id: 'red-human',
    team: 'red',
    controllerType: 'human',
  })

const enemyBot =
  actor({
    id: 'red-bot',
    team: 'red',
    controllerType: 'bot',
  })

for (
  const blockingActor of [
    sameTeamHuman,
    sameTeamBot,
    enemyHuman,
    enemyBot,
  ]
) {
  const result =
    separationAgainst(
      blockingActor
    )

  assert.equal(
    result.contacts,
    1,
    `${blockingActor.id} must participate in ordinary living-body separation`
  )

  assert.equal(
    result.position.y,
    0.91,
    'Living-body separation must never alter Y'
  )

  const distance =
    Math.hypot(
      result.position.x -
        blockingActor.position.x,
      result.position.z -
        blockingActor.position.z
    )

  assert.ok(
    distance >=
      minimumBodyDistance - 1e-9,
    `${blockingActor.id} must not remain deeply overlapped`
  )
}

// Dead combatants have no living-body presence.
const deadBotResult =
  separationAgainst(
    actor({
      id: 'dead-blue-bot',
      team: 'blue',
      controllerType: 'bot',
      alive: false,
    })
  )

assert.equal(
  deadBotResult.contacts,
  0,
  'Dead combatants must not body-block as living actors'
)

function dashSweepAgainst(otherActor) {
  return sweepDashAgainstLivingActors({
    startPosition: {
      x: 0,
      y: 0.91,
      z: 1.5,
    },
    desiredMovement: {
      x: 0,
      y: 0,
      z: -1,
    },
    playerRadius: radius,
    playerTotalHeight:
      standingHeight,
    actors: [otherActor],
    selfActorId:
      'local-player',
  })
}

for (
  const blockingActor of [
    actor({
      id: 'dash-blue-human',
      team: 'blue',
      controllerType: 'human',
      z: 0.5,
    }),
    actor({
      id: 'dash-blue-bot',
      team: 'blue',
      controllerType: 'bot',
      z: 0.5,
    }),
    actor({
      id: 'dash-red-human',
      team: 'red',
      controllerType: 'human',
      z: 0.5,
    }),
    actor({
      id: 'dash-red-bot',
      team: 'red',
      controllerType: 'bot',
      z: 0.5,
    }),
  ]
) {
  const hit =
    dashSweepAgainst(
      blockingActor
    )

  assert.ok(
    hit,
    `${blockingActor.id} must block a swept Dash`
  )

  assert.equal(
    hit.actorId,
    blockingActor.id
  )

  assert.ok(
    Math.hypot(
      hit.movement.x,
      hit.movement.z
    ) < 1,
    'Living-body Dash contact must shorten movement before pass-through'
  )
}

const deadDashHit =
  dashSweepAgainst(
    actor({
      id: 'dead-dash-bot',
      team: 'blue',
      controllerType: 'bot',
      z: 0.5,
      alive: false,
    })
  )

assert.equal(
  deadDashHit,
  null,
  'Dead combatants must not block Dash as living actors'
)

// Vertical non-overlap remains valid: a Dash clearly above another
// combatant must not be blocked by its horizontal footprint alone.
const highDashHit =
  sweepDashAgainstLivingActors({
    startPosition: {
      x: 0,
      y: 5,
      z: 1.5,
    },
    desiredMovement: {
      x: 0,
      y: 0,
      z: -1,
    },
    playerRadius: radius,
    playerTotalHeight:
      standingHeight,
    actors: [
      actor({
        id: 'low-blue-bot',
        team: 'blue',
        controllerType: 'bot',
        z: 0.5,
      }),
    ],
    selfActorId:
      'local-player',
  })

assert.equal(
  highDashHit,
  null,
  'Vertical non-overlap must not create false living-body Dash blocking'
)

// Integration: same-team Bot in the authoritative Simulation must block
// both ordinary locomotion and Dash, not merely the pure helper tests.
const integrationConfig = {
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
        x: 100,
        y: 0.91,
        z: 100,
      },
    },
    friendlyBotDummy: {
      ...gameConfig.testArena.friendlyBotDummy,
      position: {
        x: 0,
        y: 0.91,
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

const ordinaryAuthority =
  await LocalAuthorityHost.create(
    integrationConfig
  )

const ordinarySequencer =
  new IntentSequencer(
    'test:living-body-ordinary'
  )

let state =
  ordinaryAuthority.getState()

let sawBodySeparation = false

for (
  let tick = 0;
  tick < 40;
  tick += 1
) {
  state =
    await step(
      ordinaryAuthority,
      ordinarySequencer,
      {
        moveY: 1,
      }
    )

  if (
    state.player
      .livingBodySeparationContacts > 0
  ) {
    sawBodySeparation = true
  }
}

const friendlyDistance =
  Math.hypot(
    state.player.position.x -
      state.friendlyBotDummy.position.x,
    state.player.position.z -
      state.friendlyBotDummy.position.z
  )

assert.equal(
  sawBodySeparation,
  true,
  'Same-team Bot must trigger authoritative ordinary soft separation'
)

assert.ok(
  friendlyDistance >=
    minimumBodyDistance - 0.02,
  'Player must not walk through a same-team Bot'
)

assert.equal(
  state.player.velocity.y,
  0,
  'Same-team Bot contact must not transfer vertical velocity'
)

ordinaryAuthority.dispose()

const dashAuthority =
  await LocalAuthorityHost.create(
    integrationConfig
  )

const dashSequencer =
  new IntentSequencer(
    'test:living-body-dash'
  )

state =
  await step(
    dashAuthority,
    dashSequencer,
    {
      dash: true,
    }
  )

assert.equal(
  state.player.dashing,
  false,
  'Same-team Bot contact must stop Dash immediately'
)

assert.equal(
  state.player.dashCharges,
  1,
  'Same-team Bot Dash contact must still consume a charge'
)

assert.equal(
  state.player.dashLivingContactId,
  state.friendlyBotDummy.id,
  'Dash contact telemetry must identify the same-team Bot body'
)

const dashFriendlyDistance =
  Math.hypot(
    state.player.position.x -
      state.friendlyBotDummy.position.x,
    state.player.position.z -
      state.friendlyBotDummy.position.z
  )

assert.ok(
  dashFriendlyDistance >=
    minimumBodyDistance - 0.02,
  'Dash must stop before deep overlap with same-team Bot'
)

assert.ok(
  state.player.position.z >
    state.friendlyBotDummy.position.z,
  'Dash must not phase through to the far side of a same-team Bot'
)

assert.equal(
  state.player.velocity.y,
  0,
  'Dash body contact must not launch the player vertically'
)

dashAuthority.dispose()

console.log(
  'Universal living-combatant body blocking test: PASS'
)

console.log({
  ordinaryBlocking: {
    teammateHuman: true,
    teammateBot: true,
    enemyHuman: true,
    enemyBot: true,
  },
  dashBlocking: {
    teammateHuman: true,
    teammateBot: true,
    enemyHuman: true,
    enemyBot: true,
  },
  deadActorsIgnored: true,
  noVerticalTransfer: true,
  sameTeamBotIntegration: true,
  dashChargeConsumed: true,
  friendlyDistance,
  dashFriendlyDistance,
})

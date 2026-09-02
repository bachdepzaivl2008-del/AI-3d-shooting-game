import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'

const testConfig = {
  ...gameConfig,
  cube: {
    ...gameConfig.cube,
    // Keep the debug cube out of the open-ground velocity fixture.
    // The default spawn at z=5 moving yaw=0 forward reaches the
    // cube at the origin within one second and turns this into a
    // collision/autostep test instead of a pure velocity test.
    startPosition: {
      x: 100,
      y: gameConfig.cube.startPosition.y,
      z: 100,
    },
  },
}

const DT = testConfig.simulation.fixedDeltaTime
const NORMAL_SPEED = testConfig.movement.baseSpeed
const SPRINT_SPEED =
  testConfig.movement.baseSpeed *
  testConfig.movement.sprintMultiplier

function nearlyEqual(actual, expected, epsilon = 0.02) {
  return Math.abs(actual - expected) <= epsilon
}

function degToMouseDelta(degrees) {
  const radians = degrees * Math.PI / 180
  return (
    radians /
    testConfig.look.mouseSensitivityRadiansPerPixel
  )
}

async function createHarness(sourceId, yawDegrees = 0) {
  const authority =
    await LocalAuthorityHost.create(gameConfig)

  const sequencer =
    new IntentSequencer(sourceId)

  if (yawDegrees !== 0) {
    authority.submitIntent(
      sequencer.create('PLAYER_INPUT', {
        moveX: 0,
        moveY: 0,
        lookDeltaX:
          degToMouseDelta(yawDegrees),
        lookDeltaY: 0,
        sprint: false,
        jump: false,
        crouch: false,
      })
    )

    authority.step()
  }

  return { authority, sequencer }
}

function expectedVelocity({
  yawDegrees,
  moveX,
  moveY,
  speed,
}) {
  const yaw = yawDegrees * Math.PI / 180

  const rightX = Math.cos(yaw)
  const rightZ = Math.sin(yaw)
  const forwardX = Math.sin(yaw)
  const forwardZ = -Math.cos(yaw)

  let x =
    rightX * moveX +
    forwardX * moveY

  let z =
    rightZ * moveX +
    forwardZ * moveY

  const length = Math.hypot(x, z)

  if (length > 1) {
    x /= length
    z /= length
  }

  return {
    x: x * speed,
    y: 0,
    z: z * speed,
  }
}

async function runCase({
  name,
  yawDegrees,
  moveX,
  moveY,
  sprint,
  ticks = 60,
}) {
  const { authority, sequencer } =
    await createHarness(
      `velocity:${name}`,
      yawDegrees
    )

  const targetSpeed =
    sprint ? SPRINT_SPEED : NORMAL_SPEED

  const expected =
    expectedVelocity({
      yawDegrees,
      moveX,
      moveY,
      speed: targetSpeed,
    })

  const samples = []

  for (let tick = 1; tick <= ticks; tick += 1) {
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

    const player =
      authority.getState().player

    const velocity = {
      ...player.velocity,
    }

    const planarSpeed =
      Math.hypot(
        velocity.x,
        velocity.z
      )

    samples.push({
      tick,
      velocity,
      planarSpeed,
      grounded: player.grounded,
      sprinting: player.sprinting,
    })

    assert.ok(
      nearlyEqual(velocity.x, expected.x),
      `${name}: velocity X must remain stable and match expected world-axis value`
    )

    assert.ok(
      nearlyEqual(velocity.y, expected.y),
      `${name}: grounded velocity Y must stay near zero`
    )

    assert.ok(
      nearlyEqual(velocity.z, expected.z),
      `${name}: velocity Z must remain stable and match expected world-axis value`
    )

    assert.ok(
      nearlyEqual(planarSpeed, targetSpeed),
      `${name}: planar SPEED must remain stable`
    )

    assert.equal(
      player.grounded,
      true,
      `${name}: player must remain grounded on flat ground`
    )

    assert.equal(
      player.sprinting,
      sprint,
      `${name}: authoritative sprinting state mismatch`
    )
  }

  authority.submitIntent(
    sequencer.create('PLAYER_INPUT', {
      moveX: 0,
      moveY: 0,
      lookDeltaX: 0,
      lookDeltaY: 0,
      sprint,
      jump: false,
      crouch: false,
    })
  )

  authority.step()

  const idleVelocity = {
    ...authority.getState().player.velocity,
  }

  assert.ok(
    nearlyEqual(idleVelocity.x, 0),
    `${name}: velocity X must return to zero on idle`
  )

  assert.ok(
    nearlyEqual(idleVelocity.y, 0),
    `${name}: velocity Y must return to zero on idle`
  )

  assert.ok(
    nearlyEqual(idleVelocity.z, 0),
    `${name}: velocity Z must return to zero on idle`
  )

  const minMax = {
    x: {
      min: Math.min(...samples.map((s) => s.velocity.x)),
      max: Math.max(...samples.map((s) => s.velocity.x)),
    },
    y: {
      min: Math.min(...samples.map((s) => s.velocity.y)),
      max: Math.max(...samples.map((s) => s.velocity.y)),
    },
    z: {
      min: Math.min(...samples.map((s) => s.velocity.z)),
      max: Math.max(...samples.map((s) => s.velocity.z)),
    },
    speed: {
      min: Math.min(...samples.map((s) => s.planarSpeed)),
      max: Math.max(...samples.map((s) => s.planarSpeed)),
    },
  }

  authority.dispose()

  return {
    name,
    yawDegrees,
    moveX,
    moveY,
    sprint,
    expected,
    minMax,
    idleVelocity,
  }
}

const cases = [
  {
    name: 'yaw0-forward-normal',
    yawDegrees: 0,
    moveX: 0,
    moveY: 1,
    sprint: false,
  },
  {
    name: 'yaw0-right-normal',
    yawDegrees: 0,
    moveX: 1,
    moveY: 0,
    sprint: false,
  },
  {
    name: 'yaw0-back-normal',
    yawDegrees: 0,
    moveX: 0,
    moveY: -1,
    sprint: false,
  },
  {
    name: 'yaw0-left-normal',
    yawDegrees: 0,
    moveX: -1,
    moveY: 0,
    sprint: false,
  },
  {
    name: 'yaw90-forward-normal',
    yawDegrees: 90,
    moveX: 0,
    moveY: 1,
    sprint: false,
  },
  {
    name: 'yaw45-forward-normal',
    yawDegrees: 45,
    moveX: 0,
    moveY: 1,
    sprint: false,
  },
  {
    name: 'yaw0-forward-sprint',
    yawDegrees: 0,
    moveX: 0,
    moveY: 1,
    sprint: true,
  },
  {
    name: 'yaw90-forward-sprint',
    yawDegrees: 90,
    moveX: 0,
    moveY: 1,
    sprint: true,
  },
  {
    name: 'yaw45-diagonal-sprint',
    yawDegrees: 45,
    moveX: 1,
    moveY: 1,
    sprint: true,
  },
]

const results = []

for (const testCase of cases) {
  results.push(
    await runCase(testCase)
  )
}

console.log(
  'Authoritative velocity XYZ test: PASS'
)

console.dir(
  {
    normalSpeed: NORMAL_SPEED,
    sprintSpeed: SPRINT_SPEED,
    deltaTime: DT,
    results,
  },
  { depth: null }
)

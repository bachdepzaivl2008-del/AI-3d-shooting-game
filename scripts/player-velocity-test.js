import assert from 'node:assert/strict'

import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'

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
}

const NORMAL_SPEED =
  testConfig.movement.baseSpeed

const SPRINT_SPEED =
  testConfig.movement.baseSpeed *
  testConfig.movement.sprintMultiplier

const EPSILON = 0.02

function nearlyEqual(actual, expected) {
  return Math.abs(actual - expected) <= EPSILON
}

function degToMouseDelta(degrees) {
  return (
    degrees * Math.PI / 180 /
    testConfig.look.mouseSensitivityRadiansPerPixel
  )
}

function expectedVelocity({
  yawDegrees,
  moveX,
  moveY,
  speed,
}) {
  const yaw =
    yawDegrees * Math.PI / 180

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

async function createHarness(
  sourceId,
  yawDegrees = 0
) {
  const authority =
    await LocalAuthorityHost.create(
      testConfig
    )

  const sequencer =
    new IntentSequencer(sourceId)

  if (yawDegrees !== 0) {
    authority.submitIntent(
      sequencer.create(
        'PLAYER_INPUT',
        {
          moveX: 0,
          moveY: 0,
          lookDeltaX:
            degToMouseDelta(
              yawDegrees
            ),
          lookDeltaY: 0,
          sprint: false,
          jump: false,
          crouch: false,
        }
      )
    )

    authority.step()
  }

  return {
    authority,
    sequencer,
  }
}

function range(samples, key) {
  const values =
    samples.map((sample) => {
      if (key === 'speed') {
        return sample.planarSpeed
      }

      return sample.velocity[key]
    })

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  }
}

async function runCase(testCase) {
  const {
    name,
    yawDegrees,
    moveX,
    moveY,
    sprint,
  } = testCase

  const {
    authority,
    sequencer,
  } = await createHarness(
    `velocity:${name}`,
    yawDegrees
  )

  const targetSpeed =
    sprint
      ? SPRINT_SPEED
      : NORMAL_SPEED

  const expected =
    expectedVelocity({
      yawDegrees,
      moveX,
      moveY,
      speed: targetSpeed,
    })

  const samples = []
  const failures = []

  for (
    let tick = 1;
    tick <= 60;
    tick += 1
  ) {
    authority.submitIntent(
      sequencer.create(
        'PLAYER_INPUT',
        {
          moveX,
          moveY,
          lookDeltaX: 0,
          lookDeltaY: 0,
          sprint,
          jump: false,
          crouch: false,
        }
      )
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
      grounded:
        player.grounded,
      sprinting:
        player.sprinting,
    })

    const checks = [
      ['x', velocity.x, expected.x],
      ['y', velocity.y, expected.y],
      ['z', velocity.z, expected.z],
      [
        'speed',
        planarSpeed,
        targetSpeed,
      ],
    ]

    for (
      const [
        axis,
        actual,
        expectedValue,
      ] of checks
    ) {
      if (
        !nearlyEqual(
          actual,
          expectedValue
        )
      ) {
        failures.push({
          tick,
          axis,
          actual,
          expected:
            expectedValue,
        })
      }
    }

    if (!player.grounded) {
      failures.push({
        tick,
        axis: 'grounded',
        actual: false,
        expected: true,
      })
    }

    if (
      player.sprinting !== sprint
    ) {
      failures.push({
        tick,
        axis: 'sprinting',
        actual:
          player.sprinting,
        expected: sprint,
      })
    }
  }

  authority.submitIntent(
    sequencer.create(
      'PLAYER_INPUT',
      {
        moveX: 0,
        moveY: 0,
        lookDeltaX: 0,
        lookDeltaY: 0,
        sprint,
        jump: false,
        crouch: false,
      }
    )
  )

  authority.step()

  const idleVelocity = {
    ...authority.getState()
      .player.velocity,
  }

  for (
    const axis of ['x', 'y', 'z']
  ) {
    if (
      !nearlyEqual(
        idleVelocity[axis],
        0
      )
    ) {
      failures.push({
        tick: 'idle',
        axis,
        actual:
          idleVelocity[axis],
        expected: 0,
      })
    }
  }

  const result = {
    name,
    yawDegrees,
    moveX,
    moveY,
    sprint,
    expected,
    ranges: {
      x: range(samples, 'x'),
      y: range(samples, 'y'),
      z: range(samples, 'z'),
      speed:
        range(samples, 'speed'),
    },
    idleVelocity,
    failureCount:
      failures.length,
    failures:
      failures.slice(0, 20),
  }

  authority.dispose()
  return result
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

const totalFailures =
  results.reduce(
    (sum, result) =>
      sum +
      result.failureCount,
    0
  )

console.dir(
  {
    normalSpeed:
      NORMAL_SPEED,
    sprintSpeed:
      SPRINT_SPEED,
    epsilon:
      EPSILON,
    results,
  },
  { depth: null }
)

assert.equal(
  totalFailures,
  0,
  `Velocity XYZ regression found ${totalFailures} failure(s); inspect per-case output above`
)

console.log(
  'Authoritative velocity XYZ test: PASS'
)

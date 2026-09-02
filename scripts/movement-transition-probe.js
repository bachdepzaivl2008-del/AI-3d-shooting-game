import { gameConfig } from '../src/game/config/gameConfig.js'
import { LocalAuthorityHost } from '../src/game/core/LocalAuthorityHost.js'
import { IntentSequencer } from '../src/shared/intents/IntentSequencer.js'

async function runCase({
  name,
  preludePayloads,
  movementPayload,
  ticks = 60,
}) {
  const authority =
    await LocalAuthorityHost.create(gameConfig)

  const sequencer =
    new IntentSequencer(`probe:${name}`)

  for (const payload of preludePayloads) {
    authority.submitIntent(
      sequencer.create(
        'PLAYER_INPUT',
        payload
      )
    )

    authority.step()
  }

  const start = {
    ...authority
      .getState()
      .player
      .position,
  }

  let previous = { ...start }
  let minPlanarStep = Infinity
  let minPlanarStepTick = null
  let zeroPlanarTicks = 0
  const anomalies = []

  for (let tick = 1; tick <= ticks; tick += 1) {
    authority.submitIntent(
      sequencer.create(
        'PLAYER_INPUT',
        movementPayload
      )
    )

    authority.step()

    const player =
      authority
        .getState()
        .player

    const current =
      player.position

    const dx =
      current.x - previous.x

    const dz =
      current.z - previous.z

    const planarStep =
      Math.hypot(dx, dz)

    if (planarStep < minPlanarStep) {
      minPlanarStep = planarStep
      minPlanarStepTick = tick
    }

    if (planarStep < 0.09) {
      zeroPlanarTicks += 1

      anomalies.push({
        tick,
        dx,
        dz,
        planarStep,
        position: {
          x: current.x,
          y: current.y,
          z: current.z,
        },
        grounded:
          player.grounded,
      })
    }

    previous = {
      x: current.x,
      y: current.y,
      z: current.z,
    }
  }

  const end =
    authority
      .getState()
      .player
      .position

  const result = {
    name,
    preludeTicks:
      preludePayloads.length,
    start,
    end,
    deltaX:
      end.x - start.x,
    deltaZ:
      end.z - start.z,
    planarDistance:
      Math.hypot(
        end.x - start.x,
        end.z - start.z
      ),
    minPlanarStep,
    minPlanarStepTick,
    zeroPlanarTicks,
    anomalies,
    finalYawDegrees:
      authority
        .getState()
        .player
        .orientation
        .yaw *
      180 /
      Math.PI,
  }

  authority.dispose()
  return result
}

const sensitivity =
  gameConfig.look
    .mouseSensitivityRadiansPerPixel

const quarterTurnPixels =
  (Math.PI / 2) /
  sensitivity

const neutral = {
  moveX: 0,
  moveY: 0,
  lookDeltaX: 0,
  lookDeltaY: 0,
}

const results = []

results.push(
  await runCase({
    name: 'fresh-world-axis-right',
    preludePayloads: [],
    movementPayload: {
      ...neutral,
      moveX: 1,
    },
  })
)

results.push(
  await runCase({
    name: 'one-idle-tick-then-world-axis-right',
    preludePayloads: [
      neutral,
    ],
    movementPayload: {
      ...neutral,
      moveX: 1,
    },
  })
)

results.push(
  await runCase({
    name: 'one-yaw-tick-then-camera-forward',
    preludePayloads: [
      {
        ...neutral,
        lookDeltaX:
          quarterTurnPixels,
      },
    ],
    movementPayload: {
      ...neutral,
      moveY: 1,
    },
  })
)

console.dir(
  {
    probe:
      'movement-transition-isolation',
    expectedDistance:
      gameConfig.movement.baseSpeed,
    results,
  },
  { depth: null }
)

console.log(
  'Movement transition probe: COMPLETE'
)

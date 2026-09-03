import assert from 'node:assert/strict'

import {
  resolveInputMode,
} from '../src/client/device/clientProfile.js'

import {
  normalizeTouchJoystick,
  shouldAutoSprint,
} from '../src/client/input/touchControlMath.js'

assert.equal(
  resolveInputMode({
    maxTouchPoints: 0,
    coarsePointer: false,
    hoverNone: false,
  }),
  'desktop',
  'Mouse/keyboard desktop profile must select desktop input'
)

assert.equal(
  resolveInputMode({
    maxTouchPoints: 5,
    coarsePointer: true,
    hoverNone: true,
  }),
  'touch',
  'Touch-primary mobile profile must select touch input'
)

assert.equal(
  resolveInputMode({
    maxTouchPoints: 10,
    coarsePointer: true,
    hoverNone: false,
  }),
  'touch',
  'Coarse touch tablet must select touch input'
)

assert.equal(
  resolveInputMode({
    maxTouchPoints: 1,
    coarsePointer: false,
    hoverNone: false,
  }),
  'desktop',
  'Touch-capable laptop with precise pointer/hover should preserve desktop input'
)

assert.equal(
  resolveInputMode({
    maxTouchPoints: 0,
    coarsePointer: false,
    hoverNone: false,
    forcedMode: 'touch',
  }),
  'touch',
  'Debug override must allow touch controls to be tested on desktop'
)

assert.equal(
  resolveInputMode({
    maxTouchPoints: 10,
    coarsePointer: true,
    hoverNone: true,
    forcedMode: 'desktop',
  }),
  'desktop',
  'Debug override must allow desktop input mode to be forced'
)

const centered =
  normalizeTouchJoystick(
    0,
    0,
    54
  )

assert.deepEqual(
  centered,
  {
    moveX: 0,
    moveY: -0,
    magnitude: 0,
    clampedX: 0,
    clampedY: 0,
  },
  'Centered joystick must produce zero movement'
)

const forward =
  normalizeTouchJoystick(
    0,
    -54,
    54
  )

assert.ok(
  Math.abs(
    forward.moveY - 1
  ) < 1e-9,
  'Upward thumb movement must map to forward +1'
)

assert.ok(
  Math.abs(forward.moveX) <
    1e-9
)

assert.ok(
  Math.abs(
    forward.magnitude - 1
  ) < 1e-9
)

const diagonal =
  normalizeTouchJoystick(
    100,
    -100,
    54
  )

assert.ok(
  Math.hypot(
    diagonal.moveX,
    diagonal.moveY
  ) <= 1 + 1e-9,
  'Joystick output must remain normalized at extreme diagonal input'
)

assert.ok(
  shouldAutoSprint(
    0.88,
    0.88
  ),
  'Auto-Sprint must activate at threshold'
)

assert.equal(
  shouldAutoSprint(
    0.7,
    0.88
  ),
  false,
  'Partial joystick deflection must preserve walk control'
)

console.log(
  'Adaptive desktop/mobile input test: PASS'
)

console.log({
  desktopMode: 'desktop',
  touchMode: 'touch',
  joystickForward:
    forward.moveY,
  diagonalMagnitude:
    Math.hypot(
      diagonal.moveX,
      diagonal.moveY
    ),
  autoSprintThreshold: 0.88,
})

# DEVELOPMENT STATUS

## Source of truth
- Game Design Concept v0.1: DEVELOPMENT LOCKED
- Development Plan v0.1: DEVELOPMENT LOCKED

## Current branch
`phase-0-architecture`

## Current phase
**Phase 1 — Shared World & Collision Foundation**

## Phase 0
**PASS**

Verified:
- Three.js client separated from simulation
- Fixed simulation clock
- Stable IDs
- Seeded RNG
- Headless simulation
- Local authority host
- Intent buffer
- Input sequencing

## Phase 1
**PASS**

Verified:
- Rapier shared collision runtime works in browser
- Rapier shared collision runtime works headless/server-compatible
- Ground ray / floor query
- Grounded detection
- Wall blocking
- 0.34 m autostep
- 0.10 m ground snap
- Long swept movement / Dash blocked by wall
- Walkable 35° ramp traversal using the proven rotated-cuboid construction
- Flat-ground → ramp transition
- Full regression verification:
  - `npm run sim:test` PASS
  - `npm run collision:test` PASS
  - `npm run character:test` PASS
  - `npm run build` PASS

### P1-COLL-004 — Walkable slope traversal
**CLOSED / PASS**

Root cause:
- The earlier failing fixture used a trimesh ramp construction that stalled the character controller mid-slope.
- Minimal direct-slope probing proved pure slope climbing worked.
- Dedicated entry probing proved flat-ground → ramp transition worked.
- Replacing the failing fixture with a proven flush rotated-cuboid ramp construction resolved the regression.

Design requirement preserved:
- Max walkable slope remains 45°.
- No GDD value was changed to force the test green.

## Rule for continuing development
A failed subsystem is either:
1. fixed,
2. explicitly tracked as OPEN/BLOCKED,
3. or deferred with a documented dependency.

Never silently forget a failed test.

## Next planned step
Proceed to authoritative player movement integration:

```text
Browser Input
    ↓
PLAYER_INPUT Intent
    ↓
LocalAuthorityHost
    ↓
Player Movement System
    ↓
Rapier Character Controller
    ↓
Authoritative Player State
    ↓
Three.js Camera / View
```

First target:
- create authoritative player state,
- wire WASD movement into the simulation,
- move the Rapier capsule through the shared collision layer,
- render/follow the authoritative position in Three.js.

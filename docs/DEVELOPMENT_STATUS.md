# DEVELOPMENT STATUS

## Source of truth
- Game Design Concept v0.1: DEVELOPMENT LOCKED
- Development Plan v0.1: DEVELOPMENT LOCKED

## Current branch
`phase-0-architecture`

## Current phase
**Phase 2 — Authoritative Player Movement Integration**

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

## Phase 2
**IN PROGRESS**

### P2-MOVE-001 — Authoritative base WASD movement
**PASS / CLOSED**

Implemented:
- authoritative player state,
- async authority/simulation initialization for shared Rapier runtime,
- WASD input routed through PLAYER_INPUT intents,
- PlayerMovementSystem using the shared Rapier character controller,
- authoritative position + grounded state,
- client camera follows authoritative player state,
- input sequence stored in authoritative state,
- headless movement regression test.

Current technical IIV:
- base movement speed = 6 m/s.
- This is an implementation placeholder for integration testing, not a locked balance value.

Not included in this pass:
- mouse look,
- sprint,
- jump,
- crouch,
- slide,
- dash.

These remain subsequent movement tasks; the GDD movement structure is unchanged.

## Next planned step
Verify the first authoritative movement slice:

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


Verification commands:
- `npm run sim:test`
- `npm run collision:test`
- `npm run character:test`
- `npm run movement:test`
- `npm run build`

If all pass and browser preview moves with WASD, mark P2-MOVE-001 PASS.


## Latest verification result — P2-MOVE-001
- `sim:test`: PASS
- `collision:test`: PASS
- `character:test`: PASS
- `build`: PASS
- `movement:test`: FAIL on one-second rightward distance assertion

Current action:
- isolate the actual authoritative displacement before changing implementation or thresholds,
- keep P2-MOVE-001 OPEN until root cause is understood.


## P2-MOVE-001 diagnostic follow-up
Measured movement result before fix:
- expected: 6.0 m in 1 second,
- actual: ~5.799 m,
- error: ~0.201 m.

Root cause:
- the temporary 0.02 m/tick downward component was too large for a snap-to-ground bias,
- Rapier projects the full desired translation through the character-controller collision response,
- that excessive downward component reduced planar displacement.

Fix integrated:
- base speed remains 6 m/s,
- snap bias reduced from 0.02 m/tick to 0.001 m/tick,
- movement-test tolerance is unchanged.

This is a technical controller correction, not a balance change.


## P2-MOVE-001 verification update
- `movement:test`: PASS after reducing the Rapier ground-snap bias.
- Base speed remains 6 m/s IIV.
- No tolerance relaxation was required.

P2-MOVE-001 is now awaiting one final full regression pass before closure.


## P2-MOVE-001 final verification
Full regression PASS confirmed:
- `npm run sim:test`: PASS
- `npm run collision:test`: PASS
- `npm run character:test`: PASS
- `npm run movement:test`: PASS
- `npm run build`: PASS

Additional verified result:
- authoritative player movement covers ~6.0 m in 1 second at the current 6 m/s IIV,
- input sequence reaches 60 after 60 simulation ticks,
- player remains grounded on flat terrain,
- no regression detected in shared collision or build.

### Next task
**P2-MOVE-002 — Mouse Look & Camera Orientation**

Goal:
- capture mouse delta through the client input layer,
- convert it into look intent data,
- store authoritative yaw/pitch state,
- make movement direction camera-relative,
- keep the renderer as a view of authoritative orientation rather than a second source of truth.

Not included yet:
- sprint,
- jump,
- crouch,
- slide,
- dash.

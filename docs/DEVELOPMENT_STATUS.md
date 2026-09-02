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


## P2-MOVE-002 — Mouse Look & Camera Orientation
**IMPLEMENTED / AWAITING VERIFICATION**

Implemented:
- pointer-lock request on click,
- mouse delta capture in the client input layer,
- look deltas included in PLAYER_INPUT intent payloads,
- authoritative yaw/pitch state,
- authoritative pitch clamp,
- camera orientation driven only from authoritative state,
- WASD movement rotated by authoritative yaw,
- headless look + camera-relative movement test.

Current technical IIV:
- mouse sensitivity = 0.0025 rad/pixel,
- max pitch = 89°.

These are integration placeholders, not locked balance values.

Verification:
- `npm run look:test`
- existing regression tests must continue to pass,
- browser preview should rotate after clicking the viewport and moving the mouse,
- W should move in the direction the camera is facing.


## P2-MOVE-002 diagnostic update
Initial `look:test` result:
- authoritative yaw/pitch assertion reached the camera-relative movement stage,
- failure occurs on the expected +X displacement after a 90° yaw.

Current action:
- print authoritative yaw, start/end position, deltaX and deltaZ before changing implementation or tolerances,
- keep P2-MOVE-002 OPEN until the mismatch is measured.


## P2-MOVE-002 diagnostic follow-up
Measured camera-relative result:
- yaw = 90° exactly,
- deltaZ ≈ 0,
- deltaX ≈ 5.8993 m after 60 movement ticks,
- expected deltaX = 6.0 m.

Interpretation:
- camera-relative axis rotation is correct,
- remaining error is approximately one 0.1 m movement tick,
- do not change yaw logic or test tolerance yet.

Next diagnostic:
- record the first five and final per-tick authoritative displacements to locate which tick loses movement.


## P2-MOVE-002 per-tick trace result
Observed samples:
- tick 1-5: ~0.1 m each,
- tick 60: ~0.1 m,
- yaw remains exactly 90°,
- player remains grounded.

Conclusion:
- there is likely one isolated mid-run displacement anomaly,
- camera-relative basis is not the failure.

Next diagnostic is compact:
- minimum per-tick deltaX,
- tick index of minimum,
- count of ticks below 0.09 m,
- summed deltaX,
- only anomalous tick details.


## P2-MOVE-002 root-cause finding
Compact per-tick trace found:
- exactly one anomalous movement tick,
- anomalous tick = 13,
- deltaX = 0 on that tick,
- all sampled normal ticks move ~0.1 m,
- yaw = 90° exactly,
- player remains grounded,
- tiny unintended Z drift is present.

Root cause hypothesis now narrowed to floating-point residue in camera-relative cardinal directions:
- at exactly 90° yaw, trigonometric basis values produce a near-zero Z component instead of exact zero,
- that tiny residual is unnecessary and can perturb Rapier contact resolution over repeated grounded movement.

Fix integrated:
- canonicalize near-zero planar direction components to exact zero before normalization/collision movement,
- do not change sensitivity, base speed, collision settings, or test tolerance.

This is numerical canonicalization at the input-to-physics boundary, not a gameplay/balance change.


## P2-MOVE-002 diagnostic correction
Canonicalizing near-zero camera-relative components did not remove the isolated zero-displacement tick.
The anomalous tick moved from 13 to 59, which means the prior floating-point-residue hypothesis is not sufficient.

Current conclusion:
- yaw basis remains correct,
- one isolated physics/movement tick can still be lost,
- the failure may be caused by the idle/look-only prelude tick rather than mouse-look math itself.

Next action:
- run a three-case transition probe:
  1. fresh world-axis movement,
  2. one neutral idle tick then world-axis movement,
  3. one yaw-only tick then camera-relative movement.

This will isolate whether the issue is a generic idle→move transition or specifically look-related.


## P2-MOVE-002 transition-probe result
Three-case isolation result:
1. fresh movement: ~6.0 m, zero anomalous ticks,
2. one idle tick then movement: ~5.9 m, exactly one zero-displacement tick,
3. one yaw-only tick then movement: same as case 2.

Conclusion:
- the defect is NOT mouse-look specific,
- the defect is NOT camera-relative basis math,
- a look-only tick behaves exactly like any other idle tick,
- the common trigger is that an idle tick currently still feeds a downward snap translation into Rapier.

Fix integrated:
- only apply the tiny ground-snap downward bias while there is actual planar movement,
- idle/look-only ticks now request zero character translation,
- keep base speed, look sensitivity, collision settings, and test tolerances unchanged.

Rationale:
- snap-to-ground is needed while traversing horizontally across ground changes,
- an idle character does not need a synthetic downward translation,
- removing idle bias avoids perturbing the grounded controller state before movement begins.


## P2-MOVE-002 definitive idle-transition fix
The prior change removed the explicit downward bias on idle ticks, but the transition probe still failed.

Root cause refined:
- even with a zero desired translation, idle/look-only ticks were still calling
  `computeColliderMovement` and `setNextKinematicTranslation`,
- Rapier could slightly re-resolve the grounded kinematic contact on those no-op controller ticks,
- after such a prelude, later movement showed intermittent partial/zero horizontal displacement.

Definitive fix:
- idle/look-only ticks no longer invoke the character controller at all,
- the Rapier world still advances exactly one physics step per simulation tick,
- the player transform remains unchanged on idle ticks,
- grounded state is preserved from the last real character-controller movement.

This keeps the authority/simulation clock deterministic while preventing no-op controller calls from perturbing character contact state.

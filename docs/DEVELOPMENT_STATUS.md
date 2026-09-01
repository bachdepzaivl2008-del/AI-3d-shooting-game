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

## Phase 1 status

### P1-COLL-001 — Shared collision runtime
**PASS**
- Rapier runs in browser
- Rapier runs headless/server-compatible

### P1-COLL-002 — Basic world collision
**PASS**
- Ground ray
- Grounded detection
- Wall blocking

### P1-COLL-003 — Character traversal basics
**PASS**
- 0.34 m autostep
- 0.10 m ground snap
- Long swept movement / Dash blocked by wall

### P1-COLL-004 — Walkable slope traversal
**FIX INTEGRATED / AWAITING FULL VERIFICATION**
Locked requirement: max walkable slope = 45°.

Verified diagnostics:
- Minimal direct-Rapier 35° slope probe: PASS.
- Flat-ground → 35° ramp entry probe: PASS for all three tested construction patterns.
- Therefore the controller can climb the slope and transition from flat ground when the ramp is built as a rotated cuboid.

The failing trimesh ramp fixture was a test-construction problem, not evidence that the 45° gameplay requirement was invalid.

The shared character collision suite now uses the proven flush rotated-cuboid ramp construction.

Do not close P1-COLL-004 until the full character collision test and complete Phase 1 regression suite pass.

## Rule for continuing development
A failed subsystem is either:
1. fixed,
2. explicitly tracked as OPEN/BLOCKED,
3. or deferred with a documented dependency.

Never silently forget a failed test.

## Next planned step
Run full Phase 1 verification after pulling the integrated fix:

1. `npm run sim:test`
2. `npm run collision:test`
3. `npm run character:test`
4. `npm run build`

If all four pass:
- close P1-COLL-004,
- mark Phase 1 shared collision foundation PASS,
- proceed to authoritative player movement integration.

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
**BLOCKED / OPEN**
Locked requirement: max walkable slope = 45°.

Current 35° diagnostic ramp begins climbing but stalls mid-slope.

Do not change the GDD value to force a pass.
Track root-cause work in the GitHub issue for P1-COLL-004.

## Rule for continuing development
A failed subsystem is either:
1. fixed,
2. explicitly tracked as OPEN/BLOCKED,
3. or deferred with a documented dependency.

Never silently forget a failed test.

## Next planned step
A minimal direct-Rapier slope probe has now been added as `npm run slope:probe`.
It starts the capsule directly on a 35° ramp, avoiding the ground-to-ramp entry seam, and applies movement tick-by-tick using Rapier's documented controller flow.

Interpretation:
- PASS => pure slope climbing works; remaining bug is in ramp entry/transition geometry.
- BLOCKED => pure slope climbing itself is misconfigured or incompatible with the current controller setup.

Do not expand scope until this probe result is recorded.

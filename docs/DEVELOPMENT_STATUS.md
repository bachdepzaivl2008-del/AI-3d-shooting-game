# DEVELOPMENT STATUS

## Source of truth
- Game Design Concept v0.1: DEVELOPMENT LOCKED
- Development Plan v0.1: DEVELOPMENT LOCKED

## Current branch
`phase-0-architecture`

## Current canonical stage
**STAGE 1 — PLAYER CONTROLLER & MOVEMENT SANDBOX (IN PROGRESS)**

## Formal Stage 0 close
**AWAITING FINAL VERIFICATION**

Previously verified foundation:
- Three.js client separated from simulation
- Fixed simulation clock
- Seeded RNG
- Local authority host
- Intent buffer / input sequencing
- Shared Rapier browser + headless compatibility
- Pointer-lock + keyboard input
- Stable entity IDs

## Stage 0 formal-close implementation pass
Remaining locked Stage 0 foundation pieces are now implemented:
- deterministic gameplay event stream with authoritative tick/time metadata,
- stable specialized ID allocators for Entity / CombatSlot / SpawnPoint / WorldItem,
- explicit entity create/destroy registry coverage,
- developer logger + global browser error/unhandled-rejection boundary,
- browser debug overlay showing FPS, simulation tick, player position/derived velocity, yaw/pitch, grounded state and input sequence,
- dedicated headless Stage 0 foundation test.

Stage 0 status: **AWAITING FINAL VERIFICATION**.
Do not mark Stage 0 CLOSED until the foundation regression + browser checklist passes.

## Stage 1 completed slices
- P2-MOVE-001 — Authoritative Base WASD Movement: PASS / CLOSED
- P2-MOVE-002 — Mouse Look & Camera Orientation: PASS / CLOSED
- Collision foundation regression: PASS

## Next after Stage 0 formal close
**P2-MOVE-003 — Infinite Sprint**

Rule: a FAIL blocks the next dependent implementation unless explicitly registered as non-blocking PASS WITH ISSUES.

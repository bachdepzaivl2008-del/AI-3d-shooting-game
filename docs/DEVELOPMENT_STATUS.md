# DEVELOPMENT STATUS

## Source of truth
- Game Design Concept v0.1: DEVELOPMENT LOCKED
- Development Plan v0.1: DEVELOPMENT LOCKED

## Current branch
`phase-0-architecture`

## Current canonical stage
**STAGE 1 — PLAYER CONTROLLER & MOVEMENT SANDBOX (IN PROGRESS)**

## Formal Stage 0 close
**PASS / CLOSED ✅**

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

Stage 0 status: **PASS / CLOSED ✅**.

Final verification confirmed:
- foundation:test PASS
- sim:test PASS
- collision:test PASS
- character:test PASS
- movement:test PASS
- look:test PASS
- build PASS
- browser dev server boots normally
- debug overlay is visible and updates
- first-person mouse look + WASD remain operational

## Stage 1 completed slices
- P2-MOVE-001 — Authoritative Base WASD Movement: PASS / CLOSED
- P2-MOVE-002 — Mouse Look & Camera Orientation: PASS / CLOSED
- Collision foundation regression: PASS

## Current task
**P2-MOVE-003 — Infinite Sprint (OPEN / IN IMPLEMENTATION)**

Rule: a FAIL blocks the next dependent implementation unless explicitly registered as non-blocking PASS WITH ISSUES.


## P2-MOVE-003 — Infinite Sprint
**IMPLEMENTED / AWAITING VERIFICATION**

Canonical Stage 1 values from Core Gameplay Systems 68B:
- AR/Base Normal Ground Speed IIV = 5.5 m/s,
- Sprint multiplier IIV = 1.25x,
- AR/Base Sprint speed = 6.875 m/s,
- Sprint stamina = unlimited,
- Sprint may use any horizontal input direction.

Important correction:
- the earlier 6 m/s base speed was only a temporary technical integration placeholder,
- Stage 1 now uses the canonical 5.5 m/s GDD IIV.

Implemented:
- Shift sprint intent consumed by authoritative movement,
- authoritative player.sprinting state,
- Sprint active only while horizontal movement exists,
- idle + Shift does not move the player,
- diagonal Sprint remains normalized,
- fire/ADS fields already cancel Sprint for future combat integration,
- debug overlay shows SPRINTING,
- sprint:test added.

Verification required:
- npm run sprint:test
- npm run movement:test
- npm run look:test
- npm run foundation:test
- npm run collision:test
- npm run character:test
- npm run build
- browser: hold Shift + WASD, confirm visible speed increase and SPRINTING: true.

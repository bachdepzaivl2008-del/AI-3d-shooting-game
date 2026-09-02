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


## P2-MOVE-003 regression failure — root cause correction
First canonical-speed verification failed:
- sprint:test: FAIL,
- movement:test: FAIL,
- look:test: FAIL,
- foundation/collision/character/build continued to pass.

Measured normal movement at 5.5 m/s:
- expected ≈ 5.5 m in 1 s,
- actual ≈ 5.319 m,
- per-tick trace showed intermittent zero/partial grounded movement ticks.

Interpretation:
- this is not a Sprint multiplier bug,
- changing from the temporary 6.0 m/s placeholder to the canonical 5.5 m/s exposed a speed-sensitive instability already latent in the shared character-application path,
- the old wrapper drove CharacterController through a position-based kinematic rigid body, then stepped Rapier,
- the previously proven minimal slope/ramp probes use a standalone collider moved directly after CharacterController correction and do not exhibit this extra rigid-body contact-resolution layer.

Fix integrated:
- shared character capsule is now a standalone Rapier collider,
- CharacterController corrected movement is applied directly with collider.setTranslation(),
- shared getCharacterPosition() is now the single position accessor,
- PlayerMovementSystem and character collision regression suite use the same accessor.

No gameplay values or test tolerances were relaxed.
P2-MOVE-003 remains OPEN until the full regression passes at canonical 5.5 / 6.875 m/s.


## P2-MOVE-003 grounding-bias isolation result
Dedicated `movement-grounding:probe` isolated the remaining movement loss.

Key results:
- bias = 0:
  - normal: ~5.5000 m / 1 s, 60/60 grounded ticks, 0 anomalies,
  - sprint: ~6.8750 m / 1 s, 60/60 grounded ticks, 0 anomalies.
- positive synthetic downward biases produced speed-sensitive partial/zero planar ticks; the canonical runtime value 0.001 reproduced the ~5.319 m normal-movement failure.
- larger biases degraded displacement further.

Conclusion:
- Rapier's configured snap-to-ground already maintains grounded state for flat authoritative locomotion,
- the additional synthetic downward movement component is not required and is the direct cause of the intermittent planar movement loss at canonical speeds.

Fix:
- runtime `groundSnapBiasPerTick` = 0,
- no GDD speed value changed,
- no test tolerance relaxed,
- shared CharacterController snap-to-ground remains enabled.

P2-MOVE-003 remains OPEN until sprint/movement/look/full regression + browser verification pass.


## P2-MOVE-003 full regression result
User verification confirms the full seven-command regression is green with no ERROR output:
- sprint:test PASS
- movement:test PASS
- look:test PASS
- foundation:test PASS
- collision:test PASS
- character:test PASS
- build PASS

Canonical movement values remain:
- Normal Ground Speed = 5.5 m/s
- Sprint Multiplier = 1.25x
- Sprint Speed = 6.875 m/s
- Sprint stamina = unlimited

P2-MOVE-003 now only requires final browser verification before closure.


## P2-MOVE-003 browser telemetry correction
Browser observation:
- VEL returned to 0 when stopped (expected),
- while moving, VEL visibly flickered/jumped because the debug overlay derived velocity from render-frame snapshots.

Root cause:
- render runs around 120 FPS while authoritative simulation runs at 60 Hz,
- some render frames see no new simulation tick, so render-derived velocity collapses to 0 between valid movement updates,
- this is a telemetry/display defect, not evidence that authoritative Sprint itself is toggling.

Fix:
- authoritative player.velocity now lives in simulation state,
- velocity is computed once per fixed simulation tick from correctedMovement / fixedDeltaTime,
- DebugOverlay reads that simulation-owned velocity directly,
- added planar SPEED readout in m/s for browser verification.

Expected browser values on flat ground:
- normal movement SPEED ≈ 5.50 m/s,
- Sprint SPEED ≈ 6.88 m/s,
- idle SPEED = 0.00 m/s.

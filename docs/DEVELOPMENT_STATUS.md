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
**P2-MOVE-004 — Crouch & Camera Eye Height (OPEN / IN IMPLEMENTATION)**

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


## Velocity XYZ semantics correction
The isolated velocity regression still failed on grounded Y even with the cube removed.

Root cause:
- Rapier CharacterController may apply small vertical contact-resolution corrections while the character remains grounded,
- those Y corrections are necessary for collision placement but are not gameplay vertical velocity,
- exposing correctedMovement.y / dt directly as player.velocity.y makes grounded velocity telemetry semantically wrong and visually noisy.

Runtime correction:
- while grounded, authoritative player.velocity.y is now exactly 0,
- X/Z continue to use actual corrected planar movement / fixedDeltaTime,
- when airborne in future Jump/Gravity work, Y may again represent real vertical velocity.

The velocity regression was also upgraded to aggregate all XYZ/speed failures across all cases before failing, so one axis no longer hides the rest of the diagnostic.


## Velocity XYZ regression verification
Dedicated `velocity:test` now PASS.

Verified authoritative velocity semantics:
- X axis: stable and directionally correct across tested yaw/movement cases,
- Y axis: 0 while grounded; Rapier contact correction is no longer exposed as gameplay vertical velocity,
- Z axis: stable and directionally correct across tested yaw/movement cases,
- planar SPEED remains stable at configured normal/Sprint targets,
- idle returns XYZ velocity to 0,
- normal/Sprint/diagonal/yaw 0°/45°/90° cases pass.

Velocity telemetry sub-check is CLOSED.
P2-MOVE-003 remains open only for final browser Sprint confirmation.


## P2-MOVE-003 closure
**PASS WITH ISSUES / CLOSED**

Mechanical Sprint contract is verified by:
- sprint:test PASS,
- movement/look/foundation/collision/character/build regression PASS,
- velocity:test PASS for normal/Sprint/yaw/diagonal XYZ semantics.

Non-blocking deferred issue:
- the 1.25x Sprint increase can feel visually subtle in the current empty test scene.
- This is a presentation/balance-feel item for later playtest/weapon-feel passes, not a locomotion correctness blocker.

Proceeding to the next canonical Stage 1 item: Crouch.


## P2-MOVE-004 — Crouch & Camera Eye Height
**IMPLEMENTED / AWAITING VERIFICATION**

Canonical Core Gameplay 68B–68C values:
- Crouch movement = 0.60x current weapon Normal Movement Speed,
- AR/Base crouch speed = 3.30 m/s,
- Standing capsule = 1.80 m total height / 0.35 m radius,
- Crouch capsule = 1.20 m total height / 0.35 m radius,
- Standing eye height = 1.62 m,
- Crouch eye height = 1.00 m,
- standing is forbidden when standing-capsule head-clearance test fails.

Implemented:
- Ctrl drives authoritative crouch request,
- feet-preserving runtime capsule resize,
- exact standing-capsule shape-overlap clearance query,
- blocked stand keeps crouch active and exposes standBlocked,
- crouch movement multiplier,
- Sprint cannot remain active while crouched,
- authoritative crouched / standBlocked state,
- presentation-only smooth camera eye-height transition,
- debug overlay CROUCHED / STAND BLOCKED,
- crouch:test including low-ceiling stand-block contract.

Implementation-owned presentation value:
- camera eye transition rate = 14 / s.
This is not a gameplay balance constant and does not alter authoritative stance timing.

Verification required:
- npm run crouch:test
- npm run sprint:test
- npm run velocity:test
- npm run movement:test
- npm run look:test
- npm run foundation:test
- npm run collision:test
- npm run character:test
- npm run build
- browser: Ctrl lowers camera, movement slows to ~3.30 m/s, CROUCHED true, release returns standing in clear space.

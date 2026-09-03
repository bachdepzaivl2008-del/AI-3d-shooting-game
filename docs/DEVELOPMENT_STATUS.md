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
**P2-MOVE-009 — Enemy Dummy + Soft Separation + Dash Non-Phase-Through (IMPLEMENTED / AWAITING VERIFICATION)**

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


## P2-MOVE-004 closure
**PASS / CLOSED ✅**

User verification confirms:
- full regression PASS,
- browser Crouch works correctly,
- camera eye-height transition feels correct,
- authoritative crouch envelope/speed/stand-clearance contract is accepted.

## P2-MOVE-005 — Jump + Gravity
**IMPLEMENTED / AWAITING VERIFICATION**

Canonical Core Gameplay 68B values:
- Gravity IIV = 20 m/s²,
- Jump vertical velocity IIV = 6.6 m/s,
- level-ground apex target ≈ 1.09 m,
- No Double Jump,
- airborne steering is reduced and may not create speed gain above carried takeoff speed.

Implemented:
- authoritative jump press-edge handling,
- persistent vertical velocity + fixed-tick gravity,
- constant-acceleration vertical integration,
- vertical collision through shared Rapier CharacterController,
- no held-Space auto-repeat after landing,
- no Double Jump after release/re-press in air,
- second Jump becomes legal after landing + input release + new press,
- crouch-to-jump requires valid standing capsule clearance,
- blocked low-ceiling Jump remains crouched,
- airborne planar speed cap prevents gaining Sprint speed after a Normal-speed takeoff,
- reduced air steering uses implementation-owned initial steering rate = 6 / s because GDD does not lock an exact numeric steering responsiveness,
- AIRBORNE debug telemetry,
- jump:test added.

Landing Slowdown is intentionally NOT included here; it remains the next separate canonical Stage 1 slice.

Verification required:
- npm run jump:test
- npm run crouch:test
- npm run sprint:test
- npm run velocity:test
- npm run movement:test
- npm run look:test
- npm run foundation:test
- npm run collision:test
- npm run character:test
- npm run build
- browser: Space launches, AIRBORNE true, VEL Y rises/falls, player returns to ground, held Space does not auto-bunny-hop.


## P2-MOVE-005 closure
**PASS / CLOSED ✅**

User verification confirms:
- Jump + Gravity browser behavior works perfectly,
- fixed-tick gravity / no-double-jump / held-Space semantics are accepted,
- regression remained green.

## P2-MOVE-006 — Landing Slowdown
**IMPLEMENTED / AWAITING VERIFICATION**

Canonical Core Gameplay 68B values:
- Standard Landing: retain 85% horizontal speed; recovery 0.18 s.
- Hard Landing: vertical impact speed >= 10 m/s; retain 70% horizontal speed; recovery 0.30 s.
- Landing Slowdown triggers only from a real airborne-to-ground landing.
- Ordinary step traversal is not a landing.
- Values remain Prototype / Playtest Required.

Source gap / implementation-owned detail:
- the source locks the retained-speed multiplier and recovery duration but does not define the recovery interpolation curve,
- the first implementation uses deterministic linear recovery from the canonical retained multiplier back to 1.0 over the canonical duration,
- this adds no new gameplay constant and is explicitly playtest-tunable later.

Implementation:
- actual airborne vertical excursion is tracked,
- <= Step Height + controller offset traversal is classified as ordinary traversal and cannot trigger Landing Slowdown,
- real landing captures estimated vertical impact speed,
- Standard vs Hard classification is authoritative,
- recovery multiplier applies to Normal / Sprint / Crouch ground target speed and to immediate post-landing Jump takeoff speed,
- recovery timer advances at fixed simulation tick rate,
- no fall-damage behavior is added,
- authoritative landingType / multiplier / remaining / impact speed telemetry,
- landing:test covers Standard, Hard and ordinary-step exclusion.

Verification required:
- npm run landing:test
- npm run jump:test
- npm run crouch:test
- npm run sprint:test
- npm run velocity:test
- npm run movement:test
- npm run look:test
- npm run foundation:test
- npm run collision:test
- npm run character:test
- npm run build
- browser: normal Jump landing shows standard recovery; SPEED dips then returns; ordinary step traversal does not show landing recovery.


## P2-MOVE-006 closure
**PASS WITH ISSUES / CLOSED**

Verification:
- Landing Slowdown regression PASS.
- Browser behavior works correctly.
- Standard/Hard landing classification and recovery telemetry behave as intended.

Non-blocking feel observation:
- Standard Landing at 0.85x for 0.18 s is difficult to perceive in the current sparse test scene.
- This is expected to be revisited during instrumented playtest / movement-feel tuning because the GDD marks Landing Slowdown values as Prototype / Playtest Required.
- No canonical value is changed at this stage.

Next canonical Stage 1 item:
**P2-MOVE-007 — Slide entry / exit / momentum / slope behavior**


## P2-MOVE-007 — Slide entry / exit / momentum / slope behavior
**IMPLEMENTED / AWAITING VERIFICATION**

Canonical Core Gameplay 68B values:
- entry requires grounded + crouch input + horizontal speed >= 6.0 m/s,
- initial Slide speed = current horizontal speed + 0.4 m/s,
- initial Slide speed cap = 9.0 m/s,
- flat-ground deceleration = 2.5 m/s²,
- maximum duration = 1.20 s,
- exit below 4.5 m/s,
- crouch release exits Slide,
- valid-ground loss exits Slide,
- Jump may override Slide and carries horizontal speed capped at current Sprint speed,
- no hard cooldown,
- no permanent Slide-Jump speed accumulation loop.

Implementation:
- authoritative Slide state and entry gating,
- crouch press is edge-armed so one held crouch cannot immediately re-enter after an automatic Slide exit,
- no hard cooldown: release/re-press crouch may immediately start another Slide once speed requirement is restored,
- Slide uses the crouched physical envelope,
- entry momentum is captured from actual prior authoritative planar velocity,
- flat-ground speed decays deterministically at 2.5 m/s²,
- wall/collision correction can reduce carried Slide speed,
- ground loss exits Slide and carries corrected horizontal momentum into airborne state,
- Slide Jump exits Slide and caps airborne horizontal carry at Sprint speed,
- slope response uses gravity projected along actual corrected surface travel:
  - uphill adds momentum loss,
  - downhill can preserve/extend momentum,
  - no hidden slope-speed bonus constant was introduced,
- debug telemetry exposes SLIDING / SLIDE SPEED / SLIDE TIME / EXIT / SLOPE ACCEL,
- slide:test covers entry threshold, initial boost/cap, flat decay, release exit, automatic exit, no same-hold reentry, no hard cooldown, Slide Jump cap, and slope acceleration sign.

Source-gap interpretation:
- the GDD does not specify active steering strength while Sliding.
- First implementation preserves the entry momentum direction instead of inventing a new steering constant.
- This remains eligible for later playtest tuning if the GDD is extended.

Verification required:
- npm run slide:test
- npm run landing:test
- npm run jump:test
- npm run crouch:test
- npm run sprint:test
- npm run velocity:test
- npm run movement:test
- npm run look:test
- npm run foundation:test
- npm run collision:test
- npm run character:test
- npm run build
- browser: Sprint first, then press Ctrl while >=6.0 m/s; camera/capsule crouches and SLIDING becomes true; releasing Ctrl exits.


## P2-MOVE-007 regression note — Landing test boundary
Initial Slide verification:
- slide:test PASS.
- landing:test failed only at "Standard Landing must recover to full normal speed".

Root cause:
- not a Slide runtime regression,
- movement for a fixed tick uses the Landing multiplier sampled at tick start,
- recovery time advances at tick end,
- therefore the tick that changes remaining recovery to 0 may still have velocity produced by the final sub-1.0 multiplier,
- the first fully unpenalized velocity sample is the following fixed tick.

Correction:
- landing:test now checks full Normal speed on the first tick after recovery expires,
- identical correction applied to Standard and Hard Landing assertions,
- no gameplay value changed,
- no epsilon/tolerance widened,
- Landing runtime remains unchanged.

P2-MOVE-007 remains AWAITING VERIFICATION until the complete regression is green.


## PLAT-001 — Adaptive desktop/mobile input foundation
**IMPLEMENTED / AWAITING VERIFICATION**

Release-direction update requested:
- one shared browser build/link should support desktop and touch-primary mobile/tablet,
- gameplay simulation remains shared and authoritative-friendly,
- only the local input/presentation layer adapts per device.

Implemented:
- adaptive input-mode detection:
  - desktop precision-pointer/hover profile -> BrowserInputSource,
  - touch-primary coarse/no-hover profile -> TouchInputSource,
  - touch-capable laptops with a normal precision pointer remain desktop mode,
- mobile floating left joystick -> canonical moveX/moveY PLAYER_INPUT fields,
- mobile right-side drag look -> canonical lookDeltaX/lookDeltaY fields,
- mobile Jump hold button,
- mobile Crouch/Slide hold button,
- Auto-Sprint when joystick magnitude >= 0.88,
- partial joystick deflection remains walk/non-Sprint,
- landscape-orientation blocker for touch-primary portrait use,
- touch-safe viewport / overscroll / context-menu prevention,
- mobile renderer pixel-ratio cap = 1.5 versus desktop cap = 2.0,
- debug overlay now exposes INPUT MODE,
- adaptive-input:test covers device-mode selection, joystick normalization and Auto-Sprint threshold.

Implementation-owned mobile UX values:
- joystick radius = 54 CSS px,
- Auto-Sprint threshold = 0.88,
- touch look scale = 1.6,
- mobile renderer pixel-ratio cap = 1.5.

Scope boundary:
- this makes the CURRENT movement sandbox playable from touch without duplicating gameplay logic,
- Dash / Fire / ADS / Reload / Weapon Switch touch buttons are intentionally not fabricated before those gameplay actions exist,
- those controls will extend TouchInputSource when the corresponding canonical gameplay systems are implemented,
- aim assist / input-based matchmaking remain later competitive-playtest decisions, not part of PLAT-001.

Verification required:
- npm run adaptive-input:test
- npm run build
- existing Stage 1 regression remains green,
- desktop browser shows INPUT MODE: desktop and retains keyboard/mouse behavior,
- touch-primary mobile/tablet shows INPUT MODE: touch, joystick/look/Jump/Crouch-Slide controls and landscape prompt.


PLAT-001 verification convenience:
- append `?input=touch` to the browser URL to force the mobile touch-control layer on desktop for testing,
- append `?input=desktop` to force desktop input mode,
- this override is client-side diagnostics only and does not change simulation behavior.


## PLAT-001 closure
**PASS / CLOSED ✅**

User verification confirms:
- adaptive desktop input works correctly,
- touch/mobile input layer works correctly,
- forced `?input=touch` verification works,
- joystick movement, touch look, Jump, Crouch/Slide and Auto-Sprint are usable without difficulty,
- existing gameplay regression remains green.

Cross-device release foundation is now established:
- one shared browser build/link,
- desktop and touch-primary mobile/tablet use different local input sources,
- both feed the same authoritative PLAYER_INPUT contract,
- future Dash / Fire / ADS / Reload / Weapon Switch touch controls will extend the same TouchInputSource as those systems are implemented.

Return to canonical Stage 1 movement work:
**P2-MOVE-007 — Slide remains the current gameplay task until final browser acceptance is recorded.**


## P2-MOVE-007 closure
**PASS / CLOSED ✅**

Progression note:
- Slide regression is green after the Landing fixed-tick boundary correction.
- User authorized progression to the next Stage 1 movement slice.
- No remaining Slide browser defect was reported at handoff.

## P2-MOVE-008 — 2 Dash Charges + Independent Recharge
**IMPLEMENTED / AWAITING VERIFICATION**

Canonical Core Gameplay 68B values:
- Dash Charges = 2 — LOCKED,
- Dash Distance = 7.0 m,
- Dash Duration = 0.22 s,
- per-charge recharge = 4.5 s,
- each consumed charge owns an independent timer,
- minimum activation interval = 0.25 s,
- grounded and airborne Dash are legal,
- Dash is horizontal only,
- camera-relative movement input selects direction; no-input defaults camera-forward,
- gravity continues during Air Dash,
- Dash does not reset Jump/Fall state,
- Dash overrides Slide,
- swept world collision stops before solid geometry while still consuming the charge,
- no bounce and no wall-impact damage,
- attacks are locked during Dash; weapon-specific post-Dash recovery remains Weapon System-owned.

Implementation:
- authoritative DashController owns two independent recharge timers,
- exact-distance fixed-tick integration uses a partial final Dash step so 0.22 s does not overshoot 7.0 m at 60 Hz,
- input edge prevents one held button from consuming both charges,
- 0.25 s activation lock is authoritative,
- Dash direction is captured on activation and remains fixed through that Dash; this is an implementation-owned interpretation because the GDD does not specify mid-Dash steering,
- no-input Dash defaults camera-forward,
- Ground Dash preserves grounded contact,
- Air Dash preserves current vertical state and continues gravity,
- the Dash burst itself is displacement-only and does not leak its ~31.8 m/s burst velocity into permanent post-Dash airborne momentum; pre-Dash airborne planar momentum is restored when Dash ends,
- leaving a ledge during Ground Dash transitions into the existing airborne/fall state,
- airborne Dash landing still participates in Landing Slowdown because Dash does not reset fall state,
- Slide is cancelled with slideExitReason = dash when Dash activates,
- world blocking uses the shared swept Rapier CharacterController,
- grounded blocked-path detection compares corrected 3D path length against requested Dash translation so walkable slope correction is not mistaken for a wall,
- airborne blocked-path detection compares horizontal travel only so vertical fall speed cannot hide a wall block,
- a blocked Dash ends immediately and the consumed charge continues recharging,
- dashAttackLocked remains true for every tick that actually performs Dash movement, including the final partial Dash tick,
- desktop implementation-owned binding = E,
- mobile TouchInputSource now exposes a DASH button,
- debug telemetry exposes DASHING / CHARGES / independent timers / remaining distance-time / activation lock / exit reason / attack lock,
- dash:test covers:
  - exactly two spawn charges,
  - default-forward direction,
  - exact 7.0 m unblocked distance,
  - 0.22 s duration integration,
  - 0.25 s minimum activation interval,
  - independent 4.5 s timers,
  - no third Dash with zero charges,
  - staggered independent recharge,
  - Air Dash gravity/no vertical boost,
  - swept world blocking + consumed charge,
  - Slide override,
  - slope correction versus wall blocking classification.

Cross-device update:
- PLAT-001 remains CLOSED,
- Dash is the first post-PLAT gameplay action added to both desktop and mobile adaptive input layers,
- future Fire / ADS / Reload / Weapon Switch controls will follow the same pattern.

Verification required:
- npm run dash:test
- npm run slide:test
- npm run landing:test
- npm run jump:test
- npm run crouch:test
- npm run sprint:test
- npm run velocity:test
- npm run movement:test
- npm run look:test
- npm run adaptive-input:test
- npm run foundation:test
- npm run collision:test
- npm run character:test
- npm run build

Browser verification:
- desktop: E performs Dash,
- touch mode: DASH button performs Dash,
- no directional input => camera-forward Dash,
- WASD/joystick direction + Dash => camera-relative directional Dash,
- two rapid legal activations consume 2 -> 1 -> 0 charges,
- holding E/DASH must not consume both charges,
- second activation cannot occur before 0.25 s,
- each consumed charge visibly recharges independently,
- Jump then Dash preserves vertical motion while gravity continues,
- Sprint -> Slide -> Dash cancels Slide,
- Dash into the red cube/wall stops before geometry but still consumes a charge.


## P2-MOVE-008 closure
**PASS / CLOSED ✅**

User verification confirms:
- grounded Dash works very well,
- Air Dash works very well,
- 2 independent recharge timers behave correctly,
- world blocking consumes the charge and stops movement,
- Slide override works,
- desktop E and mobile DASH controls both work,
- full browser/regression acceptance is green.

Air Dash semantics and Dash world collision were implemented and verified inside P2-MOVE-008, so the next dependency pair is Enemy Dummy + Dash Enemy Body Contact.

## P2-MOVE-009 — Enemy Dummy + Soft Separation + Dash Non-Phase-Through
**IMPLEMENTED / AWAITING VERIFICATION**

Canonical Core Gameplay 68C:
- Human players and Bots use the same physical envelope.
- Enemy Body Interaction = soft separation ON.
- Enemy actors must not remain deeply overlapped.
- Separation resolves horizontal capsule overlap only.
- No rigid-body impulse, launch or vertical-velocity transfer.
- Living enemy capsules are not rigid world walls during ordinary locomotion.
- Dash may not phase through a living enemy capsule.
- Dash stops on first enemy-capsule contact before deep overlap.
- Dash charge remains consumed.
- Dash contact causes no damage, knockback, bounce or vertical launch.
- Teammate Dash pass-through remains allowed; teammate non-blocking is the next separate Stage 1 test.

Implementation:
- added one visible Stage 1 enemy dummy using the canonical standing capsule:
  - total height 1.80 m,
  - radius 0.35 m,
  - Red team,
  - default arena position x=8, y=0.91, z=5,
- enemy dummy is registered as a living actor with a stable entity ID,
- enemy dummy is NOT added as rigid Rapier world geometry,
- ordinary locomotion uses deterministic post-movement horizontal capsule separation,
- separation never changes Y position or transfers vertical velocity,
- world-collision CharacterController still owns the final separated placement so separation cannot bypass solid geometry,
- Dash uses a swept horizontal segment-vs-expanded-enemy-capsule test,
- vertical body-band overlap is checked at contact time so an Air Dash above the enemy is not blocked,
- earliest living-enemy contact shortens the Dash movement before overlap,
- enemy-contact Dash ends with dashExitReason = enemy_blocked,
- consumed Dash charge continues its independent recharge,
- no damage/knockback/bounce behavior is introduced,
- debug telemetry exposes:
  - DASH ENEMY,
  - ENEMY SEP,
- enemy-body:test covers:
  - pure horizontal overlap resolution,
  - ordinary movement soft separation,
  - no vertical transfer,
  - Dash charge consumed on enemy block,
  - Dash stops before deep overlap,
  - no phase-through to the far side,
  - vertical non-overlap allows Air Dash above the enemy.

Verification required:
- npm run enemy-body:test
- npm run dash:test
- npm run slide:test
- npm run landing:test
- npm run jump:test
- npm run crouch:test
- npm run sprint:test
- npm run velocity:test
- npm run movement:test
- npm run look:test
- npm run adaptive-input:test
- npm run foundation:test
- npm run collision:test
- npm run character:test
- npm run build

Browser verification:
- a red capsule enemy dummy is visible near x=8, z=5,
- ordinary movement into the dummy should prevent deep overlap without launch/bounce,
- ENEMY SEP should become non-zero on contact,
- approach the dummy, then Dash through it:
  - Dash must stop at the near side,
  - DASH EXIT = enemy_blocked,
  - DASH ENEMY shows the dummy entity ID,
  - one Dash charge is consumed,
  - no vertical launch or bounce occurs.

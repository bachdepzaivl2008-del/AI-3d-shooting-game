export const gameConfig = {
  simulation: {
    fixedDeltaTime: 1 / 60,
    maxFrameTime: 0.1,
    randomSeed: 0x3d5a2026,
  },

  collision: {
    gravity: {
      x: 0,
      y: -20,
      z: 0,
    },

    character: {
      standingHeight: 1.8,
      crouchHeight: 1.2,
      radius: 0.35,
      stepHeight: 0.35,
      maxSlopeDegrees: 45,

      // Technical collision margins for the first prototype.
      controllerOffset: 0.01,
      autostepMinWidth: 0.2,
      snapToGroundDistance: 0.2,
    },
  },

  movement: {
    // Core Gameplay Systems 68B IIV:
    // AR/Base Normal Ground Speed.
    baseSpeed: 5.5,

    // Core Gameplay Systems 68B IIV:
    // Sprint = 1.25x current weapon Normal Movement Speed.
    sprintMultiplier: 1.25,

    // Core Gameplay Systems 68B:
    // crouch uses 60% of current weapon Normal Movement Speed.
    crouchMultiplier: 0.6,

    // Core Gameplay Systems 68B Jump IIVs.
    gravity: 20,
    jumpVerticalVelocity: 6.6,

    // GDD requires reduced air steering and forbids airborne
    // horizontal speed gain. Exact steering responsiveness is not
    // numerically locked, so this is an implementation-owned
    // technical value for the first Jump slice.
    airSteeringRate: 6,

    // Core Gameplay Systems 68B Landing Slowdown IIVs.
    standardLandingRetainMultiplier: 0.85,
    standardLandingRecoverySeconds: 0.18,
    hardLandingImpactSpeed: 10,
    hardLandingRetainMultiplier: 0.70,
    hardLandingRecoverySeconds: 0.30,

    // Core Gameplay Systems 68B Slide IIVs.
    slideEntrySpeed: 6.0,
    slideInitialBoost: 0.4,
    slideInitialMaxSpeed: 9.0,
    slideFlatDeceleration: 2.5,
    slideMaxDuration: 1.20,
    slideExitSpeed: 4.5,

    // Core Gameplay Systems 68B Dash values.
    dashCharges: 2,
    dashDistance: 7.0,
    dashDuration: 0.22,
    dashRechargeSeconds: 4.5,
    dashMinInterval: 0.25,

    // Runtime movement uses Rapier's built-in snap-to-ground directly.
    // The diagnostic sweep proved that any synthetic downward bias can
    // intermittently shorten/zero planar movement ticks at canonical speeds.
    groundSnapBiasPerTick: 0,
  },

  look: {
    // IIV values for the first mouse-look integration pass.
    // Not locked balance values.
    mouseSensitivityRadiansPerPixel: 0.0025,
    maxPitchDegrees: 89,
  },

  input: {
    // Client-only mobile UX values. These do not alter
    // authoritative locomotion rules.
    mobileJoystickRadiusPx: 54,
    mobileAutoSprintThreshold: 0.88,
    mobileLookScale: 1.6,
  },

  client: {
    desktopPixelRatioCap: 2,
    mobilePixelRatioCap: 1.5,
  },

  player: {
    spawnPosition: {
      x: 0,
      y: 0.91,
      z: 5,
    },

    // Core Gameplay Systems 68C canonical eye heights.
    standingEyeHeight: 1.62,
    crouchEyeHeight: 1.0,

    // Presentation-only interpolation rate (implementation-owned).
    // This does not alter the authoritative collider/stance timing.
    cameraEyeTransitionRate: 14,
  },

  world: {
    backgroundColor: 0x87ceeb,
    groundSize: 30,
    groundColor: 0x4f7942,
  },

  camera: {
    fov: 75,
    near: 0.1,
    far: 1000,
  },

  lighting: {
    ambientIntensity: 1,
    directionalIntensity: 2,
    directionalPosition: {
      x: 5,
      y: 10,
      z: 5,
    },
  },

  cube: {
    size: 1,
    color: 0xff4444,
    spinSpeed: 1.5,
    startPosition: {
      x: 0,
      y: 0.5,
      z: 0,
    },
  },
}

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

  player: {
    spawnPosition: {
      x: 0,
      y: 0.91,
      z: 5,
    },

    cameraEyeOffsetY: 0.75,
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

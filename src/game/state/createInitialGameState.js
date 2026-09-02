export function createInitialGameState(config, runtime) {
  return {
    tick: 0,
    time: 0,

    cube: {
      id: runtime.cubeId,
      position: {
        x: config.cube.startPosition.x,
        y: config.cube.startPosition.y,
        z: config.cube.startPosition.z,
      },
      rotationY: 0,
    },

    player: {
      id: runtime.playerId,
      position: {
        x: runtime.playerPosition.x,
        y: runtime.playerPosition.y,
        z: runtime.playerPosition.z,
      },
      orientation: {
        yaw: 0,
        pitch: 0,
      },
      grounded: true,
      sprinting: false,
      lastInputSequence: 0,
    },
  }
}

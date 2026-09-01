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
  }
}

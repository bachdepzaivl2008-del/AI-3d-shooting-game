export function createInitialGameState(config) {
  return {
    time: 0,

    cube: {
      position: {
        x: config.cube.startPosition.x,
        y: config.cube.startPosition.y,
        z: config.cube.startPosition.z,
      },
      rotationY: 0,
    },
  }
}

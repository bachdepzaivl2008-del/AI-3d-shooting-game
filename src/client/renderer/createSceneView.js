import * as THREE from 'three'

export function createSceneView(config) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(
    config.world.backgroundColor
  )

  const camera =
    new THREE.PerspectiveCamera(
      config.camera.fov,
      window.innerWidth /
        window.innerHeight,
      config.camera.near,
      config.camera.far
    )

  const renderer =
    new THREE.WebGLRenderer({
      antialias: true,
    })

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  )

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      2
    )
  )

  document.body.appendChild(
    renderer.domElement
  )

  const groundGeometry =
    new THREE.PlaneGeometry(
      config.world.groundSize,
      config.world.groundSize
    )

  const groundMaterial =
    new THREE.MeshStandardMaterial({
      color:
        config.world.groundColor,
    })

  const ground =
    new THREE.Mesh(
      groundGeometry,
      groundMaterial
    )

  ground.rotation.x =
    -Math.PI / 2

  scene.add(ground)

  const cubeGeometry =
    new THREE.BoxGeometry(
      config.cube.size,
      config.cube.size,
      config.cube.size
    )

  const cubeMaterial =
    new THREE.MeshStandardMaterial({
      color: config.cube.color,
    })

  const cube =
    new THREE.Mesh(
      cubeGeometry,
      cubeMaterial
    )

  scene.add(cube)

  const ambientLight =
    new THREE.AmbientLight(
      0xffffff,
      config.lighting.ambientIntensity
    )

  scene.add(ambientLight)

  const directionalLight =
    new THREE.DirectionalLight(
      0xffffff,
      config.lighting.directionalIntensity
    )

  directionalLight.position.set(
    config.lighting.directionalPosition.x,
    config.lighting.directionalPosition.y,
    config.lighting.directionalPosition.z
  )

  scene.add(directionalLight)

  function syncFromState(state) {
    cube.position.set(
      state.cube.position.x,
      state.cube.position.y,
      state.cube.position.z
    )

    cube.rotation.y =
      state.cube.rotationY

    const player =
      state.player.position

    const orientation =
      state.player.orientation

    const eyeY =
      player.y +
      config.player.cameraEyeOffsetY

    camera.position.set(
      player.x,
      eyeY,
      player.z
    )

    const cosPitch =
      Math.cos(
        orientation.pitch
      )

    const forward = {
      x:
        Math.sin(
          orientation.yaw
        ) * cosPitch,
      y:
        Math.sin(
          orientation.pitch
        ),
      z:
        -Math.cos(
          orientation.yaw
        ) * cosPitch,
    }

    camera.lookAt(
      player.x + forward.x,
      eyeY + forward.y,
      player.z + forward.z
    )
  }

  function render(state) {
    syncFromState(state)
    renderer.render(scene, camera)
  }

  function handleResize() {
    camera.aspect =
      window.innerWidth /
      window.innerHeight

    camera.updateProjectionMatrix()

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    )
  }

  window.addEventListener(
    'resize',
    handleResize
  )

  function dispose() {
    window.removeEventListener(
      'resize',
      handleResize
    )

    groundGeometry.dispose()
    groundMaterial.dispose()
    cubeGeometry.dispose()
    cubeMaterial.dispose()
    renderer.dispose()
  }

  return {
    render,
    dispose,
    inputElement:
      renderer.domElement,
  }
}

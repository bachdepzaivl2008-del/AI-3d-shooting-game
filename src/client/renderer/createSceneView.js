import * as THREE from 'three'
import { detectClientProfile } from '../device/clientProfile.js'

export function createSceneView(config) {
  const clientProfile =
    detectClientProfile()

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

  const pixelRatioCap =
    clientProfile.touchPrimary
      ? config.client.mobilePixelRatioCap
      : config.client.desktopPixelRatioCap

  renderer.setPixelRatio(
    Math.min(
      window.devicePixelRatio,
      pixelRatioCap
    )
  )

  document.body.appendChild(
    renderer.domElement
  )

  const characterConfig =
    config.collision.character

  const standingEyeOffset =
    config.player.standingEyeHeight -
    characterConfig.standingHeight / 2 -
    characterConfig.controllerOffset

  const crouchEyeOffset =
    config.player.crouchEyeHeight -
    characterConfig.crouchHeight / 2 -
    characterConfig.controllerOffset

  let currentEyeOffset =
    standingEyeOffset

  let lastRenderTime =
    performance.now()

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

  const enemyRadius =
    characterConfig.radius

  const enemyCylinderHeight =
    Math.max(
      0,
      characterConfig.standingHeight -
        enemyRadius * 2
    )

  const enemyCapOffset =
    enemyCylinderHeight / 2

  const enemyCylinderGeometry =
    new THREE.CylinderGeometry(
      enemyRadius,
      enemyRadius,
      enemyCylinderHeight,
      16
    )

  const enemyCapGeometry =
    new THREE.SphereGeometry(
      enemyRadius,
      16,
      10
    )

  const enemyMaterial =
    new THREE.MeshStandardMaterial({
      color:
        config.testArena.enemyDummy.color,
    })

  const enemyDummy =
    new THREE.Group()

  const enemyCylinder =
    new THREE.Mesh(
      enemyCylinderGeometry,
      enemyMaterial
    )

  const enemyTop =
    new THREE.Mesh(
      enemyCapGeometry,
      enemyMaterial
    )

  const enemyBottom =
    new THREE.Mesh(
      enemyCapGeometry,
      enemyMaterial
    )

  enemyTop.position.y =
    enemyCapOffset

  enemyBottom.position.y =
    -enemyCapOffset

  enemyDummy.add(
    enemyCylinder,
    enemyTop,
    enemyBottom
  )

  scene.add(enemyDummy)

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

    if (state.enemyDummy) {
      enemyDummy.visible =
        state.enemyDummy.alive

      enemyDummy.position.set(
        state.enemyDummy.position.x,
        state.enemyDummy.position.y,
        state.enemyDummy.position.z
      )
    } else {
      enemyDummy.visible = false
    }

    const player =
      state.player.position

    const orientation =
      state.player.orientation

    const now = performance.now()
    const deltaTime =
      Math.min(
        (now - lastRenderTime) / 1000,
        0.1
      )

    lastRenderTime = now

    const targetEyeOffset =
      state.player.crouched
        ? crouchEyeOffset
        : standingEyeOffset

    const transitionAlpha =
      1 -
      Math.exp(
        -config.player
          .cameraEyeTransitionRate *
        deltaTime
      )

    currentEyeOffset +=
      (targetEyeOffset -
        currentEyeOffset) *
      transitionAlpha

    const eyeY =
      player.y +
      currentEyeOffset

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
    enemyCylinderGeometry.dispose()
    enemyCapGeometry.dispose()
    enemyMaterial.dispose()
    renderer.dispose()
  }

  return {
    render,
    dispose,
    inputElement:
      renderer.domElement,
  }
}

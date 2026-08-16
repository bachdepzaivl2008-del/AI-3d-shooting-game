import * as THREE from 'three'
import './style.css'

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x87ceeb)

// Camera
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
)

camera.position.set(5, 5, 8)
camera.lookAt(0, 0, 0)

// Renderer
const renderer = new THREE.WebGLRenderer({
  antialias: true,
})

renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

document.body.appendChild(renderer.domElement)

// Ground
const groundGeometry = new THREE.PlaneGeometry(30, 30)

const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x4f7942,
})

const ground = new THREE.Mesh(
  groundGeometry,
  groundMaterial
)

ground.rotation.x = -Math.PI / 2
scene.add(ground)

// Test cube
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1)

const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0xff4444,
})

const cube = new THREE.Mesh(
  cubeGeometry,
  cubeMaterial
)

cube.position.y = 0.5
scene.add(cube)

// Lighting
const ambientLight = new THREE.AmbientLight(
  0xffffff,
  1
)

scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(
  0xffffff,
  2
)

directionalLight.position.set(5, 10, 5)
scene.add(directionalLight)

// Resize
window.addEventListener('resize', () => {
  camera.aspect =
    window.innerWidth / window.innerHeight

  camera.updateProjectionMatrix()

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  )
})

// Game loop
function animate() {
  requestAnimationFrame(animate)

  cube.rotation.y += 0.01

  renderer.render(scene, camera)
}

animate()
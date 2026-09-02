import { loadRapier } from './loadRapier.js'

export class RapierCollisionWorld {
  static async create(config) {
    const RAPIER = await loadRapier()
    return new RapierCollisionWorld(RAPIER, config)
  }

  constructor(RAPIER, config) {
    this.RAPIER = RAPIER
    this.config = config
    this.world = new RAPIER.World(config.gravity)
    this.world.timestep = config.fixedDeltaTime
    this.characterControllers = new Set()
  }

  createStaticBox({ center, halfExtents, rotation = null }) {
    let desc = this.RAPIER.ColliderDesc.cuboid(
      halfExtents.x,
      halfExtents.y,
      halfExtents.z
    ).setTranslation(center.x, center.y, center.z)

    if (rotation) {
      desc = desc.setRotation(rotation)
    }

    return this.world.createCollider(desc)
  }

  createStaticTrimesh({ vertices, indices }) {
    const desc = this.RAPIER.ColliderDesc.trimesh(
      new Float32Array(vertices),
      new Uint32Array(indices),
      this.RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES
    )

    return this.world.createCollider(desc)
  }

  createKinematicCapsule({
    position,
    totalHeight,
    radius,
    controllerOffset,
    maxSlopeClimbAngle,
    stepHeight,
    autostepMinWidth,
    snapToGroundDistance,
  }) {
    const halfHeight = Math.max(
      0,
      (totalHeight - radius * 2) / 2
    )

    const colliderDesc = this.RAPIER.ColliderDesc.capsule(
      halfHeight,
      radius
    ).setTranslation(
      position.x,
      position.y,
      position.z
    )

    // CharacterController is driven directly by the collider.
    // This avoids the extra kinematic-body contact-resolution step,
    // which can intermittently drop/shorten grounded movement ticks.
    const collider = this.world.createCollider(
      colliderDesc
    )

    const controller =
      this.world.createCharacterController(controllerOffset)

    controller.setSlideEnabled(true)
    controller.setMaxSlopeClimbAngle(maxSlopeClimbAngle)
    controller.enableAutostep(
      stepHeight,
      autostepMinWidth,
      false
    )
    controller.enableSnapToGround(snapToGroundDistance)

    this.characterControllers.add(controller)

    return {
      collider,
      controller,
      totalHeight,
      radius,
    }
  }

  step() {
    this.world.step()
  }

  prepareQueries() {
    this.step()
  }

  computeCharacterMovement(character, desiredTranslation) {
    character.controller.computeColliderMovement(
      character.collider,
      desiredTranslation
    )

    const movement = character.controller.computedMovement()

    return {
      x: movement.x,
      y: movement.y,
      z: movement.z,
      grounded: character.controller.computedGrounded(),
    }
  }

  getCharacterPosition(character) {
    const position = character.collider.translation()

    return {
      x: position.x,
      y: position.y,
      z: position.z,
    }
  }

  createCapsuleShape(totalHeight, radius) {
    const halfHeight = Math.max(
      0,
      (totalHeight - radius * 2) / 2
    )

    return new this.RAPIER.Capsule(
      halfHeight,
      radius
    )
  }

  canResizeCharacterHeight(character, totalHeight) {
    if (totalHeight <= character.totalHeight) {
      return true
    }

    const current =
      this.getCharacterPosition(character)

    const bottomY =
      current.y -
      character.totalHeight / 2

    const targetPosition = {
      x: current.x,
      y:
        bottomY +
        totalHeight / 2,
      z: current.z,
    }

    const targetShape =
      this.createCapsuleShape(
        totalHeight,
        character.radius
      )

    const hit =
      this.world.intersectionWithShape(
        targetPosition,
        {
          x: 0,
          y: 0,
          z: 0,
          w: 1,
        },
        targetShape,
        undefined,
        undefined,
        character.collider
      )

    return hit === null
  }

  setCharacterHeight(character, totalHeight) {
    if (
      totalHeight ===
      character.totalHeight
    ) {
      return this.getCharacterPosition(
        character
      )
    }

    const current =
      this.getCharacterPosition(character)

    const bottomY =
      current.y -
      character.totalHeight / 2

    const targetPosition = {
      x: current.x,
      y:
        bottomY +
        totalHeight / 2,
      z: current.z,
    }

    character.collider.setShape(
      this.createCapsuleShape(
        totalHeight,
        character.radius
      )
    )

    character.collider.setTranslation(
      targetPosition
    )

    character.totalHeight =
      totalHeight

    this.world.step()

    return this.getCharacterPosition(
      character
    )
  }

  applyCharacterMovement(character, movement) {
    const current = character.collider.translation()

    character.collider.setTranslation({
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    })

    this.world.step()

    return this.getCharacterPosition(character)
  }

  castRay(origin, direction, maxDistance, solid = true) {
    const ray = new this.RAPIER.Ray(origin, direction)
    const hit = this.world.castRay(
      ray,
      maxDistance,
      solid
    )

    if (!hit) {
      return null
    }

    const point = ray.pointAt(hit.timeOfImpact)

    return {
      timeOfImpact: hit.timeOfImpact,
      point: {
        x: point.x,
        y: point.y,
        z: point.z,
      },
      colliderHandle: hit.collider.handle,
    }
  }

  dispose() {
    for (const controller of this.characterControllers) {
      this.world.removeCharacterController(controller)
    }

    this.characterControllers.clear()
    this.world.free()
  }
}

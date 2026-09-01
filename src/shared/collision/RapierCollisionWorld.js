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

    const bodyDesc =
      this.RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(position.x, position.y, position.z)

    const body = this.world.createRigidBody(bodyDesc)

    const colliderDesc = this.RAPIER.ColliderDesc.capsule(
      halfHeight,
      radius
    )

    const collider = this.world.createCollider(
      colliderDesc,
      body
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
      body,
      collider,
      controller,
      totalHeight,
      radius,
    }
  }

  prepareQueries() {
    this.world.step()
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

  applyCharacterMovement(character, movement) {
    const current = character.body.translation()

    character.body.setNextKinematicTranslation({
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    })

    this.world.step()

    const updated = character.body.translation()

    return {
      x: updated.x,
      y: updated.y,
      z: updated.z,
    }
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

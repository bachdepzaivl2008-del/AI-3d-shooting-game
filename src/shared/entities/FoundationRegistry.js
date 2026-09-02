import { StableIdAllocator } from '../ids/StableIdAllocator.js'

export function createGameIdAllocators() {
  return {
    entity: new StableIdAllocator('entity'),
    combatSlot: new StableIdAllocator('combat-slot'),
    spawnPoint: new StableIdAllocator('spawn-point'),
    worldItem: new StableIdAllocator('world-item'),
  }
}

export class EntityRegistry {
  constructor(idAllocator = new StableIdAllocator('entity')) {
    this.idAllocator = idAllocator
    this.entities = new Map()
  }

  create(data = {}) {
    const entity = {
      id: this.idAllocator.next(),
      ...data,
    }

    this.entities.set(entity.id, entity)
    return entity
  }

  get(id) {
    return this.entities.get(id) ?? null
  }

  has(id) {
    return this.entities.has(id)
  }

  destroy(id) {
    return this.entities.delete(id)
  }

  get size() {
    return this.entities.size
  }
}

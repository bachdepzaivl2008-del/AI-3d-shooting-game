import RAPIER from '@dimforge/rapier3d-compat'

let initializationPromise = null

export async function loadRapier() {
  if (!initializationPromise) {
    initializationPromise = RAPIER.init().then(() => RAPIER)
  }

  return initializationPromise
}

import { runSharedCollisionProbe } from '../../shared/collision/runSharedCollisionProbe.js'

export async function runCollisionBrowserProbe(config) {
  const result = await runSharedCollisionProbe(config)

  if (!result.groundRayHit || !result.blockedByWall) {
    throw new Error(
      'Browser collision probe failed: shared Rapier collision did not behave as expected'
    )
  }

  console.info('Browser collision probe: PASS', result)
  return result
}

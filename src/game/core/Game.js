import { LocalAuthorityHost } from './LocalAuthorityHost.js'
import { createSceneView } from '../../client/renderer/createSceneView.js'
import { BrowserInputSource } from '../../client/input/BrowserInputSource.js'
import { DebugOverlay } from '../../client/debug/DebugOverlay.js'

export class Game {
  static async create(config) {
    const authority =
      await LocalAuthorityHost.create(config)

    return new Game(config, authority)
  }

  constructor(config, authority) {
    this.config = config
    this.authority = authority

    this.sceneView =
      createSceneView(config)

    this.inputSource =
      new BrowserInputSource(
        this.sceneView.inputElement
      )

    this.debugOverlay =
      new DebugOverlay()

    this.lastFrameTime = 0
    this.accumulator = 0
    this.animationFrameId = null
    this.isRunning = false

    this.loop = this.loop.bind(this)
  }

  start() {
    if (this.isRunning) return

    this.isRunning = true
    this.lastFrameTime = performance.now()

    this.animationFrameId =
      requestAnimationFrame(this.loop)
  }

  loop(now) {
    if (!this.isRunning) return

    const rawDeltaTime =
      (now - this.lastFrameTime) / 1000

    this.lastFrameTime = now

    const frameDeltaTime = Math.min(
      rawDeltaTime,
      this.config.simulation.maxFrameTime
    )

    this.accumulator += frameDeltaTime

    while (
      this.accumulator >=
      this.config.simulation.fixedDeltaTime
    ) {
      this.authority.submitIntent(
        this.inputSource.sampleIntent()
      )

      this.authority.step()

      this.accumulator -=
        this.config.simulation.fixedDeltaTime
    }

    const state =
      this.authority.getState()

    this.sceneView.render(state)
    this.debugOverlay.update(state, now)

    this.animationFrameId =
      requestAnimationFrame(this.loop)
  }

  stop() {
    this.isRunning = false

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(
        this.animationFrameId
      )

      this.animationFrameId = null
    }

    this.inputSource.dispose()
    this.debugOverlay.dispose()
    this.sceneView.dispose()
    this.authority.dispose()
  }
}

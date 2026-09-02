import { IntentSequencer } from '../../shared/intents/IntentSequencer.js'

export class BrowserInputSource {
  constructor(
    inputElement,
    sourceId = 'client:local-player'
  ) {
    this.inputElement = inputElement
    this.keys = new Set()
    this.sequencer = new IntentSequencer(sourceId)

    this.mouseDeltaX = 0
    this.mouseDeltaY = 0

    this.handleKeyDown =
      this.handleKeyDown.bind(this)

    this.handleKeyUp =
      this.handleKeyUp.bind(this)

    this.handleBlur =
      this.handleBlur.bind(this)

    this.handleMouseMove =
      this.handleMouseMove.bind(this)

    this.handlePointerLockRequest =
      this.handlePointerLockRequest.bind(this)

    window.addEventListener(
      'keydown',
      this.handleKeyDown
    )

    window.addEventListener(
      'keyup',
      this.handleKeyUp
    )

    window.addEventListener(
      'blur',
      this.handleBlur
    )

    document.addEventListener(
      'mousemove',
      this.handleMouseMove
    )

    this.inputElement.addEventListener(
      'click',
      this.handlePointerLockRequest
    )
  }

  handleKeyDown(event) {
    this.keys.add(event.code)
  }

  handleKeyUp(event) {
    this.keys.delete(event.code)
  }

  handleBlur() {
    this.keys.clear()
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
  }

  handlePointerLockRequest() {
    if (
      document.pointerLockElement !==
      this.inputElement
    ) {
      this.inputElement
        .requestPointerLock?.()
    }
  }

  handleMouseMove(event) {
    if (
      document.pointerLockElement !==
      this.inputElement
    ) {
      return
    }

    this.mouseDeltaX += event.movementX
    this.mouseDeltaY += event.movementY
  }

  sampleIntent() {
    const moveX =
      (this.keys.has('KeyD') ? 1 : 0) -
      (this.keys.has('KeyA') ? 1 : 0)

    const moveY =
      (this.keys.has('KeyW') ? 1 : 0) -
      (this.keys.has('KeyS') ? 1 : 0)

    const lookDeltaX = this.mouseDeltaX
    const lookDeltaY = this.mouseDeltaY

    this.mouseDeltaX = 0
    this.mouseDeltaY = 0

    return this.sequencer.create('PLAYER_INPUT', {
      moveX,
      moveY,
      lookDeltaX,
      lookDeltaY,
      jump: this.keys.has('Space'),
      sprint:
        this.keys.has('ShiftLeft') ||
        this.keys.has('ShiftRight'),
      crouch:
        this.keys.has('ControlLeft') ||
        this.keys.has('ControlRight'),
    })
  }

  dispose() {
    window.removeEventListener(
      'keydown',
      this.handleKeyDown
    )

    window.removeEventListener(
      'keyup',
      this.handleKeyUp
    )

    window.removeEventListener(
      'blur',
      this.handleBlur
    )

    document.removeEventListener(
      'mousemove',
      this.handleMouseMove
    )

    this.inputElement.removeEventListener(
      'click',
      this.handlePointerLockRequest
    )

    this.keys.clear()
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
  }
}

import { IntentSequencer } from '../../shared/intents/IntentSequencer.js'

export class BrowserInputSource {
  constructor(sourceId = 'client:local-player') {
    this.keys = new Set()
    this.sequencer = new IntentSequencer(sourceId)

    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    this.handleBlur = this.handleBlur.bind(this)

    window.addEventListener('keydown', this.handleKeyDown)
    window.addEventListener('keyup', this.handleKeyUp)
    window.addEventListener('blur', this.handleBlur)
  }

  handleKeyDown(event) {
    this.keys.add(event.code)
  }

  handleKeyUp(event) {
    this.keys.delete(event.code)
  }

  handleBlur() {
    this.keys.clear()
  }

  sampleIntent() {
    const moveX =
      (this.keys.has('KeyD') ? 1 : 0) -
      (this.keys.has('KeyA') ? 1 : 0)

    const moveY =
      (this.keys.has('KeyW') ? 1 : 0) -
      (this.keys.has('KeyS') ? 1 : 0)

    return this.sequencer.create('PLAYER_INPUT', {
      moveX,
      moveY,
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
    window.removeEventListener('keydown', this.handleKeyDown)
    window.removeEventListener('keyup', this.handleKeyUp)
    window.removeEventListener('blur', this.handleBlur)
    this.keys.clear()
  }
}

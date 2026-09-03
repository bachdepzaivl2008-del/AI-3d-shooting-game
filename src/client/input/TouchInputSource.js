import { IntentSequencer } from '../../shared/intents/IntentSequencer.js'
import {
  normalizeTouchJoystick,
  shouldAutoSprint,
} from './touchControlMath.js'

function createElement(
  className,
  text = ''
) {
  const element =
    document.createElement('div')

  element.className = className
  element.textContent = text

  return element
}

export class TouchInputSource {
  constructor(
    inputElement,
    config,
    sourceId = 'client:local-player'
  ) {
    this.inputElement = inputElement
    this.config = config
    this.sequencer =
      new IntentSequencer(sourceId)

    this.moveX = 0
    this.moveY = 0
    this.moveMagnitude = 0

    this.lookDeltaX = 0
    this.lookDeltaY = 0

    this.jump = false
    this.crouch = false
    this.dash = false

    this.movePointerId = null
    this.moveOrigin = {
      x: 0,
      y: 0,
    }

    this.lookPointerId = null
    this.lookPrevious = {
      x: 0,
      y: 0,
    }

    this.root =
      createElement(
        'mobile-controls'
      )

    this.moveZone =
      createElement(
        'mobile-move-zone'
      )

    this.lookZone =
      createElement(
        'mobile-look-zone'
      )

    this.joystickBase =
      createElement(
        'mobile-joystick-base'
      )

    this.joystickKnob =
      createElement(
        'mobile-joystick-knob'
      )

    this.jumpButton =
      createElement(
        'mobile-action-button mobile-jump-button',
        'JUMP'
      )

    this.crouchButton =
      createElement(
        'mobile-action-button mobile-crouch-button',
        'CROUCH'
      )

    this.dashButton =
      createElement(
        'mobile-action-button mobile-dash-button',
        'DASH'
      )

    this.orientationHint =
      createElement(
        'mobile-orientation-hint',
        'Rotate your phone to landscape'
      )

    this.joystickBase.appendChild(
      this.joystickKnob
    )

    this.root.append(
      this.moveZone,
      this.lookZone,
      this.joystickBase,
      this.jumpButton,
      this.crouchButton,
      this.dashButton,
      this.orientationHint
    )

    document.body.appendChild(
      this.root
    )

    this.handleMovePointerDown =
      this.handleMovePointerDown.bind(
        this
      )

    this.handleMovePointerMove =
      this.handleMovePointerMove.bind(
        this
      )

    this.handleMovePointerUp =
      this.handleMovePointerUp.bind(
        this
      )

    this.handleLookPointerDown =
      this.handleLookPointerDown.bind(
        this
      )

    this.handleLookPointerMove =
      this.handleLookPointerMove.bind(
        this
      )

    this.handleLookPointerUp =
      this.handleLookPointerUp.bind(
        this
      )

    this.handleWindowBlur =
      this.handleWindowBlur.bind(this)

    this.handleContextMenu =
      this.handleContextMenu.bind(this)

    this.moveZone.addEventListener(
      'pointerdown',
      this.handleMovePointerDown
    )

    this.moveZone.addEventListener(
      'pointermove',
      this.handleMovePointerMove
    )

    this.moveZone.addEventListener(
      'pointerup',
      this.handleMovePointerUp
    )

    this.moveZone.addEventListener(
      'pointercancel',
      this.handleMovePointerUp
    )

    this.lookZone.addEventListener(
      'pointerdown',
      this.handleLookPointerDown
    )

    this.lookZone.addEventListener(
      'pointermove',
      this.handleLookPointerMove
    )

    this.lookZone.addEventListener(
      'pointerup',
      this.handleLookPointerUp
    )

    this.lookZone.addEventListener(
      'pointercancel',
      this.handleLookPointerUp
    )

    this.bindHoldButton(
      this.jumpButton,
      'jump'
    )

    this.bindHoldButton(
      this.crouchButton,
      'crouch'
    )

    this.bindHoldButton(
      this.dashButton,
      'dash'
    )

    window.addEventListener(
      'blur',
      this.handleWindowBlur
    )

    document.addEventListener(
      'contextmenu',
      this.handleContextMenu
    )

    document.body.classList.add(
      'touch-controls-active'
    )
  }

  bindHoldButton(
    element,
    property
  ) {
    const press = (event) => {
      event.preventDefault()
      event.stopPropagation()

      element.setPointerCapture?.(
        event.pointerId
      )

      this[property] = true
      element.classList.add(
        'is-active'
      )
    }

    const release = (event) => {
      event.preventDefault()
      event.stopPropagation()

      this[property] = false
      element.classList.remove(
        'is-active'
      )
    }

    element.addEventListener(
      'pointerdown',
      press
    )

    element.addEventListener(
      'pointerup',
      release
    )

    element.addEventListener(
      'pointercancel',
      release
    )

    element.addEventListener(
      'lostpointercapture',
      release
    )

    element.__touchControlPress =
      press

    element.__touchControlRelease =
      release
  }

  unbindHoldButton(element) {
    const press =
      element.__touchControlPress

    const release =
      element.__touchControlRelease

    if (press) {
      element.removeEventListener(
        'pointerdown',
        press
      )
    }

    if (release) {
      element.removeEventListener(
        'pointerup',
        release
      )

      element.removeEventListener(
        'pointercancel',
        release
      )

      element.removeEventListener(
        'lostpointercapture',
        release
      )
    }
  }

  handleContextMenu(event) {
    event.preventDefault()
  }

  handleMovePointerDown(event) {
    if (
      this.movePointerId !== null
    ) {
      return
    }

    event.preventDefault()

    this.movePointerId =
      event.pointerId

    this.moveOrigin = {
      x: event.clientX,
      y: event.clientY,
    }

    this.moveZone.setPointerCapture?.(
      event.pointerId
    )

    this.joystickBase.classList.add(
      'is-visible'
    )

    this.joystickBase.style.left =
      `${event.clientX}px`

    this.joystickBase.style.top =
      `${event.clientY}px`

    this.updateMoveFromPointer(
      event.clientX,
      event.clientY
    )
  }

  handleMovePointerMove(event) {
    if (
      event.pointerId !==
      this.movePointerId
    ) {
      return
    }

    event.preventDefault()

    this.updateMoveFromPointer(
      event.clientX,
      event.clientY
    )
  }

  updateMoveFromPointer(
    clientX,
    clientY
  ) {
    const radius =
      this.config.input
        .mobileJoystickRadiusPx

    const joystick =
      normalizeTouchJoystick(
        clientX -
          this.moveOrigin.x,
        clientY -
          this.moveOrigin.y,
        radius
      )

    this.moveX =
      joystick.moveX

    this.moveY =
      joystick.moveY

    this.moveMagnitude =
      joystick.magnitude

    this.joystickKnob.style.transform =
      `translate(${joystick.clampedX}px, ${joystick.clampedY}px)`
  }

  handleMovePointerUp(event) {
    if (
      event.pointerId !==
      this.movePointerId
    ) {
      return
    }

    event.preventDefault()

    this.movePointerId = null
    this.moveX = 0
    this.moveY = 0
    this.moveMagnitude = 0

    this.joystickKnob.style.transform =
      'translate(0px, 0px)'

    this.joystickBase.classList.remove(
      'is-visible'
    )
  }

  handleLookPointerDown(event) {
    if (
      this.lookPointerId !== null
    ) {
      return
    }

    event.preventDefault()

    this.lookPointerId =
      event.pointerId

    this.lookPrevious = {
      x: event.clientX,
      y: event.clientY,
    }

    this.lookZone.setPointerCapture?.(
      event.pointerId
    )
  }

  handleLookPointerMove(event) {
    if (
      event.pointerId !==
      this.lookPointerId
    ) {
      return
    }

    event.preventDefault()

    const scale =
      this.config.input
        .mobileLookScale

    this.lookDeltaX +=
      (
        event.clientX -
        this.lookPrevious.x
      ) * scale

    this.lookDeltaY +=
      (
        event.clientY -
        this.lookPrevious.y
      ) * scale

    this.lookPrevious = {
      x: event.clientX,
      y: event.clientY,
    }
  }

  handleLookPointerUp(event) {
    if (
      event.pointerId !==
      this.lookPointerId
    ) {
      return
    }

    event.preventDefault()

    this.lookPointerId = null
  }

  handleWindowBlur() {
    this.reset()
  }

  reset() {
    this.movePointerId = null
    this.lookPointerId = null

    this.moveX = 0
    this.moveY = 0
    this.moveMagnitude = 0

    this.lookDeltaX = 0
    this.lookDeltaY = 0

    this.jump = false
    this.crouch = false
    this.dash = false

    this.joystickKnob.style.transform =
      'translate(0px, 0px)'

    this.joystickBase.classList.remove(
      'is-visible'
    )

    this.jumpButton.classList.remove(
      'is-active'
    )

    this.crouchButton.classList.remove(
      'is-active'
    )

    this.dashButton.classList.remove(
      'is-active'
    )
  }

  sampleIntent() {
    const lookDeltaX =
      this.lookDeltaX

    const lookDeltaY =
      this.lookDeltaY

    this.lookDeltaX = 0
    this.lookDeltaY = 0

    const sprint =
      shouldAutoSprint(
        this.moveMagnitude,
        this.config.input
          .mobileAutoSprintThreshold
      )

    return this.sequencer.create(
      'PLAYER_INPUT',
      {
        moveX: this.moveX,
        moveY: this.moveY,
        lookDeltaX,
        lookDeltaY,
        jump: this.jump,
        sprint,
        crouch: this.crouch,
        dash: this.dash,
      }
    )
  }

  dispose() {
    this.moveZone.removeEventListener(
      'pointerdown',
      this.handleMovePointerDown
    )

    this.moveZone.removeEventListener(
      'pointermove',
      this.handleMovePointerMove
    )

    this.moveZone.removeEventListener(
      'pointerup',
      this.handleMovePointerUp
    )

    this.moveZone.removeEventListener(
      'pointercancel',
      this.handleMovePointerUp
    )

    this.lookZone.removeEventListener(
      'pointerdown',
      this.handleLookPointerDown
    )

    this.lookZone.removeEventListener(
      'pointermove',
      this.handleLookPointerMove
    )

    this.lookZone.removeEventListener(
      'pointerup',
      this.handleLookPointerUp
    )

    this.lookZone.removeEventListener(
      'pointercancel',
      this.handleLookPointerUp
    )

    this.unbindHoldButton(
      this.jumpButton
    )

    this.unbindHoldButton(
      this.crouchButton
    )

    this.unbindHoldButton(
      this.dashButton
    )

    window.removeEventListener(
      'blur',
      this.handleWindowBlur
    )

    document.removeEventListener(
      'contextmenu',
      this.handleContextMenu
    )

    document.body.classList.remove(
      'touch-controls-active'
    )

    this.root.remove()
  }
}

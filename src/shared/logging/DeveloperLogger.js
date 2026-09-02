export class DeveloperLogger {
  constructor(scope = 'game') {
    this.scope = scope
  }

  format(message) {
    return `[${this.scope}] ${message}`
  }

  info(message, data) {
    data === undefined
      ? console.info(this.format(message))
      : console.info(this.format(message), data)
  }

  warn(message, data) {
    data === undefined
      ? console.warn(this.format(message))
      : console.warn(this.format(message), data)
  }

  error(message, error) {
    error === undefined
      ? console.error(this.format(message))
      : console.error(this.format(message), error)
  }
}

const BOUNDARY_KEY =
  '__arenaShooterGlobalErrorBoundary__'

export function installGlobalErrorBoundary(
  logger = new DeveloperLogger('global')
) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  if (window[BOUNDARY_KEY]) {
    return window[BOUNDARY_KEY]
  }

  const onError = (event) => {
    logger.error(
      'Unhandled browser error',
      event.error ?? event.message
    )
  }

  const onRejection = (event) => {
    logger.error(
      'Unhandled promise rejection',
      event.reason
    )
  }

  window.addEventListener('error', onError)
  window.addEventListener(
    'unhandledrejection',
    onRejection
  )

  const dispose = () => {
    window.removeEventListener('error', onError)
    window.removeEventListener(
      'unhandledrejection',
      onRejection
    )
    delete window[BOUNDARY_KEY]
  }

  window[BOUNDARY_KEY] = dispose
  return dispose
}

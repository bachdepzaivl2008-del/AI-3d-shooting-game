export function resolveInputMode({
  maxTouchPoints = 0,
  coarsePointer = false,
  hoverNone = false,
  forcedMode = null,
} = {}) {
  if (
    forcedMode === 'touch' ||
    forcedMode === 'desktop'
  ) {
    return forcedMode
  }

  const touchCapable =
    Number.isFinite(maxTouchPoints) &&
    maxTouchPoints > 0

  return (
    touchCapable &&
    (coarsePointer || hoverNone)
      ? 'touch'
      : 'desktop'
  )
}

export function detectClientProfile() {
  const queryMode =
    new URLSearchParams(
      window.location.search
    ).get('input')

  const forcedMode =
    queryMode === 'touch' ||
    queryMode === 'desktop'
      ? queryMode
      : null

  const maxTouchPoints =
    navigator.maxTouchPoints ?? 0

  const coarsePointer =
    window.matchMedia?.(
      '(pointer: coarse)'
    ).matches ?? false

  const hoverNone =
    window.matchMedia?.(
      '(hover: none)'
    ).matches ?? false

  const inputMode =
    resolveInputMode({
      maxTouchPoints,
      coarsePointer,
      hoverNone,
      forcedMode,
    })

  return {
    inputMode,
    touchPrimary:
      inputMode === 'touch',
    maxTouchPoints,
    coarsePointer,
    hoverNone,
    forcedMode,
  }
}

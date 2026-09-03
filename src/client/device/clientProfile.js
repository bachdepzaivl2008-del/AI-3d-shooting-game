export function resolveInputMode({
  maxTouchPoints = 0,
  coarsePointer = false,
  hoverNone = false,
} = {}) {
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
    })

  return {
    inputMode,
    touchPrimary:
      inputMode === 'touch',
    maxTouchPoints,
    coarsePointer,
    hoverNone,
  }
}

// Motion preference helper. Behaviour (not just CSS) uses this: under reduce,
// swipes change the item without following the gesture.
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// One paging settle as a single decelerating move of the whole row: from the
// given offset (where the finger left the row, or one item width away for a
// footer press) to rest. The Web Animations API runs it imperatively, so a
// press during a running settle drops that move and starts the next one with
// no class to restart and no frame to wait.
export const SETTLE_MS = 190
export const SETTLE_EASE = 'cubic-bezier(0.4, 0.3, 0.5, 1)'

export function slideRow(row, fromPx, onfinish) {
  const animation = row.animate(
    [
      { transform: `translateX(${fromPx}px)` },
      { transform: 'translateX(0px)' },
    ],
    { duration: SETTLE_MS, easing: SETTLE_EASE },
  )
  animation.onfinish = () => {
    animation.onfinish = null
    onfinish?.()
  }
  return animation
}

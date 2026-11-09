// Motion preference helper. Behaviour (not just CSS) uses this: under reduce,
// swipes change the item without following the gesture.
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

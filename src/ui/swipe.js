// Swipe resolution: the release-side rules both gesture surfaces share. A
// horizontal drag past the threshold counts as a gesture; anything shorter
// names nothing at all. The result names where the finger travelled, not what
// the screen should do — `drag.js` maps it to each screen's own move, and the
// views carry the pixels.
export const SWIPE_THRESHOLD = 72

export function resolveSwipe(dx, threshold = SWIPE_THRESHOLD) {
  if (dx <= -threshold) return 'left'
  if (dx >= threshold) return 'right'
  return null
}

// Gesture paging belongs to the phone layout. Above this width the reader is a
// desktop column where selecting and copying text matters more than swiping,
// so only the 上一個 / 下一個 controls change the word.
export const GESTURE_MAX_WIDTH = 550

export function swipeEnabled(viewportWidth) {
  return viewportWidth <= GESTURE_MAX_WIDTH
}

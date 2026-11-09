// Swipe resolution. A horizontal drag past the threshold counts as a gesture;
// anything shorter springs back. The result names where the finger travelled,
// not what the screen should do: each screen maps it to its own command.
export const SWIPE_THRESHOLD = 72
export const SWIPE_MAX = 140

export function resolveSwipe(dx, threshold = SWIPE_THRESHOLD) {
  if (dx <= -threshold) return 'left'
  if (dx >= threshold) return 'right'
  return null
}

// Both study screens page towards the hand: dragging right-to-left pulls the
// next item in, dragging left-to-right goes back.
export const READER_SWIPE = { left: 'next', right: 'prev' }
export const CARD_SWIPE = { left: 'next', right: 'prev' }

export function readerDirection(dx, threshold = SWIPE_THRESHOLD) {
  const gesture = resolveSwipe(dx, threshold)
  return gesture ? READER_SWIPE[gesture] : null
}

export function cardDirection(dx, threshold = SWIPE_THRESHOLD) {
  const gesture = resolveSwipe(dx, threshold)
  return gesture ? CARD_SWIPE[gesture] : null
}

export function clampDrag(dx, max = SWIPE_MAX) {
  return Math.max(-max, Math.min(max, dx))
}

// Gesture paging belongs to the phone layout. Above this width the reader is a
// desktop column where selecting and copying text matters more than swiping,
// so only the 上一個 / 下一個 controls change the word.
export const GESTURE_MAX_WIDTH = 550

export function swipeEnabled(viewportWidth) {
  return viewportWidth <= GESTURE_MAX_WIDTH
}

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

// The first card has nothing behind it. It still follows the finger a little,
// with resistance, so the gesture reads as a wall rather than a dead screen:
// the offset grows at a third of the drag and stops well short of the threshold.
// The last card is not damped, because leaving it finishes the run.
export const EDGE_RESIST_RATIO = 1 / 3
export const EDGE_RESIST_MAX = 40

export function resistDrag(dx, ratio = EDGE_RESIST_RATIO, max = EDGE_RESIST_MAX) {
  return Math.max(-max, Math.min(max, dx * ratio))
}

// What a card follows during a drag, and where that drag points. `atFirst`
// is the first-card wall: a right-hand drag there is damped and names no
// direction, so the card springs back instead of changing.
export function cardDrag(dx, { atFirst = false, max = SWIPE_MAX } = {}) {
  if (atFirst && dx > 0) return resistDrag(dx)
  return clampDrag(dx, max)
}

export function cardDirectionAt(dx, { atFirst = false } = {}) {
  if (atFirst && dx > 0) return null
  return cardDirection(dx)
}

// Gesture paging belongs to the phone layout. Above this width the reader is a
// desktop column where selecting and copying text matters more than swiping,
// so only the 上一個 / 下一個 controls change the word.
export const GESTURE_MAX_WIDTH = 550

export function swipeEnabled(viewportWidth) {
  return viewportWidth <= GESTURE_MAX_WIDTH
}

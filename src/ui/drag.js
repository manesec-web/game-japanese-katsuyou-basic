// Finger-tracking drag. While a horizontal drag is held, the row of mounted
// items translates with the finger 1:1 — the content is under the hand
// instead of frozen until release — and the release decides what happens
// next. Pure geometry and naming; the views own every pixel of motion.
//
// The walls: a travel into a direction with nothing behind it is refused at
// any distance. The first card's backward drag and the list ends never move
// the row at all, so nothing springs back there either.
import { SWIPE_THRESHOLD, resolveSwipe } from './swipe.js'

// The travel before a drag claims the gesture away from the page scroll.
export const DRAG_AXIS_THRESHOLD = 8

export function dragAxis(dx, dy, threshold = DRAG_AXIS_THRESHOLD) {
  if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return null
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
}

// Where the row sits while the finger is down: the finger travel, clamped to
// one item width so at most the neighbouring item peeks in at the edge. A
// travel into a walled direction is 0 at every distance.
export function dragShift(dx, { canPrev, canNext, width }) {
  if (dx > 0 && !canPrev) return 0
  if (dx < 0 && !canNext) return 0
  const max = Math.max(width, 0)
  return Math.min(Math.max(dx, -max), max)
}

// What a release does. Past the threshold it names the page to turn to —
// right-to-left is next, left-to-right is prev, the way both screens already
// page towards the hand — and a walled direction names nothing at any
// distance. Shorter than the threshold it names nothing too: the row simply
// settles back where it started.
export function dragDirection(dx, { canPrev, canNext, threshold = SWIPE_THRESHOLD } = {}) {
  const gesture = resolveSwipe(dx, threshold)
  if (!gesture) return null
  if (gesture === 'right' && !canPrev) return null
  if (gesture === 'left' && !canNext) return null
  return gesture === 'left' ? 'next' : 'prev'
}

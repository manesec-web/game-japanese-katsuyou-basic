// Custom page scrollbar geometry. The browser's own bar is hidden, so this
// module works out how long the drawn thumb is, where it sits, and where the
// track lives. Pure: no DOM, no timers, so the numbers can be unit tested.
export const SCROLLBAR = {
  // The drawn thumb: 4px wide, rounded, hugging the column's right edge.
  width: 4,
  inset: 3,
  // The track keeps clear of the viewport's top and bottom, so the thumb never
  // runs into the rounded corners of the column on a wide screen.
  edgeInset: 16,
  // A very long page still leaves a thumb long enough to see and to grab with
  // the eye.
  minThumb: 28,
  // Shown while the page moves, gone about a second after it stops.
  fadeDelay: 1000,
  fadeMs: 160,
}

export function trackHeight(viewportHeight, edgeInset = SCROLLBAR.edgeInset) {
  if (!(viewportHeight > 0)) return 0
  return Math.max(0, viewportHeight - edgeInset * 2)
}

// `track` is the drawable height, `viewport` the window height, `content` the
// page's scroll height. Nothing is drawn when the page already fits.
export function thumbMetrics({
  scrollTop = 0,
  viewport = 0,
  content = 0,
  track = 0,
  minThumb = SCROLLBAR.minThumb,
} = {}) {
  if (track <= 0 || viewport <= 0 || content <= viewport + 1) {
    return { visible: false, length: 0, offset: 0 }
  }
  const share = viewport / content
  const floor = Math.min(minThumb, track)
  const length = Math.min(track, Math.max(floor, track * share))
  const maxScroll = content - viewport
  const travel = track - length
  const progress = maxScroll > 0 ? scrollTop / maxScroll : 0
  const offset = Math.min(travel, Math.max(0, travel * progress))
  return {
    visible: true,
    length: Math.round(length * 100) / 100,
    offset: Math.round(offset * 100) / 100,
  }
}

// How far the thumb sits from the viewport's right edge: the column's own
// margin on a wide screen, just the inset on the full-bleed phone layout.
export function rightInset(viewportWidth = 0, columnRight = 0, inset = SCROLLBAR.inset) {
  if (!(viewportWidth > 0)) return inset
  const edge = columnRight > 0 ? Math.min(columnRight, viewportWidth) : viewportWidth
  return Math.round(Math.max(0, viewportWidth - edge) + inset)
}

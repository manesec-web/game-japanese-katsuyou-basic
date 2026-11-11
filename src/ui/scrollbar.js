// Custom page scrollbar geometry. The browser's own bar is hidden, so this
// module works out how long the drawn thumb is, where it sits, and where the
// track lives. Pure: no DOM, no timers, so the numbers can be unit tested.
export const SCROLLBAR = {
  // The drawn thumb: 4px wide, rounded, hugging the column's right edge.
  width: 4,
  // The full-bleed phone layout: the thumb keeps a hair's width from the
  // window edge, and the track clears the screen's top and bottom by 16px.
  inset: 3,
  edgeInset: 16,
  // A framed desktop column has a 28px corner radius and a 24px content
  // gutter. At 3px/16px the thumb would ride the corner arc and read as
  // crossing the frame, so inside a frame it sits further in and its track
  // starts clear of the radius (32px > 28px), which keeps the whole bar on the
  // box's straight edge.
  frameInset: 8,
  frameEdgeInset: 32,
  // Kept for the tests and the phone layout: the drawn thumb stops short of
  // the viewport edge at both ends of the track.
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

// A dropdown list's own thumb. The panel is a bordered, 12px-rounded box, so
// the thumb keeps a small inset from the panel's inner right edge and from its
// top and bottom, the same 4px rounded bar the page draws.
export const LIST_SCROLLBAR = {
  width: 4,
  // From the panel's inner edges: enough to stay clear of the rounded corners.
  inset: 4,
  // A long list still leaves a thumb long enough to see.
  minThumb: 24,
  // Shown as soon as an overflowing dropdown opens, and on scroll or pointer
  // activity; gone about two seconds after the last of those events.
  fadeDelay: 2000,
  fadeMs: 160,
}

// `clientHeight` is the visible part of the list, `scrollHeight` its content.
// The track keeps `inset` clear at both ends, so the thumb never runs into the
// panel's rounded corners. The returned `offset` is measured from the panel's
// top, inset included, so the view can place the thumb with one transform.
export function listThumbMetrics({
  scrollTop = 0,
  clientHeight = 0,
  scrollHeight = 0,
  inset = LIST_SCROLLBAR.inset,
  minThumb = LIST_SCROLLBAR.minThumb,
} = {}) {
  const track = Math.max(0, clientHeight - inset * 2)
  const metrics = thumbMetrics({ scrollTop, viewport: clientHeight, content: scrollHeight, track, minThumb })
  return {
    visible: metrics.visible,
    length: metrics.length,
    offset: metrics.visible ? metrics.offset + inset : 0,
    track,
  }
}

// A framed column is one whose box does not reach the window's right edge: the
// desktop layout centres a 480px column in a wider window.
export function isFramed(viewportWidth = 0, columnRight = 0) {
  if (!(viewportWidth > 0)) return false
  const edge = columnRight > 0 ? Math.min(columnRight, viewportWidth) : viewportWidth
  return Math.max(0, viewportWidth - edge) > 0
}

// How far the thumb sits from the viewport's right edge: the column's own
// margin plus how far inside the column it belongs. Inside a frame that is an
// 8px inset from the box's right edge; on the full-bleed phone layout it stays
// the 3px gap from the window edge that already looked right.
export function rightInset(viewportWidth = 0, columnRight = 0, inset = SCROLLBAR.inset) {
  if (!(viewportWidth > 0)) return inset
  const edge = columnRight > 0 ? Math.min(columnRight, viewportWidth) : viewportWidth
  const margin = Math.max(0, viewportWidth - edge)
  const inside = margin > 0 ? SCROLLBAR.frameInset : inset
  return Math.round(margin + inside)
}

// How far the track stops short of the viewport's top and bottom: 32px inside
// a frame so the 28px corner radius never crosses the thumb, 16px on a phone.
export function trackInset(viewportWidth = 0, columnRight = 0) {
  return isFramed(viewportWidth, columnRight) ? SCROLLBAR.frameEdgeInset : SCROLLBAR.edgeInset
}

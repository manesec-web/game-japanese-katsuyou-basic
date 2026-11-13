// Horizontal clamp for a tooltip centred over its anchor chip.
//
// The 到 chip's lock explanation is wider than a chip and sits near the right
// edge of a narrow column, so a purely centred tooltip can stick out of the
// viewport (and add a sideways scrollbar). This returns the extra pixels —
// positive is to the right — that keep the centred tooltip inside the viewport
// with `margin` on both sides. Pure, so the picker only applies the result.
export function tooltipShift({ anchorCenterX, width, viewportWidth, margin = 8 }) {
  const viewport = Number(viewportWidth) || 0
  const tipWidth = Math.max(0, Number(width) || 0)
  const center = Number(anchorCenterX) || 0
  const edge = Math.max(0, Number(margin) || 0)
  const half = tipWidth / 2

  const minCenter = edge + half
  const maxCenter = viewport - edge - half
  // A tooltip wider than the viewport cannot be clamped on both sides; centre
  // it on the viewport instead of pushing it to one edge.
  if (maxCenter < minCenter) return viewport / 2 - center
  const clamped = Math.min(Math.max(center, minCenter), maxCenter)
  return clamped - center
}

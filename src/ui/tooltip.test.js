import { describe, expect, it } from 'vitest'
import { tooltipShift } from './tooltip.js'

const viewport = 390

describe('tooltipShift', () => {
  it('leaves a centred tooltip alone when it already fits', () => {
    expect(
      tooltipShift({ anchorCenterX: 195, width: 200, viewportWidth: viewport }),
    ).toBe(0)
  })

  it('pushes a tooltip whose right edge would pass the viewport back inside', () => {
    // 320px tooltip centred on a chip at x=300 would reach x=460 on a 390px
    // screen; it has to move left so its right edge stays at 382.
    expect(
      tooltipShift({ anchorCenterX: 300, width: 320, viewportWidth: viewport }),
    ).toBe(390 - 8 - 160 - 300)
  })

  it('pulls a tooltip whose left edge would pass the viewport inside', () => {
    expect(
      tooltipShift({ anchorCenterX: 40, width: 320, viewportWidth: viewport }),
    ).toBe(8 + 160 - 40)
  })

  it('keeps the configured margin from both edges', () => {
    const shift = tooltipShift({
      anchorCenterX: 380,
      width: 240,
      viewportWidth: viewport,
      margin: 12,
    })
    // Right edge lands exactly at 390 - 12.
    expect(380 + shift + 120).toBe(viewport - 12)
  })

  it('centres an oversized tooltip on the viewport instead of overhanging', () => {
    expect(
      tooltipShift({ anchorCenterX: 300, width: 800, viewportWidth: 300 }),
    ).toBe(150 - 300)
  })

  it('ignores junk values', () => {
    expect(tooltipShift({})).toBe(0)
    expect(
      tooltipShift({ anchorCenterX: 195, width: Number.NaN, viewportWidth: viewport }),
    ).toBe(0)
  })
})

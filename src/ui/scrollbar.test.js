import { describe, expect, it } from 'vitest'
import { rightInset, SCROLLBAR, thumbMetrics, trackHeight } from './scrollbar.js'

describe('trackHeight', () => {
  it('keeps clear of the viewport edges', () => {
    expect(trackHeight(844)).toBe(844 - SCROLLBAR.edgeInset * 2)
  })

  it('never goes negative on a tiny viewport', () => {
    expect(trackHeight(20)).toBe(0)
    expect(trackHeight(0)).toBe(0)
    expect(trackHeight(-100)).toBe(0)
  })
})

describe('thumbMetrics', () => {
  const page = { viewport: 800, content: 1600, track: 700 }

  it('draws nothing when the page already fits', () => {
    expect(thumbMetrics({ ...page, content: 800 }).visible).toBe(false)
    expect(thumbMetrics({ ...page, content: 799 }).visible).toBe(false)
    // A one pixel overflow is rounding, not a scrollbar.
    expect(thumbMetrics({ ...page, content: 801 }).visible).toBe(false)
    expect(thumbMetrics({ ...page, content: 1600, track: 0 }).visible).toBe(false)
    expect(thumbMetrics().visible).toBe(false)
  })

  it('sizes the thumb to the share of the page that is on screen', () => {
    const twice = thumbMetrics({ ...page })
    expect(twice.length).toBe(350)
    const fourTimes = thumbMetrics({ ...page, content: 3200 })
    expect(fourTimes.length).toBe(175)
  })

  it('sits at the top of the track at scroll 0 and at its end at the bottom', () => {
    const top = thumbMetrics({ ...page, scrollTop: 0 })
    expect(top.offset).toBe(0)
    const middle = thumbMetrics({ ...page, scrollTop: 400 })
    expect(middle.offset).toBe(175)
    const end = thumbMetrics({ ...page, scrollTop: 800 })
    expect(end.offset).toBe(700 - end.length)
  })

  it('clamps a scroll position from overscroll or a stale frame', () => {
    expect(thumbMetrics({ ...page, scrollTop: -120 }).offset).toBe(0)
    expect(thumbMetrics({ ...page, scrollTop: 99999 }).offset).toBe(350)
  })

  it('keeps a minimum thumb for a very long page', () => {
    const long = thumbMetrics({ ...page, content: 100000 })
    expect(long.length).toBe(SCROLLBAR.minThumb)
    // The travel is the remaining track once the thumb has its length.
    expect(thumbMetrics({ ...page, content: 100000, scrollTop: 100000 }).offset).toBe(700 - SCROLLBAR.minThumb)
  })

  it('never draws a thumb longer than the track', () => {
    const short = thumbMetrics({ viewport: 799, content: 800, track: 40 })
    expect(short.visible).toBe(false)
    const nearly = thumbMetrics({ viewport: 400, content: 402, track: 40 })
    expect(nearly.length).toBeLessThanOrEqual(40)
  })
})

describe('rightInset', () => {
  it('is just the inset when the column fills the window', () => {
    expect(rightInset(390, 390)).toBe(SCROLLBAR.inset)
  })

  it('follows the column margin on a wide screen', () => {
    // 900px window, 480px column centred: 210px of background either side.
    expect(rightInset(900, 900 - 210)).toBe(213)
  })

  it('falls back to the window edge before the column is measured', () => {
    expect(rightInset(900, 0)).toBe(SCROLLBAR.inset)
    expect(rightInset(0, 0)).toBe(SCROLLBAR.inset)
  })

  it('never reports a negative inset', () => {
    expect(rightInset(390, 500)).toBe(SCROLLBAR.inset)
  })
})

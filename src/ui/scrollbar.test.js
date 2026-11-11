import { describe, expect, it } from 'vitest'
import {
  isFramed,
  listThumbMetrics,
  LIST_SCROLLBAR,
  rightInset,
  SCROLLBAR,
  thumbMetrics,
  trackHeight,
  trackInset,
} from './scrollbar.js'

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

  it('sits inside a framed column, clear of its rounded corner', () => {
    // 900px window, 480px column centred: 180px of background either side.
    // The thumb keeps 8px from the column's right edge — inside the frame and
    // its 24px gutter, not on the frame's edge as on a phone.
    expect(rightInset(900, 900 - 180)).toBe(180 + SCROLLBAR.frameInset)
  })

  it('falls back to the window edge before the column is measured', () => {
    expect(rightInset(900, 0)).toBe(SCROLLBAR.inset)
    expect(rightInset(0, 0)).toBe(SCROLLBAR.inset)
  })

  it('never reports a negative inset', () => {
    expect(rightInset(390, 500)).toBe(SCROLLBAR.inset)
  })
})

describe('listThumbMetrics', () => {
  const list = { clientHeight: 320, scrollHeight: 600 }

  it('uses a two-second hint fade, separate from the page thumb', () => {
    expect(LIST_SCROLLBAR.fadeDelay).toBe(2000)
    expect(SCROLLBAR.fadeDelay).toBe(1000)
  })

  it('draws nothing when the options already fit', () => {
    expect(listThumbMetrics({ ...list, scrollHeight: 320 }).visible).toBe(false)
    expect(listThumbMetrics({ ...list, scrollHeight: 321 }).visible).toBe(false)
    expect(listThumbMetrics().visible).toBe(false)
  })

  it('keeps the track clear of the panel corners', () => {
    expect(listThumbMetrics({ ...list }).track).toBe(320 - LIST_SCROLLBAR.inset * 2)
  })

  it('sizes the thumb to the share of the list on screen', () => {
    // 312px of track for a list that shows 320 of its 600px: just over half.
    expect(listThumbMetrics({ ...list }).length).toBe(166.4)
  })

  it('starts inside the top inset and ends at the bottom inset', () => {
    expect(listThumbMetrics({ ...list, scrollTop: 0 }).offset).toBe(LIST_SCROLLBAR.inset)
    const end = listThumbMetrics({ ...list, scrollTop: 280 })
    expect(end.offset + end.length).toBe(320 - LIST_SCROLLBAR.inset)
  })

  it('keeps a minimum thumb for a very long list', () => {
    const long = listThumbMetrics({ ...list, scrollHeight: 20000 })
    expect(long.length).toBe(LIST_SCROLLBAR.minThumb)
    const end = listThumbMetrics({ ...list, scrollHeight: 20000, scrollTop: 20000 })
    expect(end.offset + end.length).toBe(320 - LIST_SCROLLBAR.inset)
  })

  it('clamps a scroll position from overscroll or a stale frame', () => {
    expect(listThumbMetrics({ ...list, scrollTop: -50 }).offset).toBe(LIST_SCROLLBAR.inset)
    const far = listThumbMetrics({ ...list, scrollTop: 99999 })
    expect(far.offset + far.length).toBe(320 - LIST_SCROLLBAR.inset)
  })
})

describe('isFramed', () => {
  it('is false when the column fills the window', () => {
    expect(isFramed(390, 390)).toBe(false)
    expect(isFramed(390, 500)).toBe(false)
  })

  it('is true when the window is wider than the column', () => {
    expect(isFramed(900, 690)).toBe(true)
    expect(isFramed(551, 551 - 40)).toBe(true)
  })

  it('treats an unmeasured column as full-bleed', () => {
    expect(isFramed(900, 0)).toBe(false)
    expect(isFramed(0, 0)).toBe(false)
  })
})

describe('trackInset', () => {
  it('clears the corner radius inside a frame', () => {
    expect(trackInset(900, 690)).toBe(SCROLLBAR.frameEdgeInset)
    // 32px is more than the column's 28px radius, so the thumb never rides the arc.
    expect(SCROLLBAR.frameEdgeInset).toBeGreaterThan(28)
  })

  it('keeps the phone inset on a full-bleed layout', () => {
    expect(trackInset(390, 390)).toBe(SCROLLBAR.edgeInset)
  })
})

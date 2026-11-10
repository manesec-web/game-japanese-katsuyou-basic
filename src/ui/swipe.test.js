import { describe, expect, it } from 'vitest'
import {
  cardDirection,
  cardDirectionAt,
  cardDrag,
  clampDrag,
  EDGE_RESIST_MAX,
  GESTURE_MAX_WIDTH,
  readerDirection,
  resistDrag,
  resolveSwipe,
  swipeEnabled,
  SWIPE_MAX,
  SWIPE_THRESHOLD,
} from './swipe.js'

describe('resolveSwipe', () => {
  it('names the gesture only past the threshold', () => {
    expect(resolveSwipe(-SWIPE_THRESHOLD)).toBe('left')
    expect(resolveSwipe(-SWIPE_THRESHOLD + 1)).toBe(null)
    expect(resolveSwipe(SWIPE_THRESHOLD)).toBe('right')
    expect(resolveSwipe(SWIPE_THRESHOLD - 1)).toBe(null)
  })
})

describe('readerDirection', () => {
  it('pages towards the hand: right-to-left is the next word', () => {
    expect(readerDirection(-120)).toBe('next')
    expect(readerDirection(120)).toBe('prev')
  })

  it('ignores a short drag', () => {
    expect(readerDirection(-40)).toBe(null)
    expect(readerDirection(40)).toBe(null)
  })
})

describe('cardDirection', () => {
  it('pages towards the hand, like the reader', () => {
    expect(cardDirection(-120)).toBe('next')
    expect(cardDirection(120)).toBe('prev')
  })

  it('matches the reader mapping', () => {
    for (const dx of [-120, -72, 72, 120]) {
      expect(cardDirection(dx)).toBe(readerDirection(dx))
    }
  })
})

describe('clampDrag', () => {
  it('keeps the drag inside the visual range', () => {
    expect(clampDrag(500)).toBe(140)
    expect(clampDrag(-500)).toBe(-140)
    expect(clampDrag(40)).toBe(40)
  })
})

describe('the first-card wall', () => {
  it('damps the drag to a third of the finger', () => {
    expect(resistDrag(30)).toBe(10)
    expect(resistDrag(60)).toBe(20)
  })

  it('caps the follow well short of the paging threshold', () => {
    expect(EDGE_RESIST_MAX).toBeLessThan(SWIPE_THRESHOLD)
    expect(resistDrag(500)).toBe(EDGE_RESIST_MAX)
    expect(resistDrag(120)).toBe(EDGE_RESIST_MAX)
  })

  it('never travels far enough to name a direction', () => {
    for (const dx of [1, 40, 71, 72, 500]) {
      expect(cardDirectionAt(dx, { atFirst: true })).toBe(null)
      expect(Math.abs(resistDrag(dx))).toBeLessThan(SWIPE_THRESHOLD)
    }
  })

  it('keeps the forward drag at the first card undamped', () => {
    expect(cardDrag(-120, { atFirst: true })).toBe(-120)
    expect(cardDrag(-500, { atFirst: true })).toBe(-SWIPE_MAX)
    expect(cardDirectionAt(-120, { atFirst: true })).toBe('next')
  })

  it('leaves every other card tracking the finger', () => {
    expect(cardDrag(120)).toBe(120)
    expect(cardDrag(120, { atFirst: false })).toBe(120)
    expect(cardDrag(-500)).toBe(-SWIPE_MAX)
    expect(cardDirectionAt(120, { atFirst: false })).toBe('prev')
  })
})

describe('swipeEnabled', () => {  it('allows gesture paging at phone widths', () => {
    expect(swipeEnabled(390)).toBe(true)
    expect(swipeEnabled(GESTURE_MAX_WIDTH)).toBe(true)
  })

  it('turns gestures off above 550px so text can be selected', () => {
    expect(swipeEnabled(GESTURE_MAX_WIDTH + 1)).toBe(false)
    expect(swipeEnabled(1280)).toBe(false)
  })
})

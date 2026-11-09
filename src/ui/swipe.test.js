import { describe, expect, it } from 'vitest'
import {
  cardDirection,
  clampDrag,
  GESTURE_MAX_WIDTH,
  readerDirection,
  resolveSwipe,
  swipeEnabled,
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

describe('swipeEnabled', () => {
  it('allows gesture paging at phone widths', () => {
    expect(swipeEnabled(390)).toBe(true)
    expect(swipeEnabled(GESTURE_MAX_WIDTH)).toBe(true)
  })

  it('turns gestures off above 550px so text can be selected', () => {
    expect(swipeEnabled(GESTURE_MAX_WIDTH + 1)).toBe(false)
    expect(swipeEnabled(1280)).toBe(false)
  })
})

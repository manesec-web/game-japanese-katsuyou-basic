import { describe, expect, it } from 'vitest'
import {
  GESTURE_MAX_WIDTH,
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

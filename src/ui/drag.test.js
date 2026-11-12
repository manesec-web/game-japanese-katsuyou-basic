import { describe, expect, it } from 'vitest'
import { dragAxis, dragDirection, dragShift, DRAG_AXIS_THRESHOLD, paintRowOffset } from './drag.js'
import { SWIPE_THRESHOLD } from './swipe.js'

describe('paintRowOffset', () => {
  it('writes the held pixels synchronously without a transition', () => {
    const row = { style: { transform: 'translateX(0px)' } }
    paintRowOffset(row, -37)
    expect(row.style.transform).toBe('translateX(-37px)')
    expect(row.style.transition).toBeUndefined()
    paintRowOffset(row, 0)
    expect(row.style.transform).toBe('translateX(0px)')
    expect(() => paintRowOffset(null, 20)).not.toThrow()
  })
})

describe('dragAxis', () => {
  it('names nothing until the drag passes the slop', () => {
    expect(dragAxis(0, 0)).toBe(null)
    expect(dragAxis(5, -5)).toBe(null)
    expect(dragAxis(DRAG_AXIS_THRESHOLD - 1, 0)).toBe(null)
    expect(dragAxis(DRAG_AXIS_THRESHOLD, 0)).toBe('x')
    expect(dragAxis(0, -DRAG_AXIS_THRESHOLD)).toBe('y')
  })

  it('follows the longer travel', () => {
    expect(dragAxis(40, 12)).toBe('x')
    expect(dragAxis(12, 40)).toBe('y')
  })
})

describe('dragShift', () => {
  it('follows the finger 1:1 while held', () => {
    const opts = { canPrev: true, canNext: true, width: 380 }
    expect(dragShift(-120, opts)).toBe(-120)
    expect(dragShift(45, opts)).toBe(45)
  })

  it('clamps to one item width so only a neighbour peeks in', () => {
    const opts = { canPrev: true, canNext: true, width: 380 }
    expect(dragShift(-900, opts)).toBe(-380)
    expect(dragShift(900, opts)).toBe(380)
  })

  it('is a wall on the first card: a backward drag never moves it', () => {
    const opts = { canPrev: false, canNext: true, width: 380 }
    for (const dx of [1, 40, 71, 72, 120, 500]) {
      expect(dragShift(dx, opts)).toBe(0)
    }
  })

  it('is a wall at the list ends: no travel past the boundary', () => {
    const first = { canPrev: false, canNext: true, width: 380 }
    const last = { canPrev: true, canNext: false, width: 380 }
    expect(dragShift(-120, last)).toBe(0)
    expect(dragShift(120, first)).toBe(0)
    // The open side still follows on each end.
    expect(dragShift(-120, first)).toBe(-120)
    expect(dragShift(120, last)).toBe(120)
    // A single item has nothing on either side.
    expect(dragShift(-120, { canPrev: false, canNext: false, width: 380 })).toBe(0)
    expect(dragShift(120, { canPrev: false, canNext: false, width: 380 })).toBe(0)
  })
})

describe('dragDirection', () => {
  it('names the turn only past the threshold', () => {
    const opts = { canPrev: true, canNext: true }
    expect(dragDirection(-SWIPE_THRESHOLD, opts)).toBe('next')
    expect(dragDirection(-SWIPE_THRESHOLD + 1, opts)).toBe(null)
    expect(dragDirection(SWIPE_THRESHOLD, opts)).toBe('prev')
    expect(dragDirection(SWIPE_THRESHOLD - 1, opts)).toBe(null)
  })

  it('pages towards the hand: right-to-left is the next item', () => {
    const opts = { canPrev: true, canNext: true }
    expect(dragDirection(-120, opts)).toBe('next')
    expect(dragDirection(120, opts)).toBe('prev')
  })

  it('names nothing at the walls, at any distance', () => {
    // The wall is stillness: the drag never names a direction, so the item
    // never changes and nothing settles twice.
    for (const dx of [1, 40, 71, 72, 120, 500]) {
      expect(dragDirection(dx, { canPrev: false, canNext: true })).toBe(null)
      expect(dragDirection(-dx, { canPrev: true, canNext: false })).toBe(null)
    }
    // The open side of an end item still names its turn.
    expect(dragDirection(-120, { canPrev: false, canNext: true })).toBe('next')
    expect(dragDirection(120, { canPrev: true, canNext: false })).toBe('prev')
  })
})

import { describe, expect, it } from 'vitest'
import {
  CARD_WINDOW,
  CURRENT_SLOT,
  READER_WINDOW,
  shiftWindow,
  windowGap,
  windowOffset,
  windowSlots,
} from './window.js'
import { specs as cardSpecs } from '../commands/card.js'
import { specs as dictSpecs } from '../commands/dict.js'

// Every window the paging commands can reach: the index is always a real list
// position once the commands have clamped it.
function allWindows(size) {
  const out = []
  for (const total of [1, 2, 3, 5, 7, 12, 20]) {
    for (let index = 0; index < total; index++) {
      out.push({ total, index, slots: windowSlots(total, index, size) })
    }
  }
  return out
}

describe('windowSlots', () => {
  it('keeps the current item in the 3rd slot', () => {
    for (const size of [READER_WINDOW, CARD_WINDOW]) {
      for (const { total, index, slots } of allWindows(size)) {
        expect(slots).toHaveLength(size)
        expect(slots[CURRENT_SLOT]).toBe(index)
      }
    }
  })

  it('holds the two items before and the rest after', () => {
    expect(windowSlots(20, 5, READER_WINDOW)).toEqual([3, 4, 5, 6, 7])
    expect(windowSlots(20, 5, CARD_WINDOW)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11])
  })

  it('leaves the slots past the ends of the list empty', () => {
    expect(windowSlots(20, 0, READER_WINDOW)).toEqual([null, null, 0, 1, 2])
    expect(windowSlots(20, 19, READER_WINDOW)).toEqual([17, 18, 19, null, null])
    // A run shorter than the window fills fewer slots.
    expect(windowSlots(3, 0, READER_WINDOW)).toEqual([null, null, 0, 1, 2])
    expect(windowSlots(3, 2, CARD_WINDOW)).toEqual([0, 1, 2, null, null, null, null, null, null])
  })

  it('holds nothing in an empty run', () => {
    expect(windowSlots(0, 0, READER_WINDOW)).toEqual([null, null, null, null, null])
    expect(windowSlots(0, 0, CARD_WINDOW)).toEqual([null, null, null, null, null, null, null, null, null])
  })

  it('clamps an out-of-range index to the nearest end', () => {
    expect(windowSlots(20, -5, READER_WINDOW)).toEqual([null, null, 0, 1, 2])
    expect(windowSlots(20, 99, READER_WINDOW)).toEqual([17, 18, 19, null, null])
  })

  it('names only real list positions', () => {
    for (const size of [READER_WINDOW, CARD_WINDOW]) {
      for (const { total, slots } of allWindows(size)) {
        for (const at of slots) {
          if (at !== null) {
            expect(at).toBeGreaterThanOrEqual(0)
            expect(at).toBeLessThan(total)
          }
        }
      }
    }
  })
})

describe('windowOffset and windowGap', () => {
  it('places the current slot at zero and the neighbours a full width away', () => {
    expect(windowOffset(CURRENT_SLOT)).toBe(0)
    expect(windowOffset(CURRENT_SLOT + 1)).toBe(100)
    expect(windowOffset(CURRENT_SLOT - 1)).toBe(-100)
    expect(windowOffset(0)).toBe(-200)
  })

  it('adds a fixed 24px seam outside every full-width slot', () => {
    expect(windowGap(CURRENT_SLOT)).toBe(0)
    expect(windowGap(CURRENT_SLOT + 1)).toBe(24)
    expect(windowGap(CURRENT_SLOT - 1)).toBe(-24)
    expect(windowGap(0)).toBe(-48)
  })
})

describe('shiftWindow', () => {
  it('goes next by deleting the front slot and appending at the back', () => {
    for (const size of [READER_WINDOW, CARD_WINDOW]) {
      for (const { total, index, slots } of allWindows(size)) {
        if (index >= total - 1) continue
        const moved = shiftWindow(slots, total, 'next')
        // One delete at the front, one append at the back: the middle is the
        // old row without its head.
        expect(moved.slice(0, size - 1)).toEqual(slots.slice(1))
        expect(moved).toHaveLength(size)
        expect(moved[CURRENT_SLOT]).toBe(index + 1)
        // The appended slot is the next list item, or empty past the end.
        const back = index + size - CURRENT_SLOT
        expect(moved[size - 1]).toBe(back < total ? back : null)
      }
    }
  })

  it('goes prev by deleting the back slot and prepending at the front', () => {
    for (const size of [READER_WINDOW, CARD_WINDOW]) {
      for (const { total, index, slots } of allWindows(size)) {
        if (index <= 0) continue
        const moved = shiftWindow(slots, total, 'prev')
        expect(moved.slice(1)).toEqual(slots.slice(0, size - 1))
        expect(moved).toHaveLength(size)
        expect(moved[CURRENT_SLOT]).toBe(index - 1)
        const front = index - CURRENT_SLOT - 1
        expect(moved[0]).toBe(front >= 0 ? front : null)
      }
    }
  })

  it('lands on the same window the list derives', () => {
    for (const size of [READER_WINDOW, CARD_WINDOW]) {
      for (const { total, index, slots } of allWindows(size)) {
        if (index < total - 1) {
          expect(shiftWindow(slots, total, 'next')).toEqual(windowSlots(total, index + 1, size))
        }
        if (index > 0) {
          expect(shiftWindow(slots, total, 'prev')).toEqual(windowSlots(total, index - 1, size))
        }
      }
    }
  })

  it('refuses to leave the list: no move at the first or last item', () => {
    expect(shiftWindow(windowSlots(20, 0, READER_WINDOW), 20, 'prev')).toBe(null)
    expect(shiftWindow(windowSlots(20, 19, READER_WINDOW), 20, 'next')).toBe(null)
    expect(shiftWindow(windowSlots(1, 0, CARD_WINDOW), 1, 'prev')).toBe(null)
    expect(shiftWindow(windowSlots(1, 0, CARD_WINDOW), 1, 'next')).toBe(null)
  })

  it('refuses an unknown direction', () => {
    expect(shiftWindow(windowSlots(20, 5, READER_WINDOW), 20, 'sideways')).toBe(null)
  })
})

describe('the paging commands keep their ids and params', () => {
  it('names the four paging commands with no params', () => {
    const paging = [...cardSpecs(), ...dictSpecs()]
      .filter((spec) => spec.id !== 'card.flip')
      .map((spec) => ({ id: spec.id, params: spec.params }))
    expect(paging).toEqual([
      { id: 'card.next', params: [] },
      { id: 'card.prev', params: [] },
      { id: 'dict.next', params: [] },
      { id: 'dict.prev', params: [] },
    ])
  })
})

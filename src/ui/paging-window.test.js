import { describe, expect, it } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import { CURRENT_SLOT, READER_WINDOW, windowSlots } from './window.js'
import { usePagingWindow } from './paging-window.js'

// The window is state, not a derived array: a turn is one delete at one end and
// one append at the other, exactly what the gesture asks for.
function sessionWith(length) {
  return reactive({ items: Array.from({ length }, (_, at) => ({ at })), index: 0 })
}

function runInScope(fn) {
  const scope = effectScope()
  const result = scope.run(fn)
  return { result, stop: () => scope.stop() }
}

describe('usePagingWindow', () => {
  it('starts on a full window derived from the current item', async () => {
    const session = sessionWith(20)
    const { result, stop } = runInScope(() => usePagingWindow(session, READER_WINDOW))
    await nextTick()
    expect(result.value).toEqual(windowSlots(20, 0, READER_WINDOW))
    expect(result.value[CURRENT_SLOT]).toBe(0)
    stop()
  })

  it('moves forward by dropping the front slot and appending one at the back', async () => {
    const session = sessionWith(20)
    const { result, stop } = runInScope(() => usePagingWindow(session, READER_WINDOW))
    await nextTick()
    session.index = 2
    await nextTick()
    // Two steps, each one delete at the front and one append at the back.
    expect(result.value).toEqual([0, 1, 2, 3, 4])
    session.index = 3
    await nextTick()
    expect(result.value).toEqual([1, 2, 3, 4, 5])
    expect(result.value[CURRENT_SLOT]).toBe(3)
    stop()
  })

  it('moves backward the other way round', async () => {
    const session = sessionWith(20)
    const { result, stop } = runInScope(() => usePagingWindow(session, READER_WINDOW))
    await nextTick()
    session.index = 6
    await nextTick()
    expect(result.value).toEqual([4, 5, 6, 7, 8])
    session.index = 4
    await nextTick()
    expect(result.value).toEqual([2, 3, 4, 5, 6])
    stop()
  })

  it('only ever changes one end per turn', async () => {
    const session = sessionWith(20)
    const { result, stop } = runInScope(() => usePagingWindow(session, READER_WINDOW))
    await nextTick()
    session.index = 1
    await nextTick()
    const before = [...result.value]
    session.index = 2
    await nextTick()
    const after = [...result.value]
    // One front slot left, one back slot arrived: the middle is untouched.
    expect(after.slice(0, READER_WINDOW - 1)).toEqual(before.slice(1))
    expect(after[READER_WINDOW - 1]).toBe(before[READER_WINDOW - 1] + 1)
    stop()
  })

  it('derives a fresh window for a new list', async () => {
    const session = sessionWith(20)
    const { result, stop } = runInScope(() => usePagingWindow(session, READER_WINDOW))
    await nextTick()
    session.index = 9
    await nextTick()
    session.items = Array.from({ length: 3 }, (_, at) => ({ at }))
    session.index = 0
    await nextTick()
    expect(result.value).toEqual([null, null, 0, 1, 2])
    stop()
  })

  it('stays on the last item at the end of the list', async () => {
    const session = sessionWith(6)
    const { result, stop } = runInScope(() => usePagingWindow(session, READER_WINDOW))
    await nextTick()
    session.index = 5
    await nextTick()
    expect(result.value).toEqual([3, 4, 5, null, null])
    expect(result.value[CURRENT_SLOT]).toBe(5)
    stop()
  })
})

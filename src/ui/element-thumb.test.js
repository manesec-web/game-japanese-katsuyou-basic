// The dropdown thumb's reveal/fade behavior, tested with fake timers and a
// tiny fake scroll element. No browser is needed: Vue's ref + onBeforeUnmount
// work outside a mounted component.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useElementThumb } from './element-thumb.js'
import { LIST_SCROLLBAR } from './scrollbar.js'

function fakeList({ clientHeight = 100, scrollHeight = 400 } = {}) {
  const listeners = new Map()
  return {
    clientHeight,
    scrollHeight,
    scrollTop: 0,
    addEventListener(type, listener) {
      listeners.set(type, listener)
    },
    removeEventListener(type) {
      listeners.delete(type)
    },
    emit(type) {
      listeners.get(type)?.()
    },
    has(type) {
      return listeners.has(type)
    },
  }
}

function fakeThumb() {
  let captured = null
  return {
    setPointerCapture: vi.fn((id) => { captured = id }),
    hasPointerCapture: vi.fn((id) => captured === id),
    releasePointerCapture: vi.fn(() => { captured = null }),
  }
}

function pointer(target, values = {}) {
  return {
    pointerType: 'mouse',
    button: 0,
    pointerId: 7,
    clientY: 100,
    currentTarget: target,
    preventDefault: vi.fn(),
    ...values,
  }
}

function setup(list) {
  const scope = effectScope()
  const thumb = scope.run(() => useElementThumb())
  thumb.attach(list)
  return { scope, thumb }
}

describe('useElementThumb', () => {
  let warn = null
  beforeEach(() => {
    vi.useFakeTimers()
    // `useElementThumb` calls a component lifecycle hook; these tests run it
    // in an effect scope. Vue's harmless warning would drown the test output.
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    globalThis.requestAnimationFrame = (callback) => {
      callback()
      return 1
    }
    globalThis.cancelAnimationFrame = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
    warn.mockRestore()
    delete globalThis.requestAnimationFrame
    delete globalThis.cancelAnimationFrame
  })

  it('shows the thumb as soon as an overflowing list opens and fades after two seconds', async () => {
    const list = fakeList()
    const { scope, thumb } = setup(list)
    expect(thumb.length.value).toBeGreaterThan(0)
    expect(thumb.visible.value).toBe(true)
    await vi.advanceTimersByTimeAsync(LIST_SCROLLBAR.fadeDelay - 1)
    expect(thumb.visible.value).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(thumb.visible.value).toBe(false)
    scope.stop()
  })

  it('does not show a thumb when the options already fit', async () => {
    const list = fakeList({ scrollHeight: 100 })
    const { scope, thumb } = setup(list)
    expect(thumb.length.value).toBe(0)
    expect(thumb.visible.value).toBe(false)
    await vi.advanceTimersByTimeAsync(LIST_SCROLLBAR.fadeDelay)
    expect(thumb.visible.value).toBe(false)
    scope.stop()
  })

  it('restarts the two-second wait on pointer enter and pointer move', async () => {
    const list = fakeList()
    const { scope, thumb } = setup(list)
    expect(list.has('pointerenter')).toBe(true)
    expect(list.has('pointermove')).toBe(true)
    await vi.advanceTimersByTimeAsync(1500)
    list.emit('pointerenter')
    await vi.advanceTimersByTimeAsync(1500)
    expect(thumb.visible.value).toBe(true)
    list.emit('pointermove')
    await vi.advanceTimersByTimeAsync(1500)
    expect(thumb.visible.value).toBe(true)
    await vi.advanceTimersByTimeAsync(500)
    expect(thumb.visible.value).toBe(false)
    scope.stop()
  })

  it('restarts the wait on scroll and remeasures its offset', async () => {
    const list = fakeList()
    const { scope, thumb } = setup(list)
    const topOffset = thumb.offset.value
    await vi.advanceTimersByTimeAsync(1200)
    list.scrollTop = 300
    list.emit('scroll')
    expect(thumb.offset.value).toBeGreaterThan(topOffset)
    await vi.advanceTimersByTimeAsync(1200)
    expect(thumb.visible.value).toBe(true)
    await vi.advanceTimersByTimeAsync(800)
    expect(thumb.visible.value).toBe(false)
    scope.stop()
  })

  it('drags the list from the grab offset without jumping and clamps at the end', () => {
    const list = fakeList()
    const target = fakeThumb()
    const { scope, thumb } = setup(list)
    thumb.dragStart(pointer(target))
    expect(target.setPointerCapture).toHaveBeenCalledWith(7)
    expect(thumb.dragging.value).toBe(true)
    expect(list.scrollTop).toBe(0)

    // 92px track, 24px minimum thumb, 68px travel for 300px of scroll.
    // Moving half the travel therefore scrolls half the list.
    thumb.dragMove(pointer(target, { clientY: 134 }))
    expect(list.scrollTop).toBe(150)
    expect(thumb.offset.value).toBe(38)
    thumb.dragMove(pointer(target, { clientY: 999 }))
    expect(list.scrollTop).toBe(300)
    thumb.dragEnd(pointer(target, { clientY: 999 }))
    expect(thumb.dragging.value).toBe(false)
    expect(target.releasePointerCapture).toHaveBeenCalledWith(7)
    scope.stop()
  })

  it('keeps the thumb visible while held and starts the fade only on release', async () => {
    const list = fakeList()
    const target = fakeThumb()
    const { scope, thumb } = setup(list)
    thumb.dragStart(pointer(target))
    await vi.advanceTimersByTimeAsync(LIST_SCROLLBAR.fadeDelay + 500)
    expect(thumb.visible.value).toBe(true)
    expect(thumb.dragging.value).toBe(true)
    thumb.dragEnd(pointer(target))
    await vi.advanceTimersByTimeAsync(LIST_SCROLLBAR.fadeDelay - 1)
    expect(thumb.visible.value).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(thumb.visible.value).toBe(false)
    scope.stop()
  })

  it('does not turn a touch press into mouse dragging', () => {
    const list = fakeList()
    const target = fakeThumb()
    const { scope, thumb } = setup(list)
    thumb.dragStart(pointer(target, { pointerType: 'touch' }))
    expect(thumb.dragging.value).toBe(false)
    expect(target.setPointerCapture).not.toHaveBeenCalled()
    expect(list.scrollTop).toBe(0)
    scope.stop()
  })

  it('detaches its listeners and clears the timer when the list closes', async () => {
    const list = fakeList()
    const { scope, thumb } = setup(list)
    thumb.attach(null)
    expect(list.has('scroll')).toBe(false)
    expect(list.has('pointerenter')).toBe(false)
    expect(list.has('pointermove')).toBe(false)
    expect(thumb.visible.value).toBe(false)
    await vi.advanceTimersByTimeAsync(LIST_SCROLLBAR.fadeDelay)
    expect(thumb.visible.value).toBe(false)
    scope.stop()
  })

  it('reveals again with a fresh timer when the dropdown reopens', async () => {
    const first = fakeList()
    const second = fakeList({ clientHeight: 120, scrollHeight: 500 })
    const { scope, thumb } = setup(first)
    await vi.advanceTimersByTimeAsync(LIST_SCROLLBAR.fadeDelay)
    thumb.attach(null)
    thumb.attach(second)
    expect(thumb.visible.value).toBe(true)
    expect(thumb.length.value).toBeGreaterThan(0)
    await nextTick()
    await vi.advanceTimersByTimeAsync(LIST_SCROLLBAR.fadeDelay - 1)
    expect(thumb.visible.value).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(thumb.visible.value).toBe(false)
    scope.stop()
  })
})

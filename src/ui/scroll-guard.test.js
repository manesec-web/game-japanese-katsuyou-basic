import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createScrollGuard } from './scroll-guard.js'

function fakeDom({ height = 1200, viewport = 500 } = {}) {
  const listeners = new Map()
  const root = {
    scrollTop: 0,
    clientHeight: viewport,
    scrollHeight: height,
    parentElement: null,
  }
  const body = { parentElement: null }
  const doc = {
    documentElement: root,
    scrollingElement: root,
    body,
    addEventListener: vi.fn((type, listener, options) => {
      listeners.set(type, { listener, options })
    }),
    removeEventListener: vi.fn((type) => listeners.delete(type)),
  }
  return { doc, root, listeners }
}

function gesture({
  x = 100,
  y = 200,
  target = null,
  touches = null,
  cancelable = true,
} = {}) {
  return {
    target,
    cancelable,
    touches: touches ?? [{ clientX: x, clientY: y }],
    preventDefault: vi.fn(),
  }
}

function start(listeners, target = null, x = 100, y = 200) {
  const event = gesture({ target, x, y })
  listeners.get('touchstart').listener(event)
  return event
}

function move(listeners, y, x = 100) {
  const event = gesture({ x, y })
  listeners.get('touchmove').listener(event)
  return event
}

function list({ scrollTop = 0, clientHeight = 160, scrollHeight = 600 } = {}) {
  return {
    scrollTop,
    clientHeight,
    scrollHeight,
    parentElement: null,
  }
}

function listTarget(list) {
  return {
    parentElement: list,
    nodeType: 1,
  }
}

describe('iOS boundary touch guard', () => {
  let dom
  let guard

  beforeEach(() => {
    dom = fakeDom()
    guard = createScrollGuard({
      document: dom.doc,
      view: { innerHeight: 500 },
      getStyle: (node) => node.scrollHeight > node.clientHeight + 1
        ? { overflowY: 'auto' }
        : { overflowY: 'visible' },
    })
  })

  it('registers touchmove as non-passive and detaches every listener', () => {
    guard.attach()
    guard.attach()
    expect(dom.doc.addEventListener).toHaveBeenCalledTimes(4)
    expect(dom.listeners.get('touchmove').options).toEqual({ passive: false })
    expect(dom.listeners.get('touchstart').options).toEqual({ passive: true })
    expect(guard.detach()).toBeUndefined()
    expect(dom.doc.removeEventListener).toHaveBeenCalledTimes(4)
    expect(dom.listeners.size).toBe(0)
    guard.detach()
    expect(dom.doc.removeEventListener).toHaveBeenCalledTimes(4)
  })

  it('cancels a downward pull at the page top', () => {
    guard.attach()
    start(dom.listeners)
    const event = move(dom.listeners, 230)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('cancels an upward push at the page bottom', () => {
    dom.root.scrollTop = 700
    guard.attach()
    start(dom.listeners)
    const event = move(dom.listeners, 170)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('allows an upward push that still has page content below it', () => {
    guard.attach()
    start(dom.listeners)
    const event = move(dom.listeners, 170)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('allows a downward pull away from the page top', () => {
    dom.root.scrollTop = 100
    guard.attach()
    start(dom.listeners)
    const event = move(dom.listeners, 230)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('keeps a scrollable dropdown live between its boundaries', () => {
    const listEl = list({ scrollTop: 100 })
    guard.attach()
    start(dom.listeners, listTarget(listEl))
    listEl.scrollTop = 130
    const event = move(dom.listeners, 170)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('cancels a dropdown edge drag without cancelling its open direction', () => {
    const listEl = list({ scrollTop: 0 })
    guard.attach()
    start(dom.listeners, listTarget(listEl))
    expect(move(dom.listeners, 230).preventDefault).toHaveBeenCalledOnce()
    dom.listeners.get('touchend').listener(gesture({ touches: [] }))
    listEl.scrollTop = 100
    start(dom.listeners, listTarget(listEl))
    expect(move(dom.listeners, 170).preventDefault).not.toHaveBeenCalled()
    listEl.scrollTop = 440
    expect(move(dom.listeners, 130).preventDefault).toHaveBeenCalledOnce()
  })

  it('does not intercept horizontal paging even with a vertical component', () => {
    guard.attach()
    start(dom.listeners)
    expect(move(dom.listeners, 205, 180).preventDefault).not.toHaveBeenCalled()
    expect(move(dom.listeners, 230, 260).preventDefault).not.toHaveBeenCalled()
  })

  it('leaves multi-touch and non-cancelable moves alone', () => {
    guard.attach()
    start(dom.listeners)
    const pinch = gesture({
      touches: [{ clientX: 100, clientY: 230 }, { clientX: 160, clientY: 240 }],
    })
    dom.listeners.get('touchmove').listener(pinch)
    expect(pinch.preventDefault).not.toHaveBeenCalled()
    const browserOwned = gesture({ y: 240, cancelable: false })
    dom.listeners.get('touchmove').listener(browserOwned)
    expect(browserOwned.preventDefault).not.toHaveBeenCalled()
  })

  it('keeps a multi-touch gesture released for its remaining finger', () => {
    guard.attach()
    start(dom.listeners)
    const pinch = gesture({
      touches: [{ clientX: 100, clientY: 230 }, { clientX: 160, clientY: 240 }],
    })
    dom.listeners.get('touchmove').listener(pinch)
    const remaining = move(dom.listeners, 240)
    expect(remaining.preventDefault).not.toHaveBeenCalled()
    dom.listeners.get('touchend').listener(gesture({
      touches: [{ clientX: 100, clientY: 240 }],
    }))
    expect(move(dom.listeners, 260).preventDefault).not.toHaveBeenCalled()
    dom.listeners.get('touchend').listener(gesture({ touches: [] }))
    start(dom.listeners)
    expect(move(dom.listeners, 260).preventDefault).toHaveBeenCalledOnce()
  })

  it('predicts the first move across a boundary and settles at the exact edge', () => {
    guard.attach()
    start(dom.listeners)
    dom.root.scrollTop = 10
    expect(move(dom.listeners, 230).preventDefault).toHaveBeenCalledOnce()
    expect(dom.root.scrollTop).toBe(0)
    dom.listeners.get('touchend').listener(gesture({ touches: [] }))
    dom.root.scrollTop = 690
    start(dom.listeners)
    expect(move(dom.listeners, 170).preventDefault).toHaveBeenCalledOnce()
    expect(dom.root.scrollTop).toBe(700)
  })

  it('cancels either outward direction when the whole page fits', () => {
    dom.root.scrollHeight = 500
    dom.root.scrollTop = 0
    guard.attach()
    start(dom.listeners)
    expect(move(dom.listeners, 230).preventDefault).toHaveBeenCalledOnce()
    dom.listeners.get('touchend').listener(gesture({ touches: [] }))
    start(dom.listeners)
    expect(move(dom.listeners, 170).preventDefault).toHaveBeenCalledOnce()
  })

  it('resets after touch end/cancel so a later gesture starts at a new boundary', () => {
    guard.attach()
    start(dom.listeners)
    expect(move(dom.listeners, 170).preventDefault).not.toHaveBeenCalled()
    dom.listeners.get('touchend').listener(gesture({ touches: [] }))
    expect(move(dom.listeners, 200).preventDefault).not.toHaveBeenCalled()
    start(dom.listeners)
    expect(move(dom.listeners, 230).preventDefault).toHaveBeenCalledOnce()
    dom.listeners.get('touchcancel').listener()
    expect(move(dom.listeners, 170).preventDefault).not.toHaveBeenCalled()
  })
})

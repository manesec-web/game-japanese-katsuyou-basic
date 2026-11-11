// Keep a one-finger vertical drag from rubber-banding the viewport on iOS.
// CSS `overscroll-behavior` handles modern Chrome/Android and newer Safari;
// older Safari needs a cancelable touchmove at the scrolling boundary.
//
// This deliberately is NOT a document-wide `preventDefault()` and NOT a fixed
// body. Long dictionary pages keep ordinary scrolling and momentum, dropdown
// lists keep their own scrolling, and horizontal card/reader swipes stay live.

function canConsume(scrollTop, clientHeight, scrollHeight, deltaY) {
  const max = Math.max(0, scrollHeight - clientHeight)
  // Predict this move, rather than waiting for the browser to pass the wall.
  // Once Safari/Chrome has claimed a native scroll, later touchmove events can
  // become non-cancelable. Keep a move that fits inside the container, but
  // intercept one that reaches beyond its remaining room in this direction.
  if (deltaY > 0) return scrollTop > deltaY
  if (deltaY < 0) return max - scrollTop > -deltaY
  return true
}

function settleAtBoundary(node, deltaY) {
  if (!node) return
  const max = Math.max(0, node.scrollHeight - node.clientHeight)
  // Cancelling the native move must not lose the ordinary travel that led to
  // the wall. Finish it at the exact boundary instead of leaving a partial
  // native scroll, or letting an already-negative iOS offset stay stretched.
  node.scrollTop = deltaY > 0 ? 0 : max
}

export function createScrollGuard({
  document: doc = globalThis.document,
  view = globalThis.window,
  getStyle = globalThis.getComputedStyle,
} = {}) {
  let attached = false
  let scroller = null
  let startX = null
  let startY = null
  let lastY = null
  let axis = null
  let multiTouch = false

  function reset() {
    scroller = null
    startX = null
    startY = null
    lastY = null
    axis = null
    multiTouch = false
  }

  function rootScroller() {
    const root = doc.scrollingElement ?? doc.documentElement
    if (!root) return null
    return {
      scrollTop: root.scrollTop,
      clientHeight: root.clientHeight || view.innerHeight,
      scrollHeight: root.scrollHeight,
      element: root,
    }
  }

  function findScroller(target) {
    let node = target?.nodeType === 1 ? target : target?.parentElement
    while (node && node !== doc.body && node !== doc.documentElement) {
      const style = getStyle?.(node)
      const overflowY = style?.overflowY ?? style?.overflow ?? ''
      const scrollable = /^(auto|scroll|overlay)$/.test(overflowY)
      if (scrollable && node.scrollHeight > node.clientHeight + 1) {
        return {
          scrollTop: node.scrollTop,
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
          element: node,
        }
      }
      node = node.parentElement
    }
    return rootScroller()
  }

  function refreshScroller(node) {
    if (!node || node === doc.scrollingElement || node === doc.documentElement) {
      scroller = rootScroller()
      return
    }
    scroller = {
      scrollTop: node.scrollTop,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      element: node,
    }
  }

  function onStart(event) {
    reset()
    if (event.touches?.length !== 1) {
      multiTouch = true
      return
    }
    const touch = event.touches[0]
    startX = touch.clientX
    startY = touch.clientY
    lastY = touch.clientY
    scroller = findScroller(event.target)
  }

  function onMove(event) {
    // Pinch is never ours. A browser may also mark a move non-cancelable once
    // it owns the gesture; calling preventDefault there would only warn.
    if (event.touches?.length !== 1) {
      multiTouch = true
      return
    }
    if (multiTouch || event.cancelable === false) return
    if (startY === null || lastY === null) return
    const touch = event.touches[0]
    const y = touch.clientY
    const deltaY = y - lastY
    lastY = y
    if (axis === null) {
      const dx = touch.clientX - startX
      const dy = y - startY
      // A few pixels of finger jitter are not a gesture. Once the direction
      // is clear, keep it for the rest of this touch: a horizontal card or
      // reader swipe never turns into a blocked vertical overscroll halfway
      // through the drag.
      if (Math.max(Math.abs(dx), Math.abs(dy)) >= 4) {
        axis = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x'
      }
    }
    if (axis !== 'y' || deltaY === 0) return

    if (!scroller) return
    refreshScroller(scroller.element)
    if (canConsume(scroller.scrollTop, scroller.clientHeight, scroller.scrollHeight, deltaY)) {
      return
    }
    event.preventDefault()
    settleAtBoundary(scroller.element, deltaY)
  }

  function onEnd(event) {
    // If one finger remains after a multi-touch gesture, wait for a fresh
    // touchstart instead of comparing against a stale coordinate.
    if (event.touches?.length !== 1) reset()
  }

  function onCancel() {
    reset()
  }

  function attach() {
    if (attached || !doc?.addEventListener) return
    doc.addEventListener('touchstart', onStart, { passive: true })
    // Safari requires passive: false for preventDefault to stop the bounce.
    doc.addEventListener('touchmove', onMove, { passive: false })
    doc.addEventListener('touchend', onEnd, { passive: true })
    doc.addEventListener('touchcancel', onCancel, { passive: true })
    attached = true
  }

  function detach() {
    if (!attached) return
    doc.removeEventListener('touchstart', onStart)
    doc.removeEventListener('touchmove', onMove)
    doc.removeEventListener('touchend', onEnd)
    doc.removeEventListener('touchcancel', onCancel)
    attached = false
    reset()
  }

  return { attach, detach }
}

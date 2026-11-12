// Behavior for the page's drawn scrollbar. The component only renders refs and
// forwards pointer events; this module owns measurement, mouse proximity, the
// fade, pointer capture and the thumb-offset → window-scroll mapping.
import { onBeforeUnmount, ref } from 'vue'
import {
  dragScrollTop,
  isNearPageThumb,
  rightInset,
  SCROLLBAR,
  thumbMetrics,
  trackHeight,
  trackInset,
} from './scrollbar.js'

export function usePageScrollbar({ root = globalThis.window, doc = globalThis.document } = {}) {
  const visible = ref(false)
  const dragging = ref(false)
  const length = ref(0)
  const offset = ref(0)
  const fromRight = ref(SCROLLBAR.inset)
  const edgeInset = ref(SCROLLBAR.edgeInset)

  let attached = false
  let fadeTimer = null
  let frame = 0
  let observer = null
  let drag = null
  let near = false
  let geometry = { viewport: 0, content: 0, track: 0 }

  function clearFade() {
    clearTimeout(fadeTimer)
    fadeTimer = null
  }

  function scheduleFade() {
    clearFade()
    if (drag || near) return
    fadeTimer = setTimeout(() => {
      visible.value = false
      fadeTimer = null
    }, SCROLLBAR.fadeDelay)
  }

  function measure() {
    if (!root || !doc) return null
    const column = doc.querySelector('.column')
    const columnRight = column ? column.getBoundingClientRect().right : 0
    const viewport = root.innerHeight
    fromRight.value = rightInset(root.innerWidth, columnRight)
    edgeInset.value = trackInset(root.innerWidth, columnRight)
    geometry = {
      viewport,
      content: doc.documentElement.scrollHeight,
      track: trackHeight(viewport, edgeInset.value),
    }
    const metrics = thumbMetrics({
      scrollTop: root.scrollY,
      ...geometry,
    })
    length.value = metrics.length
    offset.value = metrics.offset
    if (!metrics.visible) {
      visible.value = false
      near = false
      return null
    }
    return metrics
  }

  function read() {
    return Boolean(measure())
  }

  function reveal() {
    if (!measure()) return
    visible.value = true
    scheduleFade()
  }

  function onScroll() {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      reveal()
    })
  }

  function onResize() {
    read()
  }

  function proximity(event) {
    return isNearPageThumb({
      x: event.clientX,
      y: event.clientY,
      viewportWidth: root.innerWidth,
      viewportHeight: root.innerHeight,
      right: fromRight.value,
      edgeInset: edgeInset.value,
    })
  }

  // Touch pointermove never enters this path: phones keep the old passive
  // scroll hint. A real mouse reveals the thumb as it approaches the track,
  // and leaving that neighbourhood starts the ordinary one-second fade.
  function onWindowPointerMove(event) {
    if (drag || event.pointerType !== 'mouse') return
    const inside = length.value > 0 && proximity(event)
    if (inside) {
      near = true
      reveal()
      return
    }
    if (near) {
      near = false
      scheduleFade()
    }
  }

  function onPointerOut(event) {
    if (drag || event.relatedTarget) return
    if (near) {
      near = false
      scheduleFade()
    }
  }

  function dragStart(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || drag) return
    const metrics = measure()
    if (!metrics) return
    event.preventDefault()
    drag = {
      pointerId: event.pointerId,
      y: event.clientY,
      startOffset: metrics.offset,
      length: metrics.length,
      target: event.currentTarget,
    }
    dragging.value = true
    near = true
    visible.value = true
    clearFade()
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function dragMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return
    event.preventDefault()
    const top = dragScrollTop({
      startOffset: drag.startOffset,
      deltaY: event.clientY - drag.y,
      ...geometry,
      length: drag.length,
    })
    root.scrollTo({ top, behavior: 'auto' })
    // The scroll event is asynchronous; paint the dragged thumb now.
    measure()
    visible.value = true
  }

  function dragEnd(event) {
    if (!drag || event.pointerId !== drag.pointerId) return
    const finished = drag
    drag = null
    dragging.value = false
    if (finished.target?.hasPointerCapture?.(finished.pointerId)) {
      finished.target.releasePointerCapture?.(finished.pointerId)
    }
    near = event.pointerType === 'mouse' && proximity(event)
    reveal()
  }

  function onBlur() {
    if (!drag) return
    const finished = drag
    drag = null
    dragging.value = false
    near = false
    if (finished.target?.hasPointerCapture?.(finished.pointerId)) {
      finished.target.releasePointerCapture?.(finished.pointerId)
    }
    scheduleFade()
  }

  function attach() {
    if (attached || !root || !doc) return
    attached = true
    read()
    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('resize', onResize)
    root.addEventListener('pointermove', onWindowPointerMove, { passive: true })
    root.addEventListener('pointerout', onPointerOut, { passive: true })
    root.addEventListener('blur', onBlur)
    // The column's height changes with the screen, with a dropdown opening and
    // with a different lesson count, so the thumb is re-measured when it does.
    const column = doc.querySelector('.column')
    if (typeof ResizeObserver === 'function' && column) {
      observer = new ResizeObserver(() => read())
      observer.observe(column)
    }
  }

  function detach() {
    if (!attached) return
    attached = false
    onBlur()
    root.removeEventListener('scroll', onScroll)
    root.removeEventListener('resize', onResize)
    root.removeEventListener('pointermove', onWindowPointerMove)
    root.removeEventListener('pointerout', onPointerOut)
    root.removeEventListener('blur', onBlur)
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    if (observer) observer.disconnect()
    observer = null
    clearFade()
    near = false
    visible.value = false
    dragging.value = false
    length.value = 0
    offset.value = 0
  }

  onBeforeUnmount(detach)

  return {
    visible,
    dragging,
    length,
    offset,
    fromRight,
    edgeInset,
    attach,
    detach,
    dragStart,
    dragMove,
    dragEnd,
  }
}

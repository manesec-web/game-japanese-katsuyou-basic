// Wiring for a thumb that lives inside a scroll container (the two dropdown
// lists). The numbers come from `scrollbar.js`; this module watches the
// element, reads its geometry, runs the fade, and owns fine-mouse dragging.
// Kept apart from the page's own bar because that one is fixed to the window
// and follows `window.scrollY`.
import { onBeforeUnmount, ref } from 'vue'
import { dragScrollTop, listThumbMetrics, LIST_SCROLLBAR } from './scrollbar.js'

export function useElementThumb() {
  const visible = ref(false)
  const dragging = ref(false)
  const length = ref(0)
  const offset = ref(0)

  let element = null
  let fadeTimer = null
  let frame = 0
  let observer = null
  let drag = null

  function clearFade() {
    clearTimeout(fadeTimer)
    fadeTimer = null
  }

  function scheduleFade() {
    clearFade()
    if (drag) return
    fadeTimer = setTimeout(() => {
      visible.value = false
      fadeTimer = null
    }, LIST_SCROLLBAR.fadeDelay)
  }

  function measure() {
    if (!element) return null
    const metrics = listThumbMetrics({
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    })
    length.value = metrics.length
    offset.value = metrics.offset
    if (!metrics.visible) visible.value = false
    return metrics.visible ? metrics : null
  }

  function read() {
    return Boolean(measure())
  }

  // An overflowing list shows its thumb on open, while scrolling, and when a
  // pointer enters or moves inside it. Every one of those events restarts the
  // short wait before the hint leaves again. A held thumb never fades.
  function reveal() {
    if (!read()) return
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

  // Pointer events are handled directly: hover and movement are their own
  // hint, independent of any scroll frame.
  function onPointerActivity() {
    reveal()
  }

  // The 4px drawing has a wider invisible hit area in ScrollThumb.vue. Only a
  // primary fine-mouse press starts here; touch keeps the browser's ordinary
  // scroll gesture. Preserve the offset within the thumb so grabbing its top,
  // middle or bottom never makes it jump.
  function dragStart(event) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || drag || !element) return
    const metrics = measure()
    if (!metrics) return
    event.preventDefault()
    drag = {
      pointerId: event.pointerId,
      y: event.clientY,
      // listThumbMetrics includes the panel's top inset in its drawn offset;
      // the inverse mapping wants travel within the track only.
      startOffset: metrics.offset - LIST_SCROLLBAR.inset,
      viewport: element.clientHeight,
      content: element.scrollHeight,
      track: metrics.track,
      length: metrics.length,
      target: event.currentTarget,
    }
    dragging.value = true
    visible.value = true
    clearFade()
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function dragMove(event) {
    if (!drag || event.pointerId !== drag.pointerId || !element) return
    event.preventDefault()
    element.scrollTop = dragScrollTop({
      startOffset: drag.startOffset,
      deltaY: event.clientY - drag.y,
      viewport: drag.viewport,
      content: drag.content,
      track: drag.track,
      length: drag.length,
    })
    // Update the drawn thumb in the same event rather than waiting for the
    // browser's separate scroll notification.
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
    reveal()
  }

  function detach() {
    if (drag?.target?.hasPointerCapture?.(drag.pointerId)) {
      drag.target.releasePointerCapture?.(drag.pointerId)
    }
    drag = null
    dragging.value = false
    if (!element) return
    element.removeEventListener('scroll', onScroll)
    element.removeEventListener('pointerenter', onPointerActivity)
    element.removeEventListener('pointermove', onPointerActivity)
    if (observer) {
      observer.disconnect()
      observer = null
    }
    element = null
    clearFade()
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    visible.value = false
    length.value = 0
    offset.value = 0
  }

  // The view calls this whenever its list element appears or is replaced (both
  // dropdowns mount the list from a `v-if`).
  function attach(next) {
    if (next === element) return
    detach()
    element = next ?? null
    if (!element) return
    element.addEventListener('scroll', onScroll, { passive: true })
    element.addEventListener('pointerenter', onPointerActivity, { passive: true })
    element.addEventListener('pointermove', onPointerActivity, { passive: true })
    // The panel's height does not change while it is open, but a resize of the
    // window (or a rotation) does, so the thumb is re-measured whenever it does.
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(() => read())
      observer.observe(element)
    }
    // Dropdowns are mounted by a v-if whenever they open, so attaching is the
    // opening event: an overflowing list reveals the hint immediately.
    reveal()
  }

  onBeforeUnmount(detach)

  return { visible, dragging, length, offset, attach, dragStart, dragMove, dragEnd }
}

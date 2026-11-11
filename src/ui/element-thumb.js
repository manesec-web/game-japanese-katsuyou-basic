// Wiring for a thumb that lives inside a scroll container (the two dropdown
// lists). The numbers come from `scrollbar.js`; this file only watches the
// element, reads its geometry and runs the fade. Kept apart from the page's
// own bar because that one is fixed to the window and follows `window.scrollY`.
import { onBeforeUnmount, ref } from 'vue'
import { listThumbMetrics, LIST_SCROLLBAR } from './scrollbar.js'

export function useElementThumb() {
  const visible = ref(false)
  const length = ref(0)
  const offset = ref(0)

  let element = null
  let fadeTimer = null
  let frame = 0
  let observer = null

  function read() {
    if (!element) return false
    const metrics = listThumbMetrics({
      scrollTop: element.scrollTop,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    })
    length.value = metrics.length
    offset.value = metrics.offset
    if (!metrics.visible) visible.value = false
    return metrics.visible
  }

  // An overflowing list shows its thumb on open, while scrolling, and when a
  // pointer enters or moves inside it. Every one of those events restarts the
  // short wait before the hint leaves again.
  function reveal() {
    if (!read()) return
    visible.value = true
    clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => {
      visible.value = false
      fadeTimer = null
    }, LIST_SCROLLBAR.fadeDelay)
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

  function detach() {
    if (!element) return
    element.removeEventListener('scroll', onScroll)
    element.removeEventListener('pointerenter', onPointerActivity)
    element.removeEventListener('pointermove', onPointerActivity)
    if (observer) {
      observer.disconnect()
      observer = null
    }
    element = null
    clearTimeout(fadeTimer)
    fadeTimer = null
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

  return { visible, length, offset, attach }
}

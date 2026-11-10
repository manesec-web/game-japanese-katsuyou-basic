// Keeps the mounted paging window as state between turns, so a page turn really
// is one delete at one end and one append at the other — not a fresh array
// derived from scratch. The row of list positions lives in a ref, and a turn
// hands it to `shiftWindow`.
//
// A new run (a different `items` array length, e.g. after 開始 or after the
// settings rebuild the list) falls back to deriving the whole window, because
// there is no previous row to shift from.
import { ref, watch } from 'vue'
import { CURRENT_SLOT, shiftWindow, windowSlots } from './window.js'

export function usePagingWindow(session, size) {
  let total = session.items.length
  const slots = ref(windowSlots(total, session.index, size))

  function clampIndex() {
    const count = session.items.length
    if (count <= 0) return 0
    return Math.min(Math.max(session.index, 0), count - 1)
  }

  function sync() {
    const count = session.items.length
    // A new list has no previous row to shift: derive it once.
    if (count !== total || slots.value.length !== size) {
      total = count
      slots.value = windowSlots(count, clampIndex(), size)
      return
    }
    // Otherwise walk to the new position one turn at a time, so each step is
    // the same front-delete / back-append the gesture performs.
    let guard = 0
    while (slots.value[CURRENT_SLOT] !== clampIndex() && guard <= size) {
      const direction = slots.value[CURRENT_SLOT] < clampIndex() ? 'next' : 'prev'
      const moved = shiftWindow(slots.value, count, direction)
      if (!moved) break
      slots.value = moved
      guard += 1
    }
  }

  watch(() => [session.items.length, session.index], sync, { immediate: true })

  return slots
}

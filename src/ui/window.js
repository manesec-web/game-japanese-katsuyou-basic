// The paging window: the row of items that stays mounted around the current
// one, so a page turn never re-renders the row. The current item always sits
// in the 3rd slot — two slots behind it cover going back, the rest cover
// going forward — so a turn is one delete at one end and one append at the
// other. Slots past the ends of the list are empty and render nothing.
//
// Pure bookkeeping over list positions. The views map slots to items and own
// every pixel of motion; the commands keep their ids and clamp the index, so
// the window never has to refuse a move that already happened.

// Cards are small, so 翻卡學習 keeps a deep row for fast flipping. One
// dictionary word is fifteen form blocks, so the reader keeps fewer.
export const CARD_WINDOW = 9
export const READER_WINDOW = 5

// The 0-based slot the current item sits in — the 3rd.
export const CURRENT_SLOT = 2

// One entry per slot: the item's position in the list, or null when the slot
// falls past an end. The current item is always slots[CURRENT_SLOT] except in
// an empty list. An out-of-range index is clamped to the nearest end.
export function windowSlots(total, index, size) {
  const slots = new Array(size).fill(null)
  if (total <= 0) return slots
  const at = Math.min(Math.max(index, 0), total - 1)
  for (let slot = 0; slot < size; slot++) {
    const item = at - CURRENT_SLOT + slot
    if (item >= 0 && item < total) slots[slot] = item
  }
  return slots
}

// Where a slot sits on screen, in card widths from the current one: the slot
// beside the current one is one full width away, and so on. The container
// clips everything outside the current slot, so only its 0 is ever visible.
// A slot is exactly as wide as the container, so this percentage is measured
// against the slot's own width — the row itself is never translated.
export function windowOffset(slot) {
  return (slot - CURRENT_SLOT) * 100
}

// One stable identity per rendered slot. Keyed by the item's position, not by
// the slot number, so Vue keeps the nodes of the items that stay in the window
// and creates only the one that entered: a next move really does drop the front
// node and add a back node. An empty slot is named by where it sits.
export function slotKey(at, slot) {
  return at === null ? `empty-${slot}` : `item-${at}`
}

// One page turn as a window edit. Going next deletes the front slot and
// appends the next list item at the back; going prev mirrors it — delete the
// back slot and prepend the previous item at the front. Returns null when the
// move would leave the list or the direction is unknown: the commands clamp
// the index instead, so a refused move never reaches the screen.
export function shiftWindow(slots, total, direction) {
  const size = slots.length
  const index = slots[CURRENT_SLOT]
  if (index === null) return null
  if (direction === 'next') {
    if (index >= total - 1) return null
    const back = index + size - CURRENT_SLOT
    return [...slots.slice(1), back < total ? back : null]
  }
  if (direction === 'prev') {
    if (index <= 0) return null
    const front = index - CURRENT_SLOT - 1
    return [front >= 0 ? front : null, ...slots.slice(0, size - 1)]
  }
  return null
}

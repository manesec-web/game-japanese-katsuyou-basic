// Turns the paging window into what each view renders. One entry per slot, in
// slot order, so the view only loops and prints: the slot's position on screen
// comes from `windowOffset`, its identity from `slotKey`, and its contents from
// the item at that list position — never from "the current item". That is what
// keeps a neighbour showing its own word instead of a copy of the current one.
import { formName } from '../dict/forms.js'
import { windowGap, windowOffset, slotKey, CURRENT_SLOT } from '../ui/window.js'
import { backTags, frontTags } from './card-tags.js'
import { orderedFormEntries } from './reader-forms.js'

// The frame both views share: where the slot sits and which item it holds.
// `slots` is the row itself — the state the views keep between turns — so this
// only maps positions to view data and never rebuilds the row.
function frames(items, slots) {
  return slots.map((at, slot) => ({
    slot,
    at,
    key: slotKey(at, slot),
    offset: windowOffset(slot),
    gap: windowGap(slot),
    current: slot === CURRENT_SLOT,
    item: at === null ? null : items[at],
  }))
}

export function cardEntries(items, slots, settings) {
  return frames(items, slots).map((frame) => {
    const item = frame.item
    if (!item) return { ...frame, face: null, back: null }
    const source = item.verb?.[settings.from] ?? null
    const target = item.verb?.[item.targetForm] ?? null
    return {
      ...frame,
      face: {
        word: source?.vol ?? '',
        reading: source?.japanese ?? '',
        tags: frontTags(settings, source),
        prompt: `變成${formName(item.targetForm)}`,
      },
      back: {
        word: target?.vol ?? '',
        reading: target?.japanese ?? '',
        gloss: target?.chinese ?? '',
        tags: backTags(item.targetForm, target, {
          lesson: item.lesson,
          errorUsage: target?.error_usage === true,
        }),
      },
    }
  })
}

export function readerEntries(items, slots, settings) {
  return frames(items, slots).map((frame) => {
    const item = frame.item
    if (!item) return { ...frame, forms: [] }
    return {
      ...frame,
      lesson: item.lesson,
      forms: orderedFormEntries(item.verb, settings.defaultForm, {
        skipErrorUsage: settings.skipErrorUsage,
        displayForms: settings.displayForms,
      }),
    }
  })
}

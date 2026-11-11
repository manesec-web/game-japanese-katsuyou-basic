// Builds the study item list for the current mode.
//
// Dictionary: verbs in lesson order, JSON order inside each lesson.
// Card and quiz: those verbs crossed with the selected target forms, verb
// order first, then the canonical form order (settings keep that order).
// The card and quiz lists are then shuffled once, here, so a started session
// keeps one frozen order for 上一個 / 下一個.
import { shuffle } from './shuffle.js'

export function buildItems(mode, library, modeSettings, options = {}) {
  const { random = Math.random, shuffled = true } = options
  const verbs = library.getVerbs(modeSettings.lessons)
  if (mode === 'dict') {
    return verbs.map(({ lesson, verb }) => ({ mode: 'dict', lesson, verb }))
  }
  const targets = modeSettings.to ?? []
  const skipErrorUsage = modeSettings.skipErrorUsage === true
  const items = []
  for (const { lesson, verb } of verbs) {
    for (const targetForm of targets) {
      if (skipErrorUsage && verb[targetForm]?.error_usage === true) continue
      items.push({ mode, lesson, verb, targetForm })
    }
  }
  return shuffled && items.length > 1 ? shuffle(items, random) : items
}

// A quiz/card item whose target form is an invalid conjugation kept for
// practice only (the 跳過錯誤的單詞 switch hides these).
export function isErrorUsageItem(item) {
  return item?.verb?.[item?.targetForm]?.error_usage === true
}

// Reconcile the quiz queue when 跳過錯誤的單詞 flips while a run is live.
// `index` is the item on screen: when skipping turns on, error_usage items are
// removed from the unanswered portion (the current item included), and the
// answered items behind it stay. Turning it off puts the skipped items back.
export function reconcileQuizQueue(items, skipped, index, skipOn) {
  if (skipOn) {
    const past = items.slice(0, index)
    const remaining = items.slice(index)
    const kept = remaining.filter((item) => !isErrorUsageItem(item))
    const removed = remaining.filter(isErrorUsageItem)
    return {
      items: [...past, ...kept],
      skipped: [...skipped, ...removed],
    }
  }
  return { items: [...items, ...skipped], skipped: [] }
}

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
  const items = []
  for (const { lesson, verb } of verbs) {
    for (const targetForm of targets) {
      items.push({ mode, lesson, verb, targetForm })
    }
  }
  return shuffled && items.length > 1 ? shuffle(items, random) : items
}

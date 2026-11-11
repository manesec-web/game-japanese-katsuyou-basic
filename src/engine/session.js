// Session state. Plain data only; commands perform the transitions.
import { defaultSettings } from '../dict/settings.js'
import { createResults } from '../study/results.js'

export const SCREENS = ['loading', 'home', 'picker', 'reader', 'card', 'quiz', 'settings']
export const MODES = ['dict', 'card', 'quiz']

export function createSession() {
  return {
    screen: 'loading',
    mode: 'dict',
    boot: { checked: 0, total: 0, done: false, error: null, running: false },
    lessons: [],
    settings: defaultSettings(),
    items: [],
    index: 0,
    flipped: false,
    answer: { input: '', wrong: 0, revealed: false, verdict: null },
    // Per-run tally and the flag that swaps in the completion screen.
    results: createResults(),
    finished: false,
    // Quiz only: error_usage items held out of the active queue by 跳過錯誤的
    // 單詞, so a mid-run toggle can put them back at the tail.
    quizSkipped: [],
  }
}

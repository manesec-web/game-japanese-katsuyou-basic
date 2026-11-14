// Session state. Plain data only; commands perform the transitions.
import { defaultSettings } from '../dict/settings.js'
import { createResults } from '../study/results.js'

export const SCREENS = ['loading', 'home', 'picker', 'reader', 'toc', 'card', 'quiz', 'settings']
export const MODES = ['dict', 'card', 'quiz']

export function createSession() {
  return {
    screen: 'loading',
    mode: 'dict',
    // `download` feeds the loading bar while dict/vol.bin is streaming: `base`
    // is the verified percentage when the attempt started, `loaded` / `total`
    // are bytes, and `done` means the bytes have arrived and the bar holds at
    // 100 while the extracted lessons are verified.
    boot: {
      checked: 0,
      total: 0,
      done: false,
      error: null,
      running: false,
      download: { base: 0, loaded: 0, total: 0, done: false },
    },
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
    // Audio playback: `verified` remembers which lesson bins were sha256-checked
    // this session (reset on reload), `states` maps a clickable target id to
    // its transient visual state ('downloading' | 'playing'), and `hint` is the
    // transient 「該音頻暫時無法播放」 toast text.
    audio: { verified: {}, states: {}, hint: null },
  }
}

import { CommandError } from '../engine/errors.js'
import { canStart } from '../dict/settings.js'
import { buildItems, isErrorUsageItem } from '../study/items.js'
import { createResults } from '../study/results.js'

export const STUDY_SCREEN = { dict: 'reader', card: 'card', quiz: 'quiz' }

export function specs(deps = {}) {
  const library = deps.library
  const random = deps.random

  return [
    {
      id: 'study.start',
      params: [],
      enabled: (session) => canStart(session.settings, session.mode),
      run: (session) => {
        if (!library) {
          throw new CommandError('library-missing', 'library is not configured')
        }
        const mode = session.mode
        session.quizSkipped = []
        let items
        if (mode === 'quiz') {
          // Build the full shuffled queue, then split off the error_usage items
          // when 跳過錯誤的單詞 is on. Keeping them in `quizSkipped` lets a
          // mid-run toggle put them back at the tail.
          const full = buildItems(
            'quiz',
            library,
            { ...session.settings.quiz, skipErrorUsage: false },
            random ? { random } : {},
          )
          if (session.settings.quiz.skipErrorUsage) {
            items = full.filter((item) => !isErrorUsageItem(item))
            session.quizSkipped = full.filter(isErrorUsageItem)
          } else {
            items = full
          }
        } else {
          items = buildItems(mode, library, session.settings[mode], random ? { random } : {})
        }
        if (items.length === 0) {
          throw new CommandError('no-items', '沒有可練習的項目')
        }
        session.items = items
        session.index = 0
        session.flipped = false
        session.answer = { input: '', wrong: 0, revealed: false, verdict: null }
        session.results = createResults()
        session.finished = false
        session.screen = STUDY_SCREEN[mode]
        return { count: items.length, screen: session.screen }
      },
    },
    {
      // Cards have no grading: 完成 on the last card ends the run.
      id: 'study.finish',
      params: [],
      enabled: (session) => session.screen === 'card' && session.items.length > 0,
      run: (session) => {
        session.finished = true
        return { finished: true }
      },
    },
  ]
}

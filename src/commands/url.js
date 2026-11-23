// URL deep-link routing. The page URL is parsed once at load (src/study/url.js)
// and the intent is applied here after a successful boot lands on `home`.
//
// One command applies the intent; a second hands the 單詞目錄 view its one-shot
// search prefill and clears it. Both are ordinary commands the views and tests
// call through the same `dispatch`, so a bad deep link returns `{ ok: false }`
// instead of throwing past the registry.
import { CommandError } from '../engine/errors.js'
import { FORM_IDS } from '../dict/forms.js'
import { buildItems } from '../study/items.js'
import { createResults } from '../study/results.js'
import { resolveWord } from '../study/url.js'

const TARGET_SCREENS = ['reader', 'toc', 'rule', 'learn']

export function specs(deps = {}) {
  const library = deps.library

  return [
    {
      id: 'url.open',
      params: ['screen'],
      enabled: (session, params) =>
        session.boot.done === true &&
        session.screen === 'home' &&
        TARGET_SCREENS.includes(params.screen),
      run: (session, params) => {
        const screen = params.screen

        if (screen === 'learn') {
          session.screen = 'learn'
          return { screen }
        }

        if (!library) {
          throw new CommandError('library-missing', 'library is not configured')
        }

        if (screen === 'rule') {
          const { from, to } = params
          if (!FORM_IDS.includes(from) || !FORM_IDS.includes(to) || from === to) {
            throw new CommandError('invalid-deeplink', '變形說明 deep link needs two different forms', {
              from,
              to,
            })
          }
          session.rule.from = from
          session.rule.to = to
          session.rule.returnTo = 'learn'
          session.rule.ruleScrollTop = null
          session.rule.readerScrollTop = null
          session.rule.readerRestore = null
          // 例如 is optional. When the link names a verb it must resolve; a link
          // that names no verb keeps the default 選擇單詞作為例子.
          const hasWord = typeof params.word === 'string' && params.word.trim() !== ''
          const hasIndex = Number.isInteger(params.index)
          const wantsExample = Number.isInteger(params.lesson) && (hasWord || hasIndex)
          if (wantsExample) {
            const ref = resolveWord(library, params.lesson, params.word, params.index)
            if (!ref) {
              throw new CommandError('invalid-deeplink', 'example word does not exist', {
                lesson: params.lesson,
                word: params.word,
                index: params.index,
              })
            }
            session.rule.example = ref
          } else {
            session.rule.example = null
          }
          session.screen = 'rule'
          return { screen, from, to, example: session.rule.example }
        }

        // reader and toc share one single-lesson run; the reader opens on the
        // resolved verb and the 目錄 opens on it too, with the search prefilled.
        const ref = resolveWord(library, params.lesson, params.word, params.index)
        if (!ref) {
          throw new CommandError('invalid-deeplink', 'no matching word', {
            lesson: params.lesson,
            word: params.word,
            index: params.index,
          })
        }
        const items = buildItems('dict', library, { ...session.settings.dict, lessons: [ref.lesson] }, {})
        if (items.length === 0) {
          throw new CommandError('no-items', '沒有可練習的項目')
        }
        session.mode = 'dict'
        session.quizSkipped = []
        session.items = items
        session.index = ref.index
        session.flipped = false
        session.answer = { input: '', wrong: 0, revealed: false, verdict: null }
        session.results = createResults()
        session.finished = false
        session.screen = screen
        if (screen === 'toc') {
          session.toc.prefill = params.word ?? null
        }
        return { screen, lesson: ref.lesson, index: ref.index }
      },
    },
    {
      // The 單詞目錄 view reads and clears the deep link's one-shot prefill on
      // mount, so an ordinary later visit starts with the search box closed.
      id: 'toc.takePrefill',
      params: [],
      enabled: (session) => session.screen === 'toc',
      run: (session) => {
        const query = session.toc?.prefill ?? null
        if (session.toc) session.toc.prefill = null
        return { query }
      },
    },
  ]
}

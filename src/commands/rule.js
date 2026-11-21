// 學習 mode commands: open the explanation from the directory, change 從/到,
// and choose the example word from the dictionary.
import { CommandError } from '../engine/errors.js'
import { FORM_IDS } from '../dict/forms.js'
import { fallbackTarget } from '../dict/settings.js'
import { exampleVerb } from '../study/rule.js'

export function specs(deps = {}) {
  const library = deps.library

  return [
    {
      // A directory row opens 變形說明 with 到 set to the pressed form and 從
      // set to the default ます形; when the pressed form is ます形, 從 becomes
      // 辭書形 so 從 and 到 differ. The example resets on every entry.
      id: 'rule.open',
      params: ['to'],
      enabled: (session, params) => session.screen === 'learn' && FORM_IDS.includes(params.to),
      run: (session, params) => {
        const to = params.to
        session.rule.from = to === 'masu-form' ? 'dictionary-form' : 'masu-form'
        session.rule.to = to
        session.rule.example = null
        session.rule.returnTo = 'learn'
        // A fresh entry from 學習目錄 starts at the top of the explanation.
        session.rule.ruleScrollTop = null
        session.rule.readerScrollTop = null
        session.rule.readerRestore = null
        session.screen = 'rule'
        return { from: session.rule.from, to: session.rule.to, screen: session.screen }
      },
    },
    {
      // 從 is a single choice. If it lands on the current 到, 到 moves to the
      // fallback target so the two stay different.
      id: 'rule.setFrom',
      params: ['form'],
      enabled: (session, params) => session.screen === 'rule' && FORM_IDS.includes(params.form),
      run: (session, params) => {
        session.rule.from = params.form
        if (session.rule.to === params.form) {
          session.rule.to = fallbackTarget(params.form)
        }
        return { from: session.rule.from, to: session.rule.to }
      },
    },
    {
      // 到 is a single choice; it can never equal 從.
      id: 'rule.setTo',
      params: ['form'],
      enabled: (session, params) =>
        session.screen === 'rule' &&
        FORM_IDS.includes(params.form) &&
        params.form !== session.rule.from,
      run: (session, params) => {
        session.rule.to = params.form
        return { from: session.rule.from, to: session.rule.to }
      },
    },
    {
      // The 選字 screen selects the example word. Only a reference that points
      // at a real verb is accepted; anything else is an error.
      id: 'rule.selectExample',
      params: ['lesson', 'index'],
      enabled: (session) => session.screen === 'example',
      run: (session, params) => {
        const { lesson, index } = params
        if (!exampleVerb(library, { lesson, index })) {
          throw new CommandError('invalid-example', `No verb at 第${String(lesson)}課 #${String(index)}`, {
            lesson,
            index,
          })
        }
        session.rule.example = { lesson, index }
        session.screen = 'rule'
        // `ruleScrollTop` was recorded by 變形說明 before opening 選字; keep
        // it so the view can restore the same scroll position on return.
        return {
          example: session.rule.example,
          screen: session.screen,
          scrollTop: session.rule.ruleScrollTop,
        }
      },
    },
  ]
}

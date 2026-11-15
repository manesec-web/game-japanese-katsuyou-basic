// Reader → 變形說明 link and scroll memory.
//
// Both behaviours are pure session transitions, so the views and the tests
// call the same `dispatch`. `rule.openFromReader` takes the reader's current
// 預設顯示形式 as 從 and the pressed form as 到, and pins 例如 to the verb on
// screen. The scroll positions are plain numbers the views read and consume;
// no DOM is touched here.
import { CommandError } from '../engine/errors.js'
import { FORM_IDS } from '../dict/forms.js'
import { fallbackTarget } from '../dict/settings.js'
import { exampleVerb } from '../study/rule.js'

// Find the current reader verb in the library's lesson order. The reader's
// items are built from the same library (lesson order, JSON order inside a
// lesson), so `{ lesson, index }` is the reference 選字 already uses.
//
// The library re-parses its stored JSON on each `getVerbs` call, so the verb
// object in `session.items` is NOT the same object identity as a freshly
// returned one. Match by the dictionary form's reading + written word, which
// is unique inside a lesson, instead of by reference.
export function readerExampleRef(library, item) {
  if (!library || !item || !Number.isInteger(item.lesson)) return null
  const dict = item.verb?.['dictionary-form']
  if (!dict || typeof dict.japanese !== 'string' || typeof dict.vol !== 'string') return null
  const verbs = library.getVerbs([item.lesson])
  const index = verbs.findIndex(({ verb }) => {
    const candidate = verb?.['dictionary-form']
    return candidate?.japanese === dict.japanese && candidate?.vol === dict.vol
  })
  if (index < 0) return null
  return { lesson: item.lesson, index }
}

// A pure validation helper: the reader's default form must be a real form id,
// the pressed target must differ from it, and the verb must exist in the
// library. The command uses this to reject bad params with `error` instead of
// throwing.
export function readerRuleParams(session, params, library) {
  const from = session.settings?.dict?.defaultForm
  const to = params?.to
  if (!FORM_IDS.includes(from) || !FORM_IDS.includes(to) || from === to) return null
  const item = session.items?.[session.index]
  const example = readerExampleRef(library, item)
  if (!example || !exampleVerb(library, example)) return null
  return { from, to, example }
}

export function specs(deps = {}) {
  const library = deps.library

  return [
    {
      // 變形原理 in a dictionary form block: jump to 變形說明 with 從 = the
      // reader's 預設顯示形式 and 到 = the pressed form, with the on-screen
      // verb already chosen as the 例如 example. The reader's scroll position
      // is saved so returning from 變形說明 does not reset the page to top.
      id: 'rule.openFromReader',
      params: ['to'],
      enabled: (session, params) =>
        session.screen === 'reader' && readerRuleParams(session, params, library) !== null,
      run: (session, params) => {
        const resolved = readerRuleParams(session, params, library)
        if (!resolved) throw new CommandError('invalid-rule-link', 'cannot open the rule from this reader word', { to: params?.to })
        session.rule.from = resolved.from
        session.rule.to = resolved.to
        session.rule.example = resolved.example
        session.rule.returnTo = 'reader'
        session.rule.ruleScrollTop = null
        session.rule.readerScrollTop = Number.isFinite(params.scrollTop) ? Math.max(0, params.scrollTop) : null
        session.rule.readerRestore = null
        session.screen = 'rule'
        return { from: session.rule.from, to: session.rule.to, example: session.rule.example, screen: session.screen }
      },
    },
    {
      // 變形說明 remembers where 選字 was opened. The view records the number
      // just before leaving; this command keeps the value in session state so
      // the screen transition cannot lose it.
      id: 'rule.rememberScroll',
      params: ['scrollTop'],
      enabled: (session, params) =>
        session.screen === 'rule' && Number.isFinite(params.scrollTop) && params.scrollTop >= 0,
      run: (session, params) => {
        session.rule.ruleScrollTop = params.scrollTop
        return { scrollTop: session.rule.ruleScrollTop }
      },
    },
  ]
}

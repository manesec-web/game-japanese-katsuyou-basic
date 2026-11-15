import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as readerRuleSpecs, readerExampleRef, readerRuleParams } from './reader-rule.js'
import { specs as ruleSpecs } from './rule.js'
import { specs as navSpecs } from './nav.js'
import { specs as studySpecs } from './study.js'
import { specs as dictSpecs } from './dict.js'

const verbA = {
  'dictionary-form': { vol: 'A', japanese: 'えー', group: '1' },
  'masu-form': { vol: 'Aます', group: '1' },
  'nai-form': { vol: 'Aない', group: '1' },
}
const verbB = {
  'dictionary-form': { vol: 'B', japanese: 'びー', group: '1' },
  'masu-form': { vol: 'Bます', group: '1' },
  'nai-form': { vol: 'Bない', group: '1' },
}

function fakeLibrary(byLesson = { 2: [verbA, verbB], 5: [verbB] }) {
  return {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) => (byLesson[lesson] ?? []).map((verb) => ({ lesson, verb }))),
    hasVerbs: (lesson) => Boolean(byLesson[lesson]?.length),
    verbLessons: () => Object.keys(byLesson).map(Number).sort((a, b) => a - b),
  }
}

function makeRegistry(library = fakeLibrary()) {
  const registry = createRegistry()
  registry.registerAll([
    ...studySpecs({ library }),
    ...dictSpecs(),
    ...ruleSpecs({ library }),
    ...readerRuleSpecs({ library }),
    ...navSpecs(),
  ])
  return registry
}

function readerSession(library = fakeLibrary()) {
  const registry = makeRegistry(library)
  const session = createSession()
  session.settings.dict.lessons = [2]
  registry.dispatch(session, 'study.start', {})
  return { registry, session }
}

describe('readerExampleRef / readerRuleParams', () => {
  it('resolves the current reader verb to a 選字 reference', () => {
    expect(readerExampleRef(fakeLibrary(), { lesson: 2, verb: verbB })).toEqual({ lesson: 2, index: 1 })
  })

  it('rejects a verb that is not in the library', () => {
    expect(readerExampleRef(fakeLibrary(), { lesson: 2, verb: {} })).toBeNull()
    expect(readerExampleRef(null, { lesson: 2, verb: verbA })).toBeNull()
  })

  it('rejects a 到 equal to 預設顯示形式 or an unknown form', () => {
    const { session } = readerSession()
    expect(readerRuleParams(session, { to: 'masu-form' }, fakeLibrary())).toBeNull()
    expect(readerRuleParams(session, { to: 'nope' }, fakeLibrary())).toBeNull()
    expect(readerRuleParams(session, { to: 'nai-form' }, fakeLibrary())).toEqual({
      from: 'masu-form', to: 'nai-form', example: { lesson: 2, index: 0 },
    })
  })
})

describe('rule.openFromReader', () => {
  it('sets 從 = 預設顯示形式, 到 = the pressed form and pins 例如 to the word on screen', () => {
    const { registry, session } = readerSession()
    const result = registry.dispatch(session, 'rule.openFromReader', { to: 'nai-form', scrollTop: 812 })
    expect(result.ok).toBe(true)
    expect(session.screen).toBe('rule')
    expect(session.rule.from).toBe('masu-form')
    expect(session.rule.to).toBe('nai-form')
    expect(session.rule.example).toEqual({ lesson: 2, index: 0 })
    expect(session.rule.returnTo).toBe('reader')
    expect(session.rule.readerScrollTop).toBe(812)
  })

  it('uses the word the reader had moved to', () => {
    const { registry, session } = readerSession()
    registry.dispatch(session, 'dict.next')
    registry.dispatch(session, 'rule.openFromReader', { to: 'nai-form' })
    expect(session.rule.example).toEqual({ lesson: 2, index: 1 })
  })

  it('refuses 預設顯示形式 itself and an unknown form, without leaving the reader', () => {
    const { registry, session } = readerSession()
    for (const to of ['masu-form', 'nope']) {
      const result = registry.dispatch(session, 'rule.openFromReader', { to })
      expect(result.ok).toBe(false)
      expect(result.error.code).toBe('command-disabled')
    }
    expect(session.screen).toBe('reader')
    expect(session.rule.example).toBeNull()
  })

  it('is disabled outside the reader', () => {
    const registry = makeRegistry()
    const session = createSession()
    const result = registry.dispatch(session, 'rule.openFromReader', { to: 'nai-form' })
    expect(result.ok).toBe(false)
  })
})

describe('rule.rememberScroll / nav.go chain', () => {
  it('keeps the 選字 scroll position across the screen swap', () => {
    const { registry, session } = readerSession()
    registry.dispatch(session, 'rule.openFromReader', { to: 'nai-form', scrollTop: 600 })
    expect(registry.dispatch(session, 'rule.rememberScroll', { scrollTop: 430 }).ok).toBe(true)
    registry.dispatch(session, 'nav.go', { screen: 'example' })
    const selected = registry.dispatch(session, 'rule.selectExample', { lesson: 2, index: 1 })
    expect(selected.ok).toBe(true)
    expect(session.screen).toBe('rule')
    expect(session.rule.ruleScrollTop).toBe(430)
  })

  it('returns to the dictionary reader and hands over the reader scroll', () => {
    const { registry, session } = readerSession()
    registry.dispatch(session, 'rule.openFromReader', { to: 'nai-form', scrollTop: 600 })
    registry.dispatch(session, 'nav.go', { screen: 'reader' })
    expect(session.screen).toBe('reader')
    expect(session.index).toBe(0)
    expect(session.rule.readerRestore).toBe(600)
    expect(session.rule.readerScrollTop).toBeNull()
  })

  it('returns to 學習目錄 for a directory entry, with no reader restore', () => {
    const registry = makeRegistry()
    const session = createSession()
    registry.dispatch(session, 'nav.go', { screen: 'home' })
    registry.dispatch(session, 'nav.go', { screen: 'learn' })
    registry.dispatch(session, 'rule.open', { to: 'nai-form' })
    registry.dispatch(session, 'nav.go', { screen: 'learn' })
    expect(session.screen).toBe('learn')
    expect(session.rule.readerRestore).toBeNull()
  })

  it('rejects a non-negative, finite scrollTop', () => {
    const { registry, session } = readerSession()
    session.screen = 'rule'
    expect(registry.dispatch(session, 'rule.rememberScroll', { scrollTop: -1 }).ok).toBe(false)
    expect(registry.dispatch(session, 'rule.rememberScroll', { scrollTop: '4' }).ok).toBe(false)
    expect(registry.dispatch(session, 'rule.rememberScroll', { scrollTop: 0 }).ok).toBe(true)
    expect(session.rule.ruleScrollTop).toBe(0)
  })
})

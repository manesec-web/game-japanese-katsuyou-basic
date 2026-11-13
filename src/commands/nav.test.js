import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as studySpecs } from './study.js'
import { specs as navSpecs } from './nav.js'
import { specs as dictSpecs } from './dict.js'

const verbA = { 'dictionary-form': { vol: 'A' } }
const verbB = { 'dictionary-form': { vol: 'B' } }

function library(lessons) {
  return {
    getVerbs: (selected) =>
      selected.flatMap((lesson) => (lessons[lesson] ?? []).map((verb) => ({ lesson, verb }))),
    hasVerbs: (lesson) => Boolean(lessons[lesson]?.length),
    verbLessons: () => Object.keys(lessons).map(Number).sort((a, b) => a - b),
  }
}

function makeRegistry() {
  const registry = createRegistry()
  registry.registerAll([
    ...studySpecs({ library: library({ 2: [verbA, verbB] }) }),
    ...dictSpecs(),
    ...navSpecs(),
  ])
  return registry
}

function readerSession() {
  const registry = makeRegistry()
  const session = createSession()
  session.settings.dict.lessons = [2]
  registry.dispatch(session, 'study.start', {})
  return { registry, session }
}

describe('nav.go and 單詞目錄', () => {
  it('opens the word list from the reader', () => {
    const { registry, session } = readerSession()
    const result = registry.dispatch(session, 'nav.go', { screen: 'toc' })
    expect(result.ok).toBe(true)
    expect(session.screen).toBe('toc')
    // The list never changes the word behind it.
    expect(session.index).toBe(0)
  })

  it('returns to the word the reader had moved to', () => {
    const { registry, session } = readerSession()
    registry.dispatch(session, 'dict.next')
    expect(session.index).toBe(1)
    registry.dispatch(session, 'nav.go', { screen: 'toc' })
    // The list itself never moves the run.
    expect(session.index).toBe(1)
    registry.dispatch(session, 'nav.go', { screen: 'reader' })
    expect(session.screen).toBe('reader')
    expect(session.index).toBe(1)
  })

  it('refuses the list outside the reader', () => {
    const { registry, session } = readerSession()
    registry.dispatch(session, 'nav.go', { screen: 'picker' })
    const result = registry.dispatch(session, 'nav.go', { screen: 'toc' })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
    expect(session.screen).toBe('picker')
  })

  it('refuses the list before a run started', () => {
    const registry = makeRegistry()
    const session = createSession()
    session.screen = 'reader'
    const result = registry.dispatch(session, 'nav.go', { screen: 'toc' })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
  })
})

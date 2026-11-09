import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as studySpecs } from './study.js'
import { specs as dictSpecs } from './dict.js'

function fakeLibrary(byLesson) {
  return {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) =>
        (byLesson[lesson] ?? []).map((verb) => ({ lesson, verb })),
      ),
    hasVerbs: (lesson) => Boolean(byLesson[lesson] && byLesson[lesson].length > 0),
    verbLessons: () =>
      Object.keys(byLesson)
        .map(Number)
        .filter((lesson) => byLesson[lesson].length > 0)
        .sort((a, b) => a - b),
  }
}

const verbA = { 'dictionary-form': { vol: 'A' } }
const verbB = { 'dictionary-form': { vol: 'B' } }

function makeRegistry(library) {
  const registry = createRegistry()
  registry.registerAll([...studySpecs({ library }), ...dictSpecs()])
  return registry
}

describe('study.start', () => {
  it('refuses to start without selected lessons', () => {
    const registry = makeRegistry(fakeLibrary({ 2: [verbA] }))
    const session = createSession()
    const result = registry.dispatch(session, 'study.start', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
    expect(session.items).toEqual([])
  })

  it('builds dictionary items and opens the reader', () => {
    const library = fakeLibrary({ 2: [verbA], 5: [verbB] })
    const registry = makeRegistry(library)
    const session = createSession()
    session.settings.dict.lessons = [2, 5]
    const result = registry.dispatch(session, 'study.start', {})
    expect(result.ok).toBe(true)
    expect(result.result.count).toBe(2)
    expect(session.screen).toBe('reader')
    expect(session.index).toBe(0)
    expect(session.items.map((item) => item.verb)).toEqual([verbA, verbB])
  })
})

describe('dict.next / dict.prev', () => {
  function studySession() {
    const registry = makeRegistry(fakeLibrary({ 2: [verbA, verbB] }))
    const session = createSession()
    session.settings.dict.lessons = [2]
    registry.dispatch(session, 'study.start', {})
    return { registry, session }
  }

  it('walks forward and backward inside the list', () => {
    const { registry, session } = studySession()
    registry.dispatch(session, 'dict.next')
    expect(session.index).toBe(1)
    registry.dispatch(session, 'dict.prev')
    expect(session.index).toBe(0)
  })

  it('does not move before the first item', () => {
    const { registry, session } = studySession()
    registry.dispatch(session, 'dict.prev')
    expect(session.index).toBe(0)
    registry.dispatch(session, 'dict.prev')
    expect(session.index).toBe(0)
  })

  it('does not move past the last item', () => {
    const { registry, session } = studySession()
    registry.dispatch(session, 'dict.next')
    registry.dispatch(session, 'dict.next')
    registry.dispatch(session, 'dict.next')
    expect(session.index).toBe(1)
  })

  it('is disabled outside the reader', () => {
    const { registry, session } = studySession()
    session.screen = 'picker'
    const result = registry.dispatch(session, 'dict.next', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
    expect(session.index).toBe(0)
  })
})

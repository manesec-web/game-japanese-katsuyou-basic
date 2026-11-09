import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as lessonSpecs } from './lessons.js'
import { specs as settingsSpecs } from './settings.js'

function fakeLibrary(verbLessons) {
  const set = new Set(verbLessons)
  return {
    hasVerbs: (lesson) => set.has(lesson),
    verbLessons: () => [...verbLessons],
  }
}

function setup({ verbLessons = [2, 5] } = {}) {
  const saved = []
  const settingsStorage = { save: (settings) => saved.push(JSON.parse(JSON.stringify(settings))) }
  const registry = createRegistry()
  registry.registerAll([
    ...lessonSpecs({ library: fakeLibrary(verbLessons), settingsStorage }),
    ...settingsSpecs({ settingsStorage }),
  ])
  const session = createSession()
  return { registry, session, saved }
}

describe('lessons.toggle', () => {
  it('refuses lessons without verbs and keeps state unchanged', () => {
    const { registry, session } = setup()
    const result = registry.dispatch(session, 'lessons.toggle', { lesson: 1 })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('lesson-empty')
    expect(session.settings.dict.lessons).toEqual([])
  })

  it('adds and removes a lesson', () => {
    const { registry, session } = setup()
    expect(registry.dispatch(session, 'lessons.toggle', { lesson: 2 }).ok).toBe(true)
    expect(session.settings.dict.lessons).toEqual([2])
    expect(registry.dispatch(session, 'lessons.toggle', { lesson: 2 }).ok).toBe(true)
    expect(session.settings.dict.lessons).toEqual([])
  })

  it('keeps selections per mode', () => {
    const { registry, session } = setup()
    session.mode = 'card'
    registry.dispatch(session, 'lessons.toggle', { lesson: 5 })
    expect(session.settings.card.lessons).toEqual([5])
    expect(session.settings.dict.lessons).toEqual([])
  })

  it('persists after every change', () => {
    const { registry, session, saved } = setup()
    registry.dispatch(session, 'lessons.toggle', { lesson: 5 })
    expect(saved.at(-1).card.lessons).toEqual([])
    expect(saved.at(-1).dict.lessons).toEqual([5])
  })
})

describe('lessons.selectAll', () => {
  it('selects only lessons with verbs', () => {
    const { registry, session } = setup({ verbLessons: [2, 5, 9] })
    registry.dispatch(session, 'lessons.selectAll')
    expect(session.settings.dict.lessons).toEqual([2, 5, 9])
  })

  it('clears when every verb lesson is already selected', () => {
    const { registry, session } = setup({ verbLessons: [2, 5] })
    registry.dispatch(session, 'lessons.selectAll')
    registry.dispatch(session, 'lessons.selectAll')
    expect(session.settings.dict.lessons).toEqual([])
  })
})

describe('settings.patch', () => {
  it('merges a valid patch and persists', () => {
    const { registry, session, saved } = setup()
    const result = registry.dispatch(session, 'settings.patch', {
      patch: { card: { from: 'dictionary-form', showGroup: false } },
    })
    expect(result.ok).toBe(true)
    expect(session.settings.card.from).toBe('dictionary-form')
    expect(session.settings.card.to).toEqual(['masu-form'])
    expect(session.settings.card.showGroup).toBe(false)
    expect(saved).toHaveLength(1)
  })

  it('rejects the whole patch when any field is invalid', () => {
    const { registry, session } = setup()
    const before = JSON.stringify(session.settings)
    const result = registry.dispatch(session, 'settings.patch', {
      patch: { quiz: { showReading: false, nope: 1 } },
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('invalid-settings')
    expect(JSON.stringify(session.settings)).toBe(before)
  })

  it('cannot leave 到 equal to 從', () => {
    const { registry, session } = setup()
    registry.dispatch(session, 'settings.patch', { patch: { quiz: { from: 'dictionary-form' } } })
    expect(session.settings.quiz.to).toEqual(['masu-form'])
  })
})

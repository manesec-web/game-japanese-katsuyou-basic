import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as studySpecs } from './study.js'
import { specs as settingsSpecs } from './settings.js'
import { specs as quizSpecs } from './quiz.js'
import { FORM_IDS } from '../dict/forms.js'
import {
  nextSelectAllDisplayForms,
  selectAllDisplayLabel,
} from '../dict/settings.js'

const VERB_OK = {
  'dictionary-form': { vol: '行く', japanese: 'いく' },
  'masu-form': { vol: '行きます', japanese: 'いきます' },
  'passive-form': { vol: '行かれる', japanese: 'いかれる' },
}
const VERB_ERR = {
  'dictionary-form': { vol: 'ある', japanese: 'ある' },
  'masu-form': { vol: 'あります', japanese: 'あります' },
  'passive-form': { vol: 'あられる', japanese: 'あられる', error_usage: true },
}

function fakeLibrary(byLesson) {
  return {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) =>
        (byLesson[lesson] ?? []).map((verb) => ({ lesson, verb })),
      ),
  }
}

function setup() {
  const registry = createRegistry()
  const library = fakeLibrary({ 5: [VERB_OK, VERB_ERR] })
  // random() just below 1 leaves Fisher–Yates unshuffled, so the queue is the
  // deterministic [VERB_OK, VERB_ERR].
  registry.registerAll([
    ...studySpecs({ library, random: () => 0.99 }),
    ...settingsSpecs(),
    ...quizSpecs(),
  ])
  const session = createSession()
  session.mode = 'quiz'
  session.settings.quiz.lessons = [5]
  session.settings.quiz.from = 'masu-form'
  session.settings.quiz.to = ['passive-form']
  registry.dispatch(session, 'study.start', {})
  return { registry, session }
}

describe('settings.patch persists the dictionary display-form choice', () => {
  it('saves 全選 and 取消全選 transitions, with the default form still drawn', () => {
    const saved = []
    const registry = createRegistry()
    registry.registerAll(settingsSpecs({ settingsStorage: { save: (value) => saved.push(value) } }))
    const session = createSession()
    session.mode = 'dict'
    session.settings.dict.displayForms = ['masu-form']
    const all = nextSelectAllDisplayForms(session.settings.dict.displayForms, 'masu-form')
    const selected = registry.dispatch(session, 'settings.patch', {
      patch: { dict: { displayForms: all } },
    })
    expect(selected.ok).toBe(true)
    expect(session.settings.dict.displayForms).toEqual(FORM_IDS)
    expect(selectAllDisplayLabel(session.settings.dict.displayForms)).toBe('取消全選')
    const cleared = registry.dispatch(session, 'settings.patch', {
      patch: {
        dict: { displayForms: nextSelectAllDisplayForms(all, 'masu-form') },
      },
    })
    expect(cleared.ok).toBe(true)
    expect(session.settings.dict.displayForms).toEqual(['masu-form'])
    expect(selectAllDisplayLabel(session.settings.dict.displayForms)).toBe('全選')
    expect(saved).toHaveLength(2)
    expect(saved.at(-1).dict.displayForms).toEqual(['masu-form'])
  })
})

describe('settings.patch reconciles a live quiz queue', () => {
  it('removes the error_usage item when skipping turns on', () => {
    const { registry, session } = setup()
    expect(session.items.map((item) => item.verb)).toEqual([VERB_OK, VERB_ERR])

    const result = registry.dispatch(session, 'settings.patch', {
      patch: { quiz: { skipErrorUsage: true } },
    })
    expect(result.ok).toBe(true)
    expect(session.items.map((item) => item.verb)).toEqual([VERB_OK])
    expect(session.quizSkipped.map((item) => item.verb)).toEqual([VERB_ERR])
  })

  it('puts the skipped item back at the tail when skipping turns off', () => {
    const { registry, session } = setup()
    registry.dispatch(session, 'settings.patch', {
      patch: { quiz: { skipErrorUsage: true } },
    })
    expect(session.items).toHaveLength(1)

    const result = registry.dispatch(session, 'settings.patch', {
      patch: { quiz: { skipErrorUsage: false } },
    })
    expect(result.ok).toBe(true)
    expect(session.items.map((item) => item.verb)).toEqual([VERB_OK, VERB_ERR])
    expect(session.quizSkipped).toEqual([])
  })

  it('removes the current error item and settles when nothing follows', () => {
    const { registry, session } = setup()
    // Answer the first item, so the error item becomes the one on screen.
    session.settings.quiz.autoSubmit = false
    registry.dispatch(session, 'quiz.input', { op: 'append', text: 'いかれる' })
    const graded = registry.dispatch(session, 'quiz.submit', {})
    expect(graded.result.status).toBe('correct')
    expect(session.index).toBe(1)

    registry.dispatch(session, 'settings.patch', {
      patch: { quiz: { skipErrorUsage: true } },
    })
    expect(session.items.map((item) => item.verb)).toEqual([VERB_OK])
    expect(session.quizSkipped.map((item) => item.verb)).toEqual([VERB_ERR])
    expect(session.finished).toBe(true)
  })
})

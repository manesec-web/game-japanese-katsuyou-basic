import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as studySpecs } from './study.js'
import { specs as cardSpecs } from './card.js'

const VERB_A = {
  'dictionary-form': { vol: 'A' },
  'masu-form': { vol: 'A-masu' },
  'ta-form': { vol: 'A-ta' },
}
const VERB_B = {
  'dictionary-form': { vol: 'B' },
  'masu-form': { vol: 'B-masu' },
  'ta-form': { vol: 'B-ta' },
}

function fakeLibrary(byLesson) {
  return {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) =>
        (byLesson[lesson] ?? []).map((verb) => ({ lesson, verb })),
      ),
  }
}

function setup(options = {}) {
  const registry = createRegistry()
  const library = fakeLibrary({ 2: [VERB_A, VERB_B] })
  registry.registerAll([...studySpecs({ library, random: options.random }), ...cardSpecs()])
  const session = createSession()
  session.mode = 'card'
  session.settings.card.lessons = [2]
  session.settings.card.from = 'masu-form'
  session.settings.card.to = ['dictionary-form', 'ta-form']
  registry.dispatch(session, 'study.start', {})
  return { registry, session }
}

describe('card commands', () => {
  it('crosses verbs with target forms and holds one frozen shuffled order', () => {
    const { session } = setup({ random: () => 0.4 })
    expect(session.screen).toBe('card')
    expect(session.items).toHaveLength(4)
    const keys = session.items.map(
      (item) => `${item.verb['dictionary-form'].vol}:${item.targetForm}`,
    )
    expect([...keys].sort()).toEqual(
      ['A:dictionary-form', 'A:ta-form', 'B:dictionary-form', 'B:ta-form'].sort(),
    )
    expect(new Set(keys).size).toBe(4)
  })

  it('flips the card back and forth', () => {
    const { registry, session } = setup()
    expect(session.flipped).toBe(false)
    registry.dispatch(session, 'card.flip', {})
    expect(session.flipped).toBe(true)
    registry.dispatch(session, 'card.flip', {})
    expect(session.flipped).toBe(false)
  })

  it('returns to the face when moving forward or backward', () => {
    const { registry, session } = setup()
    registry.dispatch(session, 'card.flip', {})
    registry.dispatch(session, 'card.next', {})
    expect(session.index).toBe(1)
    expect(session.flipped).toBe(false)

    registry.dispatch(session, 'card.flip', {})
    registry.dispatch(session, 'card.prev', {})
    expect(session.index).toBe(0)
    expect(session.flipped).toBe(false)
  })

  it('stays inside the card list at both ends', () => {
    const { registry, session } = setup()
    for (let i = 0; i < 6; i += 1) registry.dispatch(session, 'card.next', {})
    expect(session.index).toBe(3)
    for (let i = 0; i < 6; i += 1) registry.dispatch(session, 'card.prev', {})
    expect(session.index).toBe(0)
  })

  it('is disabled outside the card screen', () => {
    const { registry, session } = setup()
    session.screen = 'picker'
    const result = registry.dispatch(session, 'card.flip', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
    expect(session.flipped).toBe(false)
  })
})

describe('study.finish', () => {
  it('ends a card run and shows the completion screen', () => {
    const { registry, session } = setup({ random: () => 0.4 })
    expect(session.finished).toBe(false)
    const result = registry.dispatch(session, 'study.finish', {})
    expect(result.ok).toBe(true)
    expect(session.finished).toBe(true)
  })

  it('is disabled outside the card screen', () => {
    const { registry, session } = setup({ random: () => 0.4 })
    session.screen = 'picker'
    const result = registry.dispatch(session, 'study.finish', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
    expect(session.finished).toBe(false)
  })
})

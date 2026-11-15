import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as ruleSpecs } from './rule.js'
import { specs as navSpecs } from './nav.js'

const verbA = {
  'dictionary-form': { vol: 'A', group: '1' },
  'masu-form': { vol: 'Aます', group: '1' },
}
const verbB = {
  'dictionary-form': { vol: 'B', group: '1' },
  'masu-form': { vol: 'Bます', group: '1' },
}

function fakeLibrary(byLesson = { 2: [verbA, verbB] }) {
  return {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) => (byLesson[lesson] ?? []).map((verb) => ({ lesson, verb }))),
    hasVerbs: (lesson) => Boolean(byLesson[lesson]?.length),
    verbLessons: () =>
      Object.keys(byLesson)
        .map(Number)
        .filter((lesson) => byLesson[lesson].length > 0)
        .sort((a, b) => a - b),
  }
}

function makeRegistry(library = fakeLibrary()) {
  const registry = createRegistry()
  registry.registerAll([...ruleSpecs({ library }), ...navSpecs()])
  return registry
}

function onLearnSession() {
  const registry = makeRegistry()
  const session = createSession()
  registry.dispatch(session, 'nav.go', { screen: 'home' })
  registry.dispatch(session, 'nav.go', { screen: 'learn' })
  return { registry, session }
}

describe('rule.open', () => {
  it('opens 變形說明 from 學習目錄 with 從 default ます形', () => {
    const { registry, session } = onLearnSession()
    const result = registry.dispatch(session, 'rule.open', { to: 'ta-form' })
    expect(result.ok).toBe(true)
    expect(session.screen).toBe('rule')
    expect(session.rule.from).toBe('masu-form')
    expect(session.rule.to).toBe('ta-form')
    expect(session.rule.example).toBeNull()
  })

  it('uses 字典形 as 從 when the pressed form is ます形', () => {
    const { registry, session } = onLearnSession()
    registry.dispatch(session, 'rule.open', { to: 'masu-form' })
    expect(session.rule.from).toBe('dictionary-form')
    expect(session.rule.to).toBe('masu-form')
  })

  it('resets the example and refuses an unknown form', () => {
    const { registry, session } = onLearnSession()
    session.rule.example = { lesson: 2, index: 0 }
    const bad = registry.dispatch(session, 'rule.open', { to: 'nope' })
    expect(bad.ok).toBe(false)
    expect(bad.error.code).toBe('command-disabled')
    expect(session.screen).toBe('learn')
  })

  it('is disabled outside 學習目錄', () => {
    const registry = makeRegistry()
    const session = createSession()
    const result = registry.dispatch(session, 'rule.open', { to: 'ta-form' })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
  })
})

describe('rule.setFrom / rule.setTo', () => {
  it('changes 從 and keeps 到', () => {
    const { registry, session } = onLearnSession()
    registry.dispatch(session, 'rule.open', { to: 'ta-form' })
    registry.dispatch(session, 'rule.setFrom', { form: 'nai-form' })
    expect(session.rule.from).toBe('nai-form')
    expect(session.rule.to).toBe('ta-form')
  })

  it('moves 到 to the fallback when 從 lands on it', () => {
    const { registry, session } = onLearnSession()
    registry.dispatch(session, 'rule.open', { to: 'ta-form' })
    registry.dispatch(session, 'rule.setFrom', { form: 'ta-form' })
    expect(session.rule.from).toBe('ta-form')
    expect(session.rule.to).toBe('dictionary-form')
  })

  it('refuses a 到 equal to 從 and an invalid form', () => {
    const { registry, session } = onLearnSession()
    registry.dispatch(session, 'rule.open', { to: 'ta-form' })
    const same = registry.dispatch(session, 'rule.setTo', { form: 'masu-form' })
    expect(same.ok).toBe(false)
    expect(same.error.code).toBe('command-disabled')
    expect(registry.dispatch(session, 'rule.setTo', { form: 'nope' }).ok).toBe(false)
    expect(session.rule.to).toBe('ta-form')
  })

  it('are disabled outside 變形說明', () => {
    const registry = makeRegistry()
    const session = createSession()
    expect(registry.dispatch(session, 'rule.setFrom', { form: 'ta-form' }).ok).toBe(false)
    expect(registry.dispatch(session, 'rule.setTo', { form: 'ta-form' }).ok).toBe(false)
  })
})

describe('rule.selectExample', () => {
  function onExample() {
    const { registry, session } = onLearnSession()
    registry.dispatch(session, 'rule.open', { to: 'dictionary-form' })
    registry.dispatch(session, 'nav.go', { screen: 'example' })
    return { registry, session }
  }

  it('stores the chosen verb and returns to 變形說明', () => {
    const { registry, session } = onExample()
    const result = registry.dispatch(session, 'rule.selectExample', { lesson: 2, index: 1 })
    expect(result.ok).toBe(true)
    expect(session.screen).toBe('rule')
    expect(session.rule.example).toEqual({ lesson: 2, index: 1 })
  })

  it('rejects a reference with no verb and stays on 選字', () => {
    const { registry, session } = onExample()
    const result = registry.dispatch(session, 'rule.selectExample', { lesson: 2, index: 9 })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('invalid-example')
    expect(session.screen).toBe('example')
    expect(session.rule.example).toBeNull()
  })

  it('rejects a non-integer reference', () => {
    const { registry, session } = onExample()
    expect(registry.dispatch(session, 'rule.selectExample', { lesson: 2, index: '1' }).ok).toBe(false)
    expect(registry.dispatch(session, 'rule.selectExample', { lesson: '2', index: 1 }).ok).toBe(false)
    expect(session.screen).toBe('example')
  })

  it('is disabled outside 選字', () => {
    const registry = makeRegistry()
    const session = createSession()
    const result = registry.dispatch(session, 'rule.selectExample', { lesson: 2, index: 0 })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
  })
})

describe('nav.go for the 學習 screens', () => {
  it('opens 學習目錄 from home and returns', () => {
    const registry = makeRegistry()
    const session = createSession()
    registry.dispatch(session, 'nav.go', { screen: 'home' })
    expect(registry.dispatch(session, 'nav.go', { screen: 'learn' }).ok).toBe(true)
    expect(session.screen).toBe('learn')
    expect(registry.dispatch(session, 'nav.go', { screen: 'home' }).ok).toBe(true)
    expect(session.screen).toBe('home')
  })

  it('walks learn → rule → example and back', () => {
    const { registry, session } = onLearnSession()
    registry.dispatch(session, 'rule.open', { to: 'dictionary-form' })
    expect(session.screen).toBe('rule')
    expect(registry.dispatch(session, 'nav.go', { screen: 'example' }).ok).toBe(true)
    expect(session.screen).toBe('example')
    expect(registry.dispatch(session, 'nav.go', { screen: 'rule' }).ok).toBe(true)
    expect(session.screen).toBe('rule')
    expect(registry.dispatch(session, 'nav.go', { screen: 'learn' }).ok).toBe(true)
    expect(session.screen).toBe('learn')
  })

  it('refuses to jump straight into 變形說明 without rule.open', () => {
    const { registry, session } = onLearnSession()
    const result = registry.dispatch(session, 'nav.go', { screen: 'rule' })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
    expect(session.screen).toBe('learn')
  })
})

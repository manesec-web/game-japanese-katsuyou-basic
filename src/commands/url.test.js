import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as urlSpecs } from './url.js'

const f = (vol, japanese = vol) => ({ vol, japanese })

function fakeLibrary(byLesson) {
  return {
    getVerbs: (lessons) =>
      lessons.flatMap((lesson) =>
        (byLesson[lesson] ?? []).map((verb) => ({ lesson, verb })),
      ),
  }
}

const iku = {
  'dictionary-form': f('行く', 'いく'),
  'masu-form': f('行きます', 'いきます'),
  'te-form': f('行って', 'いって'),
}
const taberu = {
  'dictionary-form': f('食べる', 'たべる'),
  'masu-form': f('食べます', 'たべます'),
}
const kuru = { 'dictionary-form': f('来る', 'くる') }

function makeRegistry(library = fakeLibrary({ 2: [iku, taberu], 5: [kuru] })) {
  const registry = createRegistry()
  registry.registerAll(urlSpecs({ library }))
  return registry
}

function booted() {
  const session = createSession()
  session.boot.done = true
  session.screen = 'home'
  return session
}

describe('url.open', () => {
  it('is disabled before boot finishes or outside home', () => {
    const registry = makeRegistry()
    const before = createSession()
    expect(registry.dispatch(before, 'url.open', { screen: 'learn' }).error.code).toBe(
      'command-disabled',
    )

    const session = booted()
    session.screen = 'picker'
    expect(registry.dispatch(session, 'url.open', { screen: 'learn' }).error.code).toBe(
      'command-disabled',
    )
  })

  it('is disabled for a non-deep-link screen', () => {
    const registry = makeRegistry()
    const session = booted()
    expect(registry.dispatch(session, 'url.open', { screen: 'settings' }).error.code).toBe(
      'command-disabled',
    )
  })

  it('opens the reader on the resolved word', () => {
    const registry = makeRegistry()
    const session = booted()
    const result = registry.dispatch(session, 'url.open', {
      screen: 'reader',
      lesson: 2,
      word: 'taberu',
    })
    expect(result.ok).toBe(true)
    expect(session.screen).toBe('reader')
    expect(session.mode).toBe('dict')
    expect(session.index).toBe(1)
    expect(session.items.map((item) => item.verb)).toEqual([iku, taberu])
    expect(result.result).toEqual({ screen: 'reader', lesson: 2, index: 1 })
  })

  it('opens 單詞目錄 with the search prefilled, consumable once', () => {
    const registry = makeRegistry()
    const session = booted()
    const result = registry.dispatch(session, 'url.open', {
      screen: 'toc',
      lesson: 2,
      word: 'ikimasu',
    })
    expect(result.ok).toBe(true)
    expect(session.screen).toBe('toc')
    expect(session.index).toBe(0)
    expect(session.toc.prefill).toBe('ikimasu')

    const taken = registry.dispatch(session, 'toc.takePrefill', {})
    expect(taken).toEqual({ ok: true, result: { query: 'ikimasu' } })
    expect(session.toc.prefill).toBeNull()
  })

  it('opens 變形目錄', () => {
    const registry = makeRegistry()
    const session = booted()
    const result = registry.dispatch(session, 'url.open', { screen: 'learn' })
    expect(result.ok).toBe(true)
    expect(session.screen).toBe('learn')
  })

  it('opens 變形說明 with 從/到 and a preselected example', () => {
    const registry = makeRegistry()
    const session = booted()
    const result = registry.dispatch(session, 'url.open', {
      screen: 'rule',
      from: 'masu-form',
      to: 'te-form',
      lesson: 2,
      word: 'taberu',
    })
    expect(result.ok).toBe(true)
    expect(session.screen).toBe('rule')
    expect(session.rule.from).toBe('masu-form')
    expect(session.rule.to).toBe('te-form')
    expect(session.rule.example).toEqual({ lesson: 2, index: 1 })
    expect(session.rule.returnTo).toBe('learn')
  })

  it('opens 變形說明 with no example when no verb is named', () => {
    const registry = makeRegistry()
    const session = booted()
    const result = registry.dispatch(session, 'url.open', {
      screen: 'rule',
      from: 'dictionary-form',
      to: 'te-form',
    })
    expect(result.ok).toBe(true)
    expect(session.screen).toBe('rule')
    expect(session.rule.example).toBeNull()
  })

  it('rejects a rule link whose example word does not exist', () => {
    const registry = makeRegistry()
    const session = booted()
    const result = registry.dispatch(session, 'url.open', {
      screen: 'rule',
      from: 'masu-form',
      to: 'te-form',
      lesson: 2,
      word: 'zzz',
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('invalid-deeplink')
    expect(session.screen).toBe('home')
    expect(session.rule.example).toBeNull()
  })

  it('rejects a reader link whose word does not exist', () => {
    const registry = makeRegistry()
    const session = booted()
    const result = registry.dispatch(session, 'url.open', {
      screen: 'reader',
      lesson: 2,
      word: 'zzz',
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('invalid-deeplink')
    expect(session.screen).toBe('home')
    expect(session.items).toEqual([])
  })

  it('rejects a rule link with equal or unknown forms', () => {
    const registry = makeRegistry()
    const session = booted()
    expect(
      registry.dispatch(session, 'url.open', { screen: 'rule', from: 'masu-form', to: 'masu-form' })
        .error.code,
    ).toBe('invalid-deeplink')
    expect(
      registry.dispatch(session, 'url.open', { screen: 'rule', from: 'bad', to: 'te-form' }).error
        .code,
    ).toBe('invalid-deeplink')
    expect(session.screen).toBe('home')
  })
})

describe('toc.takePrefill', () => {
  it('returns null when there is no prefill', () => {
    const registry = makeRegistry()
    const session = booted()
    session.screen = 'toc'
    expect(registry.dispatch(session, 'toc.takePrefill', {})).toEqual({
      ok: true,
      result: { query: null },
    })
  })

  it('is disabled outside 單詞目錄', () => {
    const registry = makeRegistry()
    const session = booted()
    expect(registry.dispatch(session, 'toc.takePrefill', {}).error.code).toBe('command-disabled')
  })
})

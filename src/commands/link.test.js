import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as linkSpecs } from './link.js'

function readerSession() {
  const session = createSession()
  session.screen = 'reader'
  session.index = 0
  session.items = [{ lesson: 5, verb: { 'dictionary-form': { vol: '行く', japanese: 'いく' } } }]
  return session
}

describe('link.copy', () => {
  it('writes the generated deep-link URL and returns it', async () => {
    let copied = null
    const registry = createRegistry()
    registry.registerAll(
      linkSpecs({
        href: () => 'http://x.test/game/',
        writeClipboard: async (text) => {
          copied = text
        },
      }),
    )
    const session = readerSession()
    const result = await registry.dispatch(session, 'link.copy', {})
    expect(result.ok).toBe(true)
    expect(result.result.url).toBe('http://x.test/game/?screen=reader&lesson=5&word=行く')
    expect(copied).toBe('http://x.test/game/?screen=reader&lesson=5&word=行く')
  })

  it('is disabled on a screen with no deep link', () => {
    const registry = createRegistry()
    registry.registerAll(linkSpecs({ href: () => 'http://x.test/' }))
    const session = createSession()
    session.screen = 'home'
    const result = registry.dispatch(session, 'link.copy', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
  })

  it('returns copy-failed when the clipboard rejects', async () => {
    const registry = createRegistry()
    registry.registerAll(
      linkSpecs({
        href: () => 'http://x.test/',
        writeClipboard: async () => {
          throw new Error('denied')
        },
      }),
    )
    const session = readerSession()
    const result = await registry.dispatch(session, 'link.copy', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('copy-failed')
  })
})

import { describe, expect, it } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as themeSpecs } from './theme.js'

function setup(storage = null) {
  const registry = createRegistry()
  const saved = []
  const themeStorage = {
    save: (value) => {
      saved.push(value)
      return true
    },
  }
  registry.registerAll(themeSpecs(storage === null ? { themeStorage } : { themeStorage: storage }))
  const session = createSession()
  return { registry, session, saved }
}

describe('theme.toggle', () => {
  it('turns the light theme dark and remembers the choice', () => {
    const { registry, session, saved } = setup()
    session.theme = { value: 'light', source: 'system' }
    const result = registry.dispatch(session, 'theme.toggle')
    expect(result.ok).toBe(true)
    expect(session.theme).toEqual({ value: 'dark', source: 'user' })
    expect(saved).toEqual(['dark'])
  })

  it('toggles back and leaves the source as the user', () => {
    const { registry, session, saved } = setup()
    session.theme = { value: 'dark', source: 'user' }
    registry.dispatch(session, 'theme.toggle')
    expect(session.theme).toEqual({ value: 'light', source: 'user' })
    expect(saved).toEqual(['light'])
  })

  it('works without a storage adapter', () => {
    const registry = createRegistry()
    registry.registerAll(themeSpecs())
    const session = createSession()
    const result = registry.dispatch(session, 'theme.toggle')
    expect(result.ok).toBe(true)
    expect(session.theme.value).toBe('dark')
  })
})

import { describe, expect, it } from 'vitest'
import { createRegistry } from './registry.js'
import { createSession } from './session.js'
import { specs as navSpecs } from '../commands/nav.js'

function makeRegistry() {
  const reg = createRegistry()
  reg.registerAll(navSpecs())
  return reg
}

describe('dispatch', () => {
  it('returns ok:false for an unknown command', () => {
    const reg = makeRegistry()
    const result = reg.dispatch(createSession(), 'does.not.exist', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('unknown-command')
    expect(reg.get('does.not.exist')).toBeNull()
  })

  it('returns ok:false for an empty command id', () => {
    const reg = makeRegistry()
    expect(reg.dispatch(createSession(), '', {}).error.code).toBe('unknown-command')
  })

  it('rejects a missing required parameter', () => {
    const reg = makeRegistry()
    const result = reg.dispatch(createSession(), 'nav.go', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('missing-param')
    expect(result.error.details.missing).toEqual(['screen'])
  })

  it('rejects an invalid parameter value through enabled()', () => {
    const reg = makeRegistry()
    const result = reg.dispatch(createSession(), 'nav.go', { screen: 'nope' })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
  })

  it('does not run a disabled command', () => {
    const reg = createRegistry()
    let ran = false
    reg.register({
      id: 'never.run',
      enabled: () => false,
      run: () => {
        ran = true
      },
    })
    const result = reg.dispatch(createSession(), 'never.run', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
    expect(ran).toBe(false)
  })

  it('converts a thrown error into an error result instead of throwing', () => {
    const reg = createRegistry()
    reg.register({
      id: 'boom',
      run: () => {
        throw new Error('kaboom')
      },
    })
    const result = reg.dispatch(createSession(), 'boom', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-failed')
    expect(result.error.message).toBe('kaboom')
  })

  it('runs nav.go and updates the session screen', () => {
    const reg = makeRegistry()
    const session = createSession()
    const result = reg.dispatch(session, 'nav.go', { screen: 'home' })
    expect(result.ok).toBe(true)
    expect(result.result).toEqual({ screen: 'home', mode: 'dict' })
    expect(session.screen).toBe('home')
  })

  it('refuses to register duplicate ids', () => {
    const reg = createRegistry()
    const spec = { id: 'dup', run: () => null }
    reg.register(spec)
    expect(() => reg.register(spec)).toThrow(/duplicate command id/)
  })
})

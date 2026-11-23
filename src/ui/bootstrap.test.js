import { describe, expect, it } from 'vitest'
import { bootstrap } from './bootstrap.js'

function fakeStore({ deepLink = null, bootResult = { ok: true, result: { checked: 50, total: 50 } } } = {}) {
  const calls = []
  return {
    store: {
      deepLink,
      session: { settings: {}, boot: {}, lessons: [] },
      deps: {
        library: { load: async () => [] },
        settingsStorage: { load: () => ({}) },
      },
      send(id, params) {
        calls.push({ id, params })
        if (id === 'app.boot') return bootResult
        return { ok: true, result: {} }
      },
    },
    calls,
  }
}

describe('bootstrap deep link', () => {
  it('lands on home and applies a parsed deep link', async () => {
    const { store, calls } = fakeStore({ deepLink: { screen: 'learn' } })
    await bootstrap(store)
    expect(calls.map((call) => call.id)).toEqual(['app.boot', 'nav.go', 'url.open'])
    expect(calls[1]).toEqual({ id: 'nav.go', params: { screen: 'home' } })
    expect(calls[2]).toEqual({ id: 'url.open', params: { screen: 'learn' } })
  })

  it('lands on home without applying anything when no deep link was parsed', async () => {
    const { store, calls } = fakeStore({ deepLink: null })
    await bootstrap(store)
    expect(calls.map((call) => call.id)).toEqual(['app.boot', 'nav.go'])
  })

  it('never applies a deep link when boot fails', async () => {
    const { store, calls } = fakeStore({
      deepLink: { screen: 'learn' },
      bootResult: { ok: false, error: { code: 'boot-failed', message: 'nope' } },
    })
    await bootstrap(store)
    expect(calls.map((call) => call.id)).toEqual(['app.boot'])
  })
})

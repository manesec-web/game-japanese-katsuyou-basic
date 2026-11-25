import { describe, expect, it } from 'vitest'
import {
  THEME_KEY,
  LEGACY_THEME_KEY,
  THEMES,
  isTheme,
  nextTheme,
  systemTheme,
  themeState,
} from './theme.js'
import { createThemeStorage } from '../storage/theme.js'

describe('theme rules', () => {
  it('offers exactly the two themes', () => {
    expect(THEMES).toEqual(['light', 'dark'])
    expect(isTheme('dark')).toBe(true)
    expect(isTheme('light')).toBe(true)
    expect(isTheme('sepia')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })

  it('maps the OS preference onto a theme name', () => {
    expect(systemTheme(true)).toBe('dark')
    expect(systemTheme(false)).toBe('light')
  })

  it('stores the key the storage adapter writes', () => {
    expect(THEME_KEY).toBe('game-japanese-katsuyou-basic-theme')
  })
})

describe('the theme a reload starts with', () => {
  it('follows the OS preference when the user has not chosen', () => {
    expect(themeState({ stored: null, system: 'dark' })).toEqual({
      value: 'dark',
      source: 'system',
    })
    expect(themeState({ stored: null, system: 'light' })).toEqual({
      value: 'light',
      source: 'system',
    })
  })

  it('lets a stored choice win over the OS preference', () => {
    expect(themeState({ stored: 'light', system: 'dark' })).toEqual({
      value: 'light',
      source: 'user',
    })
    expect(themeState({ stored: 'dark', system: 'light' })).toEqual({
      value: 'dark',
      source: 'user',
    })
  })

  it('ignores an unrecognised stored value and falls back to the OS', () => {
    expect(themeState({ stored: 'sepia', system: 'dark' })).toEqual({
      value: 'dark',
      source: 'system',
    })
  })

  it('falls back to light when nothing is known', () => {
    expect(themeState()).toEqual({ value: 'light', source: 'system' })
    expect(themeState({ system: 'sepia' })).toEqual({ value: 'light', source: 'system' })
  })
})

describe('nextTheme', () => {
  it('flips between the two themes', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
    expect(nextTheme('sepia')).toBe('dark')
  })
})

describe('theme storage', () => {
  function fakeStorage(initial = {}) {
    const data = new Map(Object.entries(initial))
    return {
      data,
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    }
  }

  it('round-trips a choice', () => {
    const storage = fakeStorage()
    const theme = createThemeStorage({ storage })
    expect(theme.load()).toBe(null)
    expect(theme.save('dark')).toBe(true)
    expect(theme.load()).toBe('dark')
  })

  it('treats junk and failures as "no choice"', () => {
    expect(createThemeStorage({ storage: fakeStorage({ [THEME_KEY]: 'sepia' }) }).load()).toBe(null)
    expect(createThemeStorage({ storage: null }).load()).toBe(null)
    const broken = {
      getItem() {
        throw new Error('denied')
      },
      setItem() {
        throw new Error('denied')
      },
    }
    const theme = createThemeStorage({ storage: broken })
    expect(theme.load()).toBe(null)
    expect(theme.save('dark')).toBe(false)
  })

  it('refuses to store an unknown value', () => {
    const storage = fakeStorage()
    const theme = createThemeStorage({ storage })
    expect(theme.save('sepia')).toBe(false)
    expect(storage.data.has(THEME_KEY)).toBe(false)
  })

  it('uses a project-prefixed key within the 64-byte limit', () => {
    expect(THEME_KEY).toBe('game-japanese-katsuyou-basic-theme')
    expect(LEGACY_THEME_KEY).toBe('katsuyou-theme')
    expect(THEME_KEY.length).toBeLessThanOrEqual(64)
  })

  it('migrates a legacy key and then stops using it', () => {
    const storage = fakeStorage({ [LEGACY_THEME_KEY]: 'dark' })
    const theme = createThemeStorage({ storage })
    expect(theme.load()).toBe('dark')
    expect(storage.getItem(THEME_KEY)).toBe('dark')
    expect(storage.getItem(LEGACY_THEME_KEY)).toBe(null)
  })

  it('keeps the new key when both are present and drops the legacy key', () => {
    const storage = fakeStorage({ [THEME_KEY]: 'light', [LEGACY_THEME_KEY]: 'dark' })
    const theme = createThemeStorage({ storage })
    expect(theme.load()).toBe('light')
    expect(storage.getItem(LEGACY_THEME_KEY)).toBe(null)
  })
})

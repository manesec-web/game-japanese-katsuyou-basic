import { describe, expect, it } from 'vitest'
import { createSettingsStorage } from './settings.js'
import { SETTINGS_KEY, LEGACY_SETTINGS_KEY, defaultSettings } from '../dict/settings.js'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  }
}

describe('settings storage', () => {
  it('uses a project-prefixed key within the 64-byte limit', () => {
    expect(SETTINGS_KEY).toBe('game-japanese-katsuyou-basic-settings')
    expect(LEGACY_SETTINGS_KEY).toBe('katsuyou-settings')
    expect(SETTINGS_KEY.length).toBeLessThanOrEqual(64)
  })

  it('returns defaults when nothing is stored', () => {
    const storage = createSettingsStorage({ storage: fakeStorage() })
    const settings = storage.load()
    expect(settings).toEqual(defaultSettings())
    // A fresh browser starts on ます形 for 從 and 預設顯示形式, 辭書形 only in 到.
    expect(settings.dict.defaultForm).toBe('masu-form')
    expect(settings.card.from).toBe('masu-form')
    expect(settings.quiz.from).toBe('masu-form')
    expect(settings.card.to).toEqual(['dictionary-form'])
  })

  it('fills missing fields from an older saved object with the new defaults', () => {
    const storage = createSettingsStorage({
      storage: fakeStorage({ [SETTINGS_KEY]: '{"dict":{"lessons":[2]},"quiz":{"autoSubmit":false}}' }),
    })
    const settings = storage.load()
    expect(settings.dict.lessons).toEqual([2])
    expect(settings.dict.defaultForm).toBe('masu-form')
    expect(settings.quiz.from).toBe('masu-form')
    expect(settings.quiz.autoSubmit).toBe(false)
    expect(settings.quiz.to).toEqual(['dictionary-form'])
  })

  it('restores a saved object', () => {
    const backing = fakeStorage()
    const storage = createSettingsStorage({ storage: backing })
    const settings = defaultSettings()
    settings.dict.lessons = [2, 5]
    settings.quiz.autoSubmit = true
    expect(storage.save(settings)).toBe(true)
    expect(storage.load()).toEqual(settings)
  })

  it('resets to defaults when stored JSON is broken', () => {
    const storage = createSettingsStorage({ storage: fakeStorage({ [SETTINGS_KEY]: '{oops' }) })
    expect(storage.load()).toEqual(defaultSettings())
  })

  it('survives a storage that throws', () => {
    const storage = createSettingsStorage({
      storage: {
        getItem: () => {
          throw new Error('denied')
        },
        setItem: () => {
          throw new Error('denied')
        },
        removeItem: () => {
          throw new Error('denied')
        },
      },
    })
    expect(storage.load()).toEqual(defaultSettings())
    expect(storage.save(defaultSettings())).toBe(false)
  })

  it('migrates a legacy key and then stops using it', () => {
    const backing = fakeStorage({
      [LEGACY_SETTINGS_KEY]: JSON.stringify({ dict: { lessons: [2] }, quiz: { autoSubmit: false } }),
    })
    const storage = createSettingsStorage({ storage: backing })
    const settings = storage.load()
    expect(settings.dict.lessons).toEqual([2])
    expect(settings.quiz.autoSubmit).toBe(false)
    expect(JSON.parse(backing.getItem(SETTINGS_KEY)).dict.lessons).toEqual([2])
    expect(backing.getItem(LEGACY_SETTINGS_KEY)).toBe(null)
  })

  it('keeps the new key when both are present and drops the legacy key', () => {
    const backing = fakeStorage({
      [SETTINGS_KEY]: JSON.stringify({ dict: { lessons: [1] } }),
      [LEGACY_SETTINGS_KEY]: JSON.stringify({ dict: { lessons: [9] } }),
    })
    const storage = createSettingsStorage({ storage: backing })
    expect(storage.load().dict.lessons).toEqual([1])
    expect(backing.getItem(LEGACY_SETTINGS_KEY)).toBe(null)
  })
})

describe('stale analytics keys', () => {
  it('drops a stored analytics section and writes the cleaned settings back', () => {
    const backing = fakeStorage({
      [SETTINGS_KEY]: JSON.stringify({
        dict: { lessons: [2] },
        analytics: { containerId: 'GTM-STALE01', measurementId: 'G-STALE1234' },
      }),
    })
    const storage = createSettingsStorage({ storage: backing })
    const settings = storage.load()
    expect(settings.dict.lessons).toEqual([2])
    expect(settings).not.toHaveProperty('analytics')
    const written = JSON.parse(backing.getItem(SETTINGS_KEY))
    expect(written).not.toHaveProperty('analytics')
    expect(written.dict.lessons).toEqual([2])
  })

  it('leaves a clean stored object untouched', () => {
    const backing = fakeStorage({ [SETTINGS_KEY]: '{"dict":{"lessons":[2]},"analytics":{}}' })
    const storage = createSettingsStorage({ storage: backing })
    const settings = storage.load()
    expect(settings).not.toHaveProperty('analytics')
    expect(JSON.parse(backing.getItem(SETTINGS_KEY))).not.toHaveProperty('analytics')
  })
})

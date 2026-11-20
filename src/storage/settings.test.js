import { describe, expect, it } from 'vitest'
import { createSettingsStorage } from './settings.js'
import { defaultSettings } from '../dict/settings.js'

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  }
}

describe('settings storage', () => {
  it('returns defaults when nothing is stored', () => {
    const storage = createSettingsStorage({ storage: fakeStorage() })
    const settings = storage.load()
    expect(settings).toEqual(defaultSettings())
    // A fresh browser starts on ます形 for 從 and 預設顯示形式, 字典形 only in 到.
    expect(settings.dict.defaultForm).toBe('masu-form')
    expect(settings.card.from).toBe('masu-form')
    expect(settings.quiz.from).toBe('masu-form')
    expect(settings.card.to).toEqual(['dictionary-form'])
  })

  it('fills missing fields from an older saved object with the new defaults', () => {
    const storage = createSettingsStorage({
      storage: fakeStorage({ 'katsuyou-settings': '{"dict":{"lessons":[2]},"quiz":{"autoSubmit":false}}' }),
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
    const storage = createSettingsStorage({ storage: fakeStorage({ 'katsuyou-settings': '{oops' }) })
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
      },
    })
    expect(storage.load()).toEqual(defaultSettings())
    expect(storage.save(defaultSettings())).toBe(false)
  })
})

describe('stale analytics keys', () => {
  it('drops a stored analytics section and writes the cleaned settings back', () => {
    const backing = fakeStorage({
      'katsuyou-settings': JSON.stringify({
        dict: { lessons: [2] },
        analytics: { containerId: 'GTM-STALE01', measurementId: 'G-STALE1234' },
      }),
    })
    const storage = createSettingsStorage({ storage: backing })
    const settings = storage.load()
    expect(settings.dict.lessons).toEqual([2])
    expect(settings).not.toHaveProperty('analytics')
    const written = JSON.parse(backing.getItem('katsuyou-settings'))
    expect(written).not.toHaveProperty('analytics')
    expect(written.dict.lessons).toEqual([2])
  })

  it('leaves a clean stored object untouched', () => {
    const backing = fakeStorage({ 'katsuyou-settings': '{"dict":{"lessons":[2]},"analytics":{}}' })
    const storage = createSettingsStorage({ storage: backing })
    const settings = storage.load()
    expect(settings).not.toHaveProperty('analytics')
    expect(JSON.parse(backing.getItem('katsuyou-settings'))).not.toHaveProperty('analytics')
  })
})

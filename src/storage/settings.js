import { SETTINGS_KEY, defaultSettings, normalizeSettings } from '../dict/settings.js'

// localStorage-backed settings. Invalid JSON resets the whole object to
// defaults; a storage failure is non-fatal (the app keeps working).
export function createSettingsStorage({ storage = globalThis.localStorage } = {}) {
  function load() {
    if (!storage) return defaultSettings()
    let raw
    try {
      raw = storage.getItem(SETTINGS_KEY)
    } catch {
      return defaultSettings()
    }
    if (raw === null) return defaultSettings()
    try {
      return normalizeSettings(JSON.parse(raw))
    } catch {
      return defaultSettings()
    }
  }

  function save(settings) {
    if (!storage) return false
    try {
      storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      return true
    } catch {
      return false
    }
  }

  return { key: SETTINGS_KEY, load, save }
}

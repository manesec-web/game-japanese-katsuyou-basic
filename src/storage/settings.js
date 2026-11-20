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
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return defaultSettings()
    }
    const settings = normalizeSettings(parsed)
    // Revision 40 briefly kept the Analytics IDs in this object. They are a
    // repo config now (src/config/analytics.js), so a stale section is removed
    // and the cleaned object is written back; a storage failure is ignored.
    if (parsed && typeof parsed === 'object' && 'analytics' in parsed) save(settings)
    return settings
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

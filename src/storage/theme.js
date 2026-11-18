import { THEME_KEY, isTheme } from '../ui/theme.js'

// localStorage-backed theme choice. A missing or unrecognised value means the
// user has not chosen, so the OS preference applies; a storage failure is
// non-fatal and behaves the same way.
export function createThemeStorage({ storage = globalThis.localStorage } = {}) {
  function load() {
    if (!storage) return null
    let raw
    try {
      raw = storage.getItem(THEME_KEY)
    } catch {
      return null
    }
    return isTheme(raw) ? raw : null
  }

  function save(value) {
    if (!storage || !isTheme(value)) return false
    try {
      storage.setItem(THEME_KEY, value)
      return true
    } catch {
      return false
    }
  }

  return { key: THEME_KEY, load, save }
}

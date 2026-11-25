import { THEME_KEY, LEGACY_THEME_KEY, isTheme } from '../ui/theme.js'

// localStorage-backed theme choice. A missing or unrecognised value means the
// user has not chosen, so the OS preference applies; a storage failure is
// non-fatal and behaves the same way. An older `katsuyou-theme` value is
// copied to the current key on first read or write, then removed.
function migrateLegacyTheme(storage) {
  if (!storage) return
  try {
    const current = storage.getItem(THEME_KEY)
    const legacy = storage.getItem(LEGACY_THEME_KEY)
    if (legacy === null) return
    if (current === null) storage.setItem(THEME_KEY, legacy)
    storage.removeItem(LEGACY_THEME_KEY)
  } catch {
    // Leave the legacy key in place if the copy or delete fails.
  }
}

export function createThemeStorage({ storage = globalThis.localStorage } = {}) {
  function load() {
    if (!storage) return null
    migrateLegacyTheme(storage)
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
    } catch {
      return false
    }
    try {
      storage.removeItem(LEGACY_THEME_KEY)
    } catch {
      // The new key is already the live value.
    }
    return true
  }

  return { key: THEME_KEY, load, save }
}

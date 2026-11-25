// Theme choice rules: pure, no DOM and no storage access.
//
// The theme is either the OS preference (`prefers-color-scheme`) or a choice
// the user made with the start screen's toggle. A stored choice always wins;
// without one the OS preference decides, and it keeps deciding while the user
// has not chosen (see `watchSystemTheme` in ./theme-root.js).

export const THEMES = ['light', 'dark']

export const THEME_KEY = 'game-japanese-katsuyou-basic-theme'
export const LEGACY_THEME_KEY = 'katsuyou-theme'

export function isTheme(value) {
  return THEMES.includes(value)
}

// The OS preference as a theme name. `prefersDark` is the matchMedia result.
export function systemTheme(prefersDark) {
  return prefersDark ? 'dark' : 'light'
}

// The theme a reload starts with: the stored choice, else the OS preference.
export function themeState({ stored = null, system = 'light' } = {}) {
  if (isTheme(stored)) return { value: stored, source: 'user' }
  return { value: isTheme(system) ? system : 'light', source: 'system' }
}

// The toggle flips between the two themes; anything unknown starts at dark.
export function nextTheme(value) {
  return value === 'dark' ? 'light' : 'dark'
}

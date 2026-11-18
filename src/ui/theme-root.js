// Applies the resolved theme to the document root and keeps following the OS
// preference until the user makes a choice. Thin DOM adapter: the rules live in
// ./theme.js.

export function applyTheme(root, value) {
  if (!root || !root.dataset) return false
  root.dataset.theme = value
  return true
}

// Calls `onChange(theme)` whenever the OS preference flips. Returns the detach
// function; a browser without matchMedia simply never fires.
export function watchSystemTheme(media, onChange) {
  if (!media || typeof media.addEventListener !== 'function') return () => {}
  const listener = (event) => onChange(event.matches ? 'dark' : 'light')
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

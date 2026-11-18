// The start screen's theme switch. The rule is pure (`nextTheme` in
// ../ui/theme.js); this command moves the session and persists the choice.
// Applying it to the document is the view layer's job (src/main.js).
import { nextTheme } from '../ui/theme.js'

export function specs(deps = {}) {
  const themeStorage = deps.themeStorage

  return [
    {
      id: 'theme.toggle',
      params: [],
      enabled: () => true,
      run: (session) => {
        const current = session.theme?.value ?? 'light'
        const next = { value: nextTheme(current), source: 'user' }
        session.theme = next
        if (themeStorage) themeStorage.save(next.value)
        return { theme: next }
      },
    },
  ]
}

import { createApp, watch } from 'vue'
import './styles/app.css'
import App from './App.vue'
import manifest from './data/dict-manifest.json'
import { registry } from './engine/registry.js'
import { allSpecs } from './commands/index.js'
import { createStore } from './ui/store.js'
import { bootstrap } from './ui/bootstrap.js'
import { createLibrary } from './dict/library.js'
import { idb } from './storage/idb.js'
import { createSettingsStorage } from './storage/settings.js'
import { createThemeStorage } from './storage/theme.js'
import { createScrollGuard } from './ui/scroll-guard.js'
import { systemTheme, themeState } from './ui/theme.js'
import { applyTheme, watchSystemTheme } from './ui/theme-root.js'

const library = createLibrary({ store: idb, manifest })
const settingsStorage = createSettingsStorage()
const themeStorage = createThemeStorage()

registry.registerAll(allSpecs({ library, settingsStorage, themeStorage }))

const store = createStore(registry, { library, settingsStorage, themeStorage })

// Resolve the start theme before the first render: a stored choice wins, else
// the OS preference. The CSS already draws the OS theme before this module runs
// (`@media (prefers-color-scheme: dark)` in src/styles/app.css); this pins the
// attribute so later toggles and OS changes have a single owner.
const systemQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null
const theme = themeState({
  stored: themeStorage.load(),
  system: systemTheme(systemQuery?.matches ?? false),
})
store.session.theme = theme
applyTheme(document.documentElement, theme.value)

// The session is the source of truth; painting it is the view's side only.
watch(
  () => store.session.theme.value,
  (value) => applyTheme(document.documentElement, value),
)

// Until the user chooses, the OS preference keeps deciding, including when it
// flips while the page is open.
const stopWatchingSystem = watchSystemTheme(systemQuery, (value) => {
  if (store.session.theme.source !== 'system') return
  // The watcher above paints the new value.
  store.session.theme = { value, source: 'system' }
})

const app = createApp(App).provide('store', store)
const scrollGuard = createScrollGuard()
scrollGuard.attach()
app.mount('#app')

// Vite's dev reload must not leave a second non-passive document listener.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    scrollGuard.detach()
    stopWatchingSystem()
    app.unmount()
  })
}

bootstrap(store)

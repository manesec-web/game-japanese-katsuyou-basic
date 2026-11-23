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
import { createGtm } from './analytics/gtm.js'
import { GA4_ID, GTM_ID } from './config/analytics.js'
import { deepLinkQuery, parseDeepLink } from './study/url.js'

const library = createLibrary({ store: idb, manifest })
const settingsStorage = createSettingsStorage()
const themeStorage = createThemeStorage()

registry.registerAll(allSpecs({ library, settingsStorage, themeStorage }))

const store = createStore(registry, { library, settingsStorage, themeStorage })

// Read the page URL once at load. A deep link is applied by bootstrap after a
// successful boot; an absent or invalid one is null and changes nothing.
store.deepLink =
  typeof window !== 'undefined' ? parseDeepLink(window.location.search) : null

// Observation aid for the URL deep link (remove when no longer needed). The
// browser URL never changes while the app navigates, so `deeplinkBase` is the
// stable page address and each screen change logs a freshly generated deep-link
// URL for the current screen — the URL to copy to reopen that exact view.
const deeplinkBase =
  typeof window !== 'undefined' ? window.location.href.split('?')[0] : ''
console.log('[deeplink] parse', deeplinkBase, store.deepLink ?? 'no deeplink')

// The Analytics IDs are repo config (src/config/analytics.js), not settings: a
// developer edits that file and redeploys. An empty ID loads nothing. The GTM
// container is loaded once and gtag.js carries the per-screen page views. The
// browser URL is not changed: a screen is reported, not routed.
const analytics = createGtm()
analytics.load(GTM_ID)
analytics.loadTag(GA4_ID)
watch(
  () => store.session.screen,
  (screen) => {
    // Observation aid: one line per screen change with the generated deep-link
    // URL for that screen (params only for deep-linkable screens).
    const query = deepLinkQuery(store.session, library)
    console.log('[deeplink] screen', screen, query ? deeplinkBase + query : deeplinkBase)
    analytics.screen(screen)
  },
  { immediate: true },
)

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

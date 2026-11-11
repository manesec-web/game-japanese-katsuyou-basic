import { createApp } from 'vue'
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
import { createScrollGuard } from './ui/scroll-guard.js'

const library = createLibrary({ store: idb, manifest })
const settingsStorage = createSettingsStorage()

registry.registerAll(allSpecs({ library, settingsStorage }))

const store = createStore(registry, { library, settingsStorage })

const app = createApp(App).provide('store', store)
const scrollGuard = createScrollGuard()
scrollGuard.attach()
app.mount('#app')

// Vite's dev reload must not leave a second non-passive document listener.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    scrollGuard.detach()
    app.unmount()
  })
}

bootstrap(store)

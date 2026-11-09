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

const library = createLibrary({ store: idb, manifest })
const settingsStorage = createSettingsStorage()

registry.registerAll(allSpecs({ library, settingsStorage }))

const store = createStore(registry, { library, settingsStorage })

createApp(App).provide('store', store).mount('#app')

bootstrap(store)

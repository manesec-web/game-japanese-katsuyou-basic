// IndexedDB cache for the audio bins. One record per lesson bin, keyed by the
// bin file name ("lesson10.bin") with the raw ZIP bytes as the value. This is
// a second database next to the dictionary cache
// (game-japanese-katsuyou-basic-dict), so the two kinds of "lesson data"
// never share a store. A browser that still has the older "katsuyou-audio"
// database is migrated on first open, then that name is deleted.
import { createIdb } from './idb.js'

export const AUDIO_IDB_NAME = 'game-japanese-katsuyou-basic-audio'
export const LEGACY_AUDIO_IDB_NAME = 'katsuyou-audio'
export const AUDIO_IDB_STORE = 'bins'
export const AUDIO_IDB_VERSION = 1

export const audioIdb = createIdb({
  name: AUDIO_IDB_NAME,
  legacyName: LEGACY_AUDIO_IDB_NAME,
  store: AUDIO_IDB_STORE,
  version: AUDIO_IDB_VERSION,
})

// IndexedDB cache for the audio bins. One record per lesson bin, keyed by the
// bin file name ("lesson10.bin") with the raw ZIP bytes as the value. This is
// a second database next to the dictionary cache (katsuyou-dict), so the two
// kinds of "lesson data" never share a store.
import { createIdb } from './idb.js'

export const AUDIO_IDB_NAME = 'katsuyou-audio'
export const AUDIO_IDB_STORE = 'bins'
export const AUDIO_IDB_VERSION = 1

export const audioIdb = createIdb({
  name: AUDIO_IDB_NAME,
  store: AUDIO_IDB_STORE,
  version: AUDIO_IDB_VERSION,
})

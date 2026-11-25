import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createIdb } from './idb.js'
import { AUDIO_IDB_NAME, AUDIO_IDB_STORE, AUDIO_IDB_VERSION, LEGACY_AUDIO_IDB_NAME } from './audio-idb.js'

const encoder = new TextEncoder()

describe('audio IndexedDB name', () => {
  it('uses a project-prefixed database name within the 64-byte limit', () => {
    expect(AUDIO_IDB_NAME).toBe('game-japanese-katsuyou-basic-audio')
    expect(LEGACY_AUDIO_IDB_NAME).toBe('katsuyou-audio')
    expect(AUDIO_IDB_STORE).toBe('bins')
    expect(AUDIO_IDB_NAME.length).toBeLessThanOrEqual(64)
  })

  it('copies bins from the legacy database and deletes it', async () => {
    const factory = new IDBFactory()
    const legacy = createIdb({
      factory: () => factory,
      name: LEGACY_AUDIO_IDB_NAME,
      legacyName: '',
      store: AUDIO_IDB_STORE,
      version: AUDIO_IDB_VERSION,
    })
    await legacy.write('lesson10.bin', encoder.encode('zip-bytes'))
    await legacy.close()

    const store = createIdb({
      factory: () => factory,
      name: AUDIO_IDB_NAME,
      legacyName: LEGACY_AUDIO_IDB_NAME,
      store: AUDIO_IDB_STORE,
      version: AUDIO_IDB_VERSION,
    })
    expect(new TextDecoder().decode(await store.read('lesson10.bin'))).toBe('zip-bytes')
    await store.close()

    const names = (await factory.databases()).map((entry) => entry.name)
    expect(names).toContain(AUDIO_IDB_NAME)
    expect(names).not.toContain(LEGACY_AUDIO_IDB_NAME)
  })
})

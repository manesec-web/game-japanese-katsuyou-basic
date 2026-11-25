import { describe, expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { createIdb, IDB_NAME, LEGACY_IDB_NAME } from './idb.js'

let dbCounter = 0

function freshIdb(options = {}) {
  dbCounter += 1
  // A new IDBFactory keeps every test isolated from the previous one.
  return createIdb({ factory: () => new IDBFactory(), name: `test-${dbCounter}`, ...options })
}

const encoder = new TextEncoder()

describe('createIdb', () => {
  it('uses a project-prefixed database name within the 64-byte limit', () => {
    expect(IDB_NAME).toBe('game-japanese-katsuyou-basic-dict')
    expect(LEGACY_IDB_NAME).toBe('katsuyou-dict')
    expect(IDB_NAME.length).toBeLessThanOrEqual(64)
    expect(new TextEncoder().encode(IDB_NAME).length).toBe(IDB_NAME.length)
  })

  it('reads back the bytes it wrote', async () => {
    const store = freshIdb()
    const bytes = encoder.encode('{"lesson_1":{"vols":[]}}')
    await store.write('lesson_1.json', bytes)

    const stored = await store.read('lesson_1.json')
    expect(stored).toBeInstanceOf(Uint8Array)
    expect(Array.from(stored)).toEqual(Array.from(bytes))
    await store.close()
  })

  it('accepts an ArrayBuffer', async () => {
    const store = freshIdb()
    const bytes = encoder.encode('{"lesson_2":{"vols":[]}}')
    await store.write('lesson_2.json', bytes.buffer)

    const stored = await store.read('lesson_2.json')
    expect(new TextDecoder().decode(stored)).toBe('{"lesson_2":{"vols":[]}}')
    await store.close()
  })

  it('returns null for a record that is not stored', async () => {
    const store = freshIdb()
    await expect(store.read('lesson_50.json')).resolves.toBeNull()
    await store.close()
  })

  it('overwrites an existing record', async () => {
    const store = freshIdb()
    await store.write('lesson_3.json', encoder.encode('first'))
    await store.write('lesson_3.json', encoder.encode('second'))

    const stored = await store.read('lesson_3.json')
    expect(new TextDecoder().decode(stored)).toBe('second')
    await store.close()
  })

  it('removes a record and reports whether it existed', async () => {
    const store = freshIdb()
    await store.write('lesson_4.json', encoder.encode('payload'))

    await expect(store.remove('lesson_4.json')).resolves.toBe(true)
    await expect(store.read('lesson_4.json')).resolves.toBeNull()
    await expect(store.remove('lesson_4.json')).resolves.toBe(false)
    await store.close()
  })

  it('reports a clear error when IndexedDB is unavailable', async () => {
    const store = createIdb({ factory: () => undefined })
    await expect(store.read('lesson_1.json')).rejects.toThrow(/IndexedDB is unavailable/)
  })

  it('rejects when the browser refuses to open the database', async () => {
    const factory = {
      open() {
        const request = { error: new Error('storage blocked'), result: null }
        queueMicrotask(() => request.onerror?.())
        return request
      },
    }
    const store = createIdb({ factory: () => factory })
    await expect(store.read('lesson_1.json')).rejects.toThrow('storage blocked')
  })
})

describe('legacy IndexedDB migration', () => {
  async function databaseNames(factory) {
    return (await factory.databases()).map((entry) => entry.name)
  }

  it('copies records from the legacy database and deletes it', async () => {
    const factory = new IDBFactory()
    const legacy = createIdb({ factory: () => factory, name: LEGACY_IDB_NAME, legacyName: '' })
    await legacy.write('lesson_1.json', encoder.encode('first'))
    await legacy.write('lesson_2.json', encoder.encode('second'))
    await legacy.close()

    const store = createIdb({
      factory: () => factory,
      name: IDB_NAME,
      legacyName: LEGACY_IDB_NAME,
    })
    expect(new TextDecoder().decode(await store.read('lesson_1.json'))).toBe('first')
    expect(new TextDecoder().decode(await store.read('lesson_2.json'))).toBe('second')
    await store.close()

    const names = await databaseNames(factory)
    expect(names).toContain(IDB_NAME)
    expect(names).not.toContain(LEGACY_IDB_NAME)
  })

  it('keeps an already-populated new database and still drops the legacy name', async () => {
    const factory = new IDBFactory()
    const legacy = createIdb({ factory: () => factory, name: LEGACY_IDB_NAME, legacyName: '' })
    await legacy.write('lesson_1.json', encoder.encode('old'))
    await legacy.close()

    const current = createIdb({ factory: () => factory, name: IDB_NAME, legacyName: '' })
    await current.write('lesson_1.json', encoder.encode('new'))
    await current.close()

    const store = createIdb({
      factory: () => factory,
      name: IDB_NAME,
      legacyName: LEGACY_IDB_NAME,
    })
    expect(new TextDecoder().decode(await store.read('lesson_1.json'))).toBe('new')
    await store.close()

    const names = await databaseNames(factory)
    expect(names).toContain(IDB_NAME)
    expect(names).not.toContain(LEGACY_IDB_NAME)
  })

  it('does not look for a legacy database when opened under a test name', async () => {
    const factory = new IDBFactory()
    const leftover = createIdb({ factory: () => factory, name: LEGACY_IDB_NAME, legacyName: '' })
    await leftover.write('lesson_1.json', encoder.encode('keep'))
    await leftover.close()

    const store = createIdb({ factory: () => factory, name: 'test-isolated' })
    await expect(store.read('lesson_1.json')).resolves.toBeNull()
    await store.close()

    const names = await databaseNames(factory)
    expect(names).toContain(LEGACY_IDB_NAME)
    expect(names).toContain('test-isolated')
  })
})

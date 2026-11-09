// IndexedDB adapter for the dictionary cache. One record per lesson inside
// the object store "lessons" of the database "katsuyou-dict"; the key is the
// lesson file name and the value is the raw file bytes.
//
// IndexedDB is used instead of OPFS because private browsing windows can open
// a database while they cannot expose an origin-private directory.
export const IDB_NAME = 'katsuyou-dict'
export const IDB_STORE = 'lessons'
export const IDB_VERSION = 1

function defaultFactory() {
  const factory = globalThis.indexedDB
  if (!factory || typeof factory.open !== 'function') {
    throw new Error(
      'IndexedDB is unavailable on this origin; storage is blocked or disabled',
    )
  }
  return factory
}

function toBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) {
    const copy = new Uint8Array(data.byteLength)
    copy.set(data)
    return copy
  }
  throw new TypeError('idb.write expects an ArrayBuffer or a typed array')
}

export function createIdb({
  factory = defaultFactory,
  name = IDB_NAME,
  store = IDB_STORE,
  version = IDB_VERSION,
} = {}) {
  let opened = null

  function open() {
    if (!opened) {
      const pending = new Promise((resolve, reject) => {
        let request
        try {
          const api = factory()
          if (!api || typeof api.open !== 'function') {
            throw new Error(
              'IndexedDB is unavailable on this origin; storage is blocked or disabled',
            )
          }
          request = api.open(name, version)
        } catch (error) {
          reject(error)
          return
        }
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store)
        }
        request.onsuccess = () => {
          const db = request.result
          db.onversionchange = () => db.close()
          resolve(db)
        }
        request.onerror = () => {
          reject(request.error ?? new Error(`cannot open IndexedDB "${name}"`))
        }
        request.onblocked = () => {
          reject(new Error(`IndexedDB "${name}" is blocked by another connection`))
        }
      })
      opened = pending
      pending.catch(() => {
        if (opened === pending) opened = null
      })
    }
    return opened
  }

  // Runs one request inside a fresh transaction and resolves with the request
  // result once the transaction commits.
  async function run(mode, pickRequest) {
    const db = await open()
    return await new Promise((resolve, reject) => {
      let transaction
      try {
        transaction = db.transaction(store, mode)
      } catch (error) {
        reject(error)
        return
      }
      const objectStore = transaction.objectStore(store)
      let request
      try {
        request = pickRequest(objectStore)
      } catch (error) {
        reject(error)
        return
      }
      let value = null
      request.onsuccess = () => {
        value = request.result
      }
      request.onerror = () => {
        reject(request.error ?? new Error(`${mode} request failed in "${store}"`))
      }
      transaction.onabort = () => {
        reject(transaction.error ?? new Error(`${mode} transaction aborted in "${store}"`))
      }
      transaction.oncomplete = () => resolve(value)
    })
  }

  async function read(file) {
    const value = await run('readonly', (objectStore) => objectStore.get(file))
    if (value === undefined || value === null) return null
    return toBytes(value)
  }

  async function write(file, data) {
    const bytes = toBytes(data)
    await run('readwrite', (objectStore) => objectStore.put(bytes, file))
    return true
  }

  // Returns true when a record was deleted, false when it was already absent.
  async function remove(file) {
    return await new Promise(async (resolve, reject) => {
      const db = await open()
      let transaction
      try {
        transaction = db.transaction(store, 'readwrite')
      } catch (error) {
        reject(error)
        return
      }
      const objectStore = transaction.objectStore(store)
      const request = objectStore.get(file)
      let existed = false
      request.onsuccess = () => {
        existed = request.result !== undefined
        if (existed) objectStore.delete(file)
      }
      transaction.onabort = () => {
        reject(transaction.error ?? new Error(`remove transaction aborted in "${store}"`))
      }
      transaction.oncomplete = () => resolve(existed)
    })
  }

  function close() {
    const pending = opened
    opened = null
    if (!pending) return Promise.resolve()
    return pending.then((db) => db.close()).catch(() => {})
  }

  return { read, write, remove, close, name, store, version }
}

export const idb = createIdb()

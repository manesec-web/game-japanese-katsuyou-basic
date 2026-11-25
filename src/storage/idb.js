// IndexedDB adapter for the dictionary cache. One record per lesson inside
// the object store "lessons" of the database
// "game-japanese-katsuyou-basic-dict"; the key is the lesson file name and
// the value is the raw file bytes.
//
// IndexedDB is used instead of OPFS because private browsing windows can open
// a database while they cannot expose an origin-private directory. A browser
// that still has the older "katsuyou-dict" database is migrated on first open,
// then that name is deleted.
export const IDB_NAME = 'game-japanese-katsuyou-basic-dict'
export const LEGACY_IDB_NAME = 'katsuyou-dict'
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

function hasDatabase(api, name) {
  if (typeof api.databases !== 'function') return Promise.resolve(null)
  return api
    .databases()
    .then((list) => list.some((entry) => entry.name === name))
    .catch(() => null)
}

function openDatabase(api, name, version, store) {
  return new Promise((resolve, reject) => {
    let request
    try {
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
}

function openLegacyDatabase(api, name) {
  return new Promise((resolve, reject) => {
    let created = false
    let request
    try {
      request = api.open(name)
    } catch (error) {
      reject(error)
      return
    }
    request.onupgradeneeded = () => {
      created = request.oldVersion === 0
      if (created) {
        try {
          request.transaction.abort()
        } catch {
          // The abort may itself surface as onerror; treat as "absent".
        }
      }
    }
    request.onsuccess = () => {
      const db = request.result
      if (created) {
        db.close()
        const deletion = api.deleteDatabase(name)
        deletion.onsuccess = () => resolve(null)
        deletion.onerror = () => resolve(null)
        deletion.onblocked = () => resolve(null)
        return
      }
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => {
      if (created) resolve(null)
      else reject(request.error ?? new Error(`cannot open IndexedDB "${name}"`))
    }
    request.onblocked = () => {
      reject(new Error(`IndexedDB "${name}" is blocked by another connection`))
    }
  })
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const records = []
    const request = transaction.objectStore(storeName).openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        records.push({ key: cursor.key, value: cursor.value })
        cursor.continue()
      }
    }
    request.onerror = () => {
      reject(request.error ?? new Error(`cannot read records from "${storeName}"`))
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error(`read transaction aborted in "${storeName}"`))
    }
    transaction.oncomplete = () => resolve(records)
  })
}

function idbCount(db, storeName) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).count()
    let count = 0
    request.onsuccess = () => {
      count = request.result
    }
    request.onerror = () => {
      reject(request.error ?? new Error(`cannot count records in "${storeName}"`))
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error(`count transaction aborted in "${storeName}"`))
    }
    transaction.oncomplete = () => resolve(count)
  })
}

function idbPutAll(db, storeName, records) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const objectStore = transaction.objectStore(storeName)
    for (const record of records) {
      objectStore.put(record.value, record.key)
    }
    transaction.onabort = () => {
      reject(transaction.error ?? new Error(`write transaction aborted in "${storeName}"`))
    }
    transaction.oncomplete = () => resolve()
  })
}

function idbDeleteDatabase(api, name) {
  return new Promise((resolve) => {
    let request
    try {
      request = api.deleteDatabase(name)
    } catch {
      resolve()
      return
    }
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

async function migrateLegacyDatabase(api, { name, legacyName, store, version }) {
  if (!legacyName || legacyName === name) return

  const present = await hasDatabase(api, legacyName)
  if (present === false) return

  const legacyDb = await openLegacyDatabase(api, legacyName)
  if (!legacyDb) return

  let canDropLegacy = false
  try {
    if (!legacyDb.objectStoreNames.contains(store)) return

    const records = await idbGetAll(legacyDb, store)
    const destDb = await openDatabase(api, name, version, store)
    try {
      const destCount = await idbCount(destDb, store)
      if (destCount === 0 && records.length > 0) {
        await idbPutAll(destDb, store, records)
      }
      const after = await idbCount(destDb, store)
      canDropLegacy = records.length === 0 || after > 0
    } finally {
      destDb.close()
    }
  } finally {
    legacyDb.close()
  }

  if (canDropLegacy) await idbDeleteDatabase(api, legacyName)
}

export function createIdb({
  factory = defaultFactory,
  name = IDB_NAME,
  legacyName = name === IDB_NAME ? LEGACY_IDB_NAME : '',
  store = IDB_STORE,
  version = IDB_VERSION,
} = {}) {
  let opened = null

  function open() {
    if (!opened) {
      const pending = (async () => {
        const api = factory()
        if (!api || typeof api.open !== 'function') {
          throw new Error(
            'IndexedDB is unavailable on this origin; storage is blocked or disabled',
          )
        }
        try {
          await migrateLegacyDatabase(api, { name, legacyName, store, version })
        } catch {
          // Leave the legacy database in place; the new one can still open.
        }
        return await openDatabase(api, name, version, store)
      })()
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

import manifest from '../data/dict-manifest.json'
import { bootDictionary, BootError } from '../dict/boot.js'
import { openArchive, ARCHIVE_FILE } from '../dict/archive.js'
import { idb } from '../storage/idb.js'

// One request for the whole dictionary: 50 lesson files deflate-compressed
// inside dict/vol.bin (a ZIP published without the .zip suffix). Each entry is still hashed against its own manifest
// record after extraction.
// Streams the archive so the loading bar can show the download itself. `report`
// receives (bytesReceived, bytesTotal); the total is 0 when the response does
// not announce a Content-Length, and the bar holds until the bytes arrive.
async function defaultFetchArchive(report) {
  const url =
    typeof document !== 'undefined'
      ? new URL(`dict/${ARCHIVE_FILE}`, document.baseURI).href
      : `dict/${ARCHIVE_FILE}`
  const notify = typeof report === 'function' ? report : () => {}
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${ARCHIVE_FILE}`)

  const total = Number(response.headers.get('content-length')) || 0
  if (!response.body || typeof response.body.getReader !== 'function') {
    const bytes = new Uint8Array(await response.arrayBuffer())
    notify(bytes.length, total || bytes.length)
    return bytes
  }

  const reader = response.body.getReader()
  const chunks = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    chunks.push(value)
    loaded += value.length
    notify(loaded, total)
  }

  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  notify(loaded, total || loaded)
  return bytes
}

const defaultOpenArchive = (bytes) => openArchive(bytes)

export function specs(deps = {}) {
  const fetchArchive = deps.fetchArchive ?? defaultFetchArchive
  const readArchive = deps.openArchive ?? defaultOpenArchive
  const store = deps.store ?? deps.idb ?? idb
  const dictManifest = deps.manifest ?? manifest

  return [
    {
      id: 'app.boot',
      params: [],
      run: async (session) => {
        if (session.boot.running) {
          throw new BootError({ lesson: null, message: 'boot is already running' })
        }
        session.boot.running = true
        try {
          const outcome = await bootDictionary({
            session,
            fetchArchive,
            openArchive: readArchive,
            store,
            manifest: dictManifest,
          })
          if (!outcome.ok) throw new BootError(outcome.error)
          return outcome.result
        } finally {
          session.boot.running = false
        }
      },
    },
  ]
}

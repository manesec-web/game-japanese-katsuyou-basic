import { sha256Hex } from './hash.js'

// Raised when the boot sequence cannot verify a lesson. dispatch() turns a
// thrown error carrying `code` into { ok: false, error: { code, message,
// details } }.
export class BootError extends Error {
  constructor(detail) {
    super(detail?.message ?? 'boot failed')
    this.name = 'BootError'
    this.code = 'boot-failed'
    this.details = detail ?? null
  }
}

// Boots the dictionary from the single shipped archive (dict/vol.bin).
//
// Phase 1 walks the 50 manifest entries in order, hashing whatever IndexedDB
// already holds. A match counts as a finished lesson; a missing or corrupt copy
// is collected and no download happens yet.
//
// Phase 2, only when something was collected, downloads the archive once,
// verifies each needed entry against its own manifest hash, and stores the
// verified bytes. A failed download, an unreadable archive, an absent entry or
// a hash mismatch is retried with a second download. Bytes that fail twice
// are not stored, and the sequence stops naming the first lesson still missing.
//
// `boot.checked` counts verified lessons, so the loading bar is
// finished lessons / 50 exactly as before the archive existed.
export async function bootDictionary({
  session,
  fetchArchive,
  openArchive,
  store,
  manifest,
  onProgress,
}) {
  const entries = Array.isArray(manifest?.lessons) ? manifest.lessons : []
  session.boot.checked = 0
  session.boot.total = entries.length
  session.boot.done = false
  session.boot.error = null
  session.boot.download = { base: 0, loaded: 0, total: 0, done: false }

  if (entries.length === 0) {
    return stop(session, { lesson: null, message: 'manifest has no lessons' })
  }

  const pending = []
  for (const entry of entries) {
    let stored = null
    try {
      stored = await store.read(entry.file)
    } catch (error) {
      return stop(session, failureDetail(entry, `cannot read stored copy: ${errorMessage(error)}`))
    }

    if (!stored) {
      pending.push(entry)
      continue
    }

    let hash
    try {
      hash = await sha256Hex(stored)
    } catch (error) {
      return stop(session, failureDetail(entry, `cannot hash stored copy: ${errorMessage(error)}`))
    }
    if (hash !== entry.sha256) {
      pending.push(entry)
      continue
    }
    advance(session, onProgress)
  }

  if (pending.length === 0) {
    session.boot.done = true
    return { ok: true, result: { checked: session.boot.checked, total: session.boot.total } }
  }

  let message = 'download did not run'
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    // Each attempt restarts the download portion at the work already finished,
    // so the loading bar never moves backwards between attempts.
    const download = session.boot.download
    download.base = verifiedPercent(session)
    download.loaded = 0
    download.total = 0
    download.done = false

    function reportDownload(loaded, total) {
      const bytes = Number(total) || 0
      download.loaded = Math.max(0, Number(loaded) || 0)
      download.total = bytes > 0 ? bytes : 0
      if (typeof onProgress === 'function') onProgress(session.boot)
    }

    let bytes
    try {
      bytes = await fetchArchive(reportDownload)
    } catch (error) {
      message = `download ${attempt} failed: ${errorMessage(error)}`
      continue
    }
    // Vue reactivity carries the state change to the view; onProgress stays a
    // lesson-progress hook so callers keep one notification per verified lesson.
    // A fetcher that reported nothing leaves both counters at 0; the bar then
    // holds at the cache-check share until `done` turns it to 100.
    if (download.total > 0) download.loaded = Math.max(download.loaded, bytes.length)
    else {
      download.loaded = bytes.length
      download.total = bytes.length
    }
    download.done = true

    let archive
    try {
      archive = await openArchive(bytes)
    } catch (error) {
      message = `archive ${attempt} cannot be read: ${errorMessage(error)}`
      continue
    }

    const still = []
    for (const entry of pending) {
      if (!archive.has(entry.file)) {
        message = `archive ${attempt} is missing ${entry.file}`
        still.push(entry)
        continue
      }

      let lessonBytes
      try {
        lessonBytes = await archive.read(entry.file)
      } catch (error) {
        message = `archive ${attempt} cannot read ${entry.file}: ${errorMessage(error)}`
        still.push(entry)
        continue
      }

      let hash
      try {
        hash = await sha256Hex(lessonBytes)
      } catch (error) {
        message = `archive ${attempt} cannot hash ${entry.file}: ${errorMessage(error)}`
        still.push(entry)
        continue
      }
      if (hash !== entry.sha256) {
        message = `archive ${attempt} hash mismatch for ${entry.file}`
        still.push(entry)
        continue
      }

      try {
        await store.write(entry.file, lessonBytes)
      } catch (error) {
        return stop(session, failureDetail(entry, `cannot write verified copy: ${errorMessage(error)}`))
      }
      advance(session, onProgress)
    }

    pending.length = 0
    pending.push(...still)
    if (pending.length === 0) {
      session.boot.done = true
      return { ok: true, result: { checked: session.boot.checked, total: session.boot.total } }
    }
  }

  return stop(session, failureDetail(pending[0], message))
}

function verifiedPercent(session) {
  const total = session.boot.total
  if (!total) return 0
  return (session.boot.checked / total) * 100
}

function advance(session, onProgress) {
  session.boot.checked += 1
  if (typeof onProgress === 'function') onProgress(session.boot)
}

function stop(session, error) {
  session.boot.error = error
  session.boot.done = false
  return { ok: false, error }
}

function failureDetail(entry, message) {
  return { lesson: entry.lesson, file: entry.file, message }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

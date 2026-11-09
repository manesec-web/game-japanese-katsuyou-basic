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

// Checks the 50 lessons in order. A stored file is trusted only when its hash
// matches; a missing or corrupt file is downloaded up to twice and written
// only after the hash matches. Any lesson that cannot be verified stops the
// sequence and is recorded in session.boot.error.
export async function bootDictionary({ session, fetchLesson, store, manifest, onProgress }) {
  const entries = Array.isArray(manifest?.lessons) ? manifest.lessons : []
  session.boot.checked = 0
  session.boot.total = entries.length
  session.boot.done = false
  session.boot.error = null

  if (entries.length === 0) {
    return stop(session, { lesson: null, message: 'manifest has no lessons' })
  }

  for (const entry of entries) {
    let stored = null
    try {
      stored = await store.read(entry.file)
    } catch (error) {
      return stop(session, failureDetail(entry, `cannot read stored copy: ${errorMessage(error)}`))
    }

    if (stored) {
      try {
        if ((await sha256Hex(stored)) === entry.sha256) {
          advance(session, onProgress)
          continue
        }
      } catch (error) {
        return stop(session, failureDetail(entry, `cannot hash stored copy: ${errorMessage(error)}`))
      }
    }

    const download = await downloadVerified(entry, { fetchLesson, store })
    if (!download.ok) {
      return stop(session, failureDetail(entry, download.message))
    }
    advance(session, onProgress)
  }

  session.boot.done = true
  return { ok: true, result: { checked: session.boot.checked, total: session.boot.total } }
}

async function downloadVerified(entry, { fetchLesson, store }) {
  let message = 'download did not run'
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    let bytes
    try {
      bytes = await fetchLesson(entry.lesson)
    } catch (error) {
      message = `download ${attempt} failed: ${errorMessage(error)}`
      continue
    }
    let hash
    try {
      hash = await sha256Hex(bytes)
    } catch (error) {
      message = `download ${attempt} could not be hashed: ${errorMessage(error)}`
      continue
    }
    if (hash !== entry.sha256) {
      message = `download ${attempt} hash mismatch`
      continue
    }
    try {
      await store.write(entry.file, bytes)
    } catch (error) {
      message = `cannot write verified copy: ${errorMessage(error)}`
      return { ok: false, message }
    }
    return { ok: true }
  }
  return { ok: false, message }
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

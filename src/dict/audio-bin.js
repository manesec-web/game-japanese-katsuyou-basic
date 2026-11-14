// Ensures a lesson's audio bin is available and sha256-verified for this
// session. Pure given its injected dependencies; the command supplies the real
// IndexedDB store, the release fetcher and the SHA-256 helper.
//
// Verification happens at most once per session per lesson: `verified` is
// session state, reset on reload. A stored copy already verified this session
// is used as-is; a stored copy from an earlier session is re-hashed once; a
// missing or corrupt copy is downloaded, hashed against the audio manifest and
// stored only when it matches.

export class AudioError extends Error {
  constructor(detail) {
    super(detail?.message ?? 'audio unavailable')
    this.name = 'AudioError'
    this.code = 'audio-unavailable'
    this.details = detail ?? null
  }
}

export async function ensureAudioBin({
  lesson,
  file,
  expectedHash,
  verified,
  store,
  fetchBin,
  sha256,
  onDownload,
}) {
  let bytes = null
  if (verified[lesson]) {
    // Already verified this session: the record must exist. If it was cleared
    // out from under us, fall through and re-download below.
    bytes = await store.read(file)
    if (bytes) return { bytes, downloaded: false }
  } else {
    bytes = await store.read(file)
    if (bytes) {
      const hash = await safeSha256(sha256, bytes, lesson, file)
      if (hash === expectedHash) {
        verified[lesson] = true
        return { bytes, downloaded: false }
      }
      // Corrupt stored copy: re-download below.
      bytes = null
    }
  }

  if (typeof onDownload === 'function') onDownload({ lesson, file })

  let downloaded
  try {
    downloaded = await fetchBin(lesson, file)
  } catch (error) {
    throw new AudioError({ lesson, file, message: `download failed: ${errorMessage(error)}` })
  }

  const hash = await safeSha256(sha256, downloaded, lesson, file)
  if (hash !== expectedHash) {
    throw new AudioError({ lesson, file, message: `hash mismatch for ${file}` })
  }

  try {
    await store.write(file, downloaded)
  } catch (error) {
    throw new AudioError({
      lesson,
      file,
      message: `cannot store verified copy: ${errorMessage(error)}`,
    })
  }
  verified[lesson] = true
  return { bytes: downloaded, downloaded: true }
}

async function safeSha256(sha256, bytes, lesson, file) {
  try {
    return await sha256(bytes)
  } catch (error) {
    throw new AudioError({ lesson, file, message: `cannot hash: ${errorMessage(error)}` })
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

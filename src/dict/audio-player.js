// Plays one Opus entry through an <audio> element. The Opus bytes are a
// standard Ogg-Opus stream, so a Blob URL into the audio element is enough.
// Only one audio plays at a time; starting a new one stops the previous.
import { AudioError } from './audio-bin.js'
import { extractAudioEntry } from './audio-entry.js'

let current = null

function stopCurrent({ notify = false } = {}) {
  if (!current) return
  try {
    current.audio.pause()
  } catch {
    /* the element may already be gone */
  }
  try {
    URL.revokeObjectURL(current.url)
  } catch {
    /* ignore */
  }
  const stopped = current
  current = null
  if (notify && typeof stopped.onStopped === 'function') {
    stopped.onStopped(stopped.target)
  }
}

export async function playEntry({
  bytes,
  text,
  target,
  openArchive,
  onEnded,
  onError,
  onStopped,
  createAudio = () => new Audio(),
}) {
  const entry = await extractAudioEntry({ bytes, text, openArchive })

  // A new play replaces the previous one: stop it and tell its target so the
  // reader can clear that word's grey, leaving only the new one tinted.
  stopCurrent({ notify: true })
  const audio = createAudio()
  const blob = new Blob([entry.bytes], { type: 'audio/ogg; codecs=opus' })
  const url = URL.createObjectURL(blob)
  audio.src = url
  current = { audio, url, target, onStopped }

  function finish(kind) {
    if (!current || current.target !== target) return
    stopCurrent()
    if (kind === 'ended' && typeof onEnded === 'function') onEnded(target)
    if (kind === 'error' && typeof onError === 'function') onError(target)
  }

  audio.addEventListener('ended', () => finish('ended'), { once: true })
  audio.addEventListener('error', () => finish('error'), { once: true })

  try {
    await audio.play()
  } catch (error) {
    const wasCurrent = current?.target === target
    stopCurrent()
    if (wasCurrent && typeof onError === 'function') onError(target)
    throw new AudioError({ target, message: `playback failed: ${errorMessage(error)}` })
  }
  return { target, name: entry.name }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

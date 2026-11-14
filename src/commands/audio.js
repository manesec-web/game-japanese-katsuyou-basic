// Audio playback command. Clicking a Japanese word or sentence in the reader
// runs `audio.play`, which lazily ensures the lesson's audio bin (downloading
// and sha256-verifying it once per session), decompresses the single Opus entry
// and plays it. Failures raise `audio-unavailable`, which the reader shows as
// 「該音頻暫時無法播放」.
import audioManifest from '../data/audio-manifest.json'
import { CommandError } from '../engine/errors.js'
import { ensureAudioBin, AudioError } from '../dict/audio-bin.js'
import { sha256Hex } from '../dict/hash.js'
import { openArchive } from '../dict/archive.js'
import { audioIdb } from '../storage/audio-idb.js'
import { playEntry } from '../dict/audio-player.js'

const UNAVAILABLE_HINT = '該音頻暫時無法播放'
const HINT_MS = 2200

// The bins ship same-origin under /dict/resource/ (the build downloads them
// from the release into dict/resource/ and Pages serves them), because GitHub
// release assets do not allow cross-origin fetch.
async function defaultFetchBin(lesson, file) {
  const url =
    typeof document !== 'undefined'
      ? new URL(`dict/resource/${file}`, document.baseURI).href
      : `dict/resource/${file}`
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${file}`)
  return new Uint8Array(await response.arrayBuffer())
}

// One download per lesson at a time: two words from the same lesson that are
// pressed while its bin is still streaming share the same fetch/verify work.
const pending = new Map()

export function specs(deps = {}) {
  const store = deps.audioStore ?? audioIdb
  const fetchBin = deps.fetchBin ?? defaultFetchBin
  const sha256 = deps.sha256 ?? sha256Hex
  const readArchive = deps.openArchive ?? openArchive
  const play = deps.playEntry ?? playEntry
  const manifest = deps.audioManifest ?? audioManifest
  const byLesson = new Map(manifest.lessons.map((entry) => [entry.lesson, entry]))

  function ensureOnce(args) {
    const existing = pending.get(args.lesson)
    if (existing) return existing
    const promise = ensureAudioBin(args)
    pending.set(args.lesson, promise)
    promise.then(
      () => {
        if (pending.get(args.lesson) === promise) pending.delete(args.lesson)
      },
      () => {
        if (pending.get(args.lesson) === promise) pending.delete(args.lesson)
      },
    )
    return promise
  }

  return [
    {
      id: 'audio.play',
      params: ['target', 'lesson', 'text'],
      enabled: (session) => session.screen === 'reader' && session.items.length > 0,
      run: async (session, params) => {
        const { target, lesson, text } = params
        if (typeof target !== 'string' || target === '') {
          throw new CommandError('invalid-params', 'audio.play needs a target id')
        }
        if (!Number.isInteger(lesson) || lesson <= 0) {
          throw new CommandError('invalid-params', 'audio.play needs a positive lesson number')
        }
        if (typeof text !== 'string' || text === '') {
          throw new CommandError('invalid-params', 'audio.play needs the Japanese text')
        }
        const entry = byLesson.get(lesson)
        if (!entry) {
          throw new CommandError('audio-unavailable', UNAVAILABLE_HINT)
        }

        const states = session.audio.states
        let hintTimer = null
        function markUnavailable() {
          session.audio.hint = UNAVAILABLE_HINT
          clearTimeout(hintTimer)
          hintTimer = setTimeout(() => {
            if (session.audio.hint === UNAVAILABLE_HINT) session.audio.hint = null
          }, HINT_MS)
        }

        try {
          const { bytes } = await ensureOnce({
            lesson,
            file: entry.file,
            expectedHash: entry.sha256,
            verified: session.audio.verified,
            store,
            fetchBin,
            sha256,
            onDownload: () => {
              states[target] = 'downloading'
            },
          })
          await play({
            bytes,
            text,
            target,
            openArchive: readArchive,
            onEnded: (finishedTarget) => {
              if (states[finishedTarget] !== undefined) delete states[finishedTarget]
            },
            onError: (failedTarget) => {
              if (states[failedTarget] !== undefined) delete states[failedTarget]
              markUnavailable()
            },
            onStopped: (stoppedTarget) => {
              if (states[stoppedTarget] !== undefined) delete states[stoppedTarget]
            },
          })
          states[target] = 'playing'
          return { target, lesson }
        } catch (error) {
          if (states[target] !== undefined) delete states[target]
          markUnavailable()
          if (error?.code === 'audio-unavailable' || error?.code === 'invalid-params') {
            throw error
          }
          throw new AudioError({ lesson, message: errorMessage(error) })
        }
      },
    },
  ]
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

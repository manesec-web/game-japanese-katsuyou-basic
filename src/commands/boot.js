import manifest from '../data/dict-manifest.json'
import { bootDictionary, BootError } from '../dict/boot.js'
import { idb } from '../storage/idb.js'

async function defaultFetchLesson(lesson) {
  const file = `lesson_${lesson}.json`
  const url =
    typeof document !== 'undefined'
      ? new URL(`dict/${file}`, document.baseURI).href
      : `dict/${file}`
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${file}`)
  return new Uint8Array(await response.arrayBuffer())
}

export function specs(deps = {}) {
  const fetchLesson = deps.fetchLesson ?? defaultFetchLesson
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
            fetchLesson,
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

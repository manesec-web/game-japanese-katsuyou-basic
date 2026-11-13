import { describe, expect, it } from 'vitest'
import { sha256Hex } from './hash.js'
import { bootDictionary } from './boot.js'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as bootSpecs } from '../commands/boot.js'

const LESSON_COUNT = 50
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function payload(lesson) {
  return encoder.encode(`{"lesson_${lesson}":{"vols":[]}}`)
}

async function buildManifest() {
  const lessons = []
  for (let lesson = 1; lesson <= LESSON_COUNT; lesson += 1) {
    lessons.push({
      lesson,
      file: `lesson_${lesson}.json`,
      sha256: await sha256Hex(payload(lesson)),
    })
  }
  return { algorithm: 'sha256', total: LESSON_COUNT, lessons }
}

function fakeStore(initial = {}) {
  const files = new Map(Object.entries(initial))
  const writes = []
  let failWriteFor = null
  return {
    files,
    writes,
    failWriteOn(name) {
      failWriteFor = name
    },
    async read(name) {
      return files.has(name) ? files.get(name) : null
    },
    async write(name, data) {
      if (name === failWriteFor) throw new Error('disk is full')
      files.set(name, data)
      writes.push(name)
    },
    async remove(name) {
      return files.delete(name)
    },
  }
}

// The archive is faked as an attempt-numbered token, so a test can hand out
// different bytes on the first and the second download. `omit` drops entries
// (an incomplete archive) and `mutate` rewrites one entry's bytes.
function fakeArchiveSource(manifest, { omit = [], mutate = null, failFetch = null } = {}) {
  const fetches = []
  const opens = []
  let attempts = 0

  async function fetchArchive() {
    attempts += 1
    const attempt = attempts
    if (failFetch && failFetch(attempt)) throw new Error('network down')
    fetches.push(attempt)
    return encoder.encode(`archive-${attempt}`)
  }

  async function openArchive(bytes) {
    const attempt = Number(decoder.decode(bytes).split('-')[1])
    opens.push(attempt)
    const entries = new Map()
    for (const entry of manifest.lessons) {
      if (omit.includes(entry.lesson)) continue
      const replacement = mutate ? mutate(entry.lesson, attempt) : null
      entries.set(entry.file, replacement ?? payload(entry.lesson))
    }
    return {
      names: [...entries.keys()],
      has: (name) => entries.has(name),
      read: async (name) => entries.get(name),
    }
  }

  return { fetchArchive, openArchive, fetches, opens }
}

async function run(overrides = {}) {
  const manifest = overrides.manifest ?? (await buildManifest())
  const session = createSession()
  const store = overrides.store ?? fakeStore()
  const archive =
    overrides.archive ??
    fakeArchiveSource(manifest, {
      omit: overrides.omit,
      mutate: overrides.mutate,
      failFetch: overrides.failFetch,
    })
  const outcome = await bootDictionary({
    session,
    fetchArchive: archive.fetchArchive,
    openArchive: archive.openArchive,
    store,
    manifest,
    onProgress: overrides.onProgress,
  })
  return { outcome, session, store, archive, manifest }
}

describe('bootDictionary', () => {
  it('downloads the archive once and stores every missing lesson in order', async () => {
    const { outcome, session, store, archive } = await run()
    expect(outcome.ok).toBe(true)
    expect(session.boot.checked).toBe(50)
    expect(session.boot.total).toBe(50)
    expect(session.boot.done).toBe(true)
    expect(session.boot.error).toBeNull()
    expect(archive.fetches).toEqual([1])
    expect(store.writes).toHaveLength(50)
    expect(store.files.size).toBe(50)
  })

  it('trusts verified stored copies without downloading the archive', async () => {
    const manifest = await buildManifest()
    const initial = {}
    for (const entry of manifest.lessons) initial[entry.file] = payload(entry.lesson)
    const { outcome, session, archive, store } = await run({ manifest, store: fakeStore(initial) })
    expect(outcome.ok).toBe(true)
    expect(archive.fetches).toEqual([])
    expect(store.writes).toEqual([])
    expect(session.boot.checked).toBe(50)
    expect(session.boot.done).toBe(true)
  })

  it('replaces a corrupt stored copy from the archive and writes only that lesson', async () => {
    const manifest = await buildManifest()
    const initial = {}
    for (const entry of manifest.lessons) initial[entry.file] = payload(entry.lesson)
    initial['lesson_5.json'] = encoder.encode('corrupt')
    const { outcome, session, archive, store } = await run({ manifest, store: fakeStore(initial) })
    expect(outcome.ok).toBe(true)
    expect(archive.fetches).toEqual([1])
    expect(store.writes).toEqual(['lesson_5.json'])
    expect(store.files.get('lesson_5.json')).toEqual(payload(5))
    expect(session.boot.checked).toBe(50)
  })

  it('retries once when the first download fails', async () => {
    const { outcome, session, archive } = await run({ failFetch: (attempt) => attempt === 1 })
    expect(outcome.ok).toBe(true)
    expect(archive.fetches).toEqual([2])
    expect(session.boot.done).toBe(true)
    expect(session.boot.checked).toBe(50)
  })

  it('retries once when the first archive copy has the wrong bytes', async () => {
    const { outcome, session, store } = await run({
      mutate: (lesson, attempt) => (lesson === 7 && attempt === 1 ? encoder.encode('bad copy') : null),
    })
    expect(outcome.ok).toBe(true)
    expect(store.files.get('lesson_7.json')).toEqual(payload(7))
    expect(store.writes).toHaveLength(50)
    expect(session.boot.done).toBe(true)
    expect(session.boot.checked).toBe(50)
  })

  it('stops and names the lesson when its bytes mismatch both downloads', async () => {
    const { outcome, session, archive, store } = await run({
      mutate: (lesson) => (lesson === 7 ? encoder.encode('bad copy') : null),
    })
    expect(outcome.ok).toBe(false)
    expect(outcome.error.lesson).toBe(7)
    expect(outcome.error.file).toBe('lesson_7.json')
    expect(session.boot.error.lesson).toBe(7)
    expect(session.boot.done).toBe(false)
    expect(session.boot.checked).toBe(49)
    expect(archive.fetches).toHaveLength(2)
    // The unverified lesson is never written.
    expect(store.writes).toHaveLength(49)
    expect(store.files.has('lesson_7.json')).toBe(false)
  })

  it('stops and names the lesson when the archive never contains it', async () => {
    const { outcome, session, archive } = await run({ omit: [3] })
    expect(outcome.ok).toBe(false)
    expect(outcome.error.lesson).toBe(3)
    expect(session.boot.checked).toBe(49)
    expect(session.boot.done).toBe(false)
    expect(archive.fetches).toHaveLength(2)
    expect(outcome.error.message).toContain('missing lesson_3.json')
  })

  it('stops when the archive cannot be opened at all', async () => {
    const manifest = await buildManifest()
    const archive = {
      fetches: [],
      fetchArchive: async () => encoder.encode('archive-1'),
      openArchive: async () => {
        throw new Error('not a zip')
      },
    }
    const { outcome, session } = await run({ manifest, archive })
    expect(outcome.ok).toBe(false)
    expect(outcome.error.lesson).toBe(1)
    expect(session.boot.checked).toBe(0)
    expect(session.boot.done).toBe(false)
    expect(outcome.error.message).toContain('cannot be read')
  })

  it('stops when a verified lesson cannot be written', async () => {
    const store = fakeStore()
    store.failWriteOn('lesson_5.json')
    const { outcome, session } = await run({ store })
    expect(outcome.ok).toBe(false)
    expect(outcome.error.lesson).toBe(5)
    expect(session.boot.checked).toBe(4)
    expect(session.boot.done).toBe(false)
    expect(store.writes).toHaveLength(4)
  })

  it('downloads the empty-vols lessons 1, 3, 8, and 12 like any other', async () => {
    const { store, session, archive } = await run()
    for (const lesson of [1, 3, 8, 12]) {
      const stored = store.files.get(`lesson_${lesson}.json`)
      expect(stored).toBeTruthy()
      expect(JSON.parse(decoder.decode(stored))).toEqual({ [`lesson_${lesson}`]: { vols: [] } })
    }
    expect(archive.fetches).toHaveLength(1)
    expect(session.boot.checked).toBe(50)
  })

  it('reports the download itself while the archive streams', async () => {
    const manifest = await buildManifest()
    const session = createSession()
    const reports = []
    const archive = fakeArchiveSource(manifest)
    const fetchArchive = archive.fetchArchive
    const outcome = await bootDictionary({
      session,
      // A streaming fetcher reports bytes as it reads them, then returns bytes.
      fetchArchive: async (report) => {
        report(200, 600)
        report(600, 600)
        return fetchArchive()
      },
      openArchive: archive.openArchive,
      store: fakeStore(),
      manifest,
      onProgress: (boot) => reports.push({ ...boot.download }),
    })
    expect(outcome.ok).toBe(true)
    // The first two notifications are the byte reports; after that the download
    // is done and the bar holds at 100 while entries are verified.
    expect(reports[0]).toEqual({ base: 0, loaded: 200, total: 600, done: false })
    expect(reports[1]).toEqual({ base: 0, loaded: 600, total: 600, done: false })
    expect(session.boot.download.done).toBe(true)
    expect(session.boot.download.loaded).toBe(600)
    expect(session.boot.download.total).toBe(600)
    expect(reports.slice(2).every((entry) => entry.done)).toBe(true)
  })

  it('starts the download share at the lessons the cache check already verified', async () => {
    const manifest = await buildManifest()
    const initial = {}
    for (const entry of manifest.lessons.slice(0, 20)) initial[entry.file] = payload(entry.lesson)
    const { outcome, session } = await run({ manifest, store: fakeStore(initial) })
    expect(outcome.ok).toBe(true)
    // 20 of 50 lessons were already good, so the download started from 40%.
    expect(session.boot.download.base).toBe(40)
  })

  it('records progress through the callback', async () => {
    const manifest = await buildManifest()
    const session = createSession()
    const seen = []
    const archive = fakeArchiveSource(manifest)
    const outcome = await bootDictionary({
      session,
      fetchArchive: archive.fetchArchive,
      openArchive: archive.openArchive,
      store: fakeStore(),
      manifest,
      onProgress: (boot) => seen.push(boot.checked),
    })
    expect(outcome.ok).toBe(true)
    expect(seen).toHaveLength(50)
    expect(seen.at(-1)).toBe(50)
  })

  it('fails when the manifest has no lessons', async () => {
    const { outcome, session } = await run({ manifest: { lessons: [] } })
    expect(outcome.ok).toBe(false)
    expect(session.boot.error.message).toBe('manifest has no lessons')
    expect(session.boot.done).toBe(false)
  })
})

describe('app.boot through dispatch', () => {
  async function makeRegistry(overrides = {}) {
    const manifest = overrides.manifest ?? (await buildManifest())
    const store = overrides.store ?? fakeStore()
    const archive = overrides.archive ?? fakeArchiveSource(manifest, { mutate: overrides.mutate })
    const reg = createRegistry()
    reg.registerAll(
      bootSpecs({
        manifest,
        fetchArchive: archive.fetchArchive,
        openArchive: archive.openArchive,
        store,
      }),
    )
    return { reg, archive, store, manifest }
  }

  it('resolves to ok:true with the checked/total result and fills the session', async () => {
    const { reg } = await makeRegistry()
    const session = createSession()
    const result = await reg.dispatch(session, 'app.boot', {})
    expect(result.ok).toBe(true)
    expect(result.result).toEqual({ checked: 50, total: 50 })
    expect(session.boot.done).toBe(true)
    expect(session.boot.running).toBe(false)
  })

  it('resolves to ok:false with a boot-failed error naming the lesson', async () => {
    const { reg } = await makeRegistry({
      mutate: (lesson) => (lesson === 11 ? encoder.encode('bad copy') : null),
    })
    const session = createSession()
    const result = await reg.dispatch(session, 'app.boot', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('boot-failed')
    expect(result.error.details.lesson).toBe(11)
    expect(session.boot.error.lesson).toBe(11)
    expect(session.boot.done).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { sha256Hex } from './hash.js'
import { bootDictionary } from './boot.js'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as bootSpecs } from '../commands/boot.js'

const LESSON_COUNT = 50
const encoder = new TextEncoder()

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
  return {
    files,
    writes,
    async read(name) {
      return files.has(name) ? files.get(name) : null
    },
    async write(name, data) {
      files.set(name, data)
      writes.push(name)
    },
    async remove(name) {
      return files.delete(name)
    },
  }
}

function fakeFetch({ mutate } = {}) {
  const calls = []
  async function fetchLesson(lesson) {
    calls.push(lesson)
    const attempt = calls.filter((value) => value === lesson).length
    const replacement = mutate ? mutate(lesson, attempt) : null
    return replacement ?? payload(lesson)
  }
  return { fetchLesson, calls }
}

async function run(overrides = {}) {
  const manifest = overrides.manifest ?? (await buildManifest())
  const session = createSession()
  const store = overrides.store ?? fakeStore()
  const fetcher = overrides.fetcher ?? fakeFetch()
  const outcome = await bootDictionary({
    session,
    fetchLesson: fetcher.fetchLesson,
    store,
    manifest,
  })
  return { outcome, session, store, fetcher, manifest }
}

describe('bootDictionary', () => {
  it('downloads, verifies, and stores every missing lesson in order', async () => {
    const { outcome, session, store, fetcher } = await run()
    expect(outcome.ok).toBe(true)
    expect(session.boot.checked).toBe(50)
    expect(session.boot.total).toBe(50)
    expect(session.boot.done).toBe(true)
    expect(session.boot.error).toBeNull()
    expect(store.writes).toHaveLength(50)
    expect(store.files.size).toBe(50)
    expect(fetcher.calls).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
  })

  it('trusts verified stored copies without downloading', async () => {
    const manifest = await buildManifest()
    const initial = {}
    for (const entry of manifest.lessons) initial[entry.file] = payload(entry.lesson)
    const { outcome, session, store, fetcher } = await run({ manifest, store: fakeStore(initial) })
    expect(outcome.ok).toBe(true)
    expect(fetcher.calls).toEqual([])
    expect(store.writes).toEqual([])
    expect(session.boot.checked).toBe(50)
    expect(session.boot.done).toBe(true)
  })

  it('redownloads a corrupt stored copy and overwrites it', async () => {
    const manifest = await buildManifest()
    const store = fakeStore({ 'lesson_5.json': encoder.encode('corrupt') })
    const { outcome, session, fetcher } = await run({ manifest, store })
    expect(outcome.ok).toBe(true)
    expect(fetcher.calls.filter((lesson) => lesson === 5)).toHaveLength(1)
    expect(store.writes.filter((name) => name === 'lesson_5.json')).toHaveLength(1)
    expect(store.writes).toHaveLength(50)
    expect(store.files.get('lesson_5.json')).toEqual(payload(5))
    expect(session.boot.done).toBe(true)
  })

  it('retries once when the first download does not match', async () => {
    const fetcher = fakeFetch({
      mutate: (lesson, attempt) =>
        lesson === 3 && attempt === 1 ? encoder.encode('bad copy') : null,
    })
    const { outcome, session } = await run({ fetcher })
    expect(outcome.ok).toBe(true)
    expect(fetcher.calls.filter((lesson) => lesson === 3)).toHaveLength(2)
    expect(session.boot.done).toBe(true)
    expect(session.boot.checked).toBe(50)
  })

  it('stops and names the lesson when two downloads both mismatch', async () => {
    const fetcher = fakeFetch({
      mutate: (lesson) => (lesson === 7 ? encoder.encode('bad copy') : null),
    })
    const { outcome, session, store } = await run({ fetcher })
    expect(outcome.ok).toBe(false)
    expect(outcome.error.lesson).toBe(7)
    expect(outcome.error.file).toBe('lesson_7.json')
    expect(session.boot.error.lesson).toBe(7)
    expect(session.boot.done).toBe(false)
    expect(session.boot.checked).toBe(6)
    expect(fetcher.calls.filter((lesson) => lesson === 7)).toHaveLength(2)
    expect(store.writes).toHaveLength(6)
  })

  it('stops when a corrupt stored copy cannot be replaced', async () => {
    const manifest = await buildManifest()
    const fetcher = fakeFetch({
      mutate: (lesson) => (lesson === 9 ? encoder.encode('bad copy') : null),
    })
    const store = fakeStore({ 'lesson_9.json': encoder.encode('corrupt') })
    const { outcome, session } = await run({ manifest, store, fetcher })
    expect(outcome.ok).toBe(false)
    expect(outcome.error.lesson).toBe(9)
    expect(session.boot.checked).toBe(8)
    expect(session.boot.done).toBe(false)
    expect(fetcher.calls.filter((lesson) => lesson === 9)).toHaveLength(2)
  })

  it('downloads the empty-vols lessons 1, 3, 8, and 12 like any other', async () => {
    const { store, session } = await run()
    for (const lesson of [1, 3, 8, 12]) {
      const stored = store.files.get(`lesson_${lesson}.json`)
      expect(stored).toBeTruthy()
      expect(JSON.parse(new TextDecoder().decode(stored))).toEqual({
        [`lesson_${lesson}`]: { vols: [] },
      })
    }
    expect(session.boot.checked).toBe(50)
  })

  it('records progress through the callback', async () => {
    const manifest = await buildManifest()
    const session = createSession()
    const seen = []
    const outcome = await bootDictionary({
      session,
      fetchLesson: fakeFetch().fetchLesson,
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
    const fetcher = overrides.fetcher ?? fakeFetch()
    const store = overrides.store ?? fakeStore()
    const reg = createRegistry()
    reg.registerAll(bootSpecs({ manifest, fetchLesson: fetcher.fetchLesson, store }))
    return { reg, fetcher, store, manifest }
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
    const fetcher = fakeFetch({
      mutate: (lesson) => (lesson === 11 ? encoder.encode('bad copy') : null),
    })
    const { reg } = await makeRegistry({ fetcher })
    const session = createSession()
    const result = await reg.dispatch(session, 'app.boot', {})
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('boot-failed')
    expect(result.error.details.lesson).toBe(11)
    expect(session.boot.error.lesson).toBe(11)
    expect(session.boot.done).toBe(false)
  })
})

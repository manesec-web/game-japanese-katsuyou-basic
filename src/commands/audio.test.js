import { describe, expect, it, vi } from 'vitest'
import { createRegistry } from '../engine/registry.js'
import { createSession } from '../engine/session.js'
import { specs as audioSpecs } from './audio.js'

const encoder = new TextEncoder()
const HASH = 'a'.repeat(64)

function fakeStore() {
  const map = new Map()
  return {
    map,
    read: vi.fn(async (file) => map.get(file) ?? null),
    write: vi.fn(async (file, bytes) => {
      map.set(file, bytes)
      return true
    }),
  }
}

function makeDeps(overrides = {}) {
  return {
    audioManifest: { lessons: [{ lesson: 10, file: 'lesson10.bin', sha256: HASH }] },
    audioStore: fakeStore(),
    fetchBin: vi.fn(async () => encoder.encode('bin')),
    sha256: vi.fn(async () => HASH),
    openArchive: vi.fn(async () => ({
      has: () => true,
      read: async () => encoder.encode('opus'),
    })),
    playEntry: vi.fn(async () => ({ target: 'w', name: 'x.opus' })),
    ...overrides,
  }
}

function setup(overrides = {}) {
  const deps = makeDeps(overrides)
  const registry = createRegistry()
  registry.registerAll(audioSpecs(deps))
  const session = createSession()
  session.screen = 'reader'
  session.items = [{ mode: 'dict', lesson: 10, verb: {} }]
  return { registry, session, deps }
}

describe('audio.play', () => {
  it('downloads, verifies, extracts and plays, marking the target playing', async () => {
    const { registry, session, deps } = setup()
    const result = await registry.dispatch(session, 'audio.play', {
      target: 'w',
      lesson: 10,
      text: 'ありがとうございます',
    })

    expect(result.ok).toBe(true)
    expect(session.audio.verified[10]).toBe(true)
    expect(session.audio.states.w).toBe('playing')
    expect(deps.playEntry).toHaveBeenCalledTimes(1)
    expect(deps.playEntry.mock.calls[0][0]).toMatchObject({
      target: 'w',
      text: 'ありがとうございます',
    })
  })

  it('sets the downloading state while the bin is streaming', async () => {
    let resolveFetch
    const fetchBin = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )
    const { registry, session } = setup({ fetchBin })

    const dispatching = registry.dispatch(session, 'audio.play', {
      target: 'w',
      lesson: 10,
      text: 'x',
    })
    await vi.waitFor(() => {
      expect(session.audio.states.w).toBe('downloading')
    })
    resolveFetch(encoder.encode('bin'))
    await dispatching
    expect(session.audio.states.w).toBe('playing')
  })

  it('clears a previous playing target when a new play stops it', async () => {
    const playEntry = vi.fn(async (args) => {
      if (args.onStopped) args.onStopped('prev')
      return { target: args.target, name: 'x.opus' }
    })
    const { registry, session } = setup({ playEntry })
    session.audio.states.prev = 'playing'

    const result = await registry.dispatch(session, 'audio.play', {
      target: 'w',
      lesson: 10,
      text: 'x',
    })
    expect(result.ok).toBe(true)
    expect(session.audio.states.prev).toBeUndefined()
    expect(session.audio.states.w).toBe('playing')
  })

  it('raises audio-unavailable and shows the hint when playback fails', async () => {
    const playEntry = vi.fn(async () => {
      throw Object.assign(new Error('missing entry'), { code: 'audio-unavailable' })
    })
    const { registry, session } = setup({ playEntry })

    const result = await registry.dispatch(session, 'audio.play', {
      target: 'w',
      lesson: 10,
      text: 'x',
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('audio-unavailable')
    expect(session.audio.states.w).toBeUndefined()
    expect(session.audio.hint).toBe('該音頻暫時無法播放')
  })

  it('raises audio-unavailable for a hash mismatch and stores nothing', async () => {
    const { registry, session, deps } = setup({ sha256: vi.fn(async () => 'b'.repeat(64)) })
    const result = await registry.dispatch(session, 'audio.play', {
      target: 'w',
      lesson: 10,
      text: 'x',
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('audio-unavailable')
    expect(session.audio.verified[10]).toBeUndefined()
    expect(deps.audioStore.write).not.toHaveBeenCalled()
    expect(session.audio.hint).toBe('該音頻暫時無法播放')
  })

  it('rejects a lesson with no audio bin', async () => {
    const { registry, session } = setup()
    const result = await registry.dispatch(session, 'audio.play', {
      target: 'w',
      lesson: 3,
      text: 'x',
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('audio-unavailable')
  })

  it('is disabled outside the reader', async () => {
    const { registry, session } = setup()
    session.screen = 'home'
    const result = await registry.dispatch(session, 'audio.play', {
      target: 'w',
      lesson: 10,
      text: 'x',
    })
    expect(result.ok).toBe(false)
    expect(result.error.code).toBe('command-disabled')
  })
})

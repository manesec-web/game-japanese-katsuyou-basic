import { describe, expect, it, vi } from 'vitest'
import { ensureAudioBin, AudioError } from './audio-bin.js'

const encoder = new TextEncoder()
const HASH = 'a'.repeat(64)
const FILE = 'lesson10.bin'
const LESSON = 10

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

function fakeFetch(bytes, fail = false) {
  return vi.fn(async () => {
    if (fail) throw new Error('network down')
    return bytes
  })
}

const downloadedBytes = encoder.encode('audio-bin-bytes')

describe('ensureAudioBin', () => {
  it('downloads a missing bin, verifies it and stores it', async () => {
    const store = fakeStore()
    const fetchBin = fakeFetch(downloadedBytes)
    const sha256 = vi.fn(async () => HASH)
    const verified = {}
    const onDownload = vi.fn()

    const result = await ensureAudioBin({
      lesson: LESSON,
      file: FILE,
      expectedHash: HASH,
      verified,
      store,
      fetchBin,
      sha256,
      onDownload,
    })

    expect(result).toEqual({ bytes: downloadedBytes, downloaded: true })
    expect(verified[LESSON]).toBe(true)
    expect(store.write).toHaveBeenCalledWith(FILE, downloadedBytes)
    expect(onDownload).toHaveBeenCalledTimes(1)
  })

  it('uses a stored, already-verified copy without hashing again', async () => {
    const store = fakeStore()
    store.map.set(FILE, downloadedBytes)
    const fetchBin = fakeFetch(downloadedBytes)
    const sha256 = vi.fn(async () => HASH)
    const verified = { [LESSON]: true }

    const result = await ensureAudioBin({
      lesson: LESSON,
      file: FILE,
      expectedHash: HASH,
      verified,
      store,
      fetchBin,
      sha256,
    })

    expect(result).toEqual({ bytes: downloadedBytes, downloaded: false })
    expect(fetchBin).not.toHaveBeenCalled()
    expect(sha256).not.toHaveBeenCalled()
  })

  it('re-hashes a stored copy once per session, with no download', async () => {
    const store = fakeStore()
    store.map.set(FILE, downloadedBytes)
    const fetchBin = fakeFetch(downloadedBytes)
    const sha256 = vi.fn(async () => HASH)
    const verified = {}

    const result = await ensureAudioBin({
      lesson: LESSON,
      file: FILE,
      expectedHash: HASH,
      verified,
      store,
      fetchBin,
      sha256,
    })

    expect(result).toEqual({ bytes: downloadedBytes, downloaded: false })
    expect(fetchBin).not.toHaveBeenCalled()
    expect(sha256).toHaveBeenCalledTimes(1)
    expect(verified[LESSON]).toBe(true)
  })

  it('fails on a download hash mismatch and stores nothing', async () => {
    const store = fakeStore()
    const fetchBin = fakeFetch(downloadedBytes)
    const sha256 = vi.fn(async () => 'b'.repeat(64))
    const verified = {}

    await expect(
      ensureAudioBin({
        lesson: LESSON,
        file: FILE,
        expectedHash: HASH,
        verified,
        store,
        fetchBin,
        sha256,
      }),
    ).rejects.toMatchObject({ code: 'audio-unavailable' })
    expect(verified[LESSON]).toBeUndefined()
    expect(store.write).not.toHaveBeenCalled()
  })

  it('re-downloads a corrupt stored copy', async () => {
    const store = fakeStore()
    store.map.set(FILE, encoder.encode('corrupt'))
    const fetchBin = fakeFetch(downloadedBytes)
    // First hash (stored copy) is wrong, second hash (download) is right.
    const sha256 = vi
      .fn()
      .mockResolvedValueOnce('bad'.repeat(16))
      .mockResolvedValueOnce(HASH)
    const verified = {}

    const result = await ensureAudioBin({
      lesson: LESSON,
      file: FILE,
      expectedHash: HASH,
      verified,
      store,
      fetchBin,
      sha256,
    })

    expect(result).toEqual({ bytes: downloadedBytes, downloaded: true })
    expect(fetchBin).toHaveBeenCalledTimes(1)
    expect(store.write).toHaveBeenCalledWith(FILE, downloadedBytes)
  })

  it('surfaces a download failure as audio-unavailable', async () => {
    const store = fakeStore()
    const fetchBin = fakeFetch(null, true)
    const sha256 = vi.fn(async () => HASH)

    await expect(
      ensureAudioBin({
        lesson: LESSON,
        file: FILE,
        expectedHash: HASH,
        verified: {},
        store,
        fetchBin,
        sha256,
      }),
    ).rejects.toMatchObject({ code: 'audio-unavailable' })
  })

  it('only fires onDownload when a real download runs', async () => {
    const store = fakeStore()
    store.map.set(FILE, downloadedBytes)
    const sha256 = vi.fn(async () => HASH)
    const onDownload = vi.fn()

    await ensureAudioBin({
      lesson: LESSON,
      file: FILE,
      expectedHash: HASH,
      verified: {},
      store,
      fetchBin: fakeFetch(downloadedBytes),
      sha256,
      onDownload,
    })
    expect(onDownload).not.toHaveBeenCalled()
  })
})

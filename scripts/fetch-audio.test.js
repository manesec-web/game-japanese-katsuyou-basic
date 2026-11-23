import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { syncAudioResources, verifyAudioResources } from './fetch-audio.mjs'

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const encoder = new TextEncoder()

function asset(content) {
  const bytes = encoder.encode(content)
  return { digest: `sha256:${sha256(bytes)}`, url: `https://example.test/${content}.bin`, bytes }
}

const lessons = [2, 4]
const lesson2 = asset('lesson-two-audio')
const lesson4 = asset('lesson-four-audio')

let dir
let manifestFile
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-fetch-'))
  manifestFile = path.join(dir, 'audio-manifest.json')
})

afterAll(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true })
})

function run(assets, overrides = {}) {
  const map = new Map(assets)
  const fetchBinary = vi.fn(async (url) => {
    const found = [...map.values()].find((a) => a.url === url)
    if (!found) throw new Error(`unexpected url ${url}`)
    return found.bytes
  })
  return syncAudioResources({
    lessons,
    assets: map,
    dir,
    manifestFile,
    fetchBinary,
    sha256,
    ...overrides,
  })
}

describe('syncAudioResources', () => {
  it('downloads every lesson bin and writes the manifest', async () => {
    const result = await run([
      ['lesson2.bin', lesson2],
      ['lesson4.bin', lesson4],
    ])
    expect(result.downloaded).toBe(2)
    expect(result.upToDate).toBe(0)
    expect(fs.readFileSync(path.join(dir, 'lesson2.bin'), 'utf8')).toBe('lesson-two-audio')
    expect(fs.readFileSync(path.join(dir, 'lesson4.bin'), 'utf8')).toBe('lesson-four-audio')

    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'))
    expect(manifest.lessons).toEqual([
      { lesson: 2, file: 'lesson2.bin', sha256: lesson2.digest.slice('sha256:'.length) },
      { lesson: 4, file: 'lesson4.bin', sha256: lesson4.digest.slice('sha256:'.length) },
    ])
  })

  it('leaves matching files alone and only downloads changed ones', async () => {
    await run([
      ['lesson2.bin', lesson2],
      ['lesson4.bin', lesson4],
    ])
    // The release updated lesson 2; lesson 4 is unchanged.
    const lesson2v2 = asset('lesson-two-audio-v2')
    const result = await run([
      ['lesson2.bin', lesson2v2],
      ['lesson4.bin', lesson4],
    ])
    expect(result.downloaded).toBe(1)
    expect(result.upToDate).toBe(1)
    expect(fs.readFileSync(path.join(dir, 'lesson2.bin'), 'utf8')).toBe('lesson-two-audio-v2')
  })

  it('fails when the release lacks a bin', async () => {
    await expect(run([['lesson2.bin', lesson2]])).rejects.toThrow(/no asset named lesson4\.bin/)
  })

  it('fails when a download does not match its digest', async () => {
    const tampered = { ...lesson2, digest: `sha256:${'f'.repeat(64)}` }
    await expect(run([['lesson2.bin', tampered], ['lesson4.bin', lesson4]])).rejects.toThrow(
      /download hash mismatch/,
    )
  })
})

function binEntry(lesson, content) {
  return { lesson, file: `lesson${lesson}.bin`, sha256: sha256(encoder.encode(content)) }
}

function manifestOf(entries) {
  return { algorithm: 'sha256', source: 'test', total: entries.length, lessons: entries }
}

describe('verifyAudioResources', () => {
  it('accepts a complete local cache against the manifest', () => {
    fs.writeFileSync(path.join(dir, 'lesson2.bin'), 'lesson-two-audio')
    fs.writeFileSync(path.join(dir, 'lesson4.bin'), 'lesson-four-audio')
    const manifest = manifestOf([binEntry(2, 'lesson-two-audio'), binEntry(4, 'lesson-four-audio')])
    const result = verifyAudioResources({ lessons: [2, 4], manifest, dir, sha256 })
    expect(result.upToDate).toBe(2)
    expect(result.downloaded).toBe(0)
  })

  it('fails when a bin is missing', () => {
    fs.writeFileSync(path.join(dir, 'lesson2.bin'), 'lesson-two-audio')
    const manifest = manifestOf([binEntry(2, 'lesson-two-audio'), binEntry(4, 'lesson-four-audio')])
    expect(() => verifyAudioResources({ lessons: [2, 4], manifest, dir, sha256 })).toThrow(
      /lesson4\.bin is missing/,
    )
  })

  it('fails when a bin does not match its sha256', () => {
    fs.writeFileSync(path.join(dir, 'lesson2.bin'), 'lesson-two-audio')
    fs.writeFileSync(path.join(dir, 'lesson4.bin'), 'tampered')
    const manifest = manifestOf([binEntry(2, 'lesson-two-audio'), binEntry(4, 'lesson-four-audio')])
    expect(() => verifyAudioResources({ lessons: [2, 4], manifest, dir, sha256 })).toThrow(
      /does not match its sha256/,
    )
  })

  it('fails when the manifest does not cover a lesson', () => {
    fs.writeFileSync(path.join(dir, 'lesson2.bin'), 'lesson-two-audio')
    const manifest = manifestOf([binEntry(2, 'lesson-two-audio')])
    expect(() => verifyAudioResources({ lessons: [2, 4], manifest, dir, sha256 })).toThrow(/invalid/)
  })
})

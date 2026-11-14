import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { unzip } from 'unzipit'
import {
  buildLessonArchive,
  listLessonNumbers,
  readLessonAudio,
  releaseDir,
} from './res-archive.mjs'

// A copy of the real layout, small enough to build in a test: lessons 2 and 7
// have audio, lesson 4 exists but holds no .opus files, and a stray directory
// is ignored.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'res-miles-'))

function writeOpus(lesson, name, text) {
  const dir = path.join(fixture, `lesson${lesson}`)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, name), text)
}

writeOpus(7, 'b7f0c9d2aa11ee33.opus', 'second lesson audio')
writeOpus(7, '0a0b0c0d0e0f1011.opus', 'first file by name')
writeOpus(2, '1122334455667788.opus', 'lesson two audio')
fs.mkdirSync(path.join(fixture, 'lesson4'))
fs.writeFileSync(path.join(fixture, 'lesson4', 'notes.txt'), 'not audio')
fs.mkdirSync(path.join(fixture, 'release'))

afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }))

async function readBack(bytes) {
  const { entries } = await unzip(bytes, { useWorkers: false })
  const out = {}
  for (const [name, entry] of Object.entries(entries)) {
    out[name] = new TextDecoder().decode(new Uint8Array(await entry.arrayBuffer()))
  }
  return out
}

describe('listLessonNumbers', () => {
  it('lists only lesson directories, ascending', () => {
    expect(listLessonNumbers({ dir: fixture })).toEqual([2, 4, 7])
  })
})

describe('readLessonAudio', () => {
  it('returns the .opus files sorted by name', () => {
    const files = readLessonAudio(7, { dir: fixture })
    expect(files.map((file) => file.name)).toEqual(['0a0b0c0d0e0f1011.opus', 'b7f0c9d2aa11ee33.opus'])
  })

  it('rejects a lesson with no audio files', () => {
    expect(() => readLessonAudio(4, { dir: fixture })).toThrow(/no \.opus files/)
  })

  it('rejects a lesson with no directory', () => {
    expect(() => readLessonAudio(1, { dir: fixture })).toThrow(/no audio directory/)
  })
})

describe('buildLessonArchive', () => {
  it('packs one lesson into lessonN.bin with bare entry names', async () => {
    const built = buildLessonArchive(2, { dir: fixture })
    expect(built.name).toBe('lesson2.bin')
    expect(built.files).toBe(1)
    expect(built.rawBytes).toBe(Buffer.byteLength('lesson two audio'))
    expect(await readBack(built.bytes)).toEqual({ '1122334455667788.opus': 'lesson two audio' })
  })

  it('is reproducible byte for byte', () => {
    const first = buildLessonArchive(7, { dir: fixture })
    const second = buildLessonArchive(7, { dir: fixture })
    expect(second.sha256).toBe(first.sha256)
  })

  it('publishes into res-miles/release', () => {
    expect(releaseDir.endsWith(path.join('res-miles', 'release'))).toBe(true)
  })
})

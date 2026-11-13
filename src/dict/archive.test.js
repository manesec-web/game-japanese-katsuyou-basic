import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { openArchive } from './archive.js'
import { sha256Hex } from './hash.js'
import { buildVolArchive, readManifest, volDir } from '../../scripts/vol-archive.mjs'

const manifest = readManifest()
const built = buildVolArchive({ manifest })

describe('openArchive', () => {
  it('reads a real shipped archive back into the original bytes', async () => {
    const archive = await openArchive(built.bytes)
    expect(archive.names).toEqual(manifest.lessons.map((entry) => entry.file))
    const lesson1 = await archive.read('lesson_1.json')
    expect(lesson1).toEqual(new Uint8Array(readFileSync(path.join(volDir, 'lesson_1.json'))))
    expect(await sha256Hex(lesson1)).toBe(manifest.lessons[0].sha256)
  })

  it('reports which entries exist', async () => {
    const archive = await openArchive(built.bytes)
    expect(archive.has('lesson_7.json')).toBe(true)
    expect(archive.has('lesson_99.json')).toBe(false)
    await expect(archive.read('lesson_99.json')).rejects.toThrow(/missing/)
  })

  it('reads every entry the manifest names', async () => {
    const archive = await openArchive(built.bytes)
    for (const entry of manifest.lessons) {
      expect(archive.has(entry.file)).toBe(true)
      const bytes = await archive.read(entry.file)
      expect(await sha256Hex(bytes)).toBe(entry.sha256)
    }
  })
})

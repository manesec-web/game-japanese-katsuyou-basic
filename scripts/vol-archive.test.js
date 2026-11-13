import { describe, expect, it } from 'vitest'
import { buildVolArchive, readManifest, ARCHIVE_NAME } from './vol-archive.mjs'

const manifest = readManifest()
let cached = null
function archive() {
  if (!cached) cached = buildVolArchive({ manifest })
  return cached
}

describe('buildVolArchive', () => {
  it('packs all 50 lessons and keeps their names', () => {
    const built = archive()
    expect(built.lessons).toBe(50)
    expect(built.names).toEqual(manifest.lessons.map((entry) => entry.file))
    expect(ARCHIVE_NAME).toBe('vol.bin')
  })

  it('is much smaller than the raw dictionary', () => {
    const built = archive()
    // The JSON compresses about 9x; assert a loose upper bound so a data
    // change cannot silently make the archive useless.
    expect(built.bytes.length).toBeLessThan(built.rawBytes / 5)
  })

  it('is reproducible byte for byte', () => {
    const again = buildVolArchive({ manifest })
    expect(again.sha256).toBe(archive().sha256)
  })

  it('refuses to build when a lesson no longer matches the manifest', () => {
    const tampered = {
      ...manifest,
      lessons: manifest.lessons.map((entry) =>
        entry.lesson === 4 ? { ...entry, sha256: '0'.repeat(64) } : entry,
      ),
    }
    expect(() => buildVolArchive({ manifest: tampered })).toThrow(/lesson 4/)
  })

  it('refuses to build when the manifest is empty', () => {
    expect(() => buildVolArchive({ manifest: { lessons: [] } })).toThrow(/no lessons/)
  })

  it('reports a missing source file instead of packing a hole', () => {
    const withGhost = {
      ...manifest,
      lessons: [...manifest.lessons, { lesson: 51, file: 'lesson_51.json', sha256: 'f'.repeat(64) }],
    }
    expect(() => buildVolArchive({ manifest: withGhost })).toThrow(/missing/)
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildManifest,
  nonEmptyLessons,
  validateManifest,
} from './write-audio-manifest.mjs'

const lessons = nonEmptyLessons()

function digestFor(lesson) {
  return `sha256:${String(lesson).padStart(64, '0')}`
}

describe('nonEmptyLessons', () => {
  it('finds the 46 lessons that have verbs, excluding the empty four', () => {
    expect(lessons.length).toBe(46)
    expect(lessons).not.toContain(1)
    expect(lessons).not.toContain(3)
    expect(lessons).not.toContain(8)
    expect(lessons).not.toContain(12)
    expect(lessons).toContain(2)
    expect(lessons).toContain(10)
    expect(lessons).toContain(50)
  })
})

describe('buildManifest', () => {
  it('maps each non-empty lesson to its lessonX.bin sha256', () => {
    const digests = new Map(lessons.map((lesson) => [`lesson${lesson}.bin`, digestFor(lesson)]))
    const manifest = buildManifest(lessons, digests)
    expect(manifest.algorithm).toBe('sha256')
    expect(manifest.total).toBe(46)
    expect(manifest.lessons[0]).toEqual({
      lesson: 2,
      file: 'lesson2.bin',
      sha256: digestFor(2).slice('sha256:'.length),
    })
    expect(manifest.lessons.find((e) => e.lesson === 10).file).toBe('lesson10.bin')
  })

  it('refuses a release missing a bin', () => {
    const digests = new Map(lessons.slice(1).map((lesson) => [`lesson${lesson}.bin`, digestFor(lesson)]))
    expect(() => buildManifest(lessons, digests)).toThrow(/no asset named lesson2\.bin/)
  })

  it('refuses a non-sha256 digest', () => {
    const digests = new Map(lessons.map((lesson) => [`lesson${lesson}.bin`, 'md5:deadbeef']))
    expect(() => buildManifest(lessons, digests)).toThrow(/unusable sha256 digest/)
  })
})

describe('validateManifest', () => {
  const valid = buildManifest(
    lessons,
    new Map(lessons.map((lesson) => [`lesson${lesson}.bin`, digestFor(lesson)])),
  )

  it('accepts the correct manifest', () => {
    expect(validateManifest(valid, lessons)).toEqual({ ok: true, errors: [] })
  })

  it('rejects a missing lesson', () => {
    const missing = { ...valid, lessons: valid.lessons.filter((e) => e.lesson !== 2) }
    const result = validateManifest(missing, lessons)
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('lesson 2 is missing')
  })

  it('rejects an entry for an empty lesson', () => {
    const extra = { ...valid, lessons: [...valid.lessons, { lesson: 1, file: 'lesson1.bin', sha256: '0'.repeat(64) }] }
    const result = validateManifest(extra, lessons)
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('lesson 1 is not a non-empty lesson')
  })

  it('rejects a wrong file name or bad hash', () => {
    const tampered = {
      ...valid,
      lessons: valid.lessons.map((e) =>
        e.lesson === 2 ? { ...e, file: 'lesson_2.bin' } : e,
      ),
    }
    const result = validateManifest(tampered, lessons)
    expect(result.ok).toBe(false)
    expect(result.errors.join('\n')).toContain('should be lesson2.bin')

    const badHash = {
      ...valid,
      lessons: valid.lessons.map((e) => (e.lesson === 2 ? { ...e, sha256: 'xyz' } : e)),
    }
    expect(validateManifest(badHash, lessons).ok).toBe(false)
  })

  it('rejects a total that disagrees with the entries', () => {
    expect(validateManifest({ ...valid, total: 45 }, lessons).ok).toBe(false)
  })
})

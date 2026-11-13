import { describe, expect, it } from 'vitest'
import { unzip } from 'unzipit'
import { createZip, crc32 } from './zip.mjs'

const encoder = new TextEncoder()

function files(...names) {
  return names.map((name) => ({ name, bytes: encoder.encode(`content of ${name}`) }))
}

async function readBack(zipBytes) {
  const { entries } = await unzip(zipBytes, { useWorkers: false })
  const out = {}
  for (const [name, entry] of Object.entries(entries)) {
    out[name] = new TextDecoder().decode(new Uint8Array(await entry.arrayBuffer()))
  }
  return out
}

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926)
  })

  it('is zero for the empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
  })
})

describe('createZip', () => {
  it('writes an archive unzipit can read entry by entry', async () => {
    const zipBytes = createZip(files('lesson_1.json', 'lesson_2.json', 'lesson_3.json'))
    const out = await readBack(zipBytes)
    expect(Object.keys(out).sort()).toEqual(['lesson_1.json', 'lesson_2.json', 'lesson_3.json'])
    expect(out['lesson_2.json']).toBe('content of lesson_2.json')
  })

  it('produces identical bytes for identical input (no timestamps)', () => {
    const first = createZip(files('a.json', 'b.json'))
    const second = createZip(files('a.json', 'b.json'))
    expect(first.equals(second)).toBe(true)
  })

  it('compresses repetitive JSON far below its raw size', async () => {
    const raw = encoder.encode(JSON.stringify({ vols: Array.from({ length: 200 }, (_, i) => ({ vol: `動詞${i}` })) }))
    const zipBytes = createZip([{ name: 'big.json', bytes: raw }])
    expect(zipBytes.length).toBeLessThan(raw.length / 4)
    const out = await readBack(zipBytes)
    expect(out['big.json']).toBe(new TextDecoder().decode(raw))
  })

  it('handles an empty archive without producing a trailing central directory', async () => {
    const zipBytes = createZip([])
    expect(zipBytes.length).toBe(22)
    const { entries } = await unzip(zipBytes, { useWorkers: false })
    expect(Object.keys(entries)).toEqual([])
  })
})

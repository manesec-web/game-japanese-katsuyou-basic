import { describe, expect, it } from 'vitest'
import { openArchive } from './archive.js'
import { extractAudioEntry } from './audio-entry.js'
import { audioFileName } from './audio-name.js'
import { createZip } from '../../scripts/zip.mjs'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function bin(...pairs) {
  return createZip(pairs.map(([name, text]) => ({ name, bytes: encoder.encode(text) })))
}

const TEXT = '庭に 犬が いる。'
const OTHER = 'ありがとうございます'

describe('extractAudioEntry', () => {
  it('decompresses only the entry the text names', async () => {
    const name = audioFileName(TEXT)
    const bytes = bin([name, 'opus-bytes'], [audioFileName(OTHER), 'other opus'])
    const result = await extractAudioEntry({ bytes, text: TEXT, openArchive })
    expect(result.name).toBe(name)
    expect(decoder.decode(result.bytes)).toBe('opus-bytes')
  })

  it('throws audio-unavailable when the entry is absent', async () => {
    const bytes = bin([audioFileName(OTHER), 'other opus'])
    await expect(extractAudioEntry({ bytes, text: TEXT, openArchive })).rejects.toMatchObject({
      code: 'audio-unavailable',
    })
  })

  it('throws audio-unavailable when the archive cannot be read', async () => {
    await expect(
      extractAudioEntry({ bytes: new Uint8Array([1, 2, 3]), text: TEXT, openArchive }),
    ).rejects.toMatchObject({ code: 'audio-unavailable' })
  })
})

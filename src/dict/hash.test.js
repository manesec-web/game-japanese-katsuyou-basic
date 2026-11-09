import { describe, expect, it } from 'vitest'
import { sha256Hex } from './hash.js'

const encoder = new TextEncoder()

describe('sha256Hex', () => {
  it('matches the known vector for "abc"', async () => {
    expect(await sha256Hex(encoder.encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('accepts an ArrayBuffer and returns lowercase hex', async () => {
    const bytes = encoder.encode('abc')
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    const digest = await sha256Hex(buffer)
    expect(digest).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(digest).toBe(digest.toLowerCase())
  })

  it('rejects data that is not bytes', async () => {
    await expect(sha256Hex('abc')).rejects.toThrow(TypeError)
  })
})

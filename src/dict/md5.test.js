import { describe, expect, it } from 'vitest'
import { md5Bytes, md5Hex } from './md5.js'

const encoder = new TextEncoder()

describe('md5', () => {
  it('matches the standard RFC 1321 test vectors', () => {
    expect(md5Hex('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5Hex('a')).toBe('0cc175b9c0f1b6a831c399e269772661')
    expect(md5Hex('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('matches well-known vectors', () => {
    expect(md5Hex('The quick brown fox jumps over the lazy dog')).toBe(
      '9e107d9d372bb6826bd81d3542a419d6',
    )
  })

  it('hashes UTF-8 Japanese text correctly', () => {
    expect(md5Hex('ありがとうございます')).toBe('94f49c978df33dc365b1b6aad2da8b7b')
  })

  it('agrees with md5Hex for byte and string inputs', () => {
    expect(md5Bytes(encoder.encode('abc'))).toBe(md5Hex('abc'))
  })
})

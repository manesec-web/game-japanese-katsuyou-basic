// Pure MD5 (RFC 1321). Web Crypto deliberately omits MD5, but the audio file
// names are derived from the MD5 of the Japanese text, so the digest must be
// computed in JavaScript. Operates on UTF-8 bytes and returns lowercase hex.

const SHIFT = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

// K[i] = floor(abs(sin(i + 1)) * 2^32). Deterministic; computed once at load.
const K = new Uint32Array(64)
for (let i = 0; i < 64; i += 1) {
  K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000)
}

function rotl(value, count) {
  return ((value << count) | (value >>> (32 - count))) >>> 0
}

function toHex(bytes) {
  let out = ''
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

// Digests a Uint8Array and returns the 32-char lowercase hex MD5.
export function md5Bytes(input) {
  const length = input.length
  const bitLength = length * 8
  // Message + 0x80 terminator + 8-byte length, rounded up to a 64-byte block.
  const paddedLength = ((Math.floor((length + 8) / 64) + 1) * 64)
  const padded = new Uint8Array(paddedLength)
  padded.set(input)
  padded[length] = 0x80
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, bitLength >>> 0, true)
  view.setUint32(paddedLength - 4, Math.floor(bitLength / 0x100000000), true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let offset = 0; offset < paddedLength; offset += 64) {
    const words = new Uint32Array(16)
    for (let j = 0; j < 16; j += 1) {
      words[j] = view.getUint32(offset + j * 4, true)
    }

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let i = 0; i < 64; i += 1) {
      let f
      let g
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      const next = d
      d = c
      c = b
      b = (b + rotl((a + f + K[i] + words[g]) >>> 0, SHIFT[i])) >>> 0
      a = next
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  const digest = new Uint8Array(16)
  const digestView = new DataView(digest.buffer)
  digestView.setUint32(0, a0, true)
  digestView.setUint32(4, b0, true)
  digestView.setUint32(8, c0, true)
  digestView.setUint32(12, d0, true)
  return toHex(digest)
}

// Digests a JS string (UTF-8 encoded) and returns the 32-char lowercase hex.
export function md5Hex(text) {
  return md5Bytes(new TextEncoder().encode(String(text)))
}

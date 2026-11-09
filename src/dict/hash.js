// SHA-256 helper shared by the boot sequence. Uses Web Crypto, available in
// the browser and in Node (Vitest runs under Node).
export async function sha256Hex(data) {
  const bytes = toBytes(data)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return hex(new Uint8Array(digest))
}

function toBytes(data) {
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return data
  throw new TypeError('sha256Hex expects an ArrayBuffer or a typed array')
}

function hex(bytes) {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0')
  return out
}

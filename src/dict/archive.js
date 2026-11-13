// Reads the shipped dictionary archive (dict/vol.bin) with unzipit. The file is
// a ZIP, but it is published without the `.zip` suffix so download-helper
// plugins do not hijack it. Entries are decompressed lazily: boot only pays for
// the lessons it actually needs, and a re-verify-only start decompresses nothing
// at all.
import { unzip } from 'unzipit'

export const ARCHIVE_FILE = 'vol.bin'

// Wraps the archive bytes into { names, has(name), read(name) }. `read` returns
// the entry's raw bytes, which are the exact bytes write-sha256.mjs hashed.
export async function openArchive(bytes, { unzipImpl = unzip } = {}) {
  const { entries } = await unzipImpl(bytes, { useWorkers: false })
  const byName = new Map(Object.entries(entries))
  return {
    names: [...byName.keys()],
    has(name) {
      return byName.has(name)
    },
    async read(name) {
      const entry = byName.get(name)
      if (!entry) throw new Error(`archive entry missing: ${name}`)
      return new Uint8Array(await entry.arrayBuffer())
    },
  }
}

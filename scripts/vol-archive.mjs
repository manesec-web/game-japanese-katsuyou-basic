// Builds the single dictionary archive that ships with the site. Every lesson
// is read from vol/, checked against src/data/dict-manifest.json, and packed
// into one deterministic ZIP (see scripts/zip.mjs). A hash mismatch or a missing
// lesson stops the build instead of publishing a broken archive.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createZip } from './zip.mjs'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
export const volDir = path.join(rootDir, 'vol')
export const manifestPath = path.join(rootDir, 'src', 'data', 'dict-manifest.json')
// The archive is a ZIP, but it is published as `vol.bin`: browser extensions
// and "download helper" plugins sniff `.zip` URLs and hijack them with a
// download dialog. The bytes never change, only the file name and its
// Content-Type.
export const ARCHIVE_NAME = 'vol.bin'

export function readManifest(file = manifestPath) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

// Reads the 50 lessons in manifest order and verifies each one against the
// manifest. Returns [{ name, bytes }], ready for createZip.
export function readVerifiedLessons({ dir = volDir, manifest } = {}) {
  const entries = Array.isArray(manifest?.lessons) ? manifest.lessons : []
  if (entries.length === 0) throw new Error('manifest has no lessons')
  const files = []
  for (const entry of entries) {
    const full = path.join(dir, entry.file)
    if (!fs.existsSync(full)) throw new Error(`dictionary source missing: ${full}`)
    const bytes = fs.readFileSync(full)
    const sha256 = sha256Hex(bytes)
    if (sha256 !== entry.sha256) {
      throw new Error(
        `lesson ${entry.lesson}: ${entry.file} sha256 ${sha256} does not match the manifest (${entry.sha256}); run node scripts/write-sha256.mjs`,
      )
    }
    files.push({ name: entry.file, bytes })
  }
  return files
}

// Returns { bytes, sha256, lessons, rawBytes, names } for the archive.
export function buildVolArchive(options = {}) {
  const manifest = options.manifest ?? readManifest(options.manifestPath)
  const files = readVerifiedLessons({ dir: options.dir ?? volDir, manifest })
  const bytes = createZip(files)
  const rawBytes = files.reduce((total, file) => total + file.bytes.length, 0)
  return {
    bytes,
    sha256: sha256Hex(bytes),
    lessons: files.length,
    rawBytes,
    names: files.map((file) => file.name),
  }
}

// Cheap invalidation key for the dev server: the newest mtime in vol/ plus the
// manifest's own mtime.
export function archiveSourceKey({ dir = volDir, manifestFile = manifestPath } = {}) {
  let newest = 0
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json')) continue
    const time = fs.statSync(path.join(dir, name)).mtimeMs
    if (time > newest) newest = time
  }
  const manifestTime = fs.existsSync(manifestFile) ? fs.statSync(manifestFile).mtimeMs : 0
  return `${newest}:${manifestTime}`
}

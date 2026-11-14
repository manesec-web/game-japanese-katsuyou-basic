// Builds the per-lesson audio archives that ship as GitHub release assets.
// Every lesson lives in resources/res-miles/lessonN/ as Ogg-Opus files named
// after the md5 (first 16 hex chars) of the word they pronounce. This module
// packs one lesson into a single deterministic ZIP (`lessonN.bin`, same writer
// as the dictionary: fixed 1980 timestamps, deflate level 9) and reports the
// numbers a release upload needs.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createZip } from './zip.mjs'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
export const resDir = path.join(rootDir, 'resources', 'res-miles')
export const releaseDir = path.join(resDir, 'release')
export const AUDIO_EXT = '.opus'
const LESSON_DIR = /^lesson(\d+)$/

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function lessonDir(lesson, dir) {
  const number = Number(lesson)
  if (!Number.isInteger(number) || number <= 0) {
    throw new TypeError(`lesson must be a positive integer, got ${lesson}`)
  }
  return path.join(dir, `lesson${number}`)
}

// Lessons that have audio, ascending. Lessons with no verbs (1, 3, 8, 12) have
// no directory; they are simply absent from this list.
export function listLessonNumbers({ dir = resDir } = {}) {
  if (!fs.existsSync(dir)) throw new Error(`audio source missing: ${dir}`)
  const numbers = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const match = LESSON_DIR.exec(entry.name)
    if (match) numbers.push(Number(match[1]))
  }
  return numbers.sort((a, b) => a - b)
}

// Reads one lesson's audio files as [{ name, bytes }], sorted by name so the
// archive bytes never depend on the filesystem's own ordering.
export function readLessonAudio(lesson, { dir = resDir } = {}) {
  const full = lessonDir(lesson, dir)
  if (!fs.existsSync(full)) throw new Error(`lesson has no audio directory: ${full}`)
  const names = fs
    .readdirSync(full)
    .filter((name) => name.endsWith(AUDIO_EXT))
    .sort()
  if (names.length === 0) throw new Error(`lesson has no ${AUDIO_EXT} files: ${full}`)
  return names.map((name) => ({ name, bytes: fs.readFileSync(path.join(full, name)) }))
}

// Returns the archive for one lesson: { lesson, name, bytes, files, rawBytes, sha256 }.
// Entry names inside the ZIP are the bare `<md5>.opus` names: the lesson is
// already identified by the archive it arrived in.
export function buildLessonArchive(lesson, options = {}) {
  const files = readLessonAudio(lesson, options)
  const bytes = createZip(files)
  return {
    lesson: Number(lesson),
    name: `lesson${Number(lesson)}.bin`,
    bytes,
    files: files.length,
    rawBytes: files.reduce((total, file) => total + file.bytes.length, 0),
    sha256: sha256Hex(bytes),
  }
}

// Writes every lesson archive into resources/res-miles/release. Returns one
// summary row per lesson. `lessons` limits the run (used by the CLI flag).
export function writeReleaseArchives({ dir = resDir, outDir = releaseDir, lessons } = {}) {
  const wanted = lessons ?? listLessonNumbers({ dir })
  fs.mkdirSync(outDir, { recursive: true })
  const rows = []
  for (const lesson of wanted) {
    const built = buildLessonArchive(lesson, { dir })
    fs.writeFileSync(path.join(outDir, built.name), built.bytes)
    rows.push({ ...built, bytes: built.bytes.length })
  }
  return rows
}

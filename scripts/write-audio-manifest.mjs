#!/usr/bin/env node
// Generates src/data/audio-manifest.json from the res-miles GitHub release.
//
// Each audio bin (lessonX.bin) is a ZIP of <md5-mid16>.opus entries; this
// manifest records each bin's own sha256, taken from the release's asset
// `digest` field. It is deliberately separate from dict-manifest.json, which
// hashes the vol/lesson_N.json sources — the two lessonX "bins" are different
// files and must not be confused.
//
//   node scripts/write-audio-manifest.mjs            # fetch release digests, write
//   node scripts/write-audio-manifest.mjs --check    # validate the committed file
//
// `--check` is offline: it verifies the manifest covers exactly the non-empty
// lessons (derived from vol/) with valid sha256 hex, without re-downloading
// the ~250 MB of bins. Regeneration reads the release asset digests instead of
// hashing the bytes, so it stays fast and does not depend on the API at
// runtime (the file is committed with the site).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const volDir = path.join(rootDir, 'vol')
export const audioManifestPath = path.join(rootDir, 'src', 'data', 'audio-manifest.json')

export const RELEASE_TAG = 'res-miles'
export const RELEASE_API = `https://api.github.com/repos/manesec-web/game-japanese-katsuyou-basic/releases/tags/${RELEASE_TAG}`
const LESSON_COUNT = 50

// Lessons 1, 3, 8 and 12 hold an empty `vols` array and therefore have no
// audio bin. The other 46 lessons each have one lessonX.bin.
export function nonEmptyLessons({ dir = volDir } = {}) {
  const lessons = []
  for (let lesson = 1; lesson <= LESSON_COUNT; lesson += 1) {
    const file = path.join(dir, `lesson_${lesson}.json`)
    if (!fs.existsSync(file)) throw new Error(`missing dictionary file: ${file}`)
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (data[`lesson_${lesson}`].vols.length > 0) lessons.push(lesson)
  }
  return lessons
}

export function audioBinFile(lesson) {
  return `lesson${lesson}.bin`
}

// Builds the manifest from the lesson numbers and a Map of release asset
// name -> digest string (GitHub's "sha256:<hex>" form).
export function buildManifest(lessons, digests) {
  const entries = lessons.map((lesson) => {
    const file = audioBinFile(lesson)
    const digest = digests.get(file)
    if (!digest) throw new Error(`release has no asset named ${file}`)
    if (!/^sha256:[0-9a-f]{64}$/.test(digest)) {
      throw new Error(`${file} has an unusable sha256 digest: ${digest}`)
    }
    return { lesson, file, sha256: digest.slice('sha256:'.length) }
  })
  return {
    algorithm: 'sha256',
    source: `github release ${RELEASE_TAG}`,
    total: entries.length,
    lessons: entries,
  }
}

// Validates a parsed manifest against the expected (non-empty) lesson numbers.
// Returns { ok, errors } so the CLI and the tests share one rule set.
export function validateManifest(manifest, expectedLessons) {
  const errors = []
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest is missing or not an object'] }
  }
  if (manifest.algorithm !== 'sha256') errors.push('manifest algorithm must be sha256')
  if (!Array.isArray(manifest.lessons)) {
    return { ok: false, errors: [...errors, 'manifest.lessons must be an array'] }
  }
  if (manifest.total !== manifest.lessons.length) {
    errors.push(`manifest.total ${manifest.total} does not match ${manifest.lessons.length} entries`)
  }
  const seen = new Set()
  for (const entry of manifest.lessons) {
    if (!expectedLessons.includes(entry.lesson)) {
      errors.push(`lesson ${entry.lesson} is not a non-empty lesson`)
    }
    if (seen.has(entry.lesson)) errors.push(`lesson ${entry.lesson} appears more than once`)
    seen.add(entry.lesson)
    if (entry.file !== audioBinFile(entry.lesson)) {
      errors.push(`lesson ${entry.lesson} file ${entry.file} should be ${audioBinFile(entry.lesson)}`)
    }
    if (typeof entry.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
      errors.push(`lesson ${entry.lesson} has no valid sha256`)
    }
  }
  for (const lesson of expectedLessons) {
    if (!seen.has(lesson)) errors.push(`lesson ${lesson} is missing from the manifest`)
  }
  return { ok: errors.length === 0, errors }
}

async function fetchAssetDigests() {
  const response = await fetch(RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'katsuyou-audio-manifest',
    },
  })
  if (!response.ok) throw new Error(`release API returned HTTP ${response.status}`)
  const release = await response.json()
  const digests = new Map()
  for (const asset of release.assets ?? []) {
    if (asset?.name && asset?.digest) digests.set(asset.name, asset.digest)
  }
  return digests
}

function readCommitted() {
  if (!fs.existsSync(audioManifestPath)) return null
  try {
    return JSON.parse(fs.readFileSync(audioManifestPath, 'utf8'))
  } catch (error) {
    return { parseError: error.message }
  }
}

function check() {
  const expected = nonEmptyLessons()
  const actual = readCommitted()
  if (!actual) {
    console.error(`manifest missing: ${path.relative(rootDir, audioManifestPath)}`)
    return 1
  }
  if (actual.parseError) {
    console.error(`manifest is not valid JSON: ${actual.parseError}`)
    return 1
  }
  const result = validateManifest(actual, expected)
  if (!result.ok) {
    for (const error of result.errors) console.error(error)
    console.error(`${result.errors.length} error(s) in the audio manifest`)
    return 1
  }
  console.log(`audio manifest ok: ${expected.length} bins`)
  return 0
}

async function write() {
  const lessons = nonEmptyLessons()
  const digests = await fetchAssetDigests()
  const manifest = buildManifest(lessons, digests)
  fs.mkdirSync(path.dirname(audioManifestPath), { recursive: true })
  fs.writeFileSync(audioManifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(
    `wrote ${path.relative(rootDir, audioManifestPath)} (${manifest.lessons.length} bins)`,
  )
  return 0
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    const wantsCheck = process.argv.includes('--check')
    if (wantsCheck) {
      process.exitCode = check()
    } else {
      process.exitCode = await write()
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

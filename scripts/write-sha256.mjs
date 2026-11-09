#!/usr/bin/env node
// Hashes the raw bytes of vol/lesson_1.json .. vol/lesson_50.json and writes
// src/data/dict-manifest.json. With --check it verifies the manifest instead
// of writing, and exits non-zero on any mismatch.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const volDir = path.join(rootDir, 'vol')
const manifestPath = path.join(rootDir, 'src', 'data', 'dict-manifest.json')
const LESSON_COUNT = 50

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function buildManifest() {
  const lessons = []
  for (let lesson = 1; lesson <= LESSON_COUNT; lesson += 1) {
    const file = `lesson_${lesson}.json`
    const fullPath = path.join(volDir, file)
    if (!fs.existsSync(fullPath)) {
      throw new Error(`missing dictionary file: ${fullPath}`)
    }
    const bytes = fs.readFileSync(fullPath)
    lessons.push({ lesson, file, sha256: sha256Hex(bytes) })
  }
  return { algorithm: 'sha256', total: lessons.length, lessons }
}

function readManifest() {
  if (!fs.existsSync(manifestPath)) return null
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (error) {
    return { parseError: error.message }
  }
}

function check() {
  const expected = buildManifest()
  const actual = readManifest()
  if (!actual) {
    console.error(`manifest missing: ${path.relative(rootDir, manifestPath)}`)
    return 1
  }
  if (actual.parseError) {
    console.error(`manifest is not valid JSON: ${actual.parseError}`)
    return 1
  }
  if (actual.algorithm !== expected.algorithm || !Array.isArray(actual.lessons)) {
    console.error('manifest shape is not recognized')
    return 1
  }
  if (actual.lessons.length !== expected.lessons.length) {
    console.error(
      `manifest has ${actual.lessons.length} lessons, expected ${expected.lessons.length}`,
    )
    return 1
  }
  let failures = 0
  for (const want of expected.lessons) {
    const got = actual.lessons.find((entry) => entry.lesson === want.lesson)
    if (!got) {
      console.error(`lesson ${want.lesson}: entry missing from manifest`)
      failures += 1
      continue
    }
    if (got.file !== want.file || got.sha256 !== want.sha256) {
      console.error(
        `lesson ${want.lesson}: manifest hash ${got.sha256} does not match file hash ${want.sha256}`,
      )
      failures += 1
    }
  }
  if (failures > 0) {
    console.error(`${failures} lesson(s) failed the manifest check`)
    return 1
  }
  console.log(`manifest ok: ${expected.lessons.length} lessons`)
  return 0
}

function write() {
  const manifest = buildManifest()
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`wrote ${path.relative(rootDir, manifestPath)} (${manifest.lessons.length} lessons)`)
  return 0
}

try {
  const wantsCheck = process.argv.includes('--check')
  process.exitCode = wantsCheck ? check() : write()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

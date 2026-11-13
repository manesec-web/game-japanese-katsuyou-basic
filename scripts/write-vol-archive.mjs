#!/usr/bin/env node
// Verifies vol/ against the SHA-256 manifest and builds the shipped archive.
//
//   node scripts/write-vol-archive.mjs            # check + write output/dict/vol.bin
//   node scripts/write-vol-archive.mjs --check    # check only, write nothing
//   node scripts/write-vol-archive.mjs --out <p>  # write to another path
//
// The Vite plugin does the same work during `npm run build`; this command is for
// manual checks and CI.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildVolArchive, ARCHIVE_NAME } from './vol-archive.mjs'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultOut = path.join(rootDir, 'output', 'dict', ARCHIVE_NAME)

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

try {
  const checkOnly = process.argv.includes('--check')
  const outIndex = process.argv.indexOf('--out')
  const out = outIndex > -1 && process.argv[outIndex + 1] ? path.resolve(process.argv[outIndex + 1]) : defaultOut

  const archive = buildVolArchive()
  const ratio = archive.bytes.length / archive.rawBytes
  console.log(
    `checked ${archive.lessons} lessons: ${formatBytes(archive.rawBytes)} -> ${formatBytes(archive.bytes.length)} (${(ratio * 100).toFixed(1)}%)`,
  )
  console.log(`archive sha256: ${archive.sha256}`)
  if (checkOnly) {
    console.log('check only: nothing written')
  } else {
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, archive.bytes)
    console.log(`wrote ${path.relative(rootDir, out)}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

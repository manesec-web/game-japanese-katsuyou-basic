// CLI for scripts/res-archive.mjs. Packs one `lessonN.bin` per lesson into
// resources/res-miles/release, ready to attach to a GitHub release tag.
//
//   node scripts/write-res-archive.mjs            # all lessons
//   node scripts/write-res-archive.mjs --lesson 19
import { listLessonNumbers, writeReleaseArchives, releaseDir } from './res-archive.mjs'

function parseArgs(argv) {
  const options = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--lesson') {
      const value = Number(argv[i + 1])
      if (!Number.isInteger(value) || value <= 0) throw new Error('--lesson needs a positive integer')
      options.lessons = [value]
      i += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }
  return options
}

const rows = writeReleaseArchives(parseArgs(process.argv.slice(2)))

let raw = 0
let packed = 0
for (const row of rows) {
  raw += row.rawBytes
  packed += row.bytes
  console.log(
    `${row.name.padEnd(13)} ${String(row.files).padStart(5)} files  ` +
      `${(row.rawBytes / 1024).toFixed(0).padStart(7)} KB -> ${(row.bytes / 1024).toFixed(0).padStart(7)} KB  ` +
      `${((row.bytes / row.rawBytes) * 100).toFixed(1)}%  ${row.sha256.slice(0, 16)}`,
  )
}
console.log(
  `${rows.length} archives in ${releaseDir}: ` +
    `${(raw / 1024 / 1024).toFixed(1)} MB -> ${(packed / 1024 / 1024).toFixed(1)} MB`,
)

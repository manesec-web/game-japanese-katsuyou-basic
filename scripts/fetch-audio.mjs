#!/usr/bin/env node
// Downloads the per-lesson audio bins from the res-miles release into
// dict/resource/ (gitignored) and regenerates src/data/audio-manifest.json.
//
// The release is the source of truth: its asset `digest` is each bin's sha256,
// and a bin already present with the matching hash is left alone, so a rebuild
// only downloads what the release actually changed. This runs inside
// `npm run build` (via prebuild) and therefore inside the GitHub Actions
// deploy, which is what makes the audio same-origin: the bins land in
// output/dict/resource/ and the browser never crosses an origin to fetch them.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import {
  audioManifestPath,
  audioBinFile,
  buildManifest,
  nonEmptyLessons,
  RELEASE_API,
} from './write-audio-manifest.mjs'

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
export const resourceDir = path.join(rootDir, 'dict', 'resource')

function nodeSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

async function defaultFetchBinary(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'katsuyou-audio-fetch' } })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return new Uint8Array(await response.arrayBuffer())
}

// Fetches the release metadata: file name -> { digest: "sha256:<hex>", url }.
export async function fetchReleaseAssets() {
  const response = await fetch(RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'katsuyou-audio-fetch',
    },
  })
  if (!response.ok) throw new Error(`release API returned HTTP ${response.status}`)
  const release = await response.json()
  const assets = new Map()
  for (const asset of release.assets ?? []) {
    if (asset?.name && asset?.digest && asset?.browser_download_url) {
      assets.set(asset.name, { digest: asset.digest, url: asset.browser_download_url })
    }
  }
  return assets
}

// Syncs the local dict/resource cache with the release and writes the
// manifest. Pure given its injected dependencies; `assets` is a Map of file
// name -> { digest, url }.
export async function syncAudioResources({
  lessons,
  assets,
  dir = resourceDir,
  manifestFile = audioManifestPath,
  fetchBinary = defaultFetchBinary,
  sha256 = nodeSha256,
  log = () => {},
}) {
  fs.mkdirSync(dir, { recursive: true })
  const digests = new Map()
  let downloaded = 0
  let upToDate = 0

  for (const lesson of lessons) {
    const file = audioBinFile(lesson)
    const asset = assets.get(file)
    if (!asset) throw new Error(`release has no asset named ${file}`)
    const expected = asset.digest.slice('sha256:'.length)
    digests.set(file, asset.digest)

    const target = path.join(dir, file)
    if (fs.existsSync(target) && sha256(fs.readFileSync(target)) === expected) {
      upToDate += 1
      continue
    }

    const bytes = await fetchBinary(asset.url)
    if (sha256(bytes) !== expected) throw new Error(`${file} download hash mismatch`)
    fs.writeFileSync(target, bytes)
    downloaded += 1
    log(`downloaded ${file}`)
  }

  const manifest = buildManifest(lessons, digests)
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
  return { upToDate, downloaded, manifest }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  try {
    const lessons = nonEmptyLessons()
    const assets = await fetchReleaseAssets()
    const result = await syncAudioResources({ lessons, assets, log: (message) => console.log(message) })
    console.log(
      `audio: ${result.upToDate} up to date, ${result.downloaded} downloaded -> ${path.relative(rootDir, resourceDir)}`,
    )
    console.log(`wrote ${path.relative(rootDir, audioManifestPath)} (${result.manifest.lessons.length} bins)`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import {
  ARCHIVE_NAME,
  archiveSourceKey,
  buildVolArchive,
  manifestPath,
} from './scripts/vol-archive.mjs'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

// GitHub Pages serves the repo as a project site, so the site lives under this
// path instead of the server root. The trailing slash matters: Vite needs it to
// resolve asset URLs under the subpath.
const BASE = '/game-japanese-katsuyou-basic/'

// One archive holds all 50 lessons, deflate-compressed.
const DICT_URL = new RegExp(`^/dict/(${ARCHIVE_NAME.replace('.', '\\.')})$`)

// Vite strips the base before plugin middleware in some paths and keeps it in
// others, so accept the dictionary URL with or without the subpath in front.
function dictPathname(url) {
  const pathname = (url || '').split('?')[0]
  if (pathname.startsWith(BASE)) return pathname.slice(BASE.length - 1)
  return pathname
}

// Serves dict/vol.bin in dev and writes it into output/dict/ on build. The
// archive is built from vol/ and verified against the SHA-256 manifest, so a
// stale manifest fails the build instead of shipping a broken dictionary.
// It is a ZIP named .bin and served as application/octet-stream so that
// download-helper browser extensions neither sniff nor hijack it.
function dictionaryPlugin() {
  let cache = null

  function archive() {
    const key = archiveSourceKey()
    if (cache && cache.key === key) return cache.value
    const value = buildVolArchive({ manifestPath })
    cache = { key, value }
    return value
  }

  return {
    name: 'katsuyou-dictionary',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = DICT_URL.exec(dictPathname(req.url))
        if (!match) return next()
        let built
        try {
          built = archive()
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          return res.end(error instanceof Error ? error.message : String(error))
        }
        res.setHeader('Content-Type', 'application/octet-stream')
        res.setHeader('Content-Length', String(built.bytes.length))
        res.setHeader('Cache-Control', 'no-cache')
        res.end(built.bytes)
      })
    },
    writeBundle(options) {
      const outDir = options.dir
      const built = buildVolArchive({ manifestPath })
      const target = path.join(outDir, 'dict')
      fs.mkdirSync(target, { recursive: true })
      fs.writeFileSync(path.join(target, ARCHIVE_NAME), built.bytes)
      const ratio = (built.bytes.length / built.rawBytes) * 100
      console.log(
        `dict/${ARCHIVE_NAME}: ${built.lessons} lessons, ${(built.rawBytes / 1024).toFixed(0)} KB raw -> ${(built.bytes.length / 1024).toFixed(0)} KB zip (${ratio.toFixed(1)}%)`,
      )
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [vue(), dictionaryPlugin()],
  build: {
    outDir: 'output',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'scripts/**/*.test.js'],
  },
})

import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const volDir = path.join(rootDir, 'vol')
const LESSON_FILES = Array.from({ length: 50 }, (_, i) => `lesson_${i + 1}.json`)

// GitHub Pages serves the repo as a project site, so the site lives under this
// path instead of the server root. The trailing slash matters: Vite needs it to
// resolve asset URLs under the subpath.
const BASE = '/game-japanese-katsuyou-basic/'

const DICT_URL = /^\/dict\/(lesson_\d+\.json)$/

// Vite strips the base before plugin middleware in some paths and keeps it in
// others, so accept the dictionary URL with or without the subpath in front.
function dictPathname(url) {
  const pathname = (url || '').split('?')[0]
  if (pathname.startsWith(BASE)) return pathname.slice(BASE.length - 1)
  return pathname
}

// Serve vol/*.json at /dict/lesson_N.json in dev, and copy them into
// output/dict/ on build. The dictionary stays in vol/ as the source of truth.
function dictionaryPlugin() {
  return {
    name: 'katsuyou-dictionary',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = DICT_URL.exec(dictPathname(req.url))
        if (!match) return next()
        const file = path.join(volDir, match[1])
        if (!fs.existsSync(file)) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          return res.end('not found')
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        fs.createReadStream(file).pipe(res)
      })
    },
    writeBundle(options) {
      const outDir = options.dir
      const target = path.join(outDir, 'dict')
      fs.mkdirSync(target, { recursive: true })
      for (const name of LESSON_FILES) {
        const source = path.join(volDir, name)
        if (!fs.existsSync(source)) {
          throw new Error(`dictionary source missing: ${source}`)
        }
        fs.copyFileSync(source, path.join(target, name))
      }
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

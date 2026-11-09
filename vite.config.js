import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const volDir = path.join(rootDir, 'vol')
const LESSON_FILES = Array.from({ length: 50 }, (_, i) => `lesson_${i + 1}.json`)
const DICT_URL = /^\/dict\/(lesson_\d+\.json)$/

// Serve vol/*.json at /dict/lesson_N.json in dev, and copy them into
// output/dict/ on build. The dictionary stays in vol/ as the source of truth.
function dictionaryPlugin() {
  return {
    name: 'katsuyou-dictionary',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        const match = DICT_URL.exec(pathname)
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
  base: './',
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

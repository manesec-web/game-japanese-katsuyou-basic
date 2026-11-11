// Strike probe: where the double strikethrough of an `error_usage` word is
// actually painted, and that the reading above it is left unstruck.
//
// Computed styles say which boxes carry a decoration; they cannot say where the
// line lands. This probe overrides the decoration colour to blue — the geometry
// is untouched, only the colour of the line differs — takes a screenshot of the
// word, decodes the PNG and finds the rows that hold the line. The glyphs stay
// red, so a blue row is a line and never a glyph.
//
// Usage: node scripts/strike-probe.mjs [--screenshots]
// Env: PORT (default 5202), CHROMIUM_PATH, SHOT_DIR
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { chromium } from 'playwright-core'

const PORT = Number(process.env.PORT || 5202)
const SITE_BASE = '/game-japanese-katsuyou-basic/'
const BASE = `http://localhost:${PORT}${SITE_BASE}`
const EXE =
  process.env.CHROMIUM_PATH ||
  '/home/mane/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'
const SHOT_DIR = process.env.SHOT_DIR || path.join('/tmp', 'katsuyou-shots')
const WANT_SHOTS = process.argv.includes('--screenshots')

// The decoration of the word under test is drawn in this colour instead of the
// word's own colour, so the line can be told apart from the red glyphs.
const PROBE_STRIKE = 'rgb(0, 0, 255)'
const ERROR_RED = 'rgb(220, 38, 38)'

const failures = []
const notes = []

function check(name, ok, detail = '') {
  if (ok) notes.push(`ok   ${name}`)
  else failures.push(`FAIL ${name} ${detail}`)
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForServer(timeout = 30000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      if ((await fetch(BASE)).ok) return
    } catch {
      /* not up yet */
    }
    await wait(300)
  }
  throw new Error(`preview server did not start on ${BASE}`)
}

// Minimal PNG reader: 8-bit RGB/RGBA, non-interlaced — what a Playwright
// screenshot is. Returns width, height, channel count and the raw pixels.
function decodePng(buffer) {
  let offset = 8
  let width = 0
  let height = 0
  let colorType = 6
  const idat = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      if (data.readUInt8(8) !== 8) throw new Error('expected an 8-bit PNG')
      colorType = data.readUInt8(9)
      if (data.readUInt8(12) !== 0) throw new Error('expected a non-interlaced PNG')
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }
  const channels = colorType === 6 ? 4 : 3
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const pixels = Buffer.alloc(width * height * channels)
  let prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride))
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? line[x - channels] : 0
      const b = prev[x]
      const c = x >= channels ? prev[x - channels] : 0
      if (filter === 1) line[x] = (line[x] + a) & 0xff
      else if (filter === 2) line[x] = (line[x] + b) & 0xff
      else if (filter === 3) line[x] = (line[x] + ((a + b) >> 1)) & 0xff
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
      }
    }
    line.copy(pixels, y * stride)
    prev = line
  }
  return { width, height, channels, pixels }
}

// Rows that hold the probe-coloured line, as bands of consecutive rows with at
// least `minCount` line pixels.
function strikeBands(png, minCount) {
  const { width, height, channels, pixels } = png
  const bands = []
  let open = null
  for (let y = 0; y < height; y += 1) {
    let count = 0
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels
      if (pixels[i + 2] > 180 && pixels[i] < 90 && pixels[i + 1] < 90) count += 1
    }
    if (count >= minCount) {
      if (open) {
        open.to = y
        open.max = Math.max(open.max, count)
      } else open = { from: y, to: y, max: count }
    } else if (open) {
      bands.push(open)
      open = null
    }
  }
  if (open) bands.push(open)
  return bands
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
  cwd: path.resolve('.'),
  stdio: 'ignore',
})
let browser = null
try {
  await waitForServer()
  browser = await chromium.launch({ executablePath: EXE, headless: true })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  })

  // 第2課's first verb (違う) carries error_usage forms written with kanji, so
  // the word has a reading above the base text. Readings are on by default in
  // the dictionary.
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 60000 })
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.chip', { hasText: '第2課' }).click()
  await page.locator('.picker-start').click()
  await page.waitForSelector('.reader-body', { timeout: 20000 })
  await page.waitForSelector('.reader-page--current .word--error', { timeout: 5000 })

  const styles = await page.evaluate(() => {
    const word = document.querySelector('.reader-page--current .form-block[data-form="passive-form"] .word--error')
    const rubyWord = word.querySelector('.ruby-word')
    const rb = rubyWord.querySelector('rb')
    const reading = rubyWord.querySelector('rt')
    const kana = rubyWord.querySelector(':scope > span')
    const read = (el) => {
      const style = getComputedStyle(el)
      return {
        line: style.textDecorationLine,
        style: style.textDecorationStyle,
        color: style.color,
        lineColor: style.textDecorationColor,
      }
    }
    return {
      text: word.textContent.replace(/\s+/g, ''),
      word: read(word),
      container: read(rubyWord),
      base: read(rb),
      kana: kana ? read(kana) : null,
      reading: read(reading),
      hasReading: Boolean(reading),
    }
  })

  check('an error word with a reading is on screen', styles.hasReading, JSON.stringify(styles))
  check(
    'the base text is struck through twice',
    styles.base.line === 'line-through' && styles.base.style === 'double',
    JSON.stringify(styles.base),
  )
  check(
    'every kana box of the word is struck through twice',
    styles.kana === null || (styles.kana.line === 'line-through' && styles.kana.style === 'double'),
    JSON.stringify(styles.kana),
  )
  check(
    'the decoration is drawn in the word colour',
    styles.base.lineColor === styles.base.color && styles.base.color === 'rgb(220, 38, 38)',
    JSON.stringify(styles.base),
  )
  check(
    'the reading keeps its colour and is not struck',
    styles.reading.line === 'none' && styles.reading.color === 'rgb(220, 38, 38)',
    JSON.stringify(styles.reading),
  )

  // Same DOM, same CSS, one override: the decoration colour only.
  await page.evaluate((probe) => {
    const style = document.createElement('style')
    style.id = 'probe-strike'
    style.textContent = `
      .reader-page--current .word--error .ruby-word rb,
      .reader-page--current .word--error .ruby-word > span {
        text-decoration-color: ${probe} !important;
      }
    `
    document.head.appendChild(style)
  }, PROBE_STRIKE)

  // Measure the word itself, not the full-width block that holds it: the strike
  // spans the word's own width.
  const target = page
    .locator('.reader-page--current .form-block[data-form="passive-form"] .word--error .ruby-word')
    .first()
  // The stubbed style must be on the elements that carry the line, otherwise the
  // measurement would read a line this probe did not make.
  const probeApplied = await target.evaluate((el) => getComputedStyle(el.querySelector('rb')).textDecorationColor)
  check('the probe colour reaches the struck boxes', probeApplied === PROBE_STRIKE, probeApplied)

  const box = await target.boundingBox()
  if (WANT_SHOTS) {
    fs.mkdirSync(SHOT_DIR, { recursive: true })
    await target.screenshot({ path: path.join(SHOT_DIR, 'strike-probe.png') })
  }
  const png = decodePng(await target.screenshot())
  const bands = strikeBands(png, Math.max(8, Math.round(png.width * 0.12)))
  const spans = await target.evaluate((el) => {
    const base = el.getBoundingClientRect()
    const rbBox = el.querySelector('rb').getBoundingClientRect()
    const rtBox = el.querySelector('rt').getBoundingClientRect()
    return {
      base: [Math.round(rbBox.top - base.top), Math.round(rbBox.bottom - base.top)],
      reading: [Math.round(rtBox.top - base.top), Math.round(rtBox.bottom - base.top)],
    }
  })

  check('the drawn strike is two lines', bands.length === 2, JSON.stringify(bands))
  check(
    'both lines sit inside the base text, not in the reading',
    bands.every((band) => band.from >= spans.base[0] - 2 && band.to <= spans.base[1] + 2) &&
      !bands.some((band) => band.from >= spans.reading[0] - 2 && band.to <= spans.reading[1] + 2),
    JSON.stringify({ bands, spans, box }),
  )
  check(
    'the two lines span the whole word width',
    bands.every((band) => band.max >= Math.round(png.width * 0.6)),
    JSON.stringify({ bands, width: png.width }),
  )

  if (WANT_SHOTS) {
    await page.screenshot({ path: path.join(SHOT_DIR, 'strike-probe-page.png') })
    notes.push(`screenshots in ${SHOT_DIR}`)
  }
} finally {
  if (browser) await browser.close()
  server.kill()
}

for (const line of notes) console.log(line)
for (const line of failures) console.log(line)
if (failures.length > 0) {
  process.exitCode = 1
} else {
  console.log(`strike probe passed (${notes.length} checks)`)
}

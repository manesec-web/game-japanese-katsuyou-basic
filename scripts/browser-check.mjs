// Browser walk-through against the built site (vite preview).
// Usage: node scripts/browser-check.mjs [--screenshots]
// Env: PORT (default 5199), CHROMIUM_PATH, SHOT_DIR
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { CONFETTI_EMOJI, PRACTICE_EMOJI, SCORE_BANDS } from '../src/study/results.js'
import { groupLabel } from '../src/dict/forms.js'

const PORT = Number(process.env.PORT || 5199)

// GitHub Pages serves this repository as a project site, so the site and its
// assets live under this subpath. `vite preview` honours the same base, so the
// walk-through must start there and not at the server root.
const SITE_BASE = '/game-japanese-katsuyou-basic/'
const BASE = `http://localhost:${PORT}${SITE_BASE}`
const EXE =
  process.env.CHROMIUM_PATH ||
  '/home/mane/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'
const SHOT_DIR = process.env.SHOT_DIR || path.join('/tmp', 'katsuyou-shots')
const WANT_SHOTS = process.argv.includes('--screenshots')

// The card and quiz lists are shuffled, so checks look the displayed word up
// in the lesson data instead of assuming a fixed item order.
const lessonFive = JSON.parse(fs.readFileSync(path.resolve('vol/lesson_5.json'), 'utf8'))
const lessonFiveVerbs = Object.values(lessonFive)[0].vols.map((verb) => ({
  masu: verb['masu-form'].vol,
  dict: verb['dictionary-form'].vol,
  reading: verb['dictionary-form'].japanese,
  gloss: verb['dictionary-form'].chinese,
  group: verb['dictionary-form'].group,
}))
const byMasu = (word) => lessonFiveVerbs.find((verb) => verb.masu === word)

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
      const response = await fetch(BASE)
      if (response.ok) return
    } catch {
      /* not up yet */
    }
    await wait(300)
  }
  throw new Error(`preview server did not start on ${BASE}`)
}


async function drag(page, dx, dy = 0, selector = '.reader-body') {
  const box = await page.locator(selector).boundingBox()
  const viewport = page.viewportSize()
  const cx = box.x + box.width / 2
  const cy = Math.max(90, Math.min(box.y + Math.min(box.height / 2, 240), viewport.height - 120))
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx / 2, cy + dy / 2, { steps: 5 })
  await page.mouse.move(cx + dx, cy + dy, { steps: 5 })
  await page.mouse.up()
  await wait(300)
}

// Press, drag, sample the card's transform while the finger is still down,
// then release and sample again once the release has settled. Used for the
// first-card wall, where the card must follow a little and then spring back.
async function dragHeld(page, dx, selector = '.card-stage') {
  const box = await page.locator(selector).boundingBox()
  const viewport = page.viewportSize()
  const cx = box.x + box.width / 2
  const cy = Math.max(90, Math.min(box.y + Math.min(box.height / 2, 240), viewport.height - 120))
  const transformOf = () =>
    page.locator('.card').evaluate((el) => getComputedStyle(el).transform)
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx / 2, cy, { steps: 5 })
  await page.mouse.move(cx + dx, cy, { steps: 5 })
  await wait(40)
  const held = await transformOf()
  await page.mouse.up()
  await wait(300)
  const rested = await transformOf()
  return { held, rested }
}

// matrix(a, b, c, d, e, f) or matrix3d(...); translateX is e / m41.
function translateXOf(transform) {
  if (!transform || transform === 'none') return 0
  const values = transform.match(/^matrix(3d)?\((.+)\)$/)
  if (!values) return 0
  const parts = values[2].split(',').map((value) => parseFloat(value))
  return parts.length === 16 ? parts[12] : parts[4]
}

// Swipe, then sample the page-turn state ~60ms after the finger lifts, while
// the outgoing page is still sliding. Returns the phase classes and transform.
async function dragSampled(page, dx, selector = '.reader-body') {
  const box = await page.locator(selector).boundingBox()
  const viewport = page.viewportSize()
  const cx = box.x + box.width / 2
  const cy = Math.max(90, Math.min(box.y + Math.min(box.height / 2, 240), viewport.height - 120))
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx / 2, cy, { steps: 5 })
  await page.mouse.move(cx + dx, cy, { steps: 5 })
  await page.mouse.up()
  await wait(60)
  const sample = await page.locator('.reader-page').evaluate((el) => ({
    classes: el.getAttribute('class') || '',
    transform: getComputedStyle(el).transform,
  }))
  await wait(400)
  return sample
}

async function wordText(page, selector = '.form-block--default .word') {
  return page.locator(selector).evaluate((el) => {
    const clone = el.cloneNode(true)
    clone.querySelectorAll('rt').forEach((rt) => rt.remove())
    return clone.textContent.trim()
  })
}

async function ensureLesson(page, label) {
  const chip = page.locator('.chip', { hasText: label })
  const classes = (await chip.getAttribute('class')) || ''
  if (!classes.includes('chip--on')) await chip.click()
}

async function cardFlipped(page) {
  const classes = (await page.locator('.card').getAttribute('class')) || ''
  return classes.includes('card--flipped')
}

// The scrollable overflow region must not be wider than the viewport: that is
// what puts a horizontal scrollbar under the page.
async function horizontalOverflow(page) {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }))
}

async function cardInnerTransform(page) {
  return page.locator('.card-inner').evaluate((el) => getComputedStyle(el).transform)
}

// The paging motion must stay flat: a horizontal translation only, no rotation,
// no scale and no fade. `inner` reports which side of the card is showing.
async function cardMotion(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.card')
    const inner = document.querySelector('.card-inner')
    if (!card || !inner) return null
    const cardStyle = getComputedStyle(card)
    const classes = card.getAttribute('class') || ''
    return {
      classes,
      flipped: classes.includes('card--flipped'),
      transform: cardStyle.transform,
      opacity: cardStyle.opacity,
      inner: getComputedStyle(inner).transform,
      title: (document.querySelector('.bar-title')?.textContent || '').trim(),
    }
  })
}

// matrix(1, 0, 0, 1, tx, 0) or none: the element is unturned and only shifted.
function isFlatTranslate(transform) {
  if (!transform || transform === 'none') return true
  if (!transform.startsWith('matrix(')) return false
  const [a, b, c, d, , ty] = transform.slice(7, -1).split(',').map(Number)
  return (
    Math.abs(a - 1) < 0.01 &&
    Math.abs(b) < 0.01 &&
    Math.abs(c) < 0.01 &&
    Math.abs(d - 1) < 0.01 &&
    Math.abs(ty) < 0.01
  )
}

// The card's own 3D turn is at rest when it carries no rotation at all.
function isTurnedOff(transform) {
  return !transform || transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)'
}

async function readerTitle(page) {
  return (await page.locator('.bar-title').textContent()).trim()
}

// The 從 label has to sit on the form control's centre line: its glyph, not
// just the padded box, is what the eye lines up against the control.
async function labelAlignment(page) {
  return page.evaluate(() => {
    const label = document.querySelector('.field .field-label')
    const select = document.querySelector('.form-select')
    if (!label || !select) return null
    const labelRect = label.getBoundingClientRect()
    const selectRect = select.getBoundingClientRect()
    return {
      labelCenter: Math.round((labelRect.top + labelRect.height / 2) * 10) / 10,
      selectCenter: Math.round((selectRect.top + selectRect.height / 2) * 10) / 10,
      delta: Math.round((labelRect.top + labelRect.height / 2 - (selectRect.top + selectRect.height / 2)) * 10) / 10,
      labelHeight: Math.round(labelRect.height * 10) / 10,
      labelPaddingTop: getComputedStyle(label).paddingTop,
      alignItems: getComputedStyle(label.parentElement).alignItems,
      insideControl:
        labelRect.top >= selectRect.top - 0.5 && labelRect.bottom <= selectRect.bottom + 0.5,
    }
  })
}

function checkLabelAlignment(mode, align) {
  check(
    `${mode}: the 從 label is centred on the form control`,
    align !== null && Math.abs(align.delta) <= 1,
    align ? `${align.delta}px (${align.labelCenter} vs ${align.selectCenter})` : 'no label',
  )
  check(
    `${mode}: the 從 glyph sits inside the control's height`,
    align !== null && align.insideControl,
    align ? `label ${align.labelHeight}px` : 'no label',
  )
  check(
    `${mode}: the row centres the label instead of padding it`,
    align !== null && align.alignItems === 'center' && align.labelPaddingTop === '0px',
    align ? `${align.alignItems} / padding-top ${align.labelPaddingTop}` : 'no label',
  )
}

// --- Motion traces ---------------------------------------------------------
// One CSS value per animation frame, sampled from inside the page, so the
// paging motion can be judged as a curve rather than a single snapshot.
async function startTrace(page, selector, kind = 'x') {
  await page.evaluate(
    ([sel, mode]) => {
      const el = document.querySelector(sel)
      const read = () => {
        const m = getComputedStyle(el).transform
        if (!m || m === 'none') return 0
        const p = m.slice(m.startsWith('matrix3d') ? 9 : 7, -1).split(',').map(Number)
        if (mode === 'angle') {
          if (!m.startsWith('matrix3d')) return p[0] < 0 ? 180 : 0
          return Math.abs(Math.atan2(-p[2], p[0]) * 180 / Math.PI)
        }
        return m.startsWith('matrix3d') ? p[12] : p[4]
      }
      window.__trace = []
      const t0 = performance.now()
      const loop = () => {
        window.__trace.push([performance.now() - t0, read()])
        if (performance.now() - t0 < 700) requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    },
    [selector, kind],
  )
}

// Drags, starts sampling while the finger is still down, releases, and waits
// long enough for both halves of the turn to finish.
async function swipeTrace(page, dx, gestureSelector, movedSelector) {
  const box = await page.locator(gestureSelector).boundingBox()
  const viewport = page.viewportSize()
  const cx = box.x + box.width / 2
  const cy = Math.max(90, Math.min(box.y + Math.min(box.height / 2, 240), viewport.height - 120))
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx / 2, cy, { steps: 5 })
  await page.mouse.move(cx + dx, cy, { steps: 5 })
  await startTrace(page, movedSelector)
  await page.mouse.up()
  await wait(700)
  return page.evaluate(() => window.__trace)
}

// What the traces above are checked for. `travel` is the direction the item
// moves on screen: a next swipe goes left.
function traceVerdict(trace, direction) {
  const travel = direction === 'next' ? -1 : 1
  const width = Math.max(...trace.map(([, value]) => Math.abs(value)))
  const visible = (value) => Math.abs(value) < width - 1
  const speedAt = (i) => {
    const [t0, a] = trace[i - 1]
    const [t1, b] = trace[i]
    return Math.abs(b - a) / Math.max(0.001, (t1 - t0) / 1000)
  }
  let backwards = 0
  let seamAt = -1
  let seamClean = null
  for (let i = 1; i < trace.length; i += 1) {
    const [, a] = trace[i - 1]
    const [, b] = trace[i]
    if (visible(a) && visible(b) && (b - a) * travel < -1.5) backwards += 1
    if (Math.abs(b - a) > width * 0.5 && Math.sign(a) !== Math.sign(b)) {
      seamAt = i
      // At a 60fps sample the last frame before the swap can be up to one frame
      // short of the edge, so "off screen" is judged as a share of the width.
      seamClean = Math.abs(a) >= width * 0.9 && Math.abs(b) >= width * 0.9
    }
  }
  // Overshoot is a frame that arrives at rest and then moves again: whatever
  // travels past the resting point has to stay there.
  const restAt = trace.findIndex(([, value]) => Math.abs(value) <= 1.5)
  const overshoot =
    restAt > 0 ? trace.slice(restAt + 1).filter(([, value]) => Math.abs(value) > 1.5).length : 0
  let beforeAt = -1
  let afterAt = -1
  for (let i = 1; i < (seamAt < 0 ? trace.length : seamAt); i += 1) {
    if (visible(trace[i - 1][1]) && visible(trace[i][1])) beforeAt = i
  }
  if (seamAt > 0) {
    for (let i = seamAt + 1; i < trace.length; i += 1) {
      if (afterAt < 0 && visible(trace[i - 1][1]) && visible(trace[i][1])) afterAt = i
    }
  }
  const exitSpeed = beforeAt > 0 ? speedAt(beforeAt) : 0
  const entrySpeed = afterAt > 0 ? speedAt(afterAt) : 0
  const ratio =
    exitSpeed > 0 && entrySpeed > 0
      ? Math.max(exitSpeed, entrySpeed) / Math.min(exitSpeed, entrySpeed)
      : Infinity
  const settle = trace.find(([, value]) => Math.abs(value) <= 0.5)
  return {
    width,
    backwards,
    overshoot,
    seamAt,
    seamClean,
    exitSpeed: Math.round(exitSpeed),
    entrySpeed: Math.round(entrySpeed),
    ratio: Math.round(ratio * 100) / 100,
    settleMs: settle ? Math.round(settle[0]) : null,
    end: Math.round(trace.at(-1)[1]),
    frames: trace.length,
  }
}

// The checks every turn has to pass: nothing moves back against the hand while
// it is on screen, nothing overshoots its resting point, the swap happens
// entirely off screen, and the pace does not change across the swap.
function checkTurn(label, verdict, settleLimit) {
  check(`${label}: nothing slides back while it is on screen`, verdict.backwards === 0, JSON.stringify(verdict))
  check(`${label}: the turn does not overshoot`, verdict.overshoot === 0, JSON.stringify(verdict))
  check(`${label}: the swap happens fully off screen`, verdict.seamClean === true, JSON.stringify(verdict))
  check(
    `${label}: the pace holds across the swap`,
    verdict.ratio <= 1.6,
    `exit ${verdict.exitSpeed} px/s, entry ${verdict.entrySpeed} px/s (${verdict.ratio}x)`,
  )
}

// A release below the threshold never swaps anything: it has to come back to
// rest quickly and without passing the resting point.
function checkSettle(label, verdict, settleLimit) {
  check(`${label}: the release does not overshoot rest`, verdict.overshoot === 0, JSON.stringify(verdict))
  check(
    `${label}: a short drag settles back within ${settleLimit}ms`,
    verdict.settleMs !== null && verdict.settleMs <= settleLimit && verdict.end === 0,
    `${verdict.settleMs}ms, end ${verdict.end}px`,
  )
}

// --- Zoom lock -------------------------------------------------------------
// The phone page must not scale, by double tap or by pinch. Pinch zoom is
// reproducible in headless Chromium through raw CDP touch events (it takes
// `visualViewport.scale` from 1 to 5 on a page that allows scaling), so the
// lock is verifiable. Chrome's double tap zoom is an Android-only gesture that
// headless Chromium never performs, so the two declarative causes (the viewport
// meta and `touch-action`) are asserted directly as well.
const UNRESTRICTED_PAGE =
  'data:text/html,' +
  encodeURIComponent(
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<p style="font-size:40px">hello hello hello hello</p>',
  )

const touchPoint = (x, y, id) => ({ x, y, id, radiusX: 12, radiusY: 12, force: 1 })

async function pinchAt(cdp, cx, cy) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(cx - 45, cy, 0), touchPoint(cx + 45, cy, 1)],
  })
  for (let step = 1; step <= 6; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [touchPoint(cx - 45 - step * 12, cy, 0), touchPoint(cx + 45 + step * 12, cy, 1)],
    })
    await wait(40)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await wait(400)
}

async function tapTwice(page, x, y) {
  for (let tap = 0; tap < 2; tap += 1) {
    await page.touchscreen.tap(x, y)
    await wait(90)
  }
  await wait(400)
}

async function zoomState(page) {
  return page.evaluate(() => ({
    scale: Math.round(window.visualViewport.scale * 1000) / 1000,
    innerWidth: window.innerWidth,
    docWidth: document.documentElement.clientWidth,
  }))
}

async function zoomLocked(page, cdp, label, cx, cy, expectScreen) {
  const before = await zoomState(page)
  await pinchAt(cdp, cx, cy)
  const afterPinch = await zoomState(page)
  check(
    `${label}: pinch does not zoom the page`,
    afterPinch.scale === 1,
    `scale ${before.scale} -> ${afterPinch.scale}`,
  )
  check(
    `${label}: pinch does not widen the layout`,
    afterPinch.innerWidth === before.innerWidth && afterPinch.docWidth === before.docWidth,
    JSON.stringify(afterPinch),
  )
  await tapTwice(page, cx, cy)
  const afterTap = await zoomState(page)
  check(
    `${label}: a double tap does not zoom the page`,
    afterTap.scale === 1 && afterTap.innerWidth === before.innerWidth,
    `scale ${afterTap.scale} width ${afterTap.innerWidth}`,
  )
  if (expectScreen) {
    check(
      `${label}: still on the same screen after the gestures`,
      (await page.locator(expectScreen).count()) === 1,
      expectScreen,
    )
  }
}

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
server.stdout.on('data', (chunk) => (serverLog += chunk))
server.stderr.on('data', (chunk) => (serverLog += chunk))

let browser = null
try {
  await waitForServer()
  browser = await chromium.launch({ executablePath: EXE, headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`))

  let dictRequests = 0
  await page.route('**/dict/*.json', async (route) => {
    dictRequests += 1
    await wait(50)
    await route.continue()
  })

  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForSelector('.progress', { timeout: 10000 })
  const servedBase = await page.evaluate(() => document.baseURI)
  check(
    'the site is served under the Pages subpath',
    servedBase.endsWith(SITE_BASE),
    servedBase,
  )
  check('loading text is "Loading ..."', (await page.locator('.loading-text').textContent()).trim() === 'Loading ...')
  // The first paint already names the site: head plus the build credit, and
  // the credit is the only footer line on this screen.
  check(
    'loading shows the site title',
    (await page.locator('.loading .site-title').textContent()).trim() === '大家の日本語',
    await page.locator('.loading .site-title').textContent(),
  )
  check(
    'loading shows the subtitle',
    (await page.locator('.loading .site-subtitle').textContent()).trim() === '轉型練習',
  )
  check(
    'loading shows the description',
    (await page.locator('.loading .site-lede').textContent()).trim() === '涵蓋初級 1 – 50 課的單詞',
  )
  check(
    'loading shows the build credit',
    (await page.locator('.loading .footer-link').textContent()).trim() === 'Build with ❤ by Mane',
  )
  check('loading has no bug line', (await page.locator('.loading .footer-feedback').count()) === 0)
  const progressStart = await page.evaluate(() => {
    const fill = document.querySelector('.progress-fill')
    return fill ? parseFloat(fill.style.width || '0') : 0
  })
  await wait(400)
  const progressLater = await page.evaluate(() => {
    const fill = document.querySelector('.progress-fill')
    return fill ? parseFloat(fill.style.width || '0') : 0
  })
  check('progress advances', progressLater > progressStart, `${progressStart} -> ${progressLater}`)

  await page.waitForSelector('.home-actions', { timeout: 30000 })
  check('reaches home after boot', true)
  check('fetched 50 dictionary files', dictRequests === 50, `requests=${dictRequests}`)

  const idbCount = await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('katsuyou-dict')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const count = await new Promise((resolve, reject) => {
      const store = db.transaction('lessons', 'readonly').objectStore('lessons')
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return count
  })
  check('IndexedDB holds 50 lessons', idbCount === 50, `count=${idbCount}`)

  const column = await page.locator('.column').boundingBox()
  check('column is at most 480px wide', column.width <= 480.5, `width=${column.width}`)
  const footerBox = await page.locator('.footer-link').boundingBox()
  check('footer control is at least 36px tall', footerBox.height >= 35.9, `height=${footerBox.height}`)

  if (WANT_SHOTS) {
    fs.mkdirSync(SHOT_DIR, { recursive: true })
    await page.screenshot({ path: path.join(SHOT_DIR, 'home.png') })
  }

  // Boot failure path: abort the first download, then retry.
  const failContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const failPage = await failContext.newPage()
  let abortedAttempts = 0
  await failPage.route('**/dict/lesson_1.json', (route) => {
    if (abortedAttempts < 2) {
      abortedAttempts += 1
      return route.abort()
    }
    return route.continue()
  })
  await failPage.goto(BASE, { waitUntil: 'load' })
  await failPage.waitForSelector('.loading-error', { timeout: 20000 })
  const errorText = (await failPage.locator('.error-text').textContent()).trim()
  check('boot failure names the lesson', errorText.includes('lesson 1'), errorText)
  check('boot failure shows a retry button', (await failPage.locator('.loading-error .button').count()) === 1)
  check('boot failure stops the progress bar', (await failPage.locator('.progress-fill').evaluate((el) => parseFloat(el.style.width || '0'))) < 100)
  // The head and the credit line stay on the failure screen too.
  check(
    'a failed boot keeps the site title',
    (await failPage.locator('.loading .site-title').textContent()).trim() === '大家の日本語',
  )
  check('a failed boot keeps the build credit', (await failPage.locator('.loading .footer-link').count()) === 1)
  // Geometry: the head stays on top, the credit sits under the progress area, and
  // everything fits the 390×844 viewport without a sideways scroll.
  const loadLayout = await failPage.evaluate(() => {
    const box = (selector) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, height: rect.height }
    }
    return {
      title: box('.loading .site-title'),
      lede: box('.loading .site-lede'),
      text: box('.loading-text'),
      progress: box('.progress'),
      footer: box('.loading .footer-link'),
      viewport: window.innerHeight,
      width: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }
  })
  check(
    'the loading head sits above the progress line',
    loadLayout.lede.bottom < loadLayout.text.top,
    JSON.stringify(loadLayout),
  )
  check(
    'the loading credit sits below the progress bar',
    loadLayout.progress.bottom < loadLayout.footer.top,
    JSON.stringify(loadLayout),
  )
  check(
    'the loading credit stays inside the viewport',
    loadLayout.footer.bottom <= loadLayout.viewport + 1,
    `${loadLayout.footer.bottom} vs ${loadLayout.viewport}`,
  )
  check(
    'the loading screen does not scroll sideways',
    loadLayout.width <= loadLayout.innerWidth,
    `${loadLayout.width} vs ${loadLayout.innerWidth}`,
  )
  await failPage.locator('.loading .footer-link').click()
  check('the loading credit opens the About sheet', (await failPage.locator('.sheet').count()) === 1)
  check('the loading sheet carries the repository link', (await failPage.locator('.sheet-repo').count()) === 1)
  await failPage.locator('.sheet .button').click()
  check('the About sheet closes', (await failPage.locator('.sheet').count()) === 0)
  await failPage.locator('.loading-error .button').click()
  await failPage.waitForSelector('.home-actions', { timeout: 30000 })
  check('retry re-runs boot and reaches home', true)
  await failContext.close()

  for (const label of ['字典', '翻卡學習', '測驗']) {
    await page.locator('.home-actions button', { hasText: label }).click()
    await page.waitForSelector('.chip-grid', { timeout: 5000 })
    const title = (await page.locator('.bar-title').textContent()).trim()
    check(`entry ${label} opens the picker`, title === '詞彙', `title=${title}`)
    const downloadsBefore = dictRequests
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('.home-actions', { timeout: 30000 })
    check(
      `reload ${label} verifies stored lessons without downloading`,
      dictRequests === downloadsBefore,
      `requests=${dictRequests}, before=${downloadsBefore}`,
    )
  }

  // A fresh context has empty storage, like a private window: boot downloads
  // once, then IndexedDB serves the next reload.
  const privateContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const privatePage = await privateContext.newPage()
  let privateRequests = 0
  await privatePage.route('**/dict/*.json', async (route) => {
    privateRequests += 1
    await route.continue()
  })
  await privatePage.goto(BASE, { waitUntil: 'load' })
  await privatePage.waitForSelector('.home-actions', { timeout: 40000 })
  const privateCount = await privatePage.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('katsuyou-dict')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const count = await new Promise((resolve, reject) => {
      const request = db.transaction('lessons', 'readonly').objectStore('lessons').count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return count
  })
  check('private window boots into home', true)
  check('private window stores 50 lessons in IndexedDB', privateCount === 50, `count=${privateCount}`)
  const privateBefore = privateRequests
  await privatePage.reload({ waitUntil: 'load' })
  await privatePage.waitForSelector('.home-actions', { timeout: 40000 })
  check(
    'private window reload reuses IndexedDB',
    privateRequests === privateBefore,
    `requests=${privateRequests}, before=${privateBefore}`,
  )
  await privateContext.close()

  // T4 picker: dictionary mode.
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  check('picker shows 50 lesson chips', (await page.locator('.chip-grid .chip').count()) === 50)
  const chipLabels = await page.locator('.chip-grid .chip').allTextContents()
  check(
    'chips are labelled 第N課',
    chipLabels[0].trim() === '第1課' && chipLabels[49].trim() === '第50課',
    `${chipLabels[0]}|${chipLabels[49]}`,
  )
  const chipOne = page.locator('.chip', { hasText: '第1課' })
  check('lesson 1 is disabled (no verbs)', await chipOne.isDisabled())
  check('lesson 1 looks empty', (await chipOne.getAttribute('class')).includes('chip--empty'))
  check('start disabled with no lessons', await page.locator('.picker-start').isDisabled())
  const noLessonHint = await page.evaluate(() => {
    const hint = document.querySelector('.start-hint')
    if (!hint) return null
    return {
      text: hint.textContent.trim(),
      aboveStart: hint.getBoundingClientRect().bottom <= document.querySelector('.picker-start').getBoundingClientRect().top + 1,
    }
  })
  check('with no lesson the picker asks for one', noLessonHint?.text === '請至少選擇一門課程才可以開始', noLessonHint?.text ?? 'no hint')
  check('the lesson hint sits above 開始', noLessonHint?.aboveStart === true)

  const chipTwo = page.locator('.chip', { hasText: '第2課' })
  await chipTwo.click()
  check('selecting a lesson fills the chip', (await chipTwo.getAttribute('class')).includes('chip--on'))
  check('start enabled with one lesson', await page.locator('.picker-start').isEnabled())
  check(
    'the lesson hint clears once a lesson is picked',
    (await page.locator('.start-hint').count()) === 0,
    `hints=${await page.locator('.start-hint').count()}`,
  )

  const stored = await page.evaluate(() => localStorage.getItem('katsuyou-settings'))
  check('settings saved under katsuyou-settings', Boolean(stored))
  const storedDict = JSON.parse(stored).dict.lessons
  check('dictionary lessons persisted', Array.isArray(storedDict) && storedDict.includes(2), JSON.stringify(storedDict))

  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  const persistedTwo = page.locator('.chip', { hasText: '第2課' })
  check('selection survives reload', (await persistedTwo.getAttribute('class')).includes('chip--on'))

  await page.locator('.text-button', { hasText: '全選' }).first().click()
  check(
    '全選 reads 取消全選 once everything is selected',
    (await page.locator('.section-head .text-button').textContent()).trim() === '取消全選',
    (await page.locator('.section-head .text-button').textContent()).trim(),
  )
  check(
    '全選 selects only the 46 verb lessons',
    (await page.locator('.chip--on').count()) === 46,
    `selected=${await page.locator('.chip--on').count()}`,
  )
  await page.locator('.text-button', { hasText: '全選' }).first().click()
  check('全選 clears when all were selected', (await page.locator('.chip--on').count()) === 0)
  check(
    'the control reads 全選 again after clearing',
    (await page.locator('.section-head .text-button').textContent()).trim() === '全選',
  )

  // The picker's bar pins to the top too, so 返回 stays reachable while scrolling.
  // Short viewport on purpose: the compact chips fit on a tall phone, so the
 // page only scrolls when there is less height to work with.
  const beforeScrollViewport = page.viewportSize()
  await page.setViewportSize({ width: 390, height: 560 })
  await wait(150)
  const pickerBar = await page.evaluate(async () => {
    const bar = document.querySelector('.bar')
    window.scrollTo({ top: 420 })
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const rect = bar.getBoundingClientRect()
    const scrolled = window.scrollY
    window.scrollTo({ top: 0 })
    return {
      pinned: Math.round(rect.top) === 0,
      visible: rect.bottom > 0,
      position: getComputedStyle(bar).position,
      scrolled,
    }
  })
  await page.setViewportSize(beforeScrollViewport)
  await wait(150)
  check('the picker bar is sticky', pickerBar.position === 'sticky', pickerBar.position)
  check(
    'scrolling the picker pins its bar',
    pickerBar.pinned && pickerBar.visible && pickerBar.scrolled > 0,
    JSON.stringify(pickerBar),
  )
  check(
    'the pinned bar can still go back home',
    await page.locator('.bar .icon-button[aria-label="返回"]').isVisible(),
  )

  // Empty lessons are unpressable but explain themselves on hover.
  const emptyChip = page.locator('.chip-wrap').first()
  await emptyChip.hover()
  await wait(220)
  const hintState = await page.evaluate(() => {
    const tip = document.querySelector('.chip-tip')
    return tip
      ? {
          text: tip.textContent.trim(),
          opacity: getComputedStyle(tip).opacity,
          disabled: tip.parentElement.querySelector('button').disabled,
        }
      : null
  })
  check('a verb-less lesson is disabled', hintState?.disabled === true)
  check('a verb-less lesson shows the hint 該課沒有動詞', hintState?.text === '該課沒有動詞', JSON.stringify(hintState))
  check('the hint is visible on hover', hintState?.opacity === '1', String(hintState?.opacity))
  check('start disabled again after clearing', await page.locator('.picker-start').isDisabled())

  // T4 picker: card mode form controls.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await page.waitForSelector('.form-select', { timeout: 5000 })
  check('card picker shows 從 and 到', (await page.locator('.form-chips').count()) === 1)
  checkLabelAlignment('card picker', await labelAlignment(page))
  check('到 header row exists', (await page.locator('.targets-head').count()) === 1)
  check('到 header labels the row', (await page.locator('.targets-head .field-label').textContent()).trim() === '到')
  check('到 header holds 全選', (await page.locator('.targets-head .text-button', { hasText: '全選' }).count()) === 1)
  const toHeadButton = await page.locator('.targets-head .text-button').boundingBox()
  const firstToChip = await page.locator('.form-chips .chip').first().boundingBox()
  const columnBox = await page.locator('.column').boundingBox()
  check(
    '全選 sits above the first 到 chip',
    toHeadButton.y + toHeadButton.height <= firstToChip.y + 1,
    `buttonBottom=${Math.round(toHeadButton.y + toHeadButton.height)} chipTop=${Math.round(firstToChip.y)}`,
  )
  check(
    '全選 is right-aligned in the column',
    toHeadButton.x + toHeadButton.width >= columnBox.x + columnBox.width - 40,
    `buttonRight=${Math.round(toHeadButton.x + toHeadButton.width)} columnRight=${Math.round(columnBox.x + columnBox.width)}`,
  )
  check(
    '全選 is no longer in the left label column',
    toHeadButton.x > columnBox.x + 120,
    `buttonLeft=${Math.round(toHeadButton.x)}`,
  )
  check('card start disabled without lessons', await page.locator('.picker-start').isDisabled())
  await page.locator('.form-select').click()
  await page.locator('.form-option', { hasText: /^字典形$/ }).click()
  check(
    'changing 從 removes that form from 到',
    (await page.locator('.chip--form.chip--on').count()) === 1,
  )
  check(
    '到 keeps a fallback target',
    (await page.locator('.chip--form', { hasText: /^ます形$/ }).getAttribute('class')).includes('chip--on'),
  )

  // T5 dictionary reader: selection, swipe threshold, controls, settings.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.chip', { hasText: '第5課' }).click()
  await page.locator('.picker-start').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  check('reader title counts items', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))
  check('reader lists all 15 forms', (await page.locator('.form-block').count()) === 15, String(await page.locator('.form-block').count()))
  check('every form has three sentence pairs', (await page.locator('.form-block .sentence').count()) === 45)
  check('exactly one form block is the default', (await page.locator('.form-block--default').count()) === 1)
  check(
    'default form starts as ます形',
    (await page.locator('.form-block--default .form-name').textContent()).trim() === 'ます形',
    (await page.locator('.form-block--default .form-name').textContent()).trim(),
  )
  check('every block names its form', (await page.locator('.form-name').count()) === 15)
  const blockFormat = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('.form-block')]
    return {
      backgrounds: [...new Set(blocks.map((b) => getComputedStyle(b).backgroundColor))],
      radii: [...new Set(blocks.map((b) => getComputedStyle(b).borderTopLeftRadius))],
      pads: [...new Set(blocks.map((b) => `${getComputedStyle(b).paddingLeft}|${getComputedStyle(b).paddingRight}`))],
      margins: [...new Set(blocks.map((b) => `${getComputedStyle(b).marginLeft}|${getComputedStyle(b).marginRight}`))],
      tags: document.querySelectorAll('.tag').length,
      taggedBlocks: blocks.filter((b) => b.querySelector('.tags')).length,
      firstHasTags: Boolean(blocks[0].querySelector('.tags')),
    }
  })
  check(
    'no form block paints a background',
    blockFormat.backgrounds.every((colour) => colour === 'rgba(0, 0, 0, 0)') || blockFormat.backgrounds.every((colour) => colour === 'transparent'),
    blockFormat.backgrounds.join(','),
  )
  check('no form block has a panel radius', blockFormat.radii.every((radius) => radius === '0px'), blockFormat.radii.join(','))
  check('every form block has the same horizontal padding', blockFormat.pads.length === 1, blockFormat.pads.join(','))
  check('no form block is inset with negative margins', blockFormat.margins.every((margin) => margin === '0px|0px'), blockFormat.margins.join(','))
  check('the 群組 and 第N課 pills render twice in total', blockFormat.tags === 2, String(blockFormat.tags))
  check('only the first block carries the pills', blockFormat.taggedBlocks === 1 && blockFormat.firstHasTags)
  const highlight = await page.evaluate(() => {
    const block = document.querySelector('.form-block')
    const hits = [...block.querySelectorAll('.sentence-hit')]
    const first = hits[0]
    const sentence = hits[0] ? hits[0].closest('.sentence-ja') : null
    const marked = sentence ? [...sentence.querySelectorAll('span')].map((span) => span.textContent).join('') : ''
    return {
      count: hits.length,
      texts: hits.map((hit) => hit.textContent),
      colour: first ? getComputedStyle(first).color : null,
      weight: first ? getComputedStyle(first).fontWeight : null,
      sentence: marked,
      plainSentence: sentence ? sentence.textContent : '',
    }
  })
  check('the studied word is marked in the example sentences', highlight.count > 0, `hits=${highlight.count}`)
  check(
    'the mark uses the purple highlight colour',
    highlight.colour === 'rgb(124, 58, 237)',
    String(highlight.colour),
  )
  check('the mark is bold', highlight.weight === '600', String(highlight.weight))
  check(
    'the sentence text survives the marking',
    highlight.sentence === highlight.plainSentence,
    `${highlight.sentence} vs ${highlight.plainSentence}`,
  )
  check(
    'the mark repeats the form word, nothing else',
    new Set(highlight.texts).size === 1 && highlight.texts[0].length > 0,
    highlight.texts.join('|'),
  )

  const stickyBar = await page.evaluate(async () => {
    const bar = document.querySelector('.bar')
    window.scrollTo({ top: 640 })
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const rect = bar.getBoundingClientRect()
    const scrolled = window.scrollY
    window.scrollTo({ top: 0 })
    return {
      pinned: Math.round(rect.top) === 0,
      visible: rect.bottom > 0,
      scrolled,
      position: getComputedStyle(bar).position,
    }
  })
  check('the reader bar is sticky', stickyBar.position === 'sticky')
  check('scrolling pins the bar to the top', stickyBar.pinned && stickyBar.visible, JSON.stringify(stickyBar))

  const formOrder = await page.locator('.form-block').evaluateAll((nodes) =>
    nodes.map((node) => node.dataset.form),
  )
  check('the default form sits first', formOrder[0] === 'masu-form', formOrder[0])
  check('all 15 forms appear once', new Set(formOrder).size === 15 && formOrder.length === 15)
  check(
    'the rest keep the canonical order behind it',
    formOrder.slice(1).join(',') ===
      'dictionary-form,masu-form-negative,masu-form-past,masu-form-past-negative,nai-form,ta-form,nakatta-form,te-form,potential-form,volitional-form,imperative-form,conditional-form,passive-form,causative-form',
    formOrder.slice(1).join(','),
  )
  check(
    'the last block is 使役形 and still names its form',
    (await page.locator('.form-block').last().getAttribute('data-form')) === 'causative-form' &&
      (await page.locator('.form-block').last().locator('.form-name').count()) === 1,
  )
  check('reader shows the default-form word', (await wordText(page)) === '行きます', await wordText(page))
  check('reader shows furigana by default', (await page.locator('.reader-page rt').count()) > 0)
  check('previous control disabled on the first item', await page.locator('.controls-button').first().isDisabled())
  const readerControls = (await page.locator('.reader-controls .controls-button').allTextContents()).map((t) => t.trim())
  check(
    'reader controls read 上一個 / 下一個',
    readerControls[0] === '‹ 上一個' && readerControls[1] === '下一個 ›',
    readerControls.join(' | '),
  )

  // The pager footer is opaque and taller, so sentences never show through it.
  const pagerFooter = await page.evaluate(() => {
    const footer = document.querySelector('.reader-controls')
    const style = getComputedStyle(footer)
    const rect = footer.getBoundingClientRect()
    return {
      image: style.backgroundImage,
      colour: style.backgroundColor,
      borderTop: `${style.borderTopWidth} ${style.borderTopStyle}`,
      paddingTop: parseFloat(style.paddingTop),
      buttonTopWithinFooter: Math.round(
        footer.querySelector('button').getBoundingClientRect().top - rect.top,
      ),
      position: style.position,
      bottomGap: Math.round(window.innerHeight - rect.bottom),
      height: Math.round(rect.height),
      buttons: [...footer.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)),
    }
  })
  check('the pager footer keeps its transparent fade shape', pagerFooter.image.includes('linear-gradient'), pagerFooter.image.slice(0, 40))
  check('the pager footer has no underline', pagerFooter.borderTop === '0px none', pagerFooter.borderTop)
  check('the pager footer keeps its fade band plus the 50px controls', pagerFooter.height >= 78, String(pagerFooter.height))
  check('the pager buttons are 50px tall', pagerFooter.buttons.every((h) => h >= 49.9 && h <= 51), pagerFooter.buttons.join(','))
  check(
    'the fade band sits above the buttons',
    pagerFooter.buttonTopWithinFooter >= pagerFooter.paddingTop,
    `button top ${pagerFooter.buttonTopWithinFooter}px vs fade band ${pagerFooter.paddingTop}px`,
  )
  check('the pager footer is pinned to the bottom', pagerFooter.position === 'sticky' && pagerFooter.bottomGap <= 2, `${pagerFooter.position} gap=${pagerFooter.bottomGap}`)

  // Bottom height: every screen ends 10px above the column bottom, except the
  // picker's 開始 which the user asked to sit 20px clear.
  await page.evaluate(() => window.scrollTo({ top: 0 }))
  const bottomGaps = await page.evaluate(() => {
    const gap = (el) => Math.round(el.getBoundingClientRect().bottom - window.innerHeight) * -1
    return {
      reader: gap(document.querySelector('.reader-controls .controls-button')),
      readerPad: getComputedStyle(document.querySelector('.reader-controls')).paddingBottom,
    }
  })
  check('the reader footer keeps 10px under the controls', bottomGaps.reader === 10, JSON.stringify(bottomGaps))

  await drag(page, 40)
  check('a 40px drag springs back', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))

  // Right-to-left advances: the hand pushes the next word in from the right.
  const forward = await dragSampled(page, -120)
  check('a right-to-left swipe advances', (await readerTitle(page)) === '學習（2/3）', await readerTitle(page))
  check('the outgoing page leaves to the left', forward.classes.includes('reader-page--leave-next'), forward.classes)
  check(
    'the page slide is flat, not a 3D matrix',
    !forward.transform.includes('matrix3d') && forward.transform !== 'none',
    forward.transform,
  )
  // translateX only: the x value carries the move and the y value stays zero.
  const turnSlide = /matrix\(1, 0, 0, 1, ([^,]+), ([^)]+)\)/.exec(forward.transform)
  check(
    'the outgoing page moves only along x',
    turnSlide !== null && Math.abs(Number(turnSlide[2])) < 1e-6 && Math.abs(Number(turnSlide[1])) > 1,
    forward.transform,
  )
  check(
    'the leaving page does not fade',
    (await page.locator('.reader-page').evaluate((el) => getComputedStyle(el).opacity)) === '1' || forward.transform === 'none',
  )
  const readerPerspective = await page
    .locator('.reader-body')
    .evaluate((el) => getComputedStyle(el).perspective)
  check('the reader carries no perspective depth', readerPerspective === 'none', readerPerspective)
  const readerOverflow = await horizontalOverflow(page)
  check(
    'the reader adds no horizontal scroll',
    readerOverflow.scroll <= readerOverflow.inner,
    JSON.stringify(readerOverflow),
  )

  const backward = await dragSampled(page, 120)
  check('a left-to-right swipe goes back', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))
  check('going back animates the other way', backward.classes.includes('reader-page--leave-prev'), backward.classes)

  // The turn judged as a curve: release, sample every frame, then check that
  // nothing travels backwards on screen, nothing overshoots, the swap happens
  // off screen, and the pace carries across it.
  const readerSpring = traceVerdict(await swipeTrace(page, 55, '.reader-body', '.reader-page'), 'next')
  checkSettle('dictionary', readerSpring, 160)
  check('a 55px drag keeps the word', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))
  const readerTurn = traceVerdict(await swipeTrace(page, -120, '.reader-body', '.reader-page'), 'next')
  check('the traced swipe advances', (await readerTitle(page)) === '學習（2/3）', await readerTitle(page))
  checkTurn('dictionary page turn', readerTurn, 160)
  await drag(page, 120)
  check('the traced swipe went back to the first word', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))

  // Above 550px the reader keeps text selectable and pages only by button.
  await page.setViewportSize({ width: 900, height: 900 })
  const wideBefore = await readerTitle(page)
  await drag(page, 120)
  check('a drag does not page the wide reader', (await readerTitle(page)) === wideBefore, await readerTitle(page))
  const selectedText = await page.evaluate(() => {
    const word = document.querySelector('.form-block--default .word')
    const range = document.createRange()
    range.selectNodeContents(word)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    return selection.toString().replace(/\s/g, '')
  })
  check('wide reader text can be selected', selectedText.length > 0, selectedText.slice(0, 12))
  await page.setViewportSize({ width: 390, height: 844 })

  await page.locator('.controls-button').nth(1).click()
  // The control runs the same leave-then-enter turn as a swipe, so the word
  // arrives a beat later.
  await wait(460)
  check('next control advances', (await readerTitle(page)) === '學習（2/3）', await readerTitle(page))
  const wordBeforeForm = await wordText(page)

  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  check('settings shows 預設顯示形式', (await page.locator('.row-label').first().textContent()).trim() === '預設顯示形式')
  check('settings shows 顯示平假名注音', (await page.locator('.row-label', { hasText: '顯示平假名注音' }).count()) === 1)
  const switchBox = await page.locator('.switch').first().boundingBox()
  check('switch control is 32px tall', switchBox.height >= 31.9 && switchBox.height <= 33, `height=${switchBox.height}`)
  await page.locator('.form-select').click()
  await page.locator('.form-option', { hasText: /^て形$/ }).click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  const wordAfterForm = await wordText(page)
  check('default form changes the reader word', wordAfterForm !== wordBeforeForm, `${wordBeforeForm} -> ${wordAfterForm}`)
  check('second verb shows its own te-form', wordAfterForm === '来て', wordAfterForm)

  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  await page.locator('.switch').first().click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  check('reading switch hides ruby', (await page.locator('.reader-page rt').count()) === 0)

  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.picker-start').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  check('default form persisted after reload', (await wordText(page)) === '行って', await wordText(page))
  check('reading-off setting persisted', (await page.locator('.reader-page rt').count()) === 0)

  // T6 flashcards.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.chip', { hasText: '第5課' }).click()
  await page.locator('.form-select').click()
  await page.locator('.form-option', { hasText: /^ます形$/ }).click()

  // Clearing 到 explains why 開始 is disabled, and picking a form recovers.
  const onTargets = page.locator('.chip--form.chip--on')
  while ((await onTargets.count()) > 0) await onTargets.first().click()
  const emptied = await page.evaluate(() => ({
    hint: document.querySelector('.start-hint')?.textContent.trim() ?? null,
    disabled: document.querySelector('.picker-start').disabled,
    aboveStart: (() => {
      const hint = document.querySelector('.start-hint')
      if (!hint) return false
      return hint.getBoundingClientRect().bottom <= document.querySelector('.picker-start').getBoundingClientRect().top + 1
    })(),
  }))
  check('clearing 到 shows the 轉型 hint', emptied.hint === '請至少選擇一個轉型才可以開始', emptied.hint)
  check('the hint sits above 開始', emptied.aboveStart)
  check('開始 is disabled with no 轉型', emptied.disabled)
  await page.locator('.chip--form', { hasText: '字典形' }).click()
  const restored = await page.evaluate(() => ({
    hint: document.querySelector('.start-hint')?.textContent.trim() ?? null,
    disabled: document.querySelector('.picker-start').disabled,
  }))
  check('picking a 轉型 hides the hint', restored.hint === null)
  check('開始 recovers once a 轉型 is picked', restored.disabled === false)

  const startBottomGap = await page.evaluate(
    () => Math.round(window.innerHeight - document.querySelector('.picker-start').getBoundingClientRect().bottom),
  )
  check('開始 sits 20px clear of the window edge', startBottomGap === 20, String(startBottomGap))
  await page.locator('.picker-start').click()
  await page.waitForSelector('.card-stage', { timeout: 5000 })
  check('card title counts cards', (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）')
  const cardControls = (await page.locator('.card-controls .control').allTextContents()).map((t) => t.trim())
  check(
    'card controls stay 上一張 / 下一張',
    cardControls[0] === '‹ 上一張' && cardControls[1] === '下一張 ›',
    cardControls.join(' | '),
  )
  const cardBottomGap = await page.evaluate(
    () => Math.round(window.innerHeight - document.querySelector('.card-controls .control').getBoundingClientRect().bottom),
  )
  check('the card footer keeps 10px under the controls', cardBottomGap === 10, String(cardBottomGap))
  const faceWord = await wordText(page, '.card-face .word')
  const cardVerb = byMasu(faceWord)
  check('card face shows a source form from the lesson', Boolean(cardVerb), faceWord)
  check('card face names the target', (await page.locator('.card-face .prompt').textContent()).trim() === '變成字典形')
  check('card face shows the verb-class tag', (await page.locator('.card-face .tag--group').count()) === 1)

  check('both faces exist for the 3D flip', (await page.locator('.card-side').count()) === 2)
  check('the card starts on its face', !(await cardFlipped(page)))

  await page.locator('.card-stage').click()
  await wait(90)
  const midTransform = await cardInnerTransform(page)
  check(
    'a tap animates a 3D rotation',
    midTransform.startsWith('matrix3d') && midTransform !== 'none',
    midTransform.slice(0, 48),
  )
  check('a tap flips the card state', await cardFlipped(page))
  await wait(280)
  check('the flip finishes on the back', await cardFlipped(page))

  // The turn as a curve: the rotation has to rise to 180° without passing it
  // and without any frame moving backwards.
  await page.locator('.card-stage').click()
  await wait(350)
  check('a second tap returns to the face before the trace', !(await cardFlipped(page)))
  await startTrace(page, '.card-inner', 'angle')
  await page.locator('.card-stage').click()
  await wait(600)
  const flipAngles = (await page.evaluate(() => window.__trace)).map(([, angle]) => angle)
  const flipPeak = Math.max(...flipAngles)
  let flipBack = 0
  for (let i = 1; i < flipAngles.length; i += 1) {
    if (flipAngles[i] < flipAngles[i - 1] - 1.5) flipBack += 1
  }
  check('the flip never runs past 180°', flipPeak <= 181, `${Math.round(flipPeak)}°`)
  check('the flip never turns back on itself', flipBack === 0, `${flipBack} frames went backwards`)
  const flipTurnMs = await page.locator('.card-inner').evaluate((el) => getComputedStyle(el).transitionDuration)
  check('the flip is a single short turn', parseFloat(flipTurnMs) * 1000 <= 260, flipTurnMs)
  await wait(200)
  check(
    'the answer carries the asked form as a tag',
    (await page.locator('.card-back .tag--form').textContent()).trim() === '字典形',
    (await page.locator('.card-back .tag--form').textContent()).trim(),
  )
  check(
    'a tap reveals the matching target form',
    (await wordText(page, '.card-back .word')) === cardVerb.dict,
    await wordText(page, '.card-back .word'),
  )
  check(
    'the back shows the gloss',
    (await page.locator('.card-back .gloss').textContent()).includes(cardVerb.gloss.split(';')[0].trim()),
  )

  await page.locator('.card-stage').click()
  await wait(350)
  check('tapping again returns to the face', !(await cardFlipped(page)))

  await drag(page, -120, 0, '.card-stage')
  check(
    'right-to-left swipe opens the next card',
    (await page.locator('.bar-title').textContent()).trim() === '練習（2/3）',
    (await page.locator('.bar-title').textContent()).trim(),
  )
  const cardOverflow = await horizontalOverflow(page)
  check(
    'a card swipe adds no horizontal scroll',
    cardOverflow.scroll <= cardOverflow.inner,
    JSON.stringify(cardOverflow),
  )
  check('the new card starts on its face', !(await cardFlipped(page)))
  await drag(page, 120, 0, '.card-stage')
  check(
    'left-to-right swipe goes back',
    (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）',
    (await page.locator('.bar-title').textContent()).trim(),
  )

  // The same curve check as the reader, on the card.
  const cardSpring = traceVerdict(await swipeTrace(page, 55, '.card-stage', '.card'), 'next')
  checkSettle('cards', cardSpring, 180)
  check('a 55px card drag keeps the card', (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）')
  const cardTurn = traceVerdict(await swipeTrace(page, -120, '.card-stage', '.card'), 'next')
  check('the traced card swipe advances', (await page.locator('.bar-title').textContent()).trim() === '練習（2/3）')
  checkTurn('card turn', cardTurn, 200)
  await drag(page, 120, 0, '.card-stage')
  check('the traced card swipe came back', (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）')

  // 下一張 / 上一張 run the same leave-then-enter motion as a swipe.
  await page.locator('.card-controls .control').nth(1).click()
  await wait(70)
  const leavingClasses = (await page.locator('.card').getAttribute('class')) || ''
  check('下一張 animates the outgoing card', leavingClasses.includes('card--leave-next'), leavingClasses)
  const leavingOverflow = await horizontalOverflow(page)
  check(
    'the leaving card widens no scroll while it travels',
    leavingOverflow.scroll <= leavingOverflow.inner,
    JSON.stringify(leavingOverflow),
  )
  await wait(200)
  const enteringClasses = (await page.locator('.card').getAttribute('class')) || ''
  check('下一張 animates the incoming card in from the left', enteringClasses.includes('card--enter-next'), enteringClasses)
  await wait(300)
  check('下一張 reaches the next card', (await page.locator('.bar-title').textContent()).trim() === '練習（2/3）')

  await page.locator('.card-controls .control').nth(0).click()
  await wait(70)
  const backClasses = (await page.locator('.card').getAttribute('class')) || ''
  check('上一張 animates backwards too', backClasses.includes('card--leave-prev'), backClasses)
  // This direction sticks out to the right, which is the axis a browser can
  // actually scroll: the clip is what keeps the page from widening.
  const prevOverflow = await horizontalOverflow(page)
  check(
    'a rightward card move widens no scroll',
    prevOverflow.scroll <= prevOverflow.inner,
    JSON.stringify(prevOverflow),
  )
  await wait(400)
  check('上一張 reaches the previous card', (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）')

  // Paging away from a flipped card is the case the report named: the outgoing
  // card must slide away flat and keep the side the reader was on, the fade is
  // gone, and the incoming card must arrive already on its face — never
  // rotating back to the face while it travels.
  await page.locator('.card-stage').click()
  await wait(400)
  check('the card about to page away is flipped', await cardFlipped(page))
  await page.locator('.card-controls .control').nth(1).click()
  await wait(50)
  const leaveEarly = await cardMotion(page)
  await wait(60)
  const leaveLate = await cardMotion(page)
  check(
    'a flipped card slides out on its own side',
    leaveEarly.flipped && leaveLate.flipped,
    leaveEarly.classes,
  )
  check(
    'the outgoing card never turns while it travels',
    leaveEarly.inner === leaveLate.inner,
    `${leaveEarly.inner} -> ${leaveLate.inner}`,
  )
  check(
    'the outgoing card travels flat',
    isFlatTranslate(leaveEarly.transform) && isFlatTranslate(leaveLate.transform),
    `${leaveEarly.transform} | ${leaveLate.transform}`,
  )
  check(
    'the outgoing card does not fade',
    leaveEarly.opacity === '1' && leaveLate.opacity === '1',
    `${leaveEarly.opacity} | ${leaveLate.opacity}`,
  )
  await wait(130)
  const enterNext = await cardMotion(page)
  check(
    'the next card arrives on its face',
    isTurnedOff(enterNext.inner) && !enterNext.flipped,
    JSON.stringify(enterNext),
  )
  check(
    'the entering card slides flat and does not fade',
    isFlatTranslate(enterNext.transform) && enterNext.opacity === '1',
    `${enterNext.transform} | ${enterNext.opacity}`,
  )
  await wait(300)
  const settledNext = await cardMotion(page)
  check(
    'the settled card rests on its face',
    isTurnedOff(settledNext.inner) && !settledNext.flipped && settledNext.opacity === '1',
    JSON.stringify(settledNext),
  )
  check(
    'paging from a flipped card reached the next card',
    settledNext.title === '練習（2/3）',
    settledNext.title,
  )

  // The mirror case: 上一張 from a flipped card.
  await page.locator('.card-stage').click()
  await wait(400)
  check('the card about to go back is flipped', await cardFlipped(page))
  await page.locator('.card-controls .control').nth(0).click()
  await wait(50)
  const backEarly = await cardMotion(page)
  await wait(60)
  const backLate = await cardMotion(page)
  check(
    'a flipped card slides back on its own side',
    backEarly.flipped && backLate.flipped,
    backEarly.classes,
  )
  check(
    'the card going back never turns while it travels',
    backEarly.inner === backLate.inner,
    `${backEarly.inner} -> ${backLate.inner}`,
  )
  check(
    'the card going back travels flat without fading',
    isFlatTranslate(backEarly.transform) &&
      isFlatTranslate(backLate.transform) &&
      backEarly.opacity === '1' &&
      backLate.opacity === '1',
    `${backEarly.transform} | ${backLate.transform} | ${backEarly.opacity} | ${backLate.opacity}`,
  )
  await wait(130)
  const enterPrev = await cardMotion(page)
  check(
    'the previous card arrives on its face',
    isTurnedOff(enterPrev.inner) && !enterPrev.flipped,
    JSON.stringify(enterPrev),
  )
  check(
    'the entering previous card slides flat and does not fade',
    isFlatTranslate(enterPrev.transform) && enterPrev.opacity === '1',
    `${enterPrev.transform} | ${enterPrev.opacity}`,
  )
  await wait(300)
  check(
    '上一張 from a flipped card reached the previous card',
    (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）',
    (await page.locator('.bar-title').textContent()).trim(),
  )

  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  check('card settings show the verb-class switch', (await page.locator('.row-label', { hasText: '一開始顯示幾類動詞' }).count()) === 1)
  await page.locator('.switch').first().click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.card-stage', { timeout: 5000 })
  check(
    'class switch off hides the front tag',
    (await page.locator('.card-face .tag--group').count()) === 0,
  )
  // The answer side keeps both pills: the asked form, then the verb class —
  // even though the class switch is off and hides the face's class pill.
  const answerFaceWord = await wordText(page, '.card-face .word')
  const answerVerb = byMasu(answerFaceWord)
  check('the answer check has a lesson 5 verb on the face', Boolean(answerVerb), answerFaceWord)
  await page.locator('.card-stage').click()
  await wait(400)
  const answerPills = await page.evaluate(() => {
    const back = document.querySelector('.card-back')
    if (!back) return null
    const pills = [...back.querySelectorAll('.tags .tag')]
    return {
      texts: pills.map((pill) => pill.textContent.trim()),
      classes: pills.map((pill) => pill.getAttribute('class') || ''),
      lefts: pills.map((pill) => Math.round(pill.getBoundingClientRect().left)),
      tops: pills.map((pill) => Math.round(pill.getBoundingClientRect().top)),
    }
  })
  check(
    'the answer keeps naming the asked form',
    answerPills?.texts?.[0] === '字典形',
    JSON.stringify(answerPills?.texts),
  )
  check(
    'the answer names the verb class with the switch off',
    answerPills?.texts?.[1] === groupLabel(answerVerb.group),
    `${answerPills?.texts?.[1]} vs ${groupLabel(answerVerb.group)}`,
  )
  check(
    'the answer pills run form first, class second',
    Boolean(answerPills) &&
      answerPills.classes.length === 2 &&
      answerPills.classes[0].includes('tag--form') &&
      answerPills.classes[1].includes('tag--group') &&
      answerPills.lefts[0] < answerPills.lefts[1],
    JSON.stringify(answerPills),
  )
  check(
    'the two answer pills share one row',
    Boolean(answerPills) && answerPills.tops[0] === answerPills.tops[1],
    JSON.stringify(answerPills?.tops),
  )
  await page.locator('.card-stage').click()
  await wait(400)

  // The last card turns the right-hand control into 完成 and ends the run.
  for (let i = 0; i < 3; i += 1) {
    const control = await page.locator('.card-controls .control').nth(1).textContent()
    if (control.trim() === '完成') break
    await page.locator('.card-controls .control').nth(1).click()
    await wait(220)
  }
  check(
    'the last card offers 完成',
    (await page.locator('.card-controls .control').nth(1).textContent()).trim() === '完成',
    (await page.locator('.card-controls .control').nth(1).textContent()).trim(),
  )
  await page.locator('.card-controls .control').nth(1).click()
  await page.waitForSelector('.complete', { timeout: 3000 })
  check('完成 ends the card run', (await page.locator('.card-stage').count()) === 0)
  check(
    'card completion shows the congrats copy',
    (await page.locator('.complete-title').textContent()).trim() === '恭喜，你已經做完了練習。',
  )
  check('card completion has no score block', (await page.locator('.score').count()) === 0)
  const practiceFigure = await page.evaluate(() => {
    const emoji = document.querySelector('.complete-emoji')
    if (!emoji) return null
    const title = document.querySelector('.complete-title').getBoundingClientRect()
    const box = emoji.getBoundingClientRect()
    const home = document.querySelector('.complete-home')?.getBoundingClientRect() ?? null
    return {
      text: emoji.textContent.trim(),
      aboveTitle: box.bottom <= title.top + 1,
      fontSize: getComputedStyle(emoji).fontSize,
      homeHeight: home ? home.height : 0,
    }
  })
  check('card completion shows a bowing figure', practiceFigure !== null)
  check('card completion shows exactly one emoji', (await page.locator('.complete-emoji').count()) === 1)
  check(
    'the figure is one of the three',
    PRACTICE_EMOJI.includes(practiceFigure?.text),
    String(practiceFigure?.text),
  )
  check('the emoji is a single one, never a row', !String(practiceFigure?.text).includes(' '), String(practiceFigure?.text))
  check('the figure sits above the congrats line', practiceFigure?.aboveTitle === true)
  check('card completion has no confetti', (await page.locator('.confetti-piece').count()) === 0)
  check(
    'card completion offers a 60px 返回主頁',
    Math.round(practiceFigure?.homeHeight ?? 0) === 60,
    String(practiceFigure?.homeHeight),
  )
  // Drawn once: a re-render (viewport change) must not re-roll it.
  await page.setViewportSize({ width: 391, height: 844 })
  await wait(200)
  const figureAgain = (await page.locator('.complete-emoji').textContent()).trim()
  check('the figure survives a re-render', figureAgain === practiceFigure?.text, `${practiceFigure?.text} -> ${figureAgain}`)
  await page.setViewportSize({ width: 390, height: 844 })
  check('card completion offers 返回主頁', (await page.locator('.complete-home').count()) === 1)
  await page.locator('.complete-home').click()
  await page.waitForSelector('.home-actions', { timeout: 5000 })

  // T7 quiz.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '測驗' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.chip', { hasText: '第5課' }).click()
  checkLabelAlignment('quiz picker', await labelAlignment(page))
  await page.locator('.form-select').click()
  await page.locator('.form-option', { hasText: /^ます形$/ }).click()
  await page.locator('.picker-start').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  check('quiz title counts items', (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）')
  const quizPrompt = await wordText(page, '.prompt .word')
  const quizVerb = byMasu(quizPrompt)
  check('quiz prompt shows a source form from the lesson', Boolean(quizVerb), quizPrompt)
  check('quiz asks for the dictionary form', (await page.locator('.question').textContent()).trim() === '原型是什麼？')
  check('quiz keyboard has 25 keys', (await page.locator('.keyboard .key').count()) === 25)
  for (const char of new Set(Array.from(quizVerb.reading))) {
    check(
      `keyboard contains the reading ${char}`,
      (await page.locator('.key', { hasText: new RegExp(`^${char}$`) }).count()) === 1,
      quizVerb.reading,
    )
  }

  for (const char of Array.from(quizVerb.reading)) {
    await page.locator('.key', { hasText: new RegExp(`^${char}$`) }).click()
  }
  await page.waitForSelector('.toast', { timeout: 3000 })
  check('a correct answer shows 回答正確', (await page.locator('.toast').textContent()).trim() === '回答正確')
  check('a correct answer advances', (await page.locator('.bar-title').textContent()).trim() === '練習（2/3）')
  check('the field clears after a correct answer', (await page.locator('.answer-input').inputValue()) === '')

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.locator('.answer-input').fill('あ')
    await page.locator('.check-button').click()
    await wait(120)
    if (attempt === 1) {
      check('a wrong answer stays on the item', (await page.locator('.bar-title').textContent()).trim() === '練習（2/3）')
      check('a wrong answer keeps the input', (await page.locator('.answer-input').inputValue()) === 'あ')
      check('a wrong answer shows 回答錯誤', (await page.locator('.toast').textContent()).trim() === '回答錯誤')
      check('the first miss does not reveal', (await page.locator('.reveal').count()) === 0)
      check('the first miss shows no 下一題', (await page.locator('.next-button').count()) === 0)
      check(
        'the first miss counts down the reveal',
        (await page.locator('.miss-hint').textContent()).trim() === '再答錯 2 題就顯示答案',
        (await page.locator('.miss-hint').textContent()).trim(),
      )
    }
    if (attempt === 2) {
      check('the second miss does not reveal', (await page.locator('.reveal').count()) === 0)
      check(
        'the second miss lowers the countdown',
        (await page.locator('.miss-hint').textContent()).trim() === '再答錯 1 題就顯示答案',
      )
    }
  }
  const secondPrompt = await wordText(page, '.prompt .word')
  const missedVerb = byMasu(secondPrompt)
  check('the third miss reveals the answer', (await page.locator('.reveal').count()) === 1)
  check(
    'the reveal shows the word',
    (await wordText(page, '.reveal .reveal-word')) === missedVerb.dict,
    await wordText(page, '.reveal .reveal-word'),
  )
  check(
    'the reveal shows the reading',
    (await page.locator('.reveal-reading').textContent()).trim() === missedVerb.reading,
    (await page.locator('.reveal-reading').textContent()).trim(),
  )
  const revealCover = await page.evaluate(() => {
    const keyboard = document.querySelector('.keyboard').getBoundingClientRect()
    const reveal = document.querySelector('.reveal').getBoundingClientRect()
    const overlapX = Math.max(0, Math.min(keyboard.right, reveal.right) - Math.max(keyboard.left, reveal.left))
    const overlapY = Math.max(0, Math.min(keyboard.bottom, reveal.bottom) - Math.max(keyboard.top, reveal.top))
    const centre = document.elementFromPoint(keyboard.left + keyboard.width / 2, keyboard.top + keyboard.height / 2)
    return {
      share: Math.round(((overlapX * overlapY) / (keyboard.width * keyboard.height)) * 100),
      onTop: Boolean(centre?.closest('.reveal')),
    }
  })
  check('the revealed answer covers the keyboard', revealCover.share === 100, String(revealCover.share))
  check('the revealed answer sits above the keyboard', revealCover.onTop)
  check('the reveal waits for 下一題', (await page.locator('.next-button').count()) === 1)
  check('the answer field is disabled after the reveal', await page.locator('.answer-input').isDisabled())
  check('the keyboard is disabled after the reveal', await page.locator('.keyboard .key').first().isDisabled())
  check('the revealed item does not advance by itself', (await page.locator('.bar-title').textContent()).trim() === '練習（2/3）')

  await page.locator('.next-button').click()
  check('下一題 advances after the reveal', (await page.locator('.bar-title').textContent()).trim() === '練習（3/3）')
  check('the next item has an enabled field', !(await page.locator('.answer-input').isDisabled()))

  // Third item: miss it and finish the run.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.locator('.answer-input').fill('あ')
    await page.locator('.check-button').click()
    await wait(120)
  }
  await page.locator('.next-button').click()
  await page.waitForSelector('.complete', { timeout: 3000 })
  check(
    'quiz completion shows the congrats copy',
    (await page.locator('.complete-title').textContent()).trim() === '恭喜，你已經做完了練習。',
  )
  check(
    'completion reports the correct count',
    (await page.locator('.score-correct').textContent()).trim() === '正確 1 題',
    (await page.locator('.score-correct').textContent()).trim(),
  )
  check(
    'completion reports the wrong count',
    (await page.locator('.score-wrong').textContent()).trim() === '錯誤 2 題',
    (await page.locator('.score-wrong').textContent()).trim(),
  )
  check(
    'completion draws the percentage bar',
    (await page.locator('.bar-fill').evaluate((el) => el.style.width)) === '33%',
  )
  check('completion lists the missed words', (await page.locator('.miss').count()) === 2)
  const missRows = await page.locator('.miss').evaluateAll((nodes) =>
    nodes.map((node) => node.textContent.replace(/\s/g, '')),
  )
  check(
    'each missed row keeps the asked form and the answer',
    missRows.every((row) => row.includes('字典形')),
    missRows.join(' | '),
  )
  const band = await page.evaluate(() => {
    const emoji = document.querySelector('.complete-emoji')
    const home = document.querySelector('.complete-home')?.getBoundingClientRect() ?? null
    return {
      percent: document.querySelector('.percent')?.textContent.trim() ?? '',
      emoji: emoji ? emoji.textContent.trim().split(/\s+/) : [],
      confetti: document.querySelectorAll('.confetti-piece').length,
      homeHeight: home ? home.height : 0,
    }
  })
  const expectedBand =
    SCORE_BANDS.find((entry) => entry.percent === Math.min(100, Math.floor(parseInt(band.percent, 10) / 10) * 10)) ??
    SCORE_BANDS[0]
  check('quiz completion shows one score emoji', band.emoji.length === 1, band.emoji.join('|'))
  check(
    'the score emoji come from the matching band',
    band.emoji.every((emoji) => expectedBand.emojis.includes(emoji)),
    `${band.percent} -> ${band.emoji.join('|')} vs ${expectedBand.emojis.join('|')}`,
  )
  check('a mixed score gets no confetti', band.confetti === 0, String(band.confetti))
  check(
    'quiz completion offers a 60px 返回主頁',
    Math.round(band.homeHeight) === 60,
    String(band.homeHeight),
  )
  check('completion offers 返回主頁', (await page.locator('.complete-home').count()) === 1)
  await page.locator('.complete-home').click()
  await page.waitForSelector('.home-actions', { timeout: 5000 })

  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '測驗' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await ensureLesson(page, '第5課')
  await page.locator('.picker-start').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  check(
    'quiz settings show 錯 3 題就顯示答案',
    (await page.locator('.row-label', { hasText: '錯 3 題就顯示答案' }).count()) === 1,
  )
  check('the reveal threshold offers 1 to 5', (await page.locator('.choice').count()) === 5)
  await page.locator('.choice', { hasText: /^1$/ }).click()
  check(
    'choosing 1 updates the label',
    (await page.locator('.row-label', { hasText: '錯 1 題就顯示答案' }).count()) === 1,
  )
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  await page.locator('.answer-input').fill('あ')
  await page.locator('.check-button').click()
  await wait(150)
  check('錯 1 題 reveals on the first miss', (await page.locator('.reveal').count()) === 1)
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '測驗' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await ensureLesson(page, '第5課')
  await page.locator('.picker-start').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  check(
    'the chosen threshold survives a reload',
    (await page.locator('.row-label', { hasText: '錯 1 題就顯示答案' }).count()) === 1,
  )
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  check('quiz settings show 自動提交答案', (await page.locator('.row-label', { hasText: '自動提交答案' }).count()) === 1)
  check('auto-submit defaults to on', (await page.locator('.switch').first().getAttribute('aria-checked')) === 'true')
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })

  // A perfect run earns the whole 100% row plus the confetti layer.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '測驗' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  const selectAllLessons = page.locator('.section-head .text-button')
  const selectedLessons = page.locator('.chip-grid .chip--on')
  for (let press = 0; press < 3 && (await selectedLessons.count()) > 0; press += 1) {
    await selectAllLessons.click()
  }
  check('a fresh quiz picker starts with nothing selected', (await selectedLessons.count()) === 0)
  await page.locator('.chip', { hasText: '第5課' }).click()
  await page.locator('.picker-start').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  for (let item = 0; item < 3; item += 1) {
    const prompt = await wordText(page, '.prompt .word')
    const verb = byMasu(prompt)
    check(`perfect run: ${prompt} is a lesson 5 verb`, Boolean(verb), prompt)
    for (const char of Array.from(verb.reading)) {
      await page.locator('.key', { hasText: new RegExp(`^${char}$`) }).click()
      await wait(30)
    }
    await wait(180)
    if ((await page.locator('.next-button').count()) > 0) await page.locator('.next-button').click()
    await wait(200)
  }
  await page.waitForSelector('.complete', { timeout: 5000 })
  const perfect = await page.evaluate(() => {
    const pieces = [...document.querySelectorAll('.confetti-piece')]
    const bar = document.querySelector('.bar-fill')
    return {
      percent: document.querySelector('.percent')?.textContent.trim() ?? '',
      emoji: [...document.querySelectorAll('.complete-emoji')].flatMap((row) => row.textContent.trim().split(/\s+/)),
      confetti: pieces.length,
      visible: pieces.filter((piece) => {
        const rect = piece.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      }).length,
      insidePanel: pieces.every((piece) => document.querySelector('.complete').contains(piece)),
      barWidth: bar ? bar.style.width : null,
      misses: document.querySelectorAll('.miss').length,
    }
  })
  check('three clean answers reach 100%', perfect.percent === '100%', perfect.percent)
  check('100% fills the percentage bar', perfect.barWidth === '100%', String(perfect.barWidth))
  check('100% shows no missed words', perfect.misses === 0, String(perfect.misses))
  check(
    '100% draws one emoji from the top row',
    perfect.emoji.length === 1 && perfect.emoji.every((emoji) => SCORE_BANDS[10].emojis.includes(emoji)),
    perfect.emoji.join('|'),
  )
  check('100% scatters confetti', perfect.confetti >= 12, String(perfect.confetti))
  check('every confetti piece is drawn', perfect.visible === perfect.confetti, `${perfect.visible}/${perfect.confetti}`)
  check('confetti sits inside the completion panel', perfect.insidePanel)
  check(
    'confetti emoji come from the fanfare list',
    await page.evaluate(
      (allowed) =>
        [...document.querySelectorAll('.confetti-piece')].every((piece) =>
          allowed.includes(piece.textContent.trim()),
        ),
      CONFETTI_EMOJI,
    ),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await wait(200)
  const confettiUnderReduce = await page.evaluate(
    () => getComputedStyle(document.querySelector('.confetti') ?? document.body).display,
  )
  check('reduced motion hides the confetti', confettiUnderReduce === 'none', String(confettiUnderReduce))
  await page.emulateMedia({ reducedMotion: null })
  await page.locator('.complete-home').click()
  await page.waitForSelector('.home-actions', { timeout: 5000 })

  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.footer-link').click()
  await page.waitForSelector('.sheet', { timeout: 5000 })
  const href = await page.locator('.sheet-link.sheet-repo').getAttribute('href')
  const target = await page.locator('.sheet-link.sheet-repo').getAttribute('target')
  check(
    'footer sheet links to the repository',
    href === 'https://github.com/manesec-web/game-japanese-katsuyou-basic',
    `href=${href}`,
  )
  check('repository link opens in a new tab', target === '_blank', `target=${target}`)

  if (WANT_SHOTS) {
    await page.screenshot({ path: path.join(SHOT_DIR, 'footer-sheet.png') })
  }

  // R6 full-bleed at ≤550px, framed above it, background dropped when narrow.
  const narrowLayout = await page.evaluate(() => {
    const shell = getComputedStyle(document.querySelector('.app-shell'))
    const columnStyle = getComputedStyle(document.querySelector('.column'))
    const rect = document.querySelector('.column').getBoundingClientRect()
    return {
      shellPaddingLeft: shell.paddingLeft,
      radius: columnStyle.borderRadius,
      shadow: columnStyle.boxShadow,
      width: rect.width,
      viewport: window.innerWidth,
    }
  })
  check('narrow: no outer margins', narrowLayout.shellPaddingLeft === '0px', narrowLayout.shellPaddingLeft)
  check('narrow: no rounded corners', narrowLayout.radius === '0px', narrowLayout.radius)
  check('narrow: no shadow', narrowLayout.shadow === 'none', narrowLayout.shadow)
  check(
    'narrow: column fills the viewport',
    Math.abs(narrowLayout.width - narrowLayout.viewport) <= 1,
    `${narrowLayout.width} vs ${narrowLayout.viewport}`,
  )

  const narrowBackground = await page.evaluate(() => ({
    image: getComputedStyle(document.body).backgroundImage,
    grain: getComputedStyle(document.body, '::after').display,
    animation: getComputedStyle(document.body).animationName,
  }))
  check('narrow: the gradient background is dropped', narrowBackground.image === 'none', narrowBackground.image)
  check('narrow: the grain is dropped', narrowBackground.grain === 'none', narrowBackground.grain)

  // 550 is the last full-bleed width; 551 already shows the framed column.
  await page.setViewportSize({ width: 550, height: 900 })
  const atBoundary = await page.evaluate(() => ({
    width: document.querySelector('.column').getBoundingClientRect().width,
    radius: getComputedStyle(document.querySelector('.column')).borderRadius,
    image: getComputedStyle(document.body).backgroundImage,
  }))
  check('550px is still full-bleed', Math.abs(atBoundary.width - 550) <= 1 && atBoundary.radius === '0px', JSON.stringify(atBoundary))
  check('550px still drops the background', atBoundary.image === 'none')
  await page.setViewportSize({ width: 551, height: 900 })
  const aboveBoundary = await page.evaluate(() => ({
    width: document.querySelector('.column').getBoundingClientRect().width,
    radius: getComputedStyle(document.querySelector('.column')).borderRadius,
    image: getComputedStyle(document.body).backgroundImage,
  }))
  check('551px shows the framed column again', aboveBoundary.radius === '28px' && aboveBoundary.width <= 480.5, JSON.stringify(aboveBoundary))
  check('551px brings the background back', aboveBoundary.image !== 'none')

  await page.setViewportSize({ width: 800, height: 900 })
  const wideLayout = await page.evaluate(() => {
    const shell = getComputedStyle(document.querySelector('.app-shell'))
    const columnStyle = getComputedStyle(document.querySelector('.column'))
    const rect = document.querySelector('.column').getBoundingClientRect()
    return {
      shellPaddingLeft: shell.paddingLeft,
      radius: columnStyle.borderRadius,
      shadow: columnStyle.boxShadow,
      width: rect.width,
    }
  })
  check('wide: keeps side margins', wideLayout.shellPaddingLeft !== '0px', wideLayout.shellPaddingLeft)
  check('wide: keeps the rounded frame', wideLayout.radius === '28px', wideLayout.radius)
  check('wide: keeps the shadow', wideLayout.shadow !== 'none', wideLayout.shadow)
  check('wide: column stays at most 480px', wideLayout.width <= 480.5, String(wideLayout.width))
  await page.setViewportSize({ width: 390, height: 844 })

  // T8 reduced motion: still gradient, direct item change on swipe.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  const bodyAnimation = await page.evaluate(() => getComputedStyle(document.body).animationName)
  check('reduced motion freezes the background gradient', bodyAnimation === 'none', bodyAnimation)
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.text-button', { hasText: '全選' }).first().click()
  if (!(await page.locator('.picker-start').isEnabled())) {
    await page.locator('.text-button', { hasText: '全選' }).first().click()
  }
  await page.locator('.picker-start').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  const beforeSwipe = await readerTitle(page)
  await drag(page, -120)
  const afterSwipe = await readerTitle(page)
  check('reduced motion still changes the item on swipe', afterSwipe !== beforeSwipe, `${beforeSwipe} -> ${afterSwipe}`)
  const pageTransform = await page
    .locator('.reader-page')
    .evaluate((el) => getComputedStyle(el).transform)
  check('reduced motion does not leave the page offset', pageTransform === 'none' || pageTransform === 'matrix(1, 0, 0, 1, 0, 0)', pageTransform)
  // Reduced motion must also work for cards (3 cards in lesson 5).
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  if (!(await page.locator('.chip', { hasText: '第5課' }).getAttribute('class')).includes('chip--on')) {
    await page.locator('.chip', { hasText: '第5課' }).click()
  }
  await page.locator('.picker-start').click()
  await page.waitForSelector('.card-stage', { timeout: 5000 })
  const beforeCard = (await page.locator('.bar-title').textContent()).trim()
  await drag(page, -120, 0, '.card-stage')
  const afterCard = (await page.locator('.bar-title').textContent()).trim()
  check('reduced motion changes cards on swipe', beforeCard !== afterCard, `${beforeCard} -> ${afterCard}`)
  const cardTransform = await page.locator('.card').evaluate((el) => getComputedStyle(el).transform)
  check('reduced motion leaves the card at rest', cardTransform === 'none' || cardTransform === 'matrix(1, 0, 0, 1, 0, 0)', cardTransform)

  const flipDuration = await page
    .locator('.card-inner')
    .evaluate((el) => getComputedStyle(el).transitionDuration)
  await page.locator('.card-stage').click()
  await wait(60)
  check('reduced motion flips instantly', await cardFlipped(page))
  check('reduced motion removes the flip transition', flipDuration === '0s', flipDuration)
  // The last card ends the run on a swipe, not only on the button. Its own page
  // keeps the card run here independent of the walk-through's card section.
  const cardPage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await cardPage.goto(BASE, { waitUntil: 'load' })
  await cardPage.waitForSelector('.home-actions', { timeout: 60000 })

  const startCardRun = async () => {
    await cardPage.locator('.home-actions button', { hasText: '翻卡學習' }).click()
    await cardPage.waitForSelector('.chip-grid', { timeout: 5000 })
    const chip = cardPage.locator('.chip', { hasText: '第5課' })
    if (!((await chip.getAttribute('class')) || '').includes('chip--on')) await chip.click()
    await cardPage.locator('.picker-start').click()
    await cardPage.waitForSelector('.card-stage', { timeout: 5000 })
  }
  const cardTitle = async () => (await cardPage.locator('.bar-title').textContent()).trim()

  await startCardRun()
  check('the swipe finish run starts on the first card', (await cardTitle()) === '練習（1/3）', await cardTitle())

  // The first card has nothing behind it: a right-hand drag pulls the card
  // against the edge at a third of the finger, then the release springs it
  // back. The card never changes.
  const wall = await dragHeld(cardPage, 60)
  const wallX = translateXOf(wall.held)
  check(
    'the first card follows the drag at a third of the finger',
    wallX > 12 && wallX < 30 && wallX < 60 / 2,
    `${wallX}px for a 60px drag`,
  )
  check('the first card springs back to rest', Math.abs(translateXOf(wall.rested)) < 1, wall.rested)

  const wallFar = await dragHeld(cardPage, 180)
  const wallFarX = translateXOf(wallFar.held)
  check(
    'resistance caps the follow at 40px',
    wallFarX > 35 && wallFarX <= 40.5,
    `${wallFarX}px for a 180px drag`,
  )
  check('a long drag also springs back to rest', Math.abs(translateXOf(wallFar.rested)) < 1, wallFar.rested)
  check('swiping right on the first card stays put', (await cardTitle()) === '練習（1/3）', await cardTitle())
  check('a stayed card is not a finished run', (await cardPage.locator('.complete').count()) === 0)

  // A card that is not the last one still just advances.
  await drag(cardPage, -120, 0, '.card-stage')
  check('swiping off the first card reaches the second', (await cardTitle()) === '練習（2/3）', await cardTitle())
  check('the second card does not end the run', (await cardPage.locator('.complete').count()) === 0)

  // Reaching the last card is not the end by itself.
  await drag(cardPage, -120, 0, '.card-stage')
  check('swiping again reaches the last card', (await cardTitle()) === '練習（3/3）', await cardTitle())
  check(
    'reaching the last card does not finish the run by itself',
    (await cardPage.locator('.complete').count()) === 0,
  )
  check(
    'the last card offers 完成',
    (await cardPage.locator('.card-controls .control').nth(1).textContent()).trim() === '完成',
    (await cardPage.locator('.card-controls .control').nth(1).textContent()).trim(),
  )

  // Swiping off the last card is 完成.
  await drag(cardPage, -120, 0, '.card-stage')
  await wait(600)
  check(
    'swiping off the last card finishes the run',
    (await cardPage.locator('.complete').count()) === 1,
    `title ${await cardTitle()}`,
  )
  check('a finished card run hides the card', (await cardPage.locator('.card-stage').count()) === 0)
  check('a finished card run hides the controls', (await cardPage.locator('.card-controls').count()) === 0)
  check(
    'the swipe finish shows the same congrats copy',
    (await cardPage.locator('.complete-title').textContent()).trim() === '恭喜，你已經做完了練習。',
    (await cardPage.locator('.complete-title').textContent()).trim(),
  )
  check('the swipe finish offers 返回主頁', (await cardPage.locator('.complete-home').count()) === 1)
  check(
    'the finished card does not slide the same card back in',
    (await cardPage.locator('.card--enter-next, .card--enter-prev, .card--leave-next, .card--leave-prev').count()) === 0,
  )

  // Reduced motion: no slide to wait for, but the same rule applies.
  await cardPage.emulateMedia({ reducedMotion: 'reduce' })
  await cardPage.locator('.complete-home').click()
  await cardPage.waitForSelector('.home-actions', { timeout: 5000 })
  await startCardRun()
  await drag(cardPage, 120, 0, '.card-stage')
  check('reduced motion leaves the first card still', (await cardTitle()) === '練習（1/3）', await cardTitle())
  check(
    'reduced motion does not move the first card at all',
    translateXOf(await cardPage.locator('.card').evaluate((el) => getComputedStyle(el).transform)) === 0,
  )
  await drag(cardPage, -120, 0, '.card-stage')
  check('reduced motion still advances a card', (await cardTitle()) === '練習（2/3）', await cardTitle())
  await drag(cardPage, -120, 0, '.card-stage')
  check('reduced motion reaches the last card', (await cardTitle()) === '練習（3/3）', await cardTitle())
  await drag(cardPage, -120, 0, '.card-stage')
  await wait(600)
  check(
    'reduced motion finishes on the last card too',
    (await cardPage.locator('.complete').count()) === 1,
    `title ${await cardTitle()}`,
  )
  check(
    'reduced motion does not finish one card early',
    (await cardPage.locator('.complete-title').textContent()).trim() === '恭喜，你已經做完了練習。',
  )
  await cardPage.emulateMedia({ reducedMotion: null })
  await cardPage.close()

  // The page's own scrollbar is hidden and drawn by the app instead. A fresh
  // page keeps this block independent of the rest of the walk-through.
  const barPage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await barPage.goto(BASE, { waitUntil: 'load' })
  await barPage.waitForSelector('.home-actions', { timeout: 60000 })
  check(
    'the browser page scrollbar is hidden',
    (await barPage.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth)) === 'none',
    await barPage.evaluate(() => getComputedStyle(document.documentElement).scrollbarWidth),
  )
  // The window is not a scroll container here, so nothing should be drawn yet.
  check(
    'nothing is drawn on a page that fits',
    (await barPage.locator('.page-scrollbar').count()) === 0,
  )
  // A dropdown list is its own scroll container and keeps the native bar.
  await barPage.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await barPage.waitForSelector('.form-select', { timeout: 5000 })
  await barPage.locator('.form-select').click()
  const listBar = await barPage
    .locator('.form-list')
    .evaluate((el) => getComputedStyle(el).scrollbarWidth)
  check('the form dropdown keeps its native scrollbar', listBar === 'auto', listBar)
  await barPage.locator('.icon-button[aria-label="返回"]').click()
  await barPage.waitForSelector('.home-actions', { timeout: 5000 })

  await barPage.locator('.home-actions button', { hasText: '字典' }).click()
  await barPage.waitForSelector('.chip-grid', { timeout: 5000 })
  await barPage.locator('.text-button', { hasText: '全選' }).first().click()
  await barPage.locator('.picker-start').click()
  await barPage.waitForSelector('.reader-body', { timeout: 5000 })
  await wait(300)

  const barRead = () => barPage.evaluate(() => {
    const el = document.querySelector('.page-scrollbar')
    if (!el) return { present: false }
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    return {
      present: true,
      on: (el.getAttribute('class') || '').includes('page-scrollbar--on'),
      opacity: Number(style.opacity),
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10,
      top: Math.round(rect.top * 10) / 10,
      right: Math.round((window.innerWidth - rect.right) * 10) / 10,
      pointer: style.pointerEvents,
      transition: style.transitionDuration,
    }
  })

  const pageMetrics = await barPage.evaluate(() => ({
    content: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
  }))
  check('the reader page scrolls', pageMetrics.content > pageMetrics.viewport + 1, JSON.stringify(pageMetrics))
  const barAtRest = await barRead()
  check('the thumb is measured but hidden before the page moves', barAtRest.present && !barAtRest.on && barAtRest.opacity === 0, JSON.stringify(barAtRest))
  check('the thumb is 4px wide', barAtRest.width === 4, String(barAtRest.width))
  const wantedHeight = 812 * (pageMetrics.viewport / pageMetrics.content)
  check(
    'the thumb is as long as the share of the page on screen',
    Math.abs(barAtRest.height - wantedHeight) <= 2,
    `${barAtRest.height} vs ${Math.round(wantedHeight * 10) / 10}`,
  )
  check('the thumb hugs the column edge', barAtRest.right === 3, String(barAtRest.right))
  check('the thumb starts one edge inset down', barAtRest.top === 16, String(barAtRest.top))
  check('the thumb never swallows a tap', barAtRest.pointer === 'none', barAtRest.pointer)

  await barPage.evaluate(() => window.scrollTo({ top: 300 }))
  await wait(200)
  const barShown = await barRead()
  check('a scroll reveals the thumb', barShown.on && barShown.opacity === 1, JSON.stringify(barShown))
  check(
    'the thumb follows the page',
    Math.abs(barShown.top - barAtRest.top) > 20 && barShown.top > barAtRest.top,
    `${barAtRest.top} -> ${barShown.top}`,
  )

  await barPage.evaluate(() => window.scrollTo({ top: 1e9 }))
  await wait(200)
  const barBottom = await barRead()
  check(
    'at the bottom the thumb reaches the end of the track',
    Math.abs(barBottom.top + barBottom.height - (pageMetrics.viewport - 16)) <= 2,
    `bottom ${Math.round(barBottom.top + barBottom.height)} vs ${pageMetrics.viewport - 16}`,
  )
  await wait(1300)
  const barFaded = await barRead()
  check('the thumb leaves once the page is still', !barFaded.on && barFaded.opacity === 0, JSON.stringify(barFaded))

  // The drawn thumb sits at the column's right edge, not the window's.
  await barPage.setViewportSize({ width: 900, height: 900 })
  await barPage.evaluate(() => window.scrollTo({ top: 400 }))
  await wait(250)
  const barWide = await barPage.evaluate(() => {
    const el = document.querySelector('.page-scrollbar')
    const column = document.querySelector('.column').getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    return {
      gap: Math.round(column.right - rect.right),
      right: Math.round(window.innerWidth - rect.right),
      on: (el.getAttribute('class') || '').includes('page-scrollbar--on'),
    }
  })
  check(
    'on a wide screen the thumb sits on the column edge',
    barWide.gap === 3 && barWide.right > 100,
    JSON.stringify(barWide),
  )
  check('the wide thumb is still shown after the resize scroll', barWide.on)

  // Reduced motion: the thumb still appears and leaves, it just does not fade.
  await barPage.setViewportSize({ width: 390, height: 844 })
  await barPage.emulateMedia({ reducedMotion: 'reduce' })
  await barPage.evaluate(() => window.scrollTo({ top: 500 }))
  await wait(250)
  const barReduced = await barRead()
  check('reduced motion removes the thumb fade', barReduced.transition === '0s', barReduced.transition)
  check('reduced motion still shows the thumb while moving', barReduced.on, JSON.stringify(barReduced))
  await barPage.emulateMedia({ reducedMotion: null })

  // The thumb is a scroll hint only: it must not cover a footer control.
  const footerTap = await barPage.evaluate(() => {
    const el = document.querySelector('.page-scrollbar')
    el.classList.add('page-scrollbar--on')
    const rect = el.getBoundingClientRect()
    const at = document.elementFromPoint(rect.left + rect.width / 2, rect.top + 4)
    el.classList.remove('page-scrollbar--on')
    return at ? at.className || at.tagName : 'none'
  })
  check('the thumb is not the top element under the finger', footerTap !== 'page-scrollbar', String(footerTap))
  await barPage.close()

  // Zoom lock on every screen, in a phone-shaped context with touch.
  const zoomContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const zoomPage = await zoomContext.newPage()
  const zoomCdp = await zoomContext.newCDPSession(zoomPage)

  // Negative control: the gesture really is live, so a passing check below
  // means the lock works and not that the pinch did nothing at all.
  await zoomPage.goto(UNRESTRICTED_PAGE)
  const freeBefore = (await zoomState(zoomPage)).scale
  await pinchAt(zoomCdp, 195, 300)
  const freeAfter = (await zoomState(zoomPage)).scale
  check(
    'the pinch probe can actually zoom an unrestricted page',
    freeAfter > freeBefore,
    `scale ${freeBefore} -> ${freeAfter}`,
  )

  // The loading screen needs a stall: hold lesson 1 back long enough to pinch.
  await zoomPage.route('**/dict/lesson_1.json', async (route) => {
    await wait(2600)
    await route.continue()
  })
  await zoomPage.goto(BASE, { waitUntil: 'load' })
  await zoomPage.waitForSelector('.progress', { timeout: 10000 })
  const viewportMeta = await zoomPage.evaluate(
    () => document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
  )
  check('the viewport meta locks the scale', /maximum-scale=1/.test(viewportMeta), viewportMeta)
  check('the viewport meta drops user scaling', /user-scalable=no/.test(viewportMeta), viewportMeta)
  const rootTouch = await zoomPage.evaluate(() => getComputedStyle(document.documentElement).touchAction)
  const bodyTouch = await zoomPage.evaluate(() => getComputedStyle(document.body).touchAction)
  check('the page declares touch-action: manipulation', rootTouch === 'manipulation' && bodyTouch === 'manipulation', `${rootTouch} / ${bodyTouch}`)
  await zoomLocked(zoomPage, zoomCdp, 'loading', 195, 360, '.progress')
  await zoomPage.waitForSelector('.home-actions', { timeout: 30000 })
  await zoomPage.unroute('**/dict/lesson_1.json')

  await zoomLocked(zoomPage, zoomCdp, 'home', 195, 40, '.home-actions')

  // A tap has to reach the handler without Chrome's old 300ms wait.
  const tapDelay = await zoomPage.evaluate(() => {
    const button = document.querySelector('.home-actions button')
    window.__tapStart = null
    window.__tapDelay = null
    button.addEventListener('pointerdown', () => {
      window.__tapStart = performance.now()
    })
    button.addEventListener('click', () => {
      window.__tapDelay = performance.now() - window.__tapStart
    })
    return true
  })
  const dictButton = await zoomPage.locator('.home-actions button', { hasText: '字典' }).boundingBox()
  await zoomPage.touchscreen.tap(dictButton.x + dictButton.width / 2, dictButton.y + dictButton.height / 2)
  await zoomPage.waitForSelector('.chip-grid', { timeout: 5000 })
  const tapLatency = await zoomPage.evaluate(() => window.__tapDelay)
  check('a tap is not held back by a 300ms wait', tapLatency !== null && tapLatency < 250, `${Math.round(tapLatency)}ms (${tapDelay})`)

  await zoomLocked(zoomPage, zoomCdp, 'picker', 195, 40, '.chip-grid')
  if (!((await zoomPage.locator('.chip', { hasText: '第5課' }).getAttribute('class')) || '').includes('chip--on')) {
    await zoomPage.locator('.chip', { hasText: '第5課' }).click()
  }
  await zoomPage.locator('.picker-start').click()
  await zoomPage.waitForSelector('.reader-body', { timeout: 5000 })
  await zoomLocked(zoomPage, zoomCdp, 'dictionary', 195, 40, '.reader-body')

  await zoomPage.locator('.icon-button[aria-label="返回"]').click()
  await zoomPage.waitForSelector('.chip-grid', { timeout: 5000 })
  await zoomPage.locator('.icon-button[aria-label="返回"]').click()
  await zoomPage.waitForSelector('.home-actions', { timeout: 5000 })
  await zoomPage.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await zoomPage.waitForSelector('.chip-grid', { timeout: 5000 })
  const cardZoomChip = zoomPage.locator('.chip', { hasText: '第5課' })
  if (!((await cardZoomChip.getAttribute('class')) || '').includes('chip--on')) await cardZoomChip.click()
  await zoomPage.locator('.picker-start').click()
  await zoomPage.waitForSelector('.card-stage', { timeout: 5000 })
  await zoomLocked(zoomPage, zoomCdp, 'cards', 195, 40, '.card-stage')

  await zoomPage.locator('.icon-button[aria-label="返回"]').click()
  await zoomPage.waitForSelector('.chip-grid', { timeout: 5000 })
  await zoomPage.locator('.icon-button[aria-label="返回"]').click()
  await zoomPage.waitForSelector('.home-actions', { timeout: 5000 })
  await zoomPage.locator('.home-actions button', { hasText: '測驗' }).click()
  await zoomPage.waitForSelector('.chip-grid', { timeout: 5000 })
  const quizZoomChip = zoomPage.locator('.chip', { hasText: '第5課' })
  if (!((await quizZoomChip.getAttribute('class')) || '').includes('chip--on')) await quizZoomChip.click()
  await zoomPage.locator('.picker-start').click()
  await zoomPage.waitForSelector('.quiz-body', { timeout: 5000 })
  await zoomLocked(zoomPage, zoomCdp, 'quiz', 195, 40, '.keyboard')

  await zoomPage.locator('.icon-button[aria-label="設定"]').click()
  await zoomPage.waitForSelector('.settings', { timeout: 5000 })
  await zoomLocked(zoomPage, zoomCdp, 'settings', 195, 40, '.settings')
  await zoomContext.close()

} catch (error) {
  failures.push(`error: ${error.message}`)
  if (serverLog) failures.push(`server log:\n${serverLog.slice(-2000)}`)
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}

for (const line of notes) console.log(line)
for (const line of failures) console.log(line)
if (failures.length > 0) process.exitCode = 1
else console.log(`browser check passed (${notes.length} checks)`)

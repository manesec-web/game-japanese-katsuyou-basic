// Motion probe: samples the paging and flip animations frame by frame so the
// motion can be measured instead of guessed. Run against the built site:
//   node scripts/motion-probe.mjs
// Prints, for each case, the position trace, the peak speed, the settle time
// and any direction reversal (a value that moves back past its resting point).
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const PORT = Number(process.env.PORT || 5201)
const SITE_BASE = '/game-japanese-katsuyou-basic/'
const BASE = `http://localhost:${PORT}${SITE_BASE}`
const EXE =
  process.env.CHROMIUM_PATH ||
  '/home/mane/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome'

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

// Samples a CSS value for `ms` from inside the page, one entry per frame.
async function startSampler(page, selector, read) {
  await page.evaluate(
    ([sel, source]) => {
      const el = document.querySelector(sel)
      // eslint-disable-next-line no-new-func
      const fn = new Function('getComputedStyle', 'el', source)
      const style = getComputedStyle
      window.__samples = []
      const t0 = performance.now()
      const loop = () => {
        window.__samples.push([performance.now() - t0, fn(style, el)])
        if (performance.now() - t0 < 900) requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    },
    [selector, read],
  )
}

async function collect(page) {
  return page.evaluate(() => window.__samples)
}

const READ_X = 'return getComputedStyle(el).transform'
// The turn reads back as matrix3d while it is in flight, but a flattened
// 2-D matrix(1, 0, 0, 1, 0, 0) at the start and end of it. Both shapes are
// parsed here; reading a 2-D matrix as if it were 3-D reports a bogus ±90°.
const READ_ANGLE = `const m = getComputedStyle(el).transform
  if (!m || m === 'none') return 0
  const p = m.slice(m.startsWith('matrix3d') ? 9 : 7, -1).split(',').map(Number)
  if (!m.startsWith('matrix3d')) return p[0] < 0 ? 180 : 0
  return Math.atan2(-p[2], p[0]) * 180 / Math.PI`

// Every frame around the sign change: the handover is where a cut shows up.
function printHandover(trace, label) {
  const flip = trace.findIndex(([, v], i) => i > 0 && Math.sign(v) !== Math.sign(trace[i - 1][1]))
  console.log(`\n== ${label}: frames around the handover`)
  if (flip < 0) {
    console.log('   no sign change (single phase)')
    return
  }
  const from = Math.max(0, flip - 6)
  console.log(
    '   ',
    trace
      .slice(from, flip + 7)
      .map(([t, v]) => `${Math.round(t)}ms:${Math.round(v)}`)
      .join(' '),
  )
  // Speed either side of the seam, measured from the last pair of frames where
  // the item was still visible and the first pair after it. A decelerating exit
  // followed by an accelerating entry stops at the edge and then bursts in.
  const width = Math.max(...trace.map(([, v]) => Math.abs(v)))
  const visible = (v) => Math.abs(v) < width - 1
  const speed = (i) => {
    const [t0, v0] = trace[i - 1]
    const [t1, v1] = trace[i]
    return Math.round(Math.abs(v1 - v0) / Math.max(0.001, (t1 - t0) / 1000))
  }
  let beforeAt = -1
  for (let i = 1; i < flip; i += 1) {
    if (visible(trace[i - 1][1]) && visible(trace[i][1])) beforeAt = i
  }
  let afterAt = -1
  for (let i = flip + 1; i < trace.length; i += 1) {
    if (afterAt < 0 && visible(trace[i - 1][1]) && visible(trace[i][1])) afterAt = i
  }
  console.log(
    `   visible width ${Math.round(width)}px; exit speed into the seam ` +
      `${beforeAt > 0 ? speed(beforeAt) : '?'} px/s, entry speed out of it ` +
      `${afterAt > 0 ? speed(afterAt) : '?'} px/s`,
  )
}

function txOf(transform) {
  if (!transform || transform === 'none') return 0
  if (transform.startsWith('matrix3d')) {
    const p = transform.slice(9, -1).split(',').map(Number)
    return p[12]
  }
  const p = transform.slice(7, -1).split(',').map(Number)
  return p[4]
}

function summarise(trace, restAt, label) {
  const first = trace[0]
  const last = trace.at(-1)
  const dt = (trace.at(-1)[0] - first[0]) / 1000
  let peak = 0
  let peakAt = 0
  let reversal = 0
  for (let i = 1; i < trace.length; i += 1) {
    const [t0, v0] = trace[i - 1]
    const [t1, v1] = trace[i]
    const speed = Math.abs(v1 - v0) / Math.max(0.001, (t1 - t0) / 1000)
    if (speed > peak) {
      peak = speed
      peakAt = t1
    }
  }
  // Distance travelled back past the resting point: a real rebound overshoots.
  for (const [, v] of trace) {
    reversal = Math.max(reversal, restAt === 0 ? Math.abs(0 - Math.sign(v) * 0) : 0)
  }
  const settle = trace.find(([, v]) => Math.abs(v - restAt) < 0.5)
  console.log(`\n== ${label}`)
  console.log(
    `   trace  ${trace
      .filter((_, i) => i % 3 === 0)
      .map(([t, v]) => `${Math.round(t)}ms:${Math.round(v)}`)
      .slice(0, 18)
      .join(' ')}`)
  console.log(
    `   peak speed ${Math.round(peak)} px/s at ${Math.round(peakAt)}ms; ` +
      `settle ${settle ? Math.round(settle[0]) + 'ms' : 'not within window'}; ` +
      `end ${Math.round(trace.at(-1)[1])}px`)
  console.log(`   window ${Math.round(dt * 1000)}ms, ${trace.length} frames`)
}

async function dragWith(page, selector, dx, release = true) {
  const box = await page.locator(selector).boundingBox()
  const cy = Math.max(90, Math.min(box.y + Math.min(box.height / 2, 240), 760))
  const cx = box.x + box.width / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx / 2, cy, { steps: 5 })
  await page.mouse.move(cx + dx, cy, { steps: 5 })
  if (release) await page.mouse.up()
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
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 60000 })

  // 1. Double tap on home, where no element declares touch-action.
  const zoomBefore = await page.evaluate(() => ({
    scale: window.visualViewport.scale,
    width: window.innerWidth,
    docWidth: document.documentElement.clientWidth,
  }))
  const homeBox = await page.locator('.home-actions button').first().boundingBox()
  for (let i = 0; i < 2; i += 1) {
    await page.touchscreen.tap(homeBox.x + 40, homeBox.y - 60 + i * 0)
    await wait(80)
  }
  await wait(500)
  const zoomAfter = await page.evaluate(() => ({
    scale: window.visualViewport.scale,
    width: window.innerWidth,
    docWidth: document.documentElement.clientWidth,
  }))
  console.log('\n== double tap (home, no touch-action)')
  console.log(`   before ${JSON.stringify(zoomBefore)}`)
  console.log(`   after  ${JSON.stringify(zoomAfter)}`)

  // 2. Reader: drag 60px (below the 72px threshold) and release.
  await page.evaluate(() => window.scrollTo({ top: 0 }))
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  const chip = page.locator('.chip', { hasText: '第5課' })
  if (!((await chip.getAttribute('class')) || '').includes('chip--on')) await chip.click()
  await page.locator('.picker-start').click()
  await page.waitForSelector('.reader-page', { timeout: 5000 })

  console.log('\n== reader paging row at rest')
  console.log(
    '  ',
    await page.locator('.reader-window').evaluate((el) => {
      const s = getComputedStyle(el)
      return `transition=${s.transitionProperty} ${s.transitionDuration} ${s.transitionTimingFunction}`
    }),
  )

  await dragWith(page, '.reader-body', 60, false)
  await startSampler(page, '.reader-window', READ_X)
  await page.mouse.up()
  await wait(700)
  const below = (await collect(page)).map(([t, v]) => [t, txOf(v)])
  summarise(below, 0, 'reader, 60px drag released below threshold')

  // 3. Reader: drag 120px (past the threshold) and release.
  await wait(400)
  await dragWith(page, '.reader-body', -120, false)
  await startSampler(page, '.reader-window', READ_X)
  await page.mouse.up()
  await wait(900)
  const above = (await collect(page)).map(([t, v]) => [t, txOf(v)])
  console.log('\n== reader, 120px drag released past threshold')
  console.log(
    `   trace  ${above
      .filter((_, i) => i % 3 === 0)
      .slice(0, 22)
      .map(([t, v]) => `${Math.round(t)}ms:${Math.round(v)}`)
      .join(' ')}`)
  const minv = Math.min(...above.map(([, v]) => v))
  const maxv = Math.max(...above.map(([, v]) => v))
  const reapproach = above.filter(([, v]) => v > -20 && v < 0).length
  console.log(`   min ${Math.round(minv)} max ${Math.round(maxv)} frames back near 0 ${reapproach}`)
  printHandover(above, 'reader')
  await wait(400)

  // 4. Card: drag 60px below threshold.
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 60000 })
  await page.locator('.home-actions button', { hasText: '翻卡練習' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  const cardChip = page.locator('.chip', { hasText: '第5課' })
  if (!((await cardChip.getAttribute('class')) || '').includes('chip--on')) await cardChip.click()
  await page.locator('.picker-start').click()
  await page.waitForSelector('.card-stage', { timeout: 8000 })

  console.log('\n== card transitions at rest')
  console.log(
    '  ',
    await page.locator('.card').evaluate((el) => {
      const s = getComputedStyle(el)
      const inner = getComputedStyle(document.querySelector('.card-inner'))
      return `card=${s.transitionDuration} ${s.transitionTimingFunction} inner=${inner.transitionDuration} ${inner.transitionTimingFunction}`
    }),
  )

  await dragWith(page, '.card-stage', 60, false)
  await startSampler(page, '.card-window', READ_X)
  await page.mouse.up()
  await wait(700)
  const cardBelow = (await collect(page)).map(([t, v]) => [t, txOf(v)])
  summarise(cardBelow, 0, 'card, 60px drag released below threshold')

  // Card past the threshold: the same leave-then-enter handover as the reader.
  await wait(400)
  await dragWith(page, '.card-stage', -120, false)
  await startSampler(page, '.card-window', READ_X)
  await page.mouse.up()
  await wait(900)
  const cardAbove = (await collect(page)).map(([t, v]) => [t, txOf(v)])
  console.log('\n== card, 120px drag released past threshold')
  console.log(
    `   trace  ${cardAbove
      .filter((_, i) => i % 3 === 0)
      .slice(0, 22)
      .map(([t, v]) => `${Math.round(t)}ms:${Math.round(v)}`)
      .join(' ')}`)
  console.log(
    `   min ${Math.round(Math.min(...cardAbove.map(([, v]) => v)))} ` +
      `max ${Math.round(Math.max(...cardAbove.map(([, v]) => v)))}`)
  printHandover(cardAbove, 'card')
  await wait(400)

  // 5. Card flip: sample the rotateY angle. A new card opens on its face, so
  // the next card button keeps the flip test independent of the swipe tests.
  await page.locator('.card-controls .control').nth(1).click()
  await wait(600)
  await startSampler(page, '.card-inner', READ_ANGLE)
  await page.locator('.card-stage').click()
  await wait(800)
  const flip = await collect(page)
  const angles = flip.map(([t, v]) => [t, Number(v)])
  console.log('\n== card flip (tap)')
  console.log(
    `   trace  ${angles
      .filter((_, i) => i % 3 === 0)
      .slice(0, 20)
      .map(([t, a]) => `${Math.round(t)}ms:${Math.round(a)}°`)
      .join(' ')}`)
  console.log(`   max ${Math.round(Math.max(...angles.map(([, a]) => a)))}°`)
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
  if (serverLog.includes('error')) console.log(serverLog)
}

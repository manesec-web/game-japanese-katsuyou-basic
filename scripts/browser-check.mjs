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

// Press, drag, sample the paging row's transform while the finger is still
// down, then release and sample again once the release has settled. Used for
// the first-card wall, where the strip must stay completely still.
async function dragHeld(page, dx, selector = '.card-stage') {
  const box = await page.locator(selector).boundingBox()
  const viewport = page.viewportSize()
  const cx = box.x + box.width / 2
  const cy = Math.max(90, Math.min(box.y + Math.min(box.height / 2, 240), viewport.height - 120))
  const transformOf = () =>
    page.locator('.card-window').evaluate((el) => getComputedStyle(el).transform)
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

// A real touch drag, sampled before the finger lifts. The exposed strip must
// hit the expected neighbour's own face: a transform or `visibility: visible`
// assertion alone passes even when a zero-height clip or stacking order keeps
// that neighbour off the screen.
async function dragNeighbour(page, dx, expectedAt, mode = 'card') {
  const reader = mode === 'reader'
  const gesture = reader ? '.reader-body' : '.card-stage'
  const box = await page.locator(gesture).boundingBox()
  const viewport = page.viewportSize()
  const cx = box.x + box.width / 2
  const gestureY = Math.max(90, Math.min(box.y + Math.min(box.height / 2, 240), viewport.height - 120))
  // A dictionary drag can scroll its much shorter finger-start point away.
  // Sample the visible word block, not that stale document-space y coordinate.
  const cy = reader
    ? await page.locator('.reader-page--current .form-block--default .word').evaluate(
        (el) => el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2,
      )
    : gestureY
  const cdp = await page.context().newCDPSession(page)
  const point = (x) => [{ x, y: gestureY, id: 0, radiusX: 12, radiusY: 12, force: 1 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(cx) })
  for (let step = 1; step <= 6; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(cx + (dx * step) / 6),
    })
    await wait(25)
  }
  const state = await page.evaluate(({ at, reader: isReader, direction, y }) => {
    const slotSelector = isReader ? '.reader-page' : '.card-slot'
    const slot = document.querySelector(`${slotSelector}[data-at="${at}"]`)
    const stage = document.querySelector(isReader ? '.reader-body' : '.card-stage')
    const current = document.querySelector(isReader ? '.reader-page--current' : '.card--current .card-face')
    if (!slot || !stage || !current) return { mounted: false }
    const face = isReader ? slot : slot.querySelector('.card-face')
    const rect = face.getBoundingClientRect()
    const currentRect = current.getBoundingClientRect()
    const clip = stage.getBoundingClientRect()
    const left = Math.max(rect.left, clip.left, 0)
    const right = Math.min(rect.right, clip.right, window.innerWidth)
    const hit = right - left > 1
      ? document.elementFromPoint((left + right) / 2, y)
      : null
    const hitSlot = hit?.closest(slotSelector)
    return {
      mounted: true,
      visible: getComputedStyle(slot).visibility === 'visible',
      exposedWidth: Math.round(Math.max(0, right - left)),
      // A full-width item and its neighbour must not meet at the same edge.
      gap: Math.round(direction === 'next' ? rect.left - currentRect.right : currentRect.left - rect.right),
      hit: hitSlot === slot,
      hitAt: hitSlot?.dataset.at ?? null,
      hitTag: hit?.tagName ?? null,
      hitClass: hit?.className ?? null,
      // The clip must span the column's full width while paging, so the item
      // reaches the true edge instead of leaving a side-padding gutter.
      clipFillsViewport: clip.left <= 0.5 && clip.right >= window.innerWidth - 0.5,
      clipLeft: Math.round(clip.left),
      clipRight: Math.round(clip.right),
      point: { x: Math.round((left + right) / 2), y: Math.round(y) },
      sample: {
        neighbour: { left: Math.round(rect.left), top: Math.round(rect.top), right: Math.round(rect.right), bottom: Math.round(rect.bottom) },
        current: { left: Math.round(currentRect.left), top: Math.round(currentRect.top), right: Math.round(currentRect.right), bottom: Math.round(currentRect.bottom) },
        clip: { left: Math.round(clip.left), top: Math.round(clip.top), right: Math.round(clip.right), bottom: Math.round(clip.bottom) },
        scrollY: Math.round(window.scrollY),
      },
    }
  }, { at: expectedAt, reader, direction: dx < 0 ? 'next' : 'prev', y: cy })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await wait(400)
  return state
}

// matrix(a, b, c, d, e, f) or matrix3d(...); translateX is e / m41.
function translateXOf(transform) {
  if (!transform || transform === 'none') return 0
  const values = transform.match(/^matrix(3d)?\((.+)\)$/)
  if (!values) return 0
  const parts = values[2].split(',').map((value) => parseFloat(value))
  return parts.length === 16 ? parts[12] : parts[4]
}

// Swipe, then sample the paging row ~60ms after the finger lifts, while the
// settle move is still running, and again once it has come to rest. Returns
// the mid-settle and rested transforms of the row.
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
  const mid = await page
    .locator('.reader-window')
    .evaluate((el) => getComputedStyle(el).transform)
  await wait(400)
  const rested = await page
    .locator('.reader-window')
    .evaluate((el) => getComputedStyle(el).transform)
  return { mid, rested }
}

async function wordText(page, selector = '.reader-page--current .form-block--default .word') {
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
  const classes = (await page.locator('.card--current').getAttribute('class')) || ''
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
  return page.locator('.card--current .card-inner').evaluate((el) => getComputedStyle(el).transform)
}

// The paging motion must stay flat: a horizontal translation only, no rotation,
// no scale and no fade. `inner` reports which side of the card is showing.
async function cardMotion(page) {
  return page.evaluate(() => {
    const card = document.querySelector('.card--current')
    const inner = document.querySelector('.card--current .card-inner')
    const row = document.querySelector('.card-window')
    if (!card || !inner) return null
    const cardStyle = getComputedStyle(card)
    const classes = card.getAttribute('class') || ''
    return {
      classes,
      flipped: classes.includes('card--flipped'),
      transform: cardStyle.transform,
      // The travel itself lives on the paging row, not on the card: the card
      // carries only its slot offset while the row slides under it.
      row: row ? getComputedStyle(row).transform : 'none',
      opacity: cardStyle.opacity,
      inner: getComputedStyle(inner).transform,
      title: (document.querySelector('.bar-title')?.textContent || '').trim(),
    }
  })
}

// The paging window as the browser sees it: how many slots are mounted, which
// list position each one holds, where the current item actually sits, and
// whether any neighbour is visible inside the container. This is what a passing
// test suite did not check before: the window could be offset off-screen, or
// every slot could hold a copy of the current item, and the old assertions
// would still pass.
async function windowState(page, selectors) {
  return page.evaluate(({ slot, item, current, container }) => {
    const box = document.querySelector(container).getBoundingClientRect()
    const nodes = [...document.querySelectorAll(slot)]
    const items = [...document.querySelectorAll(item)]
    const currentEl = document.querySelector(current)
    const currentRect = currentEl ? currentEl.getBoundingClientRect() : null
    return {
      slots: nodes.length,
      items: items.length,
      currents: document.querySelectorAll(current).length,
      // data-at is the item's list position; an empty slot carries none.
      at: nodes.map((node) => (node.dataset.at === undefined ? null : Number(node.dataset.at))),
      currentLeft: currentRect ? Math.round(currentRect.left - box.left) : null,
      currentWidth: currentRect ? Math.round(currentRect.width) : null,
      containerWidth: Math.round(box.width),
      containerHeight: Math.round(box.height),
      neighboursInside: items.filter((el) => {
        if (el === currentEl) return false
        const rect = el.getBoundingClientRect()
        return rect.right > box.left + 1 && rect.left < box.right - 1
      }).length,
      visibleNeighbours: items.filter((el) => {
        if (el === currentEl) return false
        const style = getComputedStyle(el)
        return style.visibility !== 'hidden' && style.display !== 'none'
      }).length,
      // Slots left in the accessibility tree: only the current one belongs
      // there. A clipped-only neighbour still reads its word out to a screen
      // reader, which is what made the window not invisible.
      accessibleSlots: nodes.filter((node) => node.getAttribute('aria-hidden') !== 'true').length,
      accessibleItems: items.filter(
        (el) => !el.closest('[aria-hidden="true"]') && getComputedStyle(el).visibility !== 'hidden',
      ).length,
      words: items.map((el) => (el.querySelector('.word')?.textContent || '').replace(/\s/g, '')),
    }
  }, selectors)
}

// Stamps every mounted slot with a marker, so a later read can prove that the
// node the browser kept is the same node rather than a rebuilt one.
async function stampSlots(page, slotSelector) {
  return page.evaluate((selector) => {
    const nodes = [...document.querySelectorAll(selector)]
    nodes.forEach((node, index) => {
      node.dataset.uid = `u${index}`
    })
    return nodes.map((node) => ({ at: node.dataset.at ?? null, uid: node.dataset.uid }))
  }, slotSelector)
}

// The same map, read after a page turn. A node that kept its marker was not
// re-created; a node with no marker is one the turn just added.
async function slotMarkers(page, slotSelector) {
  return page.evaluate(
    (selector) =>
      [...document.querySelectorAll(selector)].map((node) => ({
        at: node.dataset.at ?? null,
        uid: node.dataset.uid ?? null,
      })),
    slotSelector,
  )
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

// The top-bar icons come from Lucide and are inlined as SVG at build time:
// every icon button must carry exactly one Lucide glyph and no leftover text
// character (the old ← / ⚙ buttons).
async function iconGlyphs(page, label) {
  const state = await page.evaluate(() =>
    [...document.querySelectorAll('.icon-button')].map((button) => ({
      svg: button.querySelectorAll('svg.lucide').length,
      text: (button.textContent || '').trim(),
    })),
  )
  check(
    `${label}: the top-bar icons are Lucide SVG`,
    state.length > 0 && state.every((b) => b.svg === 1),
    JSON.stringify(state),
  )
  check(
    `${label}: no text glyph is left in the icon buttons`,
    state.every((b) => b.text === ''),
    JSON.stringify(state),
  )
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
      // The node is re-resolved every frame: with an item-keyed paging window,
      // the element that is current changes identity on a turn, and a trace
      // pinned to the old node would follow the outgoing item off the edge.
      const read = () => {
        const el = document.querySelector(sel)
        if (!el) return null
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
        const value = read()
        if (value !== null) window.__trace.push([performance.now() - t0, value])
        if (performance.now() - t0 < 700) requestAnimationFrame(loop)
      }
      requestAnimationFrame(loop)
    },
    [selector, kind],
  )
}

// Drags, samples the paging row's transform while the finger is still down,
// releases, and traces the settle move frame by frame until it rests. Returns
// the held transform, the row width and the release-to-rest trace.
async function dragSettle(page, dx, gestureSelector, rowSelector) {
  const box = await page.locator(gestureSelector).boundingBox()
  const viewport = page.viewportSize()
  const cx = box.x + box.width / 2
  const cy = Math.max(90, Math.min(box.y + Math.min(box.height / 2, 240), viewport.height - 120))
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx / 2, cy, { steps: 5 })
  await page.mouse.move(cx + dx, cy, { steps: 5 })
  await wait(40)
  const held = translateXOf(
    await page.locator(rowSelector).evaluate((el) => getComputedStyle(el).transform),
  )
  // The settle pitch is one item width plus the gap. The item width is the
  // paging row's own width, not the now full-bleed gesture surface.
  const rowWidth = await page.locator(rowSelector).evaluate((el) => el.clientWidth)
  await startTrace(page, rowSelector)
  await page.mouse.up()
  await wait(700)
  return {
    held,
    width: rowWidth,
    trace: await page.evaluate(() => window.__trace),
  }
}

// The paging motion after the finger-tracking drag: the strip translates with
// the finger 1:1 while held, the release either finishes the page as one
// decelerating move to rest or settles the strip back where it started. The
// verdict: the settle is a single monotonic run to rest on the side the move
// travels to, and nothing at all moves once it has settled.
function settleVerdict(trace, { held, side, limit = 260 }) {
  const values = trace.map(([, value]) => value)
  const moved = Math.max(0, ...values.map((value) => Math.abs(value - held)))
  const start = values.findIndex((value) => Math.abs(value - held) > 2)
  const settle = start < 0 ? [] : values.slice(start)
  let backwards = 0
  let wrongSide = 0
  for (let i = 0; i < settle.length; i += 1) {
    if (settle[i] * side < -1) wrongSide += 1
    if (i > 0 && Math.abs(settle[i]) - Math.abs(settle[i - 1]) > 2) backwards += 1
  }
  const restAt = settle.findIndex((value) => Math.abs(value) <= 1.5)
  const afterRest = restAt < 0 ? 0 : settle.slice(restAt + 1).filter((value) => Math.abs(value) > 1.5).length
  const settled = settle.findIndex((value) => Math.abs(value) <= 0.5)
  const settleMs = start < 0 || settled < 0 ? null : Math.round(trace[start + settled][0] - trace[start][0])
  return {
    moved: Math.round(moved * 10) / 10,
    from: start < 0 ? null : Math.round(settle[0]),
    backwards,
    wrongSide,
    afterRest,
    settleMs,
    limit,
    end: Math.round(trace.at(-1)[1] * 10) / 10,
    frames: trace.length,
  }
}

// The checks every settle has to pass now: one monotonic move to rest on the
// right side, and nothing moving after it has settled.
function checkSettle(label, verdict) {
  check(
    `${label}: the settle runs once, on its own side, without reversing`,
    verdict.wrongSide === 0 && verdict.backwards === 0,
    JSON.stringify(verdict),
  )
  check(`${label}: nothing moves after the settle`, verdict.afterRest === 0, JSON.stringify(verdict))
  check(
    `${label}: the settle finishes within ${verdict.limit}ms`,
    verdict.settleMs !== null && verdict.settleMs <= verdict.limit && Math.abs(verdict.end) <= 0.5,
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
  const issueHref = await failPage.locator('.sheet-issue').getAttribute('href')
  check(
    'the issue link points at the issue list, not at a new-issue form',
    issueHref === 'https://github.com/manesec-web/game-japanese-katsuyou-basic/issues/',
    String(issueHref),
  )
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
  await iconGlyphs(page, 'picker')
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
  await iconGlyphs(page, 'dictionary')
  check('reader title counts items', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))
  check('reader lists all 15 forms', (await page.locator('.reader-page--current .form-block').count()) === 15, String(await page.locator('.reader-page--current .form-block').count()))
  check('every form has three sentence pairs', (await page.locator('.reader-page--current .form-block .sentence').count()) === 45)
  check('exactly one form block is the default', (await page.locator('.reader-page--current .form-block--default').count()) === 1)
  check(
    'default form starts as ます形',
    (await page.locator('.reader-page--current .form-block--default .form-name').textContent()).trim() === 'ます形',
    (await page.locator('.reader-page--current .form-block--default .form-name').textContent()).trim(),
  )
  check('every block names its form', (await page.locator('.reader-page--current .form-name').count()) === 15)
  const blockFormat = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('.reader-page--current .form-block')]
    return {
      backgrounds: [...new Set(blocks.map((b) => getComputedStyle(b).backgroundColor))],
      radii: [...new Set(blocks.map((b) => getComputedStyle(b).borderTopLeftRadius))],
      pads: [...new Set(blocks.map((b) => `${getComputedStyle(b).paddingLeft}|${getComputedStyle(b).paddingRight}`))],
      margins: [...new Set(blocks.map((b) => `${getComputedStyle(b).marginLeft}|${getComputedStyle(b).marginRight}`))],
      tags: document.querySelectorAll('.reader-page--current .tag').length,
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
    const block = document.querySelector('.reader-page--current .form-block')
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

  const formOrder = await page.locator('.reader-page--current .form-block').evaluateAll((nodes) =>
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
    (await page.locator('.reader-page--current .form-block').last().getAttribute('data-form')) === 'causative-form' &&
      (await page.locator('.reader-page--current .form-block').last().locator('.form-name').count()) === 1,
  )
  check('reader shows the default-form word', (await wordText(page)) === '行きます', await wordText(page))
  check('reader shows furigana by default', (await page.locator('.reader-page--current rt').count()) > 0)
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

  // A drag below the threshold follows the finger and settles back: the word
  // never changes, and the strip rests where it started. The drag runs on the
  // open side of the first word — a backward drag there is the wall below.
  const shortDrag = await dragSettle(page, -55, '.reader-body', '.reader-window')
  check('a 55px drag follows the finger', Math.abs(shortDrag.held + 55) < 3, String(shortDrag.held))
  const shortVerdict = settleVerdict(shortDrag.trace, { held: shortDrag.held, side: -1 })
  check(
    'a 55px drag settles back without reversing',
    shortVerdict.backwards === 0 && shortVerdict.wrongSide === 0,
    JSON.stringify(shortVerdict),
  )
  check('a 55px drag settles back to rest', Math.abs(shortVerdict.end) <= 0.5, JSON.stringify(shortVerdict))
  check('a 55px drag keeps the word', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))

  // Right-to-left advances: the strip follows the finger, then finishes the
  // page in one decelerating move and swaps the word under it.
  const forward = await dragSampled(page, -120)
  check('a right-to-left swipe advances', (await readerTitle(page)) === '學習（2/3）', await readerTitle(page))
  check(
    'the settle is still running 60ms after release',
    translateXOf(forward.mid) > 0.5 && translateXOf(forward.mid) < 400,
    forward.mid,
  )
  check(
    'the settle move is flat, not a 3D matrix',
    !forward.mid.includes('matrix3d') && forward.mid !== 'none',
    forward.mid,
  )
  // translateX only: the x value carries the move and the y value stays zero.
  const turnSlide = /matrix\(1, 0, 0, 1, ([^,]+), ([^)]+)\)/.exec(forward.mid)
  check(
    'the strip moves only along x',
    turnSlide !== null && Math.abs(Number(turnSlide[2])) < 1e-6,
    forward.mid,
  )
  check('the settle comes to rest', Math.abs(translateXOf(forward.rested)) <= 0.5, forward.rested)
  check(
    'the moving page does not fade',
    (await page.locator('.reader-page--current').evaluate((el) => getComputedStyle(el).opacity)) === '1',
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
  check('the settle returns from the left', translateXOf(backward.mid) < -0.5, backward.mid)

  const readerNextNeighbour = await dragNeighbour(page, -120, 1, 'reader')
  check(
    'a leftward dictionary drag reveals the next word with a 24px gap',
    readerNextNeighbour.visible && readerNextNeighbour.hit && readerNextNeighbour.gap === 24 &&
      readerNextNeighbour.clipFillsViewport,
    JSON.stringify(readerNextNeighbour),
  )
  check('the revealed dictionary neighbour becomes current', (await readerTitle(page)) === '學習（2/3）', await readerTitle(page))
  const readerPrevNeighbour = await dragNeighbour(page, 120, 0, 'reader')
  check(
    'a rightward dictionary drag reveals the previous word with a 24px gap',
    readerPrevNeighbour.visible && readerPrevNeighbour.hit && readerPrevNeighbour.gap === 24 &&
      readerPrevNeighbour.clipFillsViewport,
    JSON.stringify(readerPrevNeighbour),
  )
  check('the previous dictionary neighbour becomes current', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))

  // The turn judged as a curve: the strip follows the finger while held, then
  // settles once into the next word and never moves again.
  const readerTurn = await dragSettle(page, -120, '.reader-body', '.reader-window')
  check('the strip follows the finger while held', Math.abs(readerTurn.held + 120) < 3, String(readerTurn.held))
  const turnVerdict = settleVerdict(readerTurn.trace, { held: readerTurn.held, side: 1 })
  check('the traced swipe advances', (await readerTitle(page)) === '學習（2/3）', await readerTitle(page))
  check(
    'the settle continues where the finger left the strip',
    turnVerdict.from !== null && Math.abs(turnVerdict.from - (readerTurn.width + 24 - 120)) < 30,
    JSON.stringify(turnVerdict),
  )
  checkSettle('dictionary page turn', turnVerdict)

  // The first and the last word have nothing beyond them: a drag towards the
  // edge they sit on is completely still and never changes the word.
  await drag(page, 120)
  check('a back swipe returns to the first word', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))
  const firstWall = await dragSettle(page, 120, '.reader-body', '.reader-window')
  const firstVerdict = settleVerdict(firstWall.trace, { held: firstWall.held, side: 1 })
  check('the first word never follows a backward drag', Math.abs(firstWall.held) < 1, String(firstWall.held))
  check('the first word never moves backward', firstVerdict.moved <= 1.5, JSON.stringify(firstVerdict))
  check('a stayed first word keeps its place', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))
  await drag(page, -120)
  await drag(page, -120)
  check('two forward swipes reach the last word', (await readerTitle(page)) === '學習（3/3）', await readerTitle(page))
  const lastWall = await dragSettle(page, -120, '.reader-body', '.reader-window')
  const lastVerdict = settleVerdict(lastWall.trace, { held: lastWall.held, side: -1 })
  check('the last word never follows a forward drag', Math.abs(lastWall.held) < 1, String(lastWall.held))
  check('the last word never moves forward', lastVerdict.moved <= 1.5, JSON.stringify(lastVerdict))
  check('a stayed last word keeps its place', (await readerTitle(page)) === '學習（3/3）', await readerTitle(page))
  await drag(page, 120)
  await drag(page, 120)
  check('two back swipes return to the first word', (await readerTitle(page)) === '學習（1/3）', await readerTitle(page))

  // Above 550px the reader keeps text selectable and pages only by button.
  await page.setViewportSize({ width: 900, height: 900 })
  const wideBefore = await readerTitle(page)
  await drag(page, 120)
  check('a drag does not page the wide reader', (await readerTitle(page)) === wideBefore, await readerTitle(page))
  const selectedText = await page.evaluate(() => {
    const word = document.querySelector('.reader-page--current .form-block--default .word')
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
  // The control runs the same direct swap plus one short slide as a swipe, so
  // the word arrives a beat later.
  await wait(460)
  check('next control advances', (await readerTitle(page)) === '學習（2/3）', await readerTitle(page))
  const wordBeforeForm = await wordText(page)

  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  await iconGlyphs(page, 'settings')
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
  check('reading switch hides ruby', (await page.locator('.reader-page--current rt').count()) === 0)

  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.picker-start').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  check('default form persisted after reload', (await wordText(page)) === '行って', await wordText(page))
  check('reading-off setting persisted', (await page.locator('.reader-page--current rt').count()) === 0)

  // Dictionary layout and the note layer: the word, the gloss and the tag row
  // sit centred in the block; the note and the example sentences keep the
  // reading edge. The form's note rides above the sentences in its own
  // colour, and a form flagged error_usage has its word struck through twice
  // with the colour left alone.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  for (const chip of await page.locator('.chip-grid .chip').all()) {
    const label = (await chip.textContent()).trim()
    const on = ((await chip.getAttribute('class')) || '').includes('chip--on')
    const want = label === '第10課' || label === '第11課'
    if (on !== want) await chip.click()
  }
  await page.locator('.picker-start').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })

  const layout = await page.evaluate(() => {
    const block = document.querySelector('.reader-page--current .form-block--default')
    const style = (selector) => getComputedStyle(block.querySelector(selector))
    return {
      word: style('.word').textAlign,
      gloss: style('.gloss').textAlign,
      tags: style('.tags').justifyContent,
      sentence: style('.sentence-ja').textAlign,
    }
  })
  check('the word is centred in its block', layout.word === 'center', layout.word)
  check('the gloss is centred in its block', layout.gloss === 'center', layout.gloss)
  check('the tag row is centred in its block', layout.tags === 'center', layout.tags)
  check('the example sentences keep the reading edge', layout.sentence !== 'center', layout.sentence)

  let noteSeen = null
  let errorSeen = null
  for (let step = 0; step < 5; step += 1) {
    const found = await page.evaluate(() => {
      const result = {}
      for (const block of document.querySelectorAll('.reader-page--current .form-block')) {
        const note = block.querySelector('.note-line')
        const sentences = block.querySelector('.block')
        if (note && sentences && !result.note) {
          result.note = {
            text: note.textContent.trim().slice(0, 24),
            color: getComputedStyle(note).color,
            align: getComputedStyle(note).textAlign,
            beforeSentences: Boolean(
              note.compareDocumentPosition(sentences) & Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          }
        }
        const struck = block.querySelector('.word--error')
        if (struck && !result.error) {
          const style = getComputedStyle(struck)
          result.error = {
            text: struck.textContent.trim(),
            line: style.textDecorationLine,
            style: style.textDecorationStyle,
            color: style.color,
            hasNote: Boolean(block.querySelector('.note-line')),
            hasSentences: Boolean(block.querySelector('.block')),
          }
        }
      }
      return result
    })
    if (found.note && !noteSeen) noteSeen = found.note
    if (found.error && !errorSeen) errorSeen = found.error
    if (noteSeen && errorSeen) break
    if (step < 4) {
      await page.locator('.controls-button').nth(1).click()
      await wait(460)
    }
  }
  check('a form note rides above the example sentences', noteSeen?.beforeSentences === true, JSON.stringify(noteSeen))
  check('the note is marked with its own colour', noteSeen?.color === 'rgb(180, 83, 9)', noteSeen?.color ?? 'none')
  check('the note keeps the reading edge', noteSeen?.align !== 'center', noteSeen?.align ?? 'none')
  check('an error_usage form is found in the reader', errorSeen !== null, JSON.stringify(errorSeen))
  check(
    'the error word is struck through twice',
    errorSeen?.line === 'line-through' && errorSeen?.style === 'double',
    JSON.stringify(errorSeen),
  )
  check('the error word keeps its colour', errorSeen?.color === 'rgb(36, 33, 58)', errorSeen?.color ?? 'none')
  check('the error form carries its note', errorSeen?.hasNote === true, JSON.stringify(errorSeen))
  check('the error form has no example sentences', errorSeen?.hasSentences === false, JSON.stringify(errorSeen))

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
  await iconGlyphs(page, 'cards')
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
  const faceWord = await wordText(page, '.card--current .card-face .word')
  const cardVerb = byMasu(faceWord)
  check('card face shows a source form from the lesson', Boolean(cardVerb), faceWord)
  check('card face names the target', (await page.locator('.card--current .card-face .prompt').textContent()).trim() === '變成字典形')
  check('card face shows the verb-class tag', (await page.locator('.card--current .card-face .tag--group').count()) === 1)

  check('both faces exist for the 3D flip', (await page.locator('.card--current .card-side').count()) === 2)
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
  await startTrace(page, '.card--current .card-inner', 'angle')
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
  const flipTurnMs = await page.locator('.card--current .card-inner').evaluate((el) => getComputedStyle(el).transitionDuration)
  check('the flip is a single short turn', parseFloat(flipTurnMs) * 1000 <= 260, flipTurnMs)
  await wait(200)
  check(
    'the answer carries the asked form as a tag',
    (await page.locator('.card--current .card-back .tag--form').textContent()).trim() === '字典形',
    (await page.locator('.card--current .card-back .tag--form').textContent()).trim(),
  )
  check(
    'a tap reveals the matching target form',
    (await wordText(page, '.card--current .card-back .word')) === cardVerb.dict,
    await wordText(page, '.card--current .card-back .word'),
  )
  check(
    'the back shows the gloss',
    (await page.locator('.card--current .card-back .gloss').textContent()).includes(cardVerb.gloss.split(';')[0].trim()),
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

  // The same curve check as the reader, on the card: the strip follows the
  // finger while held and settles once, and nothing moves after it.
  const cardStill = await dragSettle(page, -55, '.card-stage', '.card-window')
  const cardStillVerdict = settleVerdict(cardStill.trace, { held: cardStill.held, side: -1 })
  check('a 55px card drag follows the finger', Math.abs(cardStill.held + 55) < 3, String(cardStill.held))
  check(
    'a 55px card drag settles back without reversing',
    cardStillVerdict.backwards === 0 && cardStillVerdict.wrongSide === 0,
    JSON.stringify(cardStillVerdict),
  )
  check('a 55px card drag keeps the card', (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）')
  const cardTurn = await dragSettle(page, -120, '.card-stage', '.card-window')
  const cardTurnVerdict = settleVerdict(cardTurn.trace, { held: cardTurn.held, side: 1 })
  check('the card strip follows the finger while held', Math.abs(cardTurn.held + 120) < 3, String(cardTurn.held))
  check('the traced card swipe advances', (await page.locator('.bar-title').textContent()).trim() === '練習（2/3）')
  check(
    'the card settle continues where the finger left the strip',
    cardTurnVerdict.from !== null && Math.abs(cardTurnVerdict.from - (cardTurn.width + 24 - 120)) < 30,
    JSON.stringify(cardTurnVerdict),
  )
  checkSettle('card turn', cardTurnVerdict)
  await drag(page, 120, 0, '.card-stage')
  check('the traced card swipe came back', (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）')

  // 下一張 / 上一張 run the same settle move as a swipe: the strip carries the
  // old card out and the new one in from the edge.
  await page.locator('.card-controls .control').nth(1).click()
  await wait(70)
  const nextMid = await page.locator('.card-window').evaluate((el) => getComputedStyle(el).transform)
  check('下一張 slides the strip through', translateXOf(nextMid) > 0.5 && translateXOf(nextMid) < 400, nextMid)
  const enteringOverflow = await horizontalOverflow(page)
  check(
    'the sliding card widens no scroll while it travels',
    enteringOverflow.scroll <= enteringOverflow.inner,
    JSON.stringify(enteringOverflow),
  )
  await wait(300)
  check('下一張 reaches the next card', (await page.locator('.bar-title').textContent()).trim() === '練習（2/3）')

  await page.locator('.card-controls .control').nth(0).click()
  await wait(70)
  const backMid = await page.locator('.card-window').evaluate((el) => getComputedStyle(el).transform)
  check('上一張 slides in from the other side', translateXOf(backMid) < -0.5, backMid)
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

  // Paging away from a flipped card is the case the report named: the swap is
  // direct — the flipped card is gone at once — and the incoming card arrives
  // already on its face, never rotating into it while it travels, flat and
  // without fading.
  await page.locator('.card-stage').click()
  await wait(400)
  check('the card about to page away is flipped', await cardFlipped(page))
  await page.locator('.card-controls .control').nth(1).click()
  await wait(50)
  const leaveEarly = await cardMotion(page)
  await wait(60)
  const leaveLate = await cardMotion(page)
  check(
    'the incoming card arrives on its face and stays there',
    !leaveEarly.flipped && !leaveLate.flipped,
    leaveEarly.classes,
  )
  check(
    'the incoming card never turns while it travels',
    isTurnedOff(leaveEarly.inner) && leaveEarly.inner === leaveLate.inner,
    `${leaveEarly.inner} -> ${leaveLate.inner}`,
  )
  check(
    'the incoming card travels flat',
    isFlatTranslate(leaveEarly.row) && isFlatTranslate(leaveLate.row),
    `${leaveEarly.row} | ${leaveLate.row}`,
  )
  check(
    'the incoming card does not fade',
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
    isFlatTranslate(enterNext.row) && enterNext.opacity === '1',
    `${enterNext.row} | ${enterNext.opacity}`,
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
    'the incoming previous card arrives on its face and stays there',
    !backEarly.flipped && !backLate.flipped,
    backEarly.classes,
  )
  check(
    'the card going back never turns while it travels',
    isTurnedOff(backEarly.inner) && backEarly.inner === backLate.inner,
    `${backEarly.inner} -> ${backLate.inner}`,
  )
  check(
    'the card going back travels flat without fading',
    isFlatTranslate(backEarly.row) &&
      isFlatTranslate(backLate.row) &&
      backEarly.opacity === '1' &&
      backLate.opacity === '1',
    `${backEarly.row} | ${backLate.row} | ${backEarly.opacity} | ${backLate.opacity}`,
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
    isFlatTranslate(enterPrev.row) && enterPrev.opacity === '1',
    `${enterPrev.row} | ${enterPrev.opacity}`,
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
    (await page.locator('.card--current .card-face .tag--group').count()) === 0,
  )
  // The answer side keeps both pills: the asked form, then the verb class —
  // even though the class switch is off and hides the face's class pill.
  const answerFaceWord = await wordText(page, '.card--current .card-face .word')
  const answerVerb = byMasu(answerFaceWord)
  check('the answer check has a lesson 5 verb on the face', Boolean(answerVerb), answerFaceWord)
  await page.locator('.card-stage').click()
  await wait(400)
  const answerPills = await page.evaluate(() => {
    const back = document.querySelector('.card--current .card-back')
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
  check(
    'the completion emoji is drawn large',
    parseFloat(practiceFigure?.fontSize ?? 0) >= 56,
    String(practiceFigure?.fontSize),
  )
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
  await iconGlyphs(page, 'quiz')
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
      emojiSize: emoji ? getComputedStyle(emoji).fontSize : '0px',
      confetti: document.querySelectorAll('.confetti-piece').length,
      homeHeight: home ? home.height : 0,
    }
  })
  const expectedBand =
    SCORE_BANDS.find((entry) => entry.percent === Math.min(100, Math.floor(parseInt(band.percent, 10) / 10) * 10)) ??
    SCORE_BANDS[0]
  check('quiz completion shows one score emoji', band.emoji.length === 1, band.emoji.join('|'))
  check(
    'the quiz completion emoji is drawn large too',
    parseFloat(band.emojiSize) >= 56,
    band.emojiSize,
  )
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
  const homeIssueHref = await page.locator('.sheet-link.sheet-issue').getAttribute('href')
  check(
    'the home sheet issue link points at the issue list too',
    homeIssueHref === 'https://github.com/manesec-web/game-japanese-katsuyou-basic/issues/',
    String(homeIssueHref),
  )

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
    .locator('.reader-window')
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
  const cardTransform = await page.locator('.card-window').evaluate((el) => getComputedStyle(el).transform)
  check('reduced motion leaves the card at rest', cardTransform === 'none' || cardTransform === 'matrix(1, 0, 0, 1, 0, 0)', cardTransform)

  const flipDuration = await page
    .locator('.card--current .card-inner')
    .evaluate((el) => getComputedStyle(el).transitionDuration)
  await page.locator('.card-stage').click()
  await wait(60)
  check('reduced motion flips instantly', await cardFlipped(page))
  check('reduced motion removes the flip transition', flipDuration === '0s', flipDuration)
  // The last card ends the run on a swipe, not only on the button. Its own
  // touch-capable phone context keeps the card run independent and exercises
  // the same pointer path as a finger, not only a desktop mouse.
  const cardTouchContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const cardPage = await cardTouchContext.newPage()
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

  // Regression: the row used to follow the finger while its zero-height clip
  // and raised current slot kept every neighbour invisible. Measure the actual
  // exposed face in both directions before release, not just the row transform.
  const nextNeighbour = await dragNeighbour(cardPage, -120, 1)
  check(
    'a leftward touch drag reveals the next card in the exposed edge',
    nextNeighbour.mounted && nextNeighbour.visible && nextNeighbour.exposedWidth > 75 &&
      nextNeighbour.hit && nextNeighbour.gap === 24 && nextNeighbour.clipFillsViewport,
    JSON.stringify(nextNeighbour),
  )
  check('the revealed next card becomes current on release', (await cardTitle()) === '練習（2/3）', await cardTitle())
  check('the touch-paged card opens on its face', !(await cardFlipped(cardPage)))

  const previousNeighbour = await dragNeighbour(cardPage, 120, 0)
  check(
    'a rightward touch drag reveals the previous card in the exposed edge',
    previousNeighbour.mounted && previousNeighbour.visible && previousNeighbour.exposedWidth > 75 &&
      previousNeighbour.hit && previousNeighbour.gap === 24 && previousNeighbour.clipFillsViewport,
    JSON.stringify(previousNeighbour),
  )
  check('the revealed previous card becomes current on release', (await cardTitle()) === '練習（1/3）', await cardTitle())

  const shortNeighbour = await dragNeighbour(cardPage, -55, 1)
  check(
    'a short drag also reveals the next card while held',
    shortNeighbour.mounted && shortNeighbour.visible && shortNeighbour.exposedWidth > 25 &&
      shortNeighbour.hit && shortNeighbour.gap === 24 && shortNeighbour.clipFillsViewport,
    JSON.stringify(shortNeighbour),
  )
  check('a short touch drag settles back to the same card', (await cardTitle()) === '練習（1/3）', await cardTitle())
  const shortRest = await cardPage.locator('.card-window').evaluate((el) => getComputedStyle(el).transform)
  check('a short touch drag leaves no residual offset', Math.abs(translateXOf(shortRest)) < 1, shortRest)

  // The first card has nothing behind it: a right-hand drag is completely
  // still — the card never follows the finger, so nothing springs back. The
  // card never changes.
  const wall = await dragHeld(cardPage, 60)
  check('the first card does not follow the drag', Math.abs(translateXOf(wall.held)) < 1, wall.held)
  check('the first card is at rest after the drag', Math.abs(translateXOf(wall.rested)) < 1, wall.rested)

  const wallFar = await dragHeld(cardPage, 180)
  check('a long drag does not move the first card either', Math.abs(translateXOf(wallFar.held)) < 1, wallFar.held)
  check('a long drag leaves the first card at rest', Math.abs(translateXOf(wallFar.rested)) < 1, wallFar.rested)
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
    'the finished card does not slide another card in',
    (await cardPage.locator('.card-window').count()) === 0,
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
    translateXOf(await cardPage.locator('.card-window').evaluate((el) => getComputedStyle(el).transform)) === 0,
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
  await cardTouchContext.close()

  // The paging window itself: 5 words mounted in the dictionary, 9 cards in
  // 翻卡學習, the current item in the 3rd slot and on screen, and a turn that
  // really does delete the front node and add one at the back. 第4課 has 6
  // words and 第6課 has 11 verbs, so both lists are longer than their window
  // and the front slot has to leave.
  const windowPage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await windowPage.goto(BASE, { waitUntil: 'load' })
  await windowPage.waitForSelector('.home-actions', { timeout: 60000 })

  const readerSelectors = {
    slot: '.reader-page',
    item: '.reader-page',
    current: '.reader-page--current',
    container: '.reader-window',
  }
  const cardSelectors = {
    slot: '.card-slot',
    item: '.card',
    current: '.card--current',
    container: '.card-window',
  }

  // Dictionary reader, 第4課: six words, a five-slot window.
  await windowPage.locator('.home-actions button', { hasText: '字典' }).click()
  await windowPage.waitForSelector('.chip-grid', { timeout: 5000 })
  await windowPage.locator('.chip', { hasText: '第4課' }).click()
  await windowPage.locator('.picker-start').click()
  await windowPage.waitForSelector('.reader-body', { timeout: 5000 })

  const readerWindow = await windowState(windowPage, readerSelectors)
  check('the reader mounts five pages', readerWindow.slots === 5, JSON.stringify(readerWindow.slots))
  check('the reader shows one current page', readerWindow.currents === 1, String(readerWindow.currents))
  check(
    'the reader current page sits in the 3rd slot',
    readerWindow.currentLeft === 0 && readerWindow.currentWidth === readerWindow.containerWidth,
    JSON.stringify(readerWindow),
  )
  check(
    'the reader window puts the current page in the 3rd slot with two behind it',
    JSON.stringify(readerWindow.at) === '[null,null,0,1,2]',
    JSON.stringify(readerWindow.at),
  )
  check('no reader neighbour shows inside the window', readerWindow.neighboursInside === 0, String(readerWindow.neighboursInside))
  check('the reader hides its neighbours', readerWindow.visibleNeighbours === 0, String(readerWindow.visibleNeighbours))
  check(
    'only the current reader page is in the accessibility tree',
    readerWindow.accessibleSlots === 1 && readerWindow.accessibleItems === 1,
    JSON.stringify({ slots: readerWindow.accessibleSlots, items: readerWindow.accessibleItems }),
  )
  check(
    'every mounted reader page holds its own word',
    new Set(readerWindow.words.filter(Boolean)).size === readerWindow.words.filter(Boolean).length,
    readerWindow.words.join(' | '),
  )

  // Two turns put the front page in the window's front slot; the third has to
  // drop it and add the next word at the back.
  await drag(windowPage, -120)
  await drag(windowPage, -120)
  const beforeShift = await stampSlots(windowPage, readerSelectors.slot)
  const readerShifted = await windowState(windowPage, readerSelectors)
  check(
    'the window slides forward one slot per turn',
    JSON.stringify(readerShifted.at) === '[0,1,2,3,4]',
    JSON.stringify(readerShifted.at),
  )
  check(
    'the 3rd slot still holds the current word after two turns',
    readerShifted.currentLeft === 0 && readerShifted.at[2] === 2,
    JSON.stringify({ left: readerShifted.currentLeft, at: readerShifted.at }),
  )
  await drag(windowPage, -120)
  const afterShift = await slotMarkers(windowPage, readerSelectors.slot)
  const readerTurned = await windowState(windowPage, readerSelectors)
  check(
    'the window keeps its 3rd slot after a turn',
    JSON.stringify(readerTurned.at) === '[1,2,3,4,5]' && readerTurned.currentLeft === 0,
    JSON.stringify({ at: readerTurned.at, left: readerTurned.currentLeft }),
  )
  // The item that sat in the front slot (list position 0) is gone; the item
  // that was last is still mounted, as the same DOM node with its marker.
  check(
    'a turn drops the front page from the window',
    !afterShift.some((entry) => entry.at === '0') && beforeShift.some((entry) => entry.at === '0'),
    afterShift.map((entry) => entry.at).join(','),
  )
  check(
    'a turn appends one new page at the back',
    afterShift.filter((entry) => entry.uid === null).length === 1 && afterShift.some((entry) => entry.at === '5'),
    JSON.stringify(afterShift),
  )
  const keptPage = beforeShift.find((entry) => entry.at === '1')
  check(
    'the pages that stay are the same DOM nodes, not rebuilt',
    Boolean(keptPage) && afterShift.some((entry) => entry.at === '1' && entry.uid === keptPage.uid),
    JSON.stringify({ kept: keptPage, after: afterShift }),
  )
  await windowPage.locator('.icon-button[aria-label="返回"]').click()
  await windowPage.waitForSelector('.chip-grid', { timeout: 5000 })

  // 翻卡學習, 第6課: eleven verbs, a nine-slot window.
  await windowPage.locator('.icon-button[aria-label="返回"]').click()
  await windowPage.waitForSelector('.home-actions', { timeout: 5000 })
  await windowPage.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await windowPage.waitForSelector('.chip-grid', { timeout: 5000 })
  const lessonSix = windowPage.locator('.chip', { hasText: '第6課' })
  if (!((await lessonSix.getAttribute('class')) || '').includes('chip--on')) await lessonSix.click()
  await windowPage.locator('.picker-start').click()
  await windowPage.waitForSelector('.card-stage', { timeout: 5000 })

  const cardWindow = await windowState(windowPage, cardSelectors)
  check('the card run mounts nine slots', cardWindow.slots === 9, String(cardWindow.slots))
  check('the card run shows one current card', cardWindow.currents === 1, String(cardWindow.currents))
  check(
    'the card window has a real paint height',
    cardWindow.containerHeight >= 340,
    JSON.stringify({ height: cardWindow.containerHeight, width: cardWindow.containerWidth }),
  )
  check(
    'the card current sits in the 3rd slot and fills it',
    cardWindow.currentLeft === 0 && cardWindow.currentWidth === cardWindow.containerWidth,
    JSON.stringify(cardWindow),
  )
  check(
    'the card window puts two cards behind the current one',
    JSON.stringify(cardWindow.at.slice(0, 3)) === '[null,null,0]',
    JSON.stringify(cardWindow.at),
  )
  check('no card neighbour shows inside the window', cardWindow.neighboursInside === 0, String(cardWindow.neighboursInside))
  check('the card run hides its neighbours', cardWindow.visibleNeighbours === 0, String(cardWindow.visibleNeighbours))
  check(
    'only the current card is in the accessibility tree',
    cardWindow.accessibleSlots === 1 && cardWindow.accessibleItems === 1,
    JSON.stringify({ slots: cardWindow.accessibleSlots, items: cardWindow.accessibleItems }),
  )
  check(
    'every mounted card holds its own word',
    new Set(cardWindow.words.filter(Boolean)).size === cardWindow.words.filter(Boolean).length,
    cardWindow.words.join(' | '),
  )

  await drag(windowPage, -120, 0, '.card-stage')
  await drag(windowPage, -120, 0, '.card-stage')
  // Stamp once the window is full of real cards, so the next single turn is
  // the one being measured: one node leaves the front, one arrives at the back.
  const cardBeforeShift = await stampSlots(windowPage, cardSelectors.slot)
  const cardShifted = await windowState(windowPage, cardSelectors)
  check(
    'the card window slides forward one slot per turn',
    JSON.stringify(cardShifted.at) === '[0,1,2,3,4,5,6,7,8]',
    JSON.stringify(cardShifted.at),
  )
  check(
    'the 3rd card slot still holds the current card',
    cardShifted.currentLeft === 0 && cardShifted.at[2] === 2,
    JSON.stringify({ left: cardShifted.currentLeft, at: cardShifted.at }),
  )
  await drag(windowPage, -120, 0, '.card-stage')
  const cardAfterShift = await slotMarkers(windowPage, cardSelectors.slot)
  const cardTurned = await windowState(windowPage, cardSelectors)
  check(
    'the card window keeps its 3rd slot after a turn',
    JSON.stringify(cardTurned.at) === '[1,2,3,4,5,6,7,8,9]' && cardTurned.currentLeft === 0,
    JSON.stringify({ at: cardTurned.at, left: cardTurned.currentLeft }),
  )
  check(
    'a card turn drops the front card and adds one at the back',
    !cardAfterShift.some((entry) => entry.at === '0') && cardAfterShift.some((entry) => entry.at === '9'),
    JSON.stringify(cardAfterShift.map((entry) => entry.at)),
  )
  check(
    'a card turn adds exactly one new node',
    cardAfterShift.filter((entry) => entry.uid === null).length === 1,
    JSON.stringify(cardAfterShift.map((entry) => entry.uid)),
  )
  const keptCard = cardBeforeShift.find((entry) => entry.at === '2')
  check(
    'the cards that stay are the same DOM nodes, not rebuilt',
    Boolean(keptCard) && cardAfterShift.some((entry) => entry.at === '2' && entry.uid === keptCard.uid),
    JSON.stringify({ kept: keptCard, after: cardAfterShift }),
  )
  check(
    'the counter follows the current card, not the window edge',
    (await windowPage.locator('.bar-title').textContent()).trim() === '練習（4/11）',
    (await windowPage.locator('.bar-title').textContent()).trim(),
  )
  await windowPage.close()

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

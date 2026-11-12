// Browser walk-through against the built site (vite preview).
// Usage: node scripts/browser-check.mjs [--screenshots]
// Env: PORT (default 5199), CHROMIUM_PATH, SHOT_DIR
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { CONFETTI_EMOJI, PRACTICE_EMOJI, SCORE_BANDS } from '../src/study/results.js'
import { groupLabel } from '../src/dict/forms.js'
import { LIST_SCROLLBAR, SCROLLBAR } from '../src/ui/scrollbar.js'

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

// Read the drawn thumb inside either dropdown frame. Kept as a helper because
// both lists share the same open/pointer/fade rules but are reached from
// different screens.
async function readListThumbState(page, frameSelector) {
  return page.evaluate((selector) => {
    const thumb = document.querySelector(`${selector} .list-thumb`)
    if (!thumb) return { present: false, on: false, opacity: 0 }
    return {
      present: true,
      on: (thumb.getAttribute('class') || '').includes('list-thumb--on'),
      opacity: Number(getComputedStyle(thumb).opacity),
    }
  }, frameSelector)
}

async function readStartButton(page) {
  return page.evaluate(() => {
    const button = document.querySelector('.picker-start')
    if (!button) return { present: false }
    const style = getComputedStyle(button)
    return {
      present: true,
      disabled: button.disabled,
      invalid: button.classList.contains('picker-start--invalid'),
      text: button.textContent.trim(),
      hints: document.querySelectorAll('.start-hint').length,
      color: style.color,
      background: style.backgroundColor,
      border: style.borderTopColor,
      borderWidth: style.borderTopWidth,
      shadow: style.boxShadow,
    }
  })
}

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
  // The tab carries the wordmark and the logo: the document title is the site
  // name, and the favicon and the iOS touch icon must resolve to real images
  // under the Pages subpath instead of a bare root path.
  const headMeta = await page.evaluate(async () => {
    const linkOf = (selector) => {
      const link = document.querySelector(selector)
      if (!link) return null
      return { href: link.href, sizes: link.getAttribute('sizes') || '', type: link.getAttribute('type') || '' }
    }
    const probe = async (href) => {
      if (!href) return { status: 0, type: '', bytes: 0, ok: false }
      const response = await fetch(href)
      const blob = await response.blob()
      return {
        status: response.status,
        // response.type is the fetch mode ('basic'/'cors'), so read the header.
        type: response.headers.get('content-type') || '',
        bytes: blob.size,
        ok: response.ok,
      }
    }
    const icons = {
      ico: linkOf('link[rel="icon"][href$=".ico"]'),
      png32: linkOf('link[rel="icon"][type="image/png"][sizes="32x32"]'),
      png192: linkOf('link[rel="icon"][type="image/png"][sizes="192x192"]'),
      touch: linkOf('link[rel="apple-touch-icon"]'),
    }
    return {
      title: document.title,
      icons,
      ico: await probe(icons.ico && icons.ico.href),
      png32: await probe(icons.png32 && icons.png32.href),
      png192: await probe(icons.png192 && icons.png192.href),
      touch: await probe(icons.touch && icons.touch.href),
    }
  })
  check(
    'the document title is 大家の動詞轉型練習',
    headMeta.title === '大家の動詞轉型練習',
    headMeta.title,
  )
  check(
    'the head declares a favicon and a touch icon',
    Boolean(headMeta.icons.ico && headMeta.icons.png192 && headMeta.icons.touch),
    JSON.stringify(headMeta.icons),
  )
  check(
    'every icon URL lives under the Pages subpath',
    [headMeta.icons.ico, headMeta.icons.png32, headMeta.icons.png192, headMeta.icons.touch]
      .every((icon) => icon && icon.href.includes(SITE_BASE)),
    [headMeta.icons.ico, headMeta.icons.touch].map((icon) => icon && icon.href).join(' '),
  )
  check(
    'the favicon is served as an image',
    headMeta.ico.ok && headMeta.ico.bytes > 0 && /image/.test(headMeta.ico.type),
    `${headMeta.ico.status} ${headMeta.ico.type} ${headMeta.ico.bytes}B`,
  )
  check(
    'the 32px and 192px favicons are served as images',
    headMeta.png32.ok && headMeta.png192.ok && headMeta.png32.bytes > 0 && headMeta.png192.bytes > 0,
    `${headMeta.png32.status}/${headMeta.png192.status}`,
  )
  check(
    'the iOS touch icon is served as an image',
    headMeta.touch.ok && headMeta.touch.bytes > 0 && /image/.test(headMeta.touch.type),
    `${headMeta.touch.status} ${headMeta.touch.type} ${headMeta.touch.bytes}B`,
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
    (await page.locator('.loading .site-subtitle').textContent()).trim() === '動詞轉型練習',
  )
  check(
    'loading shows the description',
    (await page.locator('.loading .site-lede').textContent()).trim() === '涵蓋初級 1 – 50 課的動詞',
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
    const invalidStart = await readStartButton(page)
    check(
      `${label} shows the lesson message on the red disabled 開始 button`,
      invalidStart.disabled &&
        invalidStart.invalid &&
        invalidStart.text === '請至少選擇一門課程才可以開始' &&
        invalidStart.hints === 0 &&
        invalidStart.color === 'rgb(220, 38, 38)' &&
        invalidStart.background === 'rgba(0, 0, 0, 0)' &&
        invalidStart.border === 'rgb(220, 38, 38)' &&
        invalidStart.borderWidth === '1px' &&
        invalidStart.shadow === 'none',
      JSON.stringify(invalidStart),
    )
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
  check(
    'the dictionary puts the lesson message on the 開始 button',
    (await page.locator('.start-hint').count()) === 0 &&
      (await page.locator('.picker-start').textContent()).trim() === '請至少選擇一門課程才可以開始',
  )

  const chipTwo = page.locator('.chip', { hasText: '第2課' })
  await chipTwo.click()
  check('selecting a lesson fills the chip', (await chipTwo.getAttribute('class')).includes('chip--on'))
  check('start enabled with one lesson', await page.locator('.picker-start').isEnabled())
  // The disabled→primary swap animates background over 140ms; wait for it.
  await wait(220)
  const validStart = await readStartButton(page)
  check(
    'a valid lesson restores the original purple primary 開始 button',
    !validStart.disabled &&
      !validStart.invalid &&
      validStart.text === '開始' &&
      validStart.color === 'rgb(255, 255, 255)' &&
      validStart.background === 'rgb(74, 63, 159)',
    JSON.stringify(validStart),
  )
  check(
    'the lesson message leaves the button once a lesson is picked',
    validStart.text === '開始' && (await page.locator('.start-hint').count()) === 0,
    `text=${validStart.text} hints=${await page.locator('.start-hint').count()}`,
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

  // Empty lessons are unpressable but explain themselves on hover. Capture
  // their computed disabled look here so the settings' locked chip can be
  // compared against the real 第1課 button later in the same browser.
  const emptyChip = page.locator('.chip-wrap').first()
  const emptyChipStyle = await page.evaluate(() => {
    const chip = document.querySelector('.chip-grid .chip--empty:disabled')
    const style = getComputedStyle(chip)
    return {
      color: style.color,
      background: style.backgroundColor,
      border: style.borderTopColor,
      opacity: style.opacity,
      pointerEvents: style.pointerEvents,
      cursor: style.cursor,
      fontWeight: style.fontWeight,
    }
  })
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
  const fromGlyph = await page.locator('.form-select').evaluate((el) => ({
    svg: el.querySelectorAll('svg.lucide').length,
    text: (el.textContent || '').trim(),
  }))
  check(
    '從 uses a Lucide chevron, not a text glyph',
    fromGlyph.svg === 1 && !fromGlyph.text.includes('⌄'),
    JSON.stringify(fromGlyph),
  )
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
    readerControls[0] === '上一個' && readerControls[1] === '下一個',
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
  check('settings shows 選擇顯示的類型', (await page.locator('.row-label', { hasText: '選擇顯示的類型' }).count()) === 1)
  check('settings shows 顯示平假名注音', (await page.locator('.row-label', { hasText: '顯示平假名注音' }).count()) === 1)
  const switchBox = await page.locator('.switch').first().boundingBox()
  check('switch control is 32px tall', switchBox.height >= 31.9 && switchBox.height <= 33, `height=${switchBox.height}`)
  // The current 預設顯示形式 is always selected: its 選擇顯示的類型 chip is a
  // disabled button that explains itself in a tooltip, and a press cannot
  // switch it off.
  const readLockedChip = () =>
    page.evaluate(() => {
      const chips = [...document.querySelectorAll('.settings .form-chips .chip')]
      const locked = document.querySelector('.settings .form-chips .chip--locked')
      const tip = locked?.parentElement?.querySelector('.chip-tip')
      return {
        chips: chips.length,
        pressed: chips.filter((chip) => chip.getAttribute('aria-pressed') === 'true').length,
        lockedName: locked?.textContent.trim() ?? null,
        lockedDisabled: locked?.disabled === true,
        lockedPressed: locked?.getAttribute('aria-pressed') === 'true',
        lockedDescribed: locked?.getAttribute('aria-describedby') ?? null,
        tipId: tip?.id ?? null,
        tipText: tip?.textContent.trim() ?? null,
        tipOpacity: tip ? Number(getComputedStyle(tip).opacity) : null,
        otherDisabled: chips.filter((chip) => chip !== locked && chip.disabled).length,
      }
    })
  // The 選擇顯示的類型 control follows the state just like the lesson 全選.
  // It starts fully selected, so the first visit sees 取消全選.
  const displaySelectAll = page.locator('.settings .row-head .text-button')
  const displayControlText = async () => (await displaySelectAll.textContent()).trim()
  const pressedCount = async () =>
    (await page.locator('.settings .form-chips .chip[aria-pressed="true"]').count())
  check('all 15 display forms start selected', (await pressedCount()) === 15, String(await pressedCount()))
  check('the display control reads 取消全選 when all are selected', (await displayControlText()) === '取消全選', await displayControlText())
  await displaySelectAll.click()
  check(
    '取消全選 leaves only the locked 預設顯示形式',
    (await pressedCount()) === 1 && (await readLockedChip()).lockedPressed,
    `pressed=${await pressedCount()} state=${JSON.stringify(await readLockedChip())}`,
  )
  check('the display control returns to 全選 after clearing', (await displayControlText()) === '全選', await displayControlText())
  await displaySelectAll.click()
  check('全選 selects all 15 display forms again', (await pressedCount()) === 15, String(await pressedCount()))
  check('the display control becomes 取消全選 again', (await displayControlText()) === '取消全選', await displayControlText())
  // A manual toggle also updates the control's label.
  await page.locator('.settings .form-chips .chip', { hasText: /^字典形$/ }).click()
  check(
    'hiding one form returns the display control to 全選',
    (await displayControlText()) === '全選' && (await pressedCount()) === 14,
    `label=${await displayControlText()} pressed=${await pressedCount()}`,
  )
  await page.locator('.settings .form-chips .chip', { hasText: /^字典形$/ }).click()
  check(
    'restoring the last form returns the display control to 取消全選',
    (await displayControlText()) === '取消全選' && (await pressedCount()) === 15,
    `label=${await displayControlText()} pressed=${await pressedCount()}`,
  )
  // 取消全選 keeps its state across reload and still draws the opening block.
  await displaySelectAll.click()
  const afterClear = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('katsuyou-settings') || '{}')
    return stored?.dict?.displayForms ?? null
  })
  check('取消全選 persists its one-form selection', Array.isArray(afterClear) && afterClear.length === 1 && afterClear[0] === 'masu-form', JSON.stringify(afterClear))
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.picker-start').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  // Reload restarts the reader on its first word. The rest of this settings
  // walk was written against the second verb, so page forward once again.
  await page.locator('.controls-button').nth(1).click()
  await wait(460)
  check('the reload walk returns to the second verb', (await readerTitle(page)) === '學習（2/3）', await readerTitle(page))
  check(
    'only the default form block is drawn after clearing',
    (await page.locator('.reader-page--current .form-block').count()) === 1 &&
      (await page.locator('.reader-page--current .form-block--default').count()) === 1,
    `blocks=${await page.locator('.reader-page--current .form-block').count()}`,
  )
  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings .form-chips', { timeout: 5000 })
  const reloadedControl = page.locator('.settings .row-head .text-button')
  check('cleared display selection persists after reload', (await reloadedControl.textContent()).trim() === '全選', (await reloadedControl.textContent()).trim())
  check('the locked chip is still pressed after reload', (await readLockedChip()).lockedPressed === true)
  await reloadedControl.click()
  check('全選 restores all 15 after reload', (await pressedCount()) === 15, String(await pressedCount()))
  const chipRest = await readLockedChip()
  check(
    'the 預設顯示形式 chip is a disabled button',
    chipRest.lockedName === 'ます形' && chipRest.lockedDisabled && chipRest.lockedPressed,
    JSON.stringify(chipRest),
  )
  check(
    'no other 選擇顯示的類型 chip is disabled',
    chipRest.otherDisabled === 0 && chipRest.chips === 15,
    JSON.stringify(chipRest),
  )
  check(
    'the locked chip explains itself in a tooltip',
    chipRest.tipText === '這是預設顯示形式，必須顯示，不能取消' &&
      chipRest.lockedDescribed === chipRest.tipId &&
      chipRest.tipOpacity === 0,
    JSON.stringify(chipRest),
  )
  // A locked 預設顯示形式 is still selected, but looks like the picker's
  // disabled 第1課 chip: the filled 'on' style must not win over the disabled
  // look, and hovering its wrapper must not add the accent border.
  const lockedStyle = (reference) =>
    page.evaluate((empty) => {
      const chip = document.querySelector('.settings .chip--locked:disabled')
      const style = getComputedStyle(chip)
      const current = {
        color: style.color,
        background: style.backgroundColor,
        border: style.borderTopColor,
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        cursor: style.cursor,
        fontWeight: style.fontWeight,
      }
      return {
        current,
        sameAsEmptyChip: Object.keys(empty).every((key) => current[key] === empty[key]),
        pressed: chip.getAttribute('aria-pressed'),
      }
    }, reference)
  const lockedRest = await lockedStyle(emptyChipStyle)
  check(
    'the locked chip has the disabled 第1課 computed look',
    lockedRest.sameAsEmptyChip && lockedRest.pressed === 'true',
    `empty=${JSON.stringify(emptyChipStyle)} locked=${JSON.stringify(lockedRest)}`,
  )
  await page.locator('.settings .form-chips .chip-wrap', { hasText: 'ます形' }).hover()
  await wait(250)
  const chipHover = await readLockedChip()
  const lockedOnHover = await lockedStyle(emptyChipStyle)
  check('hovering the locked chip shows its tooltip', chipHover.tipOpacity === 1, JSON.stringify(chipHover))
  check(
    'hovering the locked chip wrapper keeps the disabled look and no accent border',
    lockedOnHover.sameAsEmptyChip && lockedOnHover.current.border === emptyChipStyle.border,
    `empty=${JSON.stringify(emptyChipStyle)} hover=${JSON.stringify(lockedOnHover)}`,
  )
  // The 選擇顯示的類型 buttons line up with the quiz settings' equal-width
  // button group: every chip fills its grid cell and the full rows sit flush
  // with the group's edges, instead of shrinking to the width of its label.
  const chipGrid = await page.evaluate(() => {
    const group = document.querySelector('.settings .form-chips')
    const box = group.getBoundingClientRect()
    const chips = [...group.querySelectorAll('.chip')].map((chip) => {
      const rect = chip.getBoundingClientRect()
      const wrap = chip.parentElement.getBoundingClientRect()
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
        wrapLeft: wrap.left,
        wrapRight: wrap.right,
      }
    })
    const perRow = new Map()
    for (const chip of chips) {
      const key = Math.round(chip.top)
      perRow.set(key, [...(perRow.get(key) ?? []), chip])
    }
    const rows = [...perRow.values()]
    const widths = chips.map((chip) => chip.width)
    const fullRows = rows.filter((row) => row.length === Math.max(...rows.map((r) => r.length)))
    return {
      chips: chips.length,
      rows: rows.length,
      minWidth: Math.min(...widths),
      maxWidth: Math.max(...widths),
      fillsWrap: chips.every((chip) =>
        Math.abs(chip.left - chip.wrapLeft) < 0.5 && Math.abs(chip.right - chip.wrapRight) < 0.5,
      ),
      groupLeft: box.left,
      groupRight: box.right,
      rowEdges: fullRows.map((row) => ({
        left: Math.min(...row.map((chip) => chip.left)),
        right: Math.max(...row.map((chip) => chip.right)),
      })),
      widestLabelFits: chips.every((_, index) => {
        const chip = group.querySelectorAll('.chip')[index]
        return chip.scrollWidth <= chip.clientWidth + 0.5
      }),
    }
  })
  check(
    'the 選擇顯示的類型 chips have equal widths and fill their cells',
    chipGrid.chips === 15 && chipGrid.maxWidth - chipGrid.minWidth < 0.5 && chipGrid.fillsWrap,
    JSON.stringify(chipGrid),
  )
  check(
    'the 選擇顯示的類型 chips wrap in flush, full-width rows',
    chipGrid.rows > 1 &&
      chipGrid.rowEdges.every(
        (edge) =>
          Math.abs(edge.left - chipGrid.groupLeft) < 0.5 &&
          Math.abs(edge.right - chipGrid.groupRight) < 0.5,
      ),
    JSON.stringify(chipGrid),
  )
  check(
    'no 選擇顯示的類型 label overflows its button',
    chipGrid.widestLabelFits,
    JSON.stringify(chipGrid),
  )
  await page.mouse.move(5, 5)
  await page.locator('.form-select').click()
  // No row carries a border-bottom any more: every separator is an `.hrule`
  // element of its own, so a hover or press tint cannot paint over the line
  // and a pressed row cannot shorten it. Held down, the row still spans the
  // list's inner width.
  const optionRow = page.locator('.form-option', { hasText: /^て形$/ })
  const listInner = await page.locator('.form-list').evaluate((el) => {
    const box = el.getBoundingClientRect()
    const border = parseFloat(getComputedStyle(el).borderLeftWidth)
    return { left: box.left + border, right: box.right - border }
  })
  const dividers = await page.evaluate(() => {
    const settings = document.querySelector('.settings')
    const rows = settings.querySelectorAll('.row')
    const options = settings.querySelectorAll('.form-option')
    const rules = [...settings.querySelectorAll('.hrule')]
    const bordered = [...rows, ...options].filter(
      (el) => getComputedStyle(el).borderBottomWidth !== '0px',
    )
    const drawn = rules.map((el) => {
      const style = getComputedStyle(el)
      return {
        height: Math.round(el.getBoundingClientRect().height * 100) / 100,
        color: style.backgroundColor,
        border: style.borderBottomWidth,
        hidden: el.getAttribute('aria-hidden'),
      }
    })
    return {
      rows: rows.length,
      options: options.length,
      rules: rules.length,
      bordered: bordered.length,
      onePixel: drawn.every((rule) => rule.height === 1),
      lineColour: drawn.every((rule) => rule.color === 'rgba(36, 33, 58, 0.12)'),
      borderless: drawn.every((rule) => rule.border === '0px'),
      decorative: drawn.every((rule) => rule.hidden === 'true'),
      endsOnRow: settings.lastElementChild?.classList.contains('row') === true,
      // The 預設顯示形式 list opens straight under its row: the user asked for
      // no rule between the row and the panel ("不要加綫，很醜！").
      ruleAboveList:
        document.querySelector('.form-list-frame')?.previousElementSibling?.classList.contains(
          'hrule',
        ) === true,
    }
  })
  check(
    'settings rows carry no border-bottom',
    dividers.bordered === 0 && dividers.rows > 0,
    JSON.stringify(dividers),
  )
  check(
    'settings separators are 1px drawn lines in the line colour',
    dividers.onePixel && dividers.lineColour && dividers.borderless,
    JSON.stringify(dividers),
  )
  check(
    'every rule separates two entries and the list ends on a row',
    dividers.decorative &&
      dividers.endsOnRow &&
      // One rule between every pair of rows (the list opens with no rule of
      // its own), plus one between every pair of options.
      dividers.rules ===
        dividers.rows - 1 + Math.max(0, dividers.options - 1),
    JSON.stringify(dividers),
  )
  check(
    'the form list opens directly under its row, with no rule in between',
    dividers.ruleAboveList === false,
    JSON.stringify(dividers),
  )
  // Both dropdowns reveal the thumb as soon as they open. The settings list
  // is measured here; the picker's 從 list gets its own timing walk below.
  const settingsList = await page.evaluate(() => {
    const frame = document.querySelector('.settings .form-list-frame')
    const list = frame?.querySelector('.form-list')
    const thumb = frame?.querySelector('.list-thumb')
    if (!list) return { present: false }
    const listBox = list.getBoundingClientRect()
    const style = getComputedStyle(list)
    if (!thumb) return { present: true, nativeBar: style.scrollbarWidth, thumb: null }
    const box = thumb.getBoundingClientRect()
    const thumbStyle = getComputedStyle(thumb)
    return {
      present: true,
      nativeBar: style.scrollbarWidth,
      scrollable: list.scrollHeight > list.clientHeight + 1,
      thumb: {
        width: Math.round(box.width * 10) / 10,
        radius: thumbStyle.borderRadius,
        rightInset: Math.round((listBox.right - box.right) * 10) / 10,
        opacity: Number(thumbStyle.opacity),
        on: (thumb.getAttribute('class') || '').includes('list-thumb--on'),
        pointer: thumbStyle.pointerEvents,
        aria: thumb.getAttribute('aria-hidden'),
      },
    }
  })
  check(
    'the settings list draws the drawn thumb instead of the native bar',
    settingsList.present &&
      settingsList.nativeBar === 'none' &&
      settingsList.scrollable === true &&
      settingsList.thumb?.width === 4 &&
      settingsList.thumb?.radius === '999px' &&
      settingsList.thumb?.rightInset === 4 &&
      settingsList.thumb?.pointer === 'auto' &&
      settingsList.thumb?.aria === 'true',
    JSON.stringify(settingsList),
  )
  check(
    'the settings list thumb is visible as soon as the dropdown opens',
    settingsList.thumb?.on === true && settingsList.thumb?.opacity === 1,
    JSON.stringify(settingsList.thumb),
  )
  // The same two-second hint applies to the settings dropdown. The pointer
  // sits outside it during this wait, then re-enters to restart the timer.
  await page.mouse.move(5, 5)
  await wait(LIST_SCROLLBAR.fadeDelay + 250)
  const settingsThumbIdle = await readListThumbState(page, '.settings .form-list-frame')
  check(
    'the settings list thumb fades two seconds after opening',
    settingsThumbIdle.on === false && settingsThumbIdle.opacity === 0,
    JSON.stringify(settingsThumbIdle),
  )
  const settingsListBounds = await page.locator('.settings .form-list').boundingBox()
  await page.mouse.move(settingsListBounds.x + 20, settingsListBounds.y + 20)
  await wait(250)
  const settingsThumbPointer = await readListThumbState(page, '.settings .form-list-frame')
  check(
    'pointer activity reveals the settings list thumb again',
    settingsThumbPointer.on === true && settingsThumbPointer.opacity === 1,
    JSON.stringify(settingsThumbPointer),
  )
  await page.mouse.move(5, 5)
  await wait(LIST_SCROLLBAR.fadeDelay + 250)
  const settingsThumbFaded = await readListThumbState(page, '.settings .form-list-frame')
  check(
    'the settings list thumb fades two seconds after pointer activity',
    settingsThumbFaded.on === false && settingsThumbFaded.opacity === 0,
    JSON.stringify(settingsThumbFaded),
  )
  await page.locator('.settings .form-select').click()
  await page.locator('.settings .form-select').click()
  await wait(120)
  const settingsThumbReopened = await readListThumbState(page, '.settings .form-list-frame')
  check(
    'reopening the settings dropdown shows its thumb immediately',
    settingsThumbReopened.on === true && settingsThumbReopened.opacity === 1,
    JSON.stringify(settingsThumbReopened),
  )
  await page.mouse.move(5, 5)
  await optionRow.hover()
  const optionRest = await optionRow.boundingBox()
  await page.mouse.down()
  const optionHeld = await optionRow.boundingBox()
  // Release away from the row: a release on it would select the form and close
  // the list before the click check below.
  await page.mouse.move(5, 20, { steps: 4 })
  await page.mouse.up()
  check(
    'a pressed option row keeps its width and its position',
    Math.abs(optionHeld.width - optionRest.width) < 0.5 &&
      Math.abs(optionHeld.x - listInner.left) < 0.5 &&
      Math.abs(optionHeld.x + optionHeld.width - listInner.right) < 0.5,
    `rest=${optionRest.width} held=${optionHeld.width} x=${optionHeld.x} list=${listInner.left}..${listInner.right}`,
  )
  await optionRow.click()
  // Choosing て形 moves the lock: the new default cannot be switched off and
  // the old one is an ordinary chip again.
  const chipAfterForm = await readLockedChip()
  check(
    'the lock follows the new 預設顯示形式',
    chipAfterForm.lockedName === 'て形' && chipAfterForm.lockedDisabled && chipAfterForm.otherDisabled === 0,
    JSON.stringify(chipAfterForm),
  )
  // Pressing the freed ます形 chip removes it from the drawn forms.
  await page.locator('.settings .form-chips .chip', { hasText: /^ます形$/ }).click()
  const chipToggled = await readLockedChip()
  check(
    'the freed chip can be switched off again',
    chipToggled.pressed === chipAfterForm.pressed - 1,
    `pressed ${chipAfterForm.pressed} -> ${chipToggled.pressed}`,
  )
  await page.locator('.settings .form-chips .chip', { hasText: /^ます形$/ }).click()
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

  // 選擇顯示的類型 hides a deselected form; restoring it brings it back. The
  // chip under test is 字典形, because て形 is the current 預設顯示形式 and its
  // chip is a disabled button (it can never be switched off).
  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  await page.locator('.form-chips .chip', { hasText: /^字典形$/ }).click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  check(
    '選擇顯示的類型 hides the deselected form',
    (await page.locator('.reader-page--current .form-block[data-form="dictionary-form"]').count()) === 0,
  )
  check(
    'the default form stays drawn while another is hidden',
    (await page.locator('.reader-page--current .form-block[data-form="te-form"]').count()) === 1,
  )
  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  await page.locator('.form-chips .chip', { hasText: /^字典形$/ }).click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  check(
    '選擇顯示的類型 restores the form',
    (await page.locator('.reader-page--current .form-block[data-form="dictionary-form"]').count()) === 1,
  )

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
  // colour, and a form flagged error_usage keeps its error colour and carries
  // a double strike through the word (the reading above it stays unstruck).
  // 第2課 is in the set because its first verb (違う) has error_usage forms
  // written with kanji, so the reading rule has a word with an `rt` to check;
  // 第10課 and 第11課 carry the notes.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '字典' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  for (const chip of await page.locator('.chip-grid .chip').all()) {
    const label = (await chip.textContent()).trim()
    const on = ((await chip.getAttribute('class')) || '').includes('chip--on')
    const want = label === '第2課' || label === '第10課' || label === '第11課'
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

  // The strike rule needs a reading on screen, and this walk turned the
  // dictionary's readings off earlier (the setting persisted). Turn them back
  // on so a kanji error word has an `rt` above its base text to measure.
  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  const readingSwitch = page.locator('.switch').first()
  if ((await readingSwitch.getAttribute('aria-checked')) !== 'true') await readingSwitch.click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  check(
    'the walk shows readings for the strike check',
    (await page.locator('.reader-page--current rt').count()) > 0,
    String(await page.locator('.reader-page--current rt').count()),
  )

  let noteSeen = null
  let errorSeen = null
  const errorWords = []
  for (let step = 0; step < 8; step += 1) {
    const found = await page.evaluate(() => {
      const result = { errors: [] }
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
        if (struck) {
          const base = struck.querySelector('rb') ?? struck.querySelector('.ruby-word > span')
          const rubyWord = struck.querySelector('.ruby-word') ?? struck
          const baseBoxes = [
            ...rubyWord.querySelectorAll('rb'),
            ...rubyWord.querySelectorAll(':scope > span'),
          ]
          const reading = rubyWord.querySelector('rt')
          const baseStyle = base ? getComputedStyle(base) : null
          const readingStyle = reading ? getComputedStyle(reading) : null
          result.errors.push({
            text: struck.textContent.trim(),
            color: baseStyle ? baseStyle.color : null,
            line: baseStyle ? baseStyle.textDecorationLine : 'none',
            style: baseStyle ? baseStyle.textDecorationStyle : 'none',
            strikeColor: baseStyle ? baseStyle.textDecorationColor : null,
            // Every base box carries the strike: the kanji (`rb`) and each
            // plain kana span. A rule on the flex container or on `ruby`
            // would also strike the reading, so the reading is measured too.
            everyBaseStruck:
              baseBoxes.length > 0 &&
              baseBoxes.every((box) => getComputedStyle(box).textDecorationLine === 'line-through'),
            readingLine: readingStyle ? readingStyle.textDecorationLine : null,
            readingColor: readingStyle ? readingStyle.color : null,
            hasNote: Boolean(block.querySelector('.note-line')),
            hasSentences: Boolean(block.querySelector('.block')),
          })
        }
      }
      if (result.errors.length) result.error = result.errors[0]
      return result
    })
    if (found.note && !noteSeen) noteSeen = found.note
    for (const entry of found.errors ?? []) {
      if (!errorWords.some((seen) => seen.text === entry.text)) errorWords.push(entry)
      // A page holds all 15 forms of one verb, so the first error word met may
      // be an all-kana verb with no reading above it. Keep paging until one
      // with a reading shows up: that is the case the reading rule is about.
      if (entry.readingLine !== null) errorSeen = entry
    }
    if (!errorSeen && found.error) errorSeen = found.error
    if (noteSeen && errorSeen && errorSeen.readingLine !== null) break
    if (step < 7) {
      const next = page.locator('.controls-button').nth(1)
      if (await next.isDisabled()) break
      await next.click()
      await wait(460)
    }
  }
  check('a form note rides above the example sentences', noteSeen?.beforeSentences === true, JSON.stringify(noteSeen))
  check('the note is marked with its own colour', noteSeen?.color === 'rgb(180, 83, 9)', noteSeen?.color ?? 'none')
  check('the note keeps the reading edge', noteSeen?.align !== 'center', noteSeen?.align ?? 'none')
  check('an error_usage form is found in the reader', errorWords.length > 0, JSON.stringify(errorSeen))
  check(
    'every error word keeps its error colour',
    errorWords.every((word) => word.color === 'rgb(220, 38, 38)'),
    JSON.stringify(errorWords.map((word) => [word.text, word.color])),
  )
  check(
    'every base box of every error word is struck through twice',
    errorWords.every(
      (word) => word.line === 'line-through' && word.style === 'double' && word.everyBaseStruck,
    ),
    JSON.stringify(errorWords.map((word) => [word.text, word.line, word.style, word.everyBaseStruck])),
  )
  check(
    'the strike keeps the error colour',
    errorWords.every((word) => word.strikeColor === 'rgb(220, 38, 38)'),
    JSON.stringify(errorWords.map((word) => [word.text, word.strikeColor])),
  )
  check(
    'a reading over an error word keeps its colour and is not struck',
    errorSeen?.readingLine === 'none' && errorSeen?.readingColor === 'rgb(220, 38, 38)',
    JSON.stringify(errorSeen),
  )
  check('the error form carries its note', errorSeen?.hasNote === true, JSON.stringify(errorSeen))
  check('the error form has no example sentences', errorSeen?.hasSentences === false, JSON.stringify(errorSeen))

  // 跳過錯誤的單詞: turning the switch on removes every error_usage block from
  // the remaining words in the run.
  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  await page.locator('.switch[aria-label="跳過錯誤的單詞"]').click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.reader-body', { timeout: 5000 })
  const skipSweep = await page.evaluate(async () => {
    let errorWords = 0
    let words = 0
    for (let guard = 0; guard < 40; guard += 1) {
      const current = document.querySelector('.reader-page--current')
      if (!current) break
      words += 1
      errorWords += current.querySelectorAll('.word--error').length
      const next = document.querySelector('.reader-controls .controls-button:last-child')
      if (!next || next.disabled) break
      next.click()
      await new Promise((resolve) => setTimeout(resolve, 320))
    }
    return { errorWords, words }
  })
  check('跳過錯誤的單詞 removes the error_usage blocks', skipSweep.errorWords === 0 && skipSweep.words > 0, JSON.stringify(skipSweep))

  // T6 flashcards.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.chip', { hasText: '第5課' }).click()
  await page.locator('.form-select').click()
  await page.locator('.form-option', { hasText: /^ます形$/ }).click()

  // Clearing 到 explains why 開始 is disabled: the message moves onto the
  // button's label, and picking a form recovers it.
  const onTargets = page.locator('.chip--form.chip--on')
  while ((await onTargets.count()) > 0) await onTargets.first().click()
  const emptied = await page.evaluate(() => {
    const button = document.querySelector('.picker-start')
    return {
      text: button.textContent.trim(),
      disabled: button.disabled,
      invalid: button.classList.contains('picker-start--invalid'),
      separateHint: document.querySelector('.start-hint'),
    }
  })
  check(
    'clearing 到 puts the 轉型 hint on the 開始 button',
    emptied.text === '請至少選擇一個轉型才可以開始' &&
      emptied.disabled &&
      emptied.invalid &&
      emptied.separateHint === null,
    JSON.stringify(emptied),
  )
  await page.locator('.chip--form', { hasText: '字典形' }).click()
  const restored = await page.evaluate(() => ({
    text: document.querySelector('.picker-start').textContent.trim(),
    disabled: document.querySelector('.picker-start').disabled,
    invalid: document.querySelector('.picker-start').classList.contains('picker-start--invalid'),
  }))
  check(
    'picking a 轉型 returns the button to 開始 and enables it',
    restored.text === '開始' && restored.disabled === false && restored.invalid === false,
    JSON.stringify(restored),
  )

  const startBottomGap = await page.evaluate(
    () => Math.round(window.innerHeight - document.querySelector('.picker-start').getBoundingClientRect().bottom),
  )
  check('開始 sits 20px clear of the window edge', startBottomGap === 20, String(startBottomGap))
  await page.locator('.picker-start').click()
  await page.waitForSelector('.card-stage', { timeout: 5000 })
  await iconGlyphs(page, 'cards')
  check('card title counts cards', (await page.locator('.bar-title').textContent()).trim() === '練習（1/3）')
  const immediateCardPaint = await page.evaluate(() => {
    const stage = document.querySelector('.card-stage')
    const row = document.querySelector('.card-window')
    const capture = stage.setPointerCapture
    stage.setPointerCapture = () => {}
    const event = (type, x) => new PointerEvent(type, {
      bubbles: true,
      pointerId: 77,
      pointerType: 'mouse',
      button: 0,
      clientX: x,
      clientY: 300,
    })
    stage.dispatchEvent(event('pointerdown', 200))
    stage.dispatchEvent(event('pointermove', 196))
    const insideSlop = row.style.transform
    stage.dispatchEvent(event('pointermove', 176))
    // Read in the same task as pointermove, before Vue's queued microtask can
    // render. A reactive-only implementation still says 0px here.
    const horizontal = row.style.transform
    stage.dispatchEvent(event('pointercancel', 176))
    stage.setPointerCapture = capture
    return { insideSlop, horizontal }
  })
  check(
    'a card paints its held offset in the pointer event after the 8px axis slop',
    immediateCardPaint.insideSlop === 'translateX(0px)' &&
      immediateCardPaint.horizontal === 'translateX(-24px)',
    JSON.stringify(immediateCardPaint),
  )
  await wait(300)
  const cardControls = (await page.locator('.card-controls .control').allTextContents()).map((t) => t.trim())
  check(
    'card controls stay 上一張 / 下一張',
    cardControls[0] === '上一張' && cardControls[1] === '下一張',
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
  const faceTagAboveWord = await page.evaluate(() => {
    const tag = document.querySelector('.card--current .card-face .tag')
    const word = document.querySelector('.card--current .card-face .word')
    if (!tag || !word) return false
    const tagBox = tag.getBoundingClientRect()
    const wordBox = word.getBoundingClientRect()
    return tagBox.bottom <= wordBox.top + 1
  })
  check('the face tag sits above the word like the answer', faceTagAboveWord === true, String(faceTagAboveWord))

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
    'the answer carries the lesson tag',
    (await page.locator('.card--current .card-back .tag--lesson').textContent()).trim() === '第5課',
    (await page.locator('.card--current .card-back .tag--lesson').textContent()).trim(),
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
    'the answer pills run form, class, then lesson',
    Boolean(answerPills) &&
      answerPills.classes.length === 3 &&
      answerPills.classes[0].includes('tag--form') &&
      answerPills.classes[1].includes('tag--group') &&
      answerPills.classes[2].includes('tag--lesson') &&
      answerPills.lefts[0] < answerPills.lefts[1] &&
      answerPills.lefts[1] < answerPills.lefts[2],
    JSON.stringify(answerPills),
  )
  check(
    'the answer pills share one row',
    Boolean(answerPills) && answerPills.tops.every((top) => top === answerPills.tops[0]),
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

  // 翻卡學習 error_usage: the card carries 錯誤單詞 and 跳過錯誤的單詞 drops it.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  for (const chip of await page.locator('.chip-grid .chip').all()) {
    const label = (await chip.textContent()).trim()
    const on = ((await chip.getAttribute('class')) || '').includes('chip--on')
    const want = label === '第10課'
    if (on !== want) await chip.click()
  }
  // 從 stays ます形; make 到 just 受身形 (lesson 10 flags ある's 受身形).
  await page.locator('.chip--form', { hasText: /^字典形$/ }).click()
  await page.locator('.chip--form', { hasText: /^受身形$/ }).click()
  await page.locator('.picker-start').click()
  await page.waitForSelector('.card-stage', { timeout: 5000 })
  check('the error run holds both cards before skipping', (await page.locator('.bar-title').textContent()).trim() === '練習（1/2）')

  let errorTagCount = 0
  for (let guard = 0; guard < 10; guard += 1) {
    await page.locator('.card-stage').click()
    await wait(320)
    if ((await page.locator('.card--current .card-back .tag--error').count()) > 0) errorTagCount += 1
    const lastControl = await page.locator('.card-controls .control').last().textContent()
    const isLast = lastControl.trim() === '完成'
    await page.locator('.card-stage').click()
    await wait(320)
    if (isLast) break
    await page.locator('.card-controls .control').last().click()
    await wait(320)
  }
  check('an error_usage card carries 錯誤單詞', errorTagCount === 1, String(errorTagCount))

  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  await page.locator('.switch[aria-label="跳過錯誤的單詞"]').click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.card-stage', { timeout: 5000 })
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.picker-start').click()
  await page.waitForSelector('.card-stage', { timeout: 5000 })
  check('跳過錯誤的單詞 drops the error card', (await page.locator('.bar-title').textContent()).trim() === '練習（1/1）')

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
  check('quiz title counts items', (await page.locator('.bar-title').textContent()).trim() === '測驗（1/3）')
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
  check('a correct answer advances', (await page.locator('.bar-title').textContent()).trim() === '測驗（2/3）')
  check('the field clears after a correct answer', (await page.locator('.answer-input').inputValue()) === '')

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.locator('.answer-input').fill('あ')
    await page.locator('.check-button').click()
    await wait(120)
    if (attempt === 1) {
      check('a wrong answer stays on the item', (await page.locator('.bar-title').textContent()).trim() === '測驗（2/3）')
      check('a wrong answer keeps the input', (await page.locator('.answer-input').inputValue()) === 'あ')
      check('a wrong answer shakes the field', (await page.locator('.field--shake').count()) === 1)
      check('a wrong answer turns the field red', (await page.locator('.field--error').count()) === 1)
      const missToast = (await page.locator('.toast').count()) > 0
        ? (await page.locator('.toast').textContent()).trim()
        : ''
      check('a wrong answer shows no 回答錯誤 toast', missToast !== '回答錯誤', missToast)
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
  check('the revealed item does not advance by itself', (await page.locator('.bar-title').textContent()).trim() === '測驗（2/3）')

  await page.locator('.next-button').click()
  check('下一題 advances after the reveal', (await page.locator('.bar-title').textContent()).trim() === '測驗（3/3）')
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
  // The quiz group is the reference: five equal-width buttons in one flush
  // row. The dictionary's wrapping group uses the same full-cell alignment.
  const quizChoiceRow = await page.evaluate(() => {
    const group = document.querySelector('.settings .choice-chips')
    const box = group.getBoundingClientRect()
    const buttons = [...group.querySelectorAll('.choice')].map((button) => {
      const rect = button.getBoundingClientRect()
      return { left: rect.left, right: rect.right, top: rect.top, width: rect.width }
    })
    const widths = buttons.map((button) => button.width)
    return {
      widths: Math.max(...widths) - Math.min(...widths),
      left: Math.abs(Math.min(...buttons.map((button) => button.left)) - box.left),
      right: Math.abs(Math.max(...buttons.map((button) => button.right)) - box.right),
      rows: new Set(buttons.map((button) => Math.round(button.top))).size,
    }
  })
  check(
    'the quiz settings buttons are equal-width and flush in one row',
    quizChoiceRow.widths < 0.5 &&
      quizChoiceRow.left < 0.5 &&
      quizChoiceRow.right < 0.5 &&
      quizChoiceRow.rows === 1,
    JSON.stringify(quizChoiceRow),
  )
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

  // 跳過錯誤的單詞 in the quiz: it excludes error_usage items at start, and a
  // mid-run toggle puts them back at the tail.
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('.home-actions', { timeout: 30000 })
  await page.locator('.home-actions button', { hasText: '測驗' }).click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  for (const chip of await page.locator('.chip-grid .chip').all()) {
    const label = (await chip.textContent()).trim()
    const on = ((await chip.getAttribute('class')) || '').includes('chip--on')
    const want = label === '第10課'
    if (on !== want) await chip.click()
  }
  await page.locator('.chip--form', { hasText: /^字典形$/ }).click()
  await page.locator('.chip--form', { hasText: /^受身形$/ }).click()
  await page.locator('.picker-start').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  check('quiz starts with the error item before skipping', (await page.locator('.bar-title').textContent()).trim() === '測驗（1/2）')

  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  check('quiz settings show 跳過錯誤的單詞', (await page.locator('.switch[aria-label="跳過錯誤的單詞"]').count()) === 1)
  await page.locator('.switch[aria-label="跳過錯誤的單詞"]').click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  check('turning 跳過錯誤的單詞 on removes the error item mid-run', (await page.locator('.bar-title').textContent()).trim() === '測驗（1/1）')
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.picker-start').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  check('跳過錯誤的單詞 excludes the error item at start', (await page.locator('.bar-title').textContent()).trim() === '測驗（1/1）')

  await page.locator('.icon-button[aria-label="設定"]').click()
  await page.waitForSelector('.settings', { timeout: 5000 })
  await page.locator('.switch[aria-label="跳過錯誤的單詞"]').click()
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.quiz-body', { timeout: 5000 })
  check('turning 跳過錯誤的單詞 off restores the error item', (await page.locator('.bar-title').textContent()).trim() === '測驗（1/2）')

  // Restore the quiz picker's 到 to 字典形 for the sections that follow.
  await page.locator('.icon-button[aria-label="返回"]').click()
  await page.waitForSelector('.chip-grid', { timeout: 5000 })
  await page.locator('.chip--form', { hasText: /^受身形$/ }).click()
  await page.locator('.chip--form', { hasText: /^字典形$/ }).click()

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
  // A short screen must not gain a browser-chrome-sized scroller: the outer
  // shell follows the dynamic viewport height, so the card fits the visible
  // area and the document has nothing extra to scroll. `dvh` cannot be
  // exercised for Safari's collapsing toolbar in headless Chromium, but the
  // declaration plus this no-overflow assertion guard the short-page path.
  const shortCardLayout = await cardPage.evaluate(() => ({
    content: document.documentElement.scrollHeight,
    viewport: window.innerHeight,
    body: getComputedStyle(document.body).minHeight,
    app: getComputedStyle(document.querySelector('#app')).minHeight,
    column: getComputedStyle(document.querySelector('.column')).minHeight,
  }))
  check(
    'a short card screen fills the viewport without a vertical overflow',
    shortCardLayout.content <= shortCardLayout.viewport + 1 &&
      Math.round(parseFloat(shortCardLayout.body)) === shortCardLayout.viewport &&
      Math.round(parseFloat(shortCardLayout.app)) === shortCardLayout.viewport,
    JSON.stringify(shortCardLayout),
  )
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
  // A dropdown list is its own scroll container: the native bar is hidden and
  // the list draws the same 4px rounded thumb the page draws, inside its own
  // frame.
  await barPage.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await barPage.waitForSelector('.form-select', { timeout: 5000 })
  await barPage.locator('.form-select').click()
  const readListThumb = () =>
    barPage.evaluate(() => {
      const frame = document.querySelector('.form-list-frame')
      const list = frame?.querySelector('.form-list')
      const thumb = frame?.querySelector('.list-thumb')
      if (!list) return { present: false }
      const listBox = list.getBoundingClientRect()
      const listStyle = getComputedStyle(list)
      if (!thumb) {
        return {
          present: true,
          nativeBar: listStyle.scrollbarWidth,
          scrollable: list.scrollHeight > list.clientHeight + 1,
          thumb: null,
        }
      }
      const box = thumb.getBoundingClientRect()
      const style = getComputedStyle(thumb)
      return {
        present: true,
        nativeBar: listStyle.scrollbarWidth,
        scrollable: list.scrollHeight > list.clientHeight + 1,
        clientHeight: list.clientHeight,
        scrollHeight: list.scrollHeight,
        thumb: {
          width: Math.round(box.width * 10) / 10,
          height: Math.round(box.height * 10) / 10,
          rightInset: Math.round((listBox.right - box.right) * 10) / 10,
          on: (thumb.getAttribute('class') || '').includes('list-thumb--on'),
          opacity: Number(style.opacity),
          transition: style.transitionDuration,
          pointer: style.pointerEvents,
          aria: thumb.getAttribute('aria-hidden'),
          radius: style.borderRadius,
        },
      }
    })
  const listRest = await readListThumb()
  check(
    'the form dropdown hides its native scrollbar',
    listRest.nativeBar === 'none' && listRest.scrollable,
    JSON.stringify(listRest),
  )
  check(
    'the dropdown draws the same 4px rounded thumb as the page',
    listRest.thumb?.width === 4 &&
      listRest.thumb?.radius === '999px' &&
      listRest.thumb?.rightInset === 4 &&
      listRest.thumb?.pointer === 'auto' &&
      listRest.thumb?.aria === 'true' &&
      listRest.thumb?.on === true &&
      listRest.thumb?.opacity === 1,
    JSON.stringify(listRest.thumb),
  )
  check(
    'the picker list thumb is visible as soon as the dropdown opens',
    listRest.thumb?.on === true && listRest.thumb?.opacity === 1,
    JSON.stringify(listRest.thumb),
  )
  const listWanted = (listRest.clientHeight - 8) * (listRest.clientHeight / listRest.scrollHeight)
  check(
    'the list thumb is as long as the share of the list on screen',
    Math.abs(listRest.thumb.height - listWanted) <= 2,
    `${listRest.thumb.height} vs ${Math.round(listWanted * 10) / 10}`,
  )
  // A wheel-less mouse can grab the drawn thumb itself. Moving outside the
  // narrow bar while held also proves pointer capture keeps the drag alive.
  const draggableListThumb = await barPage.locator('.list-thumb').boundingBox()
  await barPage.mouse.move(
    draggableListThumb.x + draggableListThumb.width / 2,
    draggableListThumb.y + draggableListThumb.height / 2,
  )
  await barPage.mouse.down()
  await barPage.mouse.move(
    draggableListThumb.x + draggableListThumb.width / 2 + 80,
    draggableListThumb.y + draggableListThumb.height / 2 + 34,
    { steps: 4 },
  )
  const listDragged = await barPage.evaluate(() => ({
    scrollTop: document.querySelector('.form-list').scrollTop,
    dragging: document.querySelector('.list-thumb').classList.contains('list-thumb--dragging'),
    on: document.querySelector('.list-thumb').classList.contains('list-thumb--on'),
  }))
  check(
    'dragging a dropdown thumb scrolls its list even outside the hit area',
    listDragged.scrollTop > 0 && listDragged.dragging && listDragged.on,
    JSON.stringify(listDragged),
  )
  await barPage.mouse.up()
  check(
    'releasing the dropdown thumb ends its drag state',
    !(await barPage.locator('.list-thumb').getAttribute('class')).includes('list-thumb--dragging'),
  )
  await barPage.evaluate(() => { document.querySelector('.form-list').scrollTop = 0 })
  // Each scroll or pointer event restarts the two-second hint. Keep the mouse
  // outside the list while measuring the open/scroll fade so pointermove does
  // not extend it by accident.
  await barPage.mouse.move(5, 5)
  await wait(LIST_SCROLLBAR.fadeDelay + 250)
  const listOpenIdle = await readListThumb()
  check(
    'an opened list thumb fades about two seconds later',
    !listOpenIdle.thumb.on && listOpenIdle.thumb.opacity === 0,
    JSON.stringify(listOpenIdle.thumb),
  )
  await barPage.evaluate(() => {
    document.querySelector('.form-list').scrollTop = 180
  })
  await wait(250)
  const listMoving = await readListThumb()
  check('scrolling the list reveals its thumb', listMoving.thumb.on && listMoving.thumb.opacity === 1, JSON.stringify(listMoving.thumb))
  await wait(LIST_SCROLLBAR.fadeDelay + 250)
  const listIdle = await readListThumb()
  check('the list thumb fades once the list is still', !listIdle.thumb.on && listIdle.thumb.opacity === 0, JSON.stringify(listIdle.thumb))
  // Moving the mouse inside the panel reveals the hint again and restarts the
  // same wait, even though the list is not scrolling.
  const listBox = await barPage.locator('.form-list').boundingBox()
  await barPage.mouse.move(listBox.x + listBox.width / 2, listBox.y + 30)
  await wait(250)
  const pointerShown = await readListThumb()
  check('moving the pointer into the list reveals its thumb', pointerShown.thumb.on && pointerShown.thumb.opacity === 1, JSON.stringify(pointerShown.thumb))
  await wait(LIST_SCROLLBAR.fadeDelay - 500)
  await barPage.mouse.move(listBox.x + listBox.width / 2 + 12, listBox.y + 50, { steps: 3 })
  await wait(700)
  const pointerReset = await readListThumb()
  check(
    'pointer movement restarts the two-second list thumb wait',
    pointerReset.thumb.on && pointerReset.thumb.opacity === 1,
    JSON.stringify(pointerReset.thumb),
  )
  await barPage.mouse.move(5, 5)
  await wait(LIST_SCROLLBAR.fadeDelay + 250)
  const pointerIdle = await readListThumb()
  check(
    'the list thumb fades again after pointer activity stops',
    !pointerIdle.thumb.on && pointerIdle.thumb.opacity === 0,
    JSON.stringify(pointerIdle.thumb),
  )
  // Reduced motion keeps the thumb and drops the fade.
  await barPage.emulateMedia({ reducedMotion: 'reduce' })
  await barPage.evaluate(() => {
    document.querySelector('.form-list').scrollTop = 40
  })
  await wait(250)
  const listReduced = await readListThumb()
  check(
    'reduced motion keeps the list thumb without the fade',
    listReduced.thumb.transition === '0s' && listReduced.thumb.on === true,
    JSON.stringify(listReduced.thumb),
  )
  await barPage.emulateMedia({ reducedMotion: null })
  await wait(LIST_SCROLLBAR.fadeDelay + 250)
  const reducedFaded = await readListThumb()
  check(
    'reduced motion still lets the list thumb leave after two seconds',
    !reducedFaded.thumb.on && reducedFaded.thumb.opacity === 0,
    JSON.stringify(reducedFaded.thumb),
  )
  // The picker's 從 list is not part of the settings separator change: it keeps
  // the revision-18 treatment (each row carries the panel's divider as its own
  // border, clipped to the padding box) because the user scoped the `.hrule`
  // switch to the settings screen.
  const pickerRows = await barPage.evaluate(() => {
    const list = document.querySelector('.form-list')
    const rows = [...list.querySelectorAll('.form-option')]
    const style = (el) => getComputedStyle(el)
    return {
      rows: rows.length,
      bordered: rows.filter((row) => style(row).borderBottomWidth === '1px').length,
      clipped: rows.filter((row) => style(row).backgroundClip === 'padding-box').length,
      // Every row but the last carries the divider; the last row closes the
      // panel instead of drawing a line against its own bottom edge.
      lastClosed: rows.length > 0 && style(rows.at(-1)).borderBottomWidth === '0px',
      noRules: list.querySelectorAll('.hrule').length,
    }
  })
  check(
    "the picker's 從 list keeps its own row dividers",
    pickerRows.rows > 1 &&
      pickerRows.bordered === pickerRows.rows - 1 &&
      pickerRows.clipped === pickerRows.rows &&
      pickerRows.lastClosed &&
      pickerRows.noRules === 0,
    JSON.stringify(pickerRows),
  )
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
  check(
    'a scroll reveals an interactive desktop thumb',
    barShown.on && barShown.opacity === 1 && barShown.pointer === 'auto',
    JSON.stringify(barShown),
  )
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

  // No wheel is needed on a fine-pointer desktop: approaching the track
  // reveals the 4px thumb, which remains available while the mouse is nearby.
  const fadedBox = await barPage.locator('.page-scrollbar').boundingBox()
  await barPage.mouse.move(fadedBox.x - 12, fadedBox.y + fadedBox.height / 2)
  await wait(250)
  const barNear = await barRead()
  check(
    'mouse proximity reveals the page scrollbar without scrolling',
    barNear.on && barNear.opacity === 1 && barNear.pointer === 'auto',
    JSON.stringify(barNear),
  )
  await wait(1300)
  const barNearHeld = await barRead()
  check(
    'the page scrollbar stays visible while the mouse remains nearby',
    barNearHeld.on && barNearHeld.opacity === 1,
    JSON.stringify(barNearHeld),
  )
  await barPage.mouse.move(5, 5)
  await wait(1300)
  const barNearLeft = await barRead()
  check(
    'leaving the scrollbar neighbourhood starts its normal fade',
    !barNearLeft.on && barNearLeft.opacity === 0,
    JSON.stringify(barNearLeft),
  )

  // The drawn thumb hugs the column's own right edge at every width: on a
  // framed desktop the 24px content gutter is not where it belongs, because
  // the footer buttons reach the content edge and the thumb would cross them.
  await barPage.setViewportSize({ width: 900, height: 900 })
  // Back to the top of the page: the thumb then sits at the start of its track,
  // which is where the corner clearance is measurable (32px, not 16px).
  await barPage.evaluate(() => window.scrollTo({ top: 0 }))
  await wait(250)
  const barWide = await barPage.evaluate(() => {
    const el = document.querySelector('.page-scrollbar')
    const column = document.querySelector('.column').getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const controls = [...document.querySelectorAll('.reader-controls .controls-button')].map((button) => {
      const box = button.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
    })
    // The thumb is drawn over the column, so a control underneath it would be
    // hit first if the thumb took pointer events; visually it would also cut
    // through the button's own edge.
    const crossesAControl = controls.some(
      (box) =>
        rect.right > box.left && rect.left < box.right && rect.bottom > box.top && rect.top < box.bottom,
    )
    return {
      gap: Math.round(column.right - rect.right),
      right: Math.round(window.innerWidth - rect.right),
      top: Math.round(rect.top * 10) / 10,
      insideColumn: rect.left >= column.left && rect.right <= column.right,
      crossesAControl,
      on: (el.getAttribute('class') || '').includes('page-scrollbar--on'),
    }
  })
  check(
    'on a wide screen the thumb sits inside the box, clear of the corner',
    barWide.gap === SCROLLBAR.frameInset &&
      barWide.top === SCROLLBAR.frameEdgeInset &&
      barWide.right > 100 &&
      barWide.insideColumn,
    JSON.stringify(barWide),
  )
  check(
    'the wide thumb never crosses a footer control',
    barWide.crossesAControl === false,
    JSON.stringify(barWide),
  )
  check('the wide thumb is still shown after the resize scroll', barWide.on)

  const pageThumbBox = await barPage.locator('.page-scrollbar').boundingBox()
  await barPage.mouse.move(pageThumbBox.x + 2, pageThumbBox.y + 4)
  await barPage.mouse.down()
  await barPage.mouse.move(pageThumbBox.x + 180, pageThumbBox.y + 104, { steps: 5 })
  const pageDragged = await barPage.evaluate(() => ({
    scrollTop: window.scrollY,
    dragging: document.querySelector('.page-scrollbar').classList.contains('page-scrollbar--dragging'),
    on: document.querySelector('.page-scrollbar').classList.contains('page-scrollbar--on'),
  }))
  check(
    'dragging the page thumb scrolls the document and survives leaving the hit area',
    pageDragged.scrollTop > 0 && pageDragged.dragging && pageDragged.on,
    JSON.stringify(pageDragged),
  )
  await barPage.mouse.up()
  check(
    'releasing the page thumb ends its drag state',
    !(await barPage.locator('.page-scrollbar').getAttribute('class')).includes('page-scrollbar--dragging'),
  )

  // Reduced motion: the thumb still appears and leaves, it just does not fade.
  await barPage.setViewportSize({ width: 390, height: 844 })
  await barPage.emulateMedia({ reducedMotion: 'reduce' })
  await barPage.evaluate(() => window.scrollTo({ top: 500 }))
  await wait(250)
  const barReduced = await barRead()
  check('reduced motion removes the thumb fade', barReduced.transition === '0s', barReduced.transition)
  check('reduced motion still shows the thumb while moving', barReduced.on, JSON.stringify(barReduced))
  await barPage.emulateMedia({ reducedMotion: null })

  // A visible fine-pointer thumb is grabbable; once hidden it must become
  // pointer-transparent again instead of leaving an invisible strip over UI.
  const footerTap = await barPage.evaluate(() => {
    const el = document.querySelector('.page-scrollbar')
    el.classList.add('page-scrollbar--on')
    const rect = el.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + 4
    const visibleHit = document.elementFromPoint(x, y)
    el.classList.remove('page-scrollbar--on')
    const hiddenHit = document.elementFromPoint(x, y)
    return {
      visible: visibleHit ? visibleHit.className || visibleHit.tagName : 'none',
      hidden: hiddenHit ? hiddenHit.className || hiddenHit.tagName : 'none',
    }
  })
  check('the visible desktop thumb owns its mouse grab', footerTap.visible === 'page-scrollbar', JSON.stringify(footerTap))
  check('the hidden thumb does not cover the UI underneath', footerTap.hidden !== 'page-scrollbar', JSON.stringify(footerTap))

  // A dropdown whose options already fit draws no hint. Use the same browser
  // context (and so the same verified dictionary cache), but a fresh page
  // with a very short option list via a local style override.
  const fitContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const fitPage = await fitContext.newPage()
  await fitPage.goto(BASE, { waitUntil: 'load' })
  await fitPage.waitForSelector('.home-actions', { timeout: 30000 })
  await fitPage.addStyleTag({
    content: '.form-list { max-height: none !important; height: 260px !important; } .form-option { min-height: 0 !important; height: 10px !important; line-height: 10px !important; padding: 0 !important; } .form-list .hrule { display: none !important; }',
  })
  await fitPage.locator('.home-actions button', { hasText: '翻卡學習' }).click()
  await fitPage.waitForSelector('.form-select', { timeout: 5000 })
  await fitPage.locator('.form-select').click()
  await wait(250)
  const fittingList = await fitPage.evaluate(() => {
    const list = document.querySelector('.form-list')
    const frame = document.querySelector('.form-list-frame')
    return {
      fits: list.scrollHeight <= list.clientHeight + 1,
      thumb: frame.querySelectorAll('.list-thumb').length,
    }
  })
  check(
    'a dropdown whose options fit draws no thumb',
    fittingList.fits && fittingList.thumb === 0,
    JSON.stringify(fittingList),
  )
  await fitContext.close()
  await barPage.close()

  // Root overscroll containment: preserve normal reading and inner-list
  // scrolling rather than applying a document-wide touchmove preventDefault.
  // The touch context also exercises the boundary guard's real event path.
  const scrollContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  })
  const scrollPage = await scrollContext.newPage()
  await scrollPage.addInitScript(() => {
    window.scrollGuardEvents = []
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      document.addEventListener(type, (event) => {
        const touch = event.touches[0] ?? event.changedTouches[0]
        window.scrollGuardEvents.push({
          type,
          cancelable: event.cancelable,
          canceled: event.defaultPrevented,
          x: touch?.clientX ?? null,
          y: touch?.clientY ?? null,
        })
      }, { passive: true })
    }
  })
  await scrollPage.goto(BASE, { waitUntil: 'load' })
  await scrollPage.waitForSelector('.home-actions', { timeout: 60000 })
  await scrollPage.evaluate(() => {
    const settings = {
      dict: { lessons: [5], defaultForm: 'masu-form' },
      card: { lessons: [5], from: 'masu-form', to: ['dictionary-form'] },
    }
    localStorage.setItem('katsuyou-settings', JSON.stringify(settings))
  })
  await scrollPage.reload({ waitUntil: 'load' })
  await scrollPage.waitForSelector('.home-actions', { timeout: 30000 })
  const rootOverscroll = await scrollPage.evaluate(() => ({
    html: getComputedStyle(document.documentElement).overscrollBehaviorY,
    body: getComputedStyle(document.body).overscrollBehaviorY,
    touch: getComputedStyle(document.documentElement).touchAction,
    position: getComputedStyle(document.body).position,
  }))
  check(
    'root overscroll is disabled on Android/iOS CSS without locking the body',
    rootOverscroll.html === 'none' &&
      rootOverscroll.body === 'none' &&
      rootOverscroll.touch === 'manipulation' &&
      rootOverscroll.position === 'static',
    JSON.stringify(rootOverscroll),
  )
  await scrollPage.locator('.home-actions button', { hasText: '字典' }).click()
  await scrollPage.locator('.picker-start').click()
  await scrollPage.waitForSelector('.reader-body', { timeout: 5000 })
  await wait(300)
  await scrollPage.evaluate(() => window.scrollTo({ top: 240 }))
  await wait(250)
  const coarseThumb = await scrollPage.evaluate(() => ({
    fine: matchMedia('(hover: hover) and (pointer: fine)').matches,
    on: document.querySelector('.page-scrollbar')?.classList.contains('page-scrollbar--on'),
    pointer: document.querySelector('.page-scrollbar')
      ? getComputedStyle(document.querySelector('.page-scrollbar')).pointerEvents
      : null,
  }))
  check(
    'a coarse-pointer phone keeps a passive scroll hint, never a mouse drag target',
    coarseThumb.fine === false && coarseThumb.on === true && coarseThumb.pointer === 'none',
    JSON.stringify(coarseThumb),
  )
  await scrollPage.evaluate(() => window.scrollTo({ top: 0 }))
  const scrollCdp = await scrollContext.newCDPSession(scrollPage)
  const touchScroll = async (x, y, dy) => {
    await scrollCdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ x, y, id: 0 }],
    })
    for (let step = 1; step <= 8; step += 1) {
      await scrollCdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove', touchPoints: [{ x, y: y + (dy * step) / 8, id: 0 }],
      })
      await wait(25)
    }
    await scrollCdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await wait(500)
    return scrollPage.evaluate(() => ({
      page: window.scrollY,
      list: document.querySelector('.form-list')?.scrollTop ?? null,
      events: window.scrollGuardEvents.splice(0),
    }))
  }
  const inwardScroll = await touchScroll(195, 600, -220)
  check(
    'a one-finger drag in the middle of a long reader still scrolls down',
    inwardScroll.page > 0 && inwardScroll.events.some((event) => event.type === 'touchmove' && event.cancelable),
    JSON.stringify(inwardScroll),
  )
  // The next probe asserts the top edge, so restore the page to its top first.
  await scrollPage.evaluate(() => window.scrollTo({ top: 0 }))
  await wait(250)
  const outwardScroll = await touchScroll(195, 300, 160)
  // Chrome can hand a root scroll to its compositor and make subsequent
  // touchmove events non-cancelable before any page listener sees them. That
  // is NOT an iOS rubber-band simulation. The pure guard tests assert the
  // cancelable-iOS event path; here verify the observable page position and
  // that the guard does not invent a scroll offset. A real-device Safari
  // bounce check remains a separate manual acceptance step.
  check(
    'a downward touch at the page top leaves its scroll position at zero',
    outwardScroll.page === 0 &&
      outwardScroll.events.some((event) => event.type === 'touchmove'),
    JSON.stringify(outwardScroll),
  )
  await scrollPage.locator('.icon-button[aria-label="設定"]').click()
  await scrollPage.waitForSelector('.settings .form-select', { timeout: 5000 })
  await scrollPage.locator('.settings .form-select').click()
  const innerBefore = await scrollPage.locator('.settings .form-list').evaluate((list) => {
    const box = list.getBoundingClientRect()
    return {
      x: box.x + box.width / 2,
      y: Math.min(box.bottom - 60, window.innerHeight - 100),
      scrollTop: list.scrollTop,
      containment: getComputedStyle(list).overscrollBehaviorY,
      thumbPointer: getComputedStyle(document.querySelector('.settings .list-thumb')).pointerEvents,
    }
  })
  check(
    'the dropdown contains overscroll instead of disabling its own scrolling',
    innerBefore.containment === 'contain' &&
      innerBefore.scrollTop === 0 &&
      innerBefore.thumbPointer === 'none',
    JSON.stringify(innerBefore),
  )
  const innerScroll = await touchScroll(innerBefore.x, innerBefore.y, -150)
  check(
    'a dropdown still scrolls normally under the iOS touch guard',
    innerScroll.list > 0 && innerScroll.page === 0,
    JSON.stringify(innerScroll),
  )
  await scrollContext.close()

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

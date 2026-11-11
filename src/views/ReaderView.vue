<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight, Settings as SettingsIcon } from 'lucide-vue-next'
import RubyWord from '../components/RubyWord.vue'
import { groupLabel } from '../dict/forms.js'
import { sentenceParts } from '../study/highlight.js'
import { swipeEnabled } from '../ui/swipe.js'
import { dragAxis, dragDirection, dragShift } from '../ui/drag.js'
import { prefersReducedMotion, slideRow } from '../ui/motion.js'
import { PAGING_GAP, READER_WINDOW } from '../ui/window.js'
import { usePagingWindow } from '../ui/paging-window.js'
import { readerEntries } from '../study/window-views.js'

const store = inject('store')
const session = store.session
let pointer = null

// Page turn is a finger-tracking drag: while the finger is down, the paging
// row translates with it 1:1 so the word is under the hand. On release past
// the threshold the row finishes the page as one decelerating move from where
// the finger left it; the command swaps the word under that move, so the
// window advance is never visible. A shorter drag settles back to rest.
const rowEl = ref(null)
const dragX = ref(0)
const held = ref(false)
const sliding = ref(false)

const SETTLE_FALLBACK_MS = 600
let settleTimer = null
let rowAnimation = null

const item = computed(() => session.items[session.index] ?? null)
const defaultFormId = computed(() => session.settings.dict.defaultForm)
const showReading = computed(() => session.settings.dict.showReading)
const canPrev = computed(() => session.index > 0)
const canNext = computed(() => session.index < session.items.length - 1)
// While the row is held or settling, the neighbours peek in at the edges and
// the footer controls wait: one move at a time.
const paging = computed(() => held.value || sliding.value)

// The paging window: 5 mounted slots, the current word always in the 3rd. The
// row of positions is state that each turn shifts by one, and every slot
// carries its own word's forms.
// Named `pagingSlotRow`, never `window`: this file still calls the global
// `window.scrollTo`, and a local of that name would shadow it.
const pagingSlotRow = usePagingWindow(session, READER_WINDOW)
const slots = computed(() =>
  readerEntries(session.items, pagingSlotRow.value, session.settings.dict),
)

// A new word opens at the top of the page: the default form is the first block.
watch(
  () => [session.index, defaultFormId.value],
  () => window.scrollTo({ top: 0, behavior: 'auto' }),
)

function canGo(direction) {
  return direction === 'next' ? canNext.value : canPrev.value
}

function rowWidth() {
  return rowEl.value?.clientWidth ?? 0
}

function endSlide() {
  clearTimeout(settleTimer)
  settleTimer = null
  if (rowAnimation) {
    rowAnimation.cancel()
    rowAnimation = null
  }
  sliding.value = false
}

// One settle move of the whole row: from where the finger left it (or from
// one item width away for a footer press) to rest. The command has already
// swapped the word, so the row carries the old word out and the new one in —
// the same pushed-in-from-the-edge slide the direct swap used to play.
function startSlide(fromPx) {
  endSlide()
  sliding.value = true
  rowAnimation = slideRow(rowEl.value, fromPx, () => {
    rowAnimation = null
    sliding.value = false
    clearTimeout(settleTimer)
    settleTimer = null
  })
  settleTimer = setTimeout(endSlide, SETTLE_FALLBACK_MS)
}

function sendMove(direction) {
  window.scrollTo({ top: 0, behavior: 'auto' })
  store.send(direction === 'next' ? 'dict.next' : 'dict.prev')
}

// One path for gestures and for the footer controls: swap the word at once
// under the settle move. A press while a move is settling drops that move
// first and runs the new one — movement is finished, never stacked.
function go(direction, releasedX = 0) {
  if (!direction || !canGo(direction) || paging.value) return
  dragX.value = 0
  if (prefersReducedMotion()) {
    // No motion to wait for: change the word at once.
    sendMove(direction)
    return
  }
  sendMove(direction)
  // Keep the same 24px seam throughout a turn: compensate for the width plus
  // gap restored by the direct swap, less the finger's completed travel.
  const pitch = rowWidth() + PAGING_GAP
  const from = direction === 'next' ? pitch + releasedX : releasedX - pitch
  startSlide(from)
}

// The spring back: a release below the threshold, or into a wall. Nothing
// committed, so the row simply settles to where it started.
function settleBack() {
  const from = dragX.value
  dragX.value = 0
  if (prefersReducedMotion() || from === 0) return
  startSlide(from)
}

onBeforeUnmount(() => {
  endSlide()
})

function onDown(event) {
  // Above 550px the page shows its background: a desktop reader where text
  // selection matters more than swiping. Only the footer buttons page there.
  if (!swipeEnabled(window.innerWidth)) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (paging.value) return
  pointer = {
    x: event.clientX,
    y: event.clientY,
    axis: null,
    lastDx: 0,
    width: rowWidth(),
  }
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onMove(event) {
  if (!pointer) return
  const dx = event.clientX - pointer.x
  const dy = event.clientY - pointer.y
  if (!pointer.axis) {
    const axis = dragAxis(dx, dy)
    if (!axis) return
    pointer.axis = axis
    if (axis === 'x') held.value = true
  }
  if (pointer.axis !== 'x') return
  pointer.lastDx = dx
  // Under reduced motion the drag stays invisible: the release still changes
  // the word directly, but nothing tracks the finger on the way there.
  if (!prefersReducedMotion()) {
    dragX.value = dragShift(dx, {
      canPrev: canPrev.value,
      canNext: canNext.value,
      width: pointer.width,
    })
  }
}

function onUp() {
  if (!pointer) return
  const { axis, lastDx } = pointer
  pointer = null
  held.value = false
  if (axis !== 'x') return
  // The finger travel names the direction. A wall — the first word backward,
  // the last word forward — names nothing at any distance.
  const direction = dragDirection(lastDx, {
    canPrev: canPrev.value,
    canNext: canNext.value,
  })
  if (direction) {
    go(direction, dragX.value)
    return
  }
  settleBack()
}

function back() {
  store.send('nav.go', { screen: 'picker' })
}

function openSettings() {
  store.send('nav.go', { screen: 'settings' })
}
</script>

<template>
  <section class="reader">
    <header class="bar bar--sticky">
      <button class="icon-button" type="button" aria-label="返回" @click="back"><ArrowLeft :size="22" aria-hidden="true" /></button>
      <h1 class="bar-title">學習（{{ session.index + 1 }}/{{ session.items.length }}）</h1>
      <button class="icon-button" type="button" aria-label="設定" @click="openSettings"><SettingsIcon :size="22" aria-hidden="true" /></button>
    </header>

    <div
      v-if="item"
      class="reader-body"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onUp"
    >
      <div
        ref="rowEl"
        class="reader-window"
        :class="{ 'reader-window--paging': paging }"
        :style="{ transform: `translateX(${dragX}px)` }"
      >
        <article
          v-for="entry in slots"
          :key="entry.key"
          class="reader-page"
          :class="{ 'reader-page--current': entry.current }"
          :aria-hidden="entry.current ? undefined : 'true'"
          :data-at="entry.at"
          :style="{ transform: `translateX(calc(${entry.offset}% + ${entry.gap}px))` }"
        >
          <template v-if="entry.forms.length">
            <section
              v-for="form in entry.forms"
              :key="form.id"
              class="form-block"
              :class="{ 'form-block--default': form.isDefault }"
              :data-form="form.id"
              :aria-current="form.isDefault ? 'true' : undefined"
            >
              <h2 class="form-name">{{ form.name }}</h2>
              <div class="word" :class="{ 'word--error': form.errorUsage }">
                <RubyWord
                  :text="form.data.vol"
                  :reading="form.data.japanese"
                  :show-reading="showReading"
                  :error="form.errorUsage"
                />
              </div>
              <p class="gloss">{{ form.data.chinese }}</p>
              <div v-if="form.isFirst" class="tags">
                <span class="tag">{{ groupLabel(form.data.group) }}</span>
                <span class="tag">第{{ entry.lesson }}課</span>
              </div>

              <!-- The form's own note sits above the example sentences, laid
                   out like a sentence but marked with its own colour. -->
              <p v-if="form.note" class="note-line">{{ form.note }}</p>

              <div v-if="form.data.sentence?.length" class="block">
                <h3 class="block-title">例句：</h3>
                <div
                  v-for="(sentence, at) in form.data.sentence"
                  :key="at"
                  class="sentence"
                >
                  <p class="sentence-ja" lang="ja"><span
                    v-for="(part, index) in sentenceParts(sentence, form.data.vol)"
                    :key="index"
                    :class="{ 'sentence-hit': part.highlight }"
                  >{{ part.text }}</span></p>
                  <p class="sentence-zh">{{ sentence.chinese }}</p>
                  <p v-if="sentence.note" class="note-line">{{ sentence.note }}</p>
                </div>
              </div>
            </section>
          </template>
        </article>
      </div>
    </div>

    <footer class="reader-controls">
      <button
        class="button ghost controls-button"
        type="button"
        :disabled="!canPrev || paging"
        @click="go('prev')"
      >
        <ChevronLeft :size="18" aria-hidden="true" />
        <span>上一個</span>
      </button>
      <button
        class="button ghost controls-button"
        type="button"
        :disabled="!canNext || paging"
        @click="go('next')"
      >
        <span>下一個</span>
        <ChevronRight :size="18" aria-hidden="true" />
      </button>
    </footer>
  </section>
</template>

<style scoped>
.reader {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
}

.bar-title {
  flex: 1;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.icon-button {
  border: 0;
  background: transparent;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  cursor: pointer;
  flex: 0 0 48px;
}

.icon-button:hover {
  background: rgba(36, 33, 58, 0.06);
}

.reader-body {
  flex: 1;
  overflow: hidden;
  touch-action: pan-y;
  padding: 4px 0 8px;
  /* The gesture surface reaches the column's true edge while paging, so a
     word slides to the edge instead of stopping at the side padding. */
  margin-left: calc(-1 * var(--page-gutter));
  margin-right: calc(-1 * var(--page-gutter));
}

/* The paging window: one slot per mounted word, pushed sideways by the slot's
   own offset so the 3rd slot always sits where the current word belongs. The
   window is the strip the finger drags — its own transform carries the whole
   row 1:1 while held and the settle move after release. */
.reader-window {
  position: relative;
  width: calc(100% - 2 * var(--page-gutter));
  margin: 0 auto;
  min-height: 100%;
  will-change: transform;
}

/* Where gesture paging is on, a drag must page rather than select text.
   Above 550px text selection stays available (see the swipe gate in the view). */
@media (max-width: 550px) {
  .reader-body {
    user-select: none;
    -webkit-user-select: none;
  }
}

/* Only the current page contributes to document flow; neighbours are taken
   out of flow so they never add scroll height or capture taps, and the window
   clips them so nothing shows past the column edge. */
.reader-page {
  will-change: transform;
}

.reader-page:not(.reader-page--current) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  pointer-events: none;
  visibility: hidden;
}

.reader-page--current {
  position: relative;
  pointer-events: auto;
  visibility: visible;
}

/* While the row is under the finger or settling, the neighbours peek in at
   the edges: the drag is real, so what is behind it is really there. */
.reader-window--paging .reader-page:not(.reader-page--current) {
  visibility: visible;
  /* A revealed neighbour is a real page, hit-testable like the card faces. */
  pointer-events: auto;
}

@media (prefers-reduced-motion: reduce) {
  .reader-window {
    will-change: auto;
  }
}

/* Every form block shares one format: no tinted panel, no accent border, the
   same padding and a hairline separator. The default form is simply first. */
.form-block {
  padding: 16px 0 8px;
  border-top: 1px solid var(--line);
  background: none;
}

.form-block:first-child {
  border-top: 0;
  padding-top: 4px;
}

.form-name {
  margin: 0 0 6px;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
}

.word {
  font-size: 2rem;
  font-weight: 600;
  margin-top: 2px;
  text-align: center;
}

/* A form flagged error_usage is kept for conjugation practice only: its word
   is coloured with the error colour and struck through twice, both drawn
   inside RubyWord (the `error` prop); `.word--error` remains as the locator
   the tests and the view share. */

.gloss {
  margin: 8px 0 10px;
  font-size: 1rem;
  color: var(--ink-soft);
  text-align: center;
}

.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.tag {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  font-size: 0.78rem;
  color: var(--ink-soft);
  letter-spacing: 0.06em;
}

.block {
  margin-top: 14px;
}

.block-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-soft);
  letter-spacing: 0.14em;
  margin: 0 0 8px;
}

.sentence {
  margin-bottom: 10px;
}

.sentence-ja {
  margin: 0;
  font-size: 0.98rem;
  line-height: 1.65;
}

/* The word under study, marked where it appears in the example sentence. */
.sentence-hit {
  color: var(--highlight);
  font-weight: 600;
}

.sentence-zh {
  margin: 2px 0 0;
  font-size: 0.84rem;
  color: var(--ink-soft);
}

/* A note is laid out like the example sentences — same reading edge, not
   centred — and marked by its own colour. */
.note-line {
  margin: 6px 0 0;
  font-size: 0.92rem;
  line-height: 1.65;
  color: var(--note);
}

.reader-controls {
/* The fade band lives entirely above the controls: solid column colour behind
   the buttons, transparency only in the top padding. No hairline underline. */

  position: sticky;
  bottom: 0;
  z-index: 2;
  display: flex;
  gap: 12px;
  margin-top: 12px;
  padding: 28px 0 max(10px, env(safe-area-inset-bottom));
  background: linear-gradient(
    to top,
    var(--column) 0,
    var(--column) calc(100% - 28px),
    transparent 100%
  );
}

/* Tall enough to stay clear of the window edge, with the footer's own 20px
   of column padding below it. */
.reader-controls .controls-button {
  min-height: 50px;
}

.controls-button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
</style>

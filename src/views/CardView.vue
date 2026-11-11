<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-vue-next'
import RubyWord from '../components/RubyWord.vue'
import CompletePanel from '../components/CompletePanel.vue'
import { dragAxis, dragDirection, dragShift } from '../ui/drag.js'
import { prefersReducedMotion, slideRow } from '../ui/motion.js'
import { CARD_WINDOW, PAGING_GAP } from '../ui/window.js'
import { usePagingWindow } from '../ui/paging-window.js'
import { cardEntries } from '../study/window-views.js'

const store = inject('store')
const session = store.session

// Paging is a finger-tracking drag: while the finger is down, the row of
// cards translates with it 1:1 so the card is under the hand. On release past
// the threshold the row finishes the page as one decelerating move from where
// the finger left it; the command swaps the card under that move. A shorter
// drag settles back to rest, and a tap (no drag at all) turns the card over.
const rowEl = ref(null)
const dragX = ref(0)
const held = ref(false)
const sliding = ref(false)

// The phase ends on its own animation event, not on a timer that guesses how
// long the CSS takes. This value is only a safety net for an event that never
// arrives.
const SETTLE_FALLBACK_MS = 600
let settleTimer = null
let rowAnimation = null

// Paging is a flat slide, so the card never turns while it travels. A card the
// reader had flipped to its answer keeps that answer while it slides in, and
// the incoming card is snapped to its face off-screen before it enters.
const turning = computed(() => held.value || sliding.value)

let pointer = null

const item = computed(() => session.items[session.index] ?? null)
const cardSettings = computed(() => session.settings.card)
// The paging window: 9 mounted slots, the current card always in the 3rd. The
// row of positions is state that each turn shifts by one — delete the front,
// append the back — and every slot carries its own card's face and back.
const pagingSlotRow = usePagingWindow(session, CARD_WINDOW)
const slots = computed(() => cardEntries(session.items, pagingSlotRow.value, cardSettings.value))

const onLastCard = computed(() => session.index >= session.items.length - 1)
// The first card has no card behind it, so its backward drag is completely
// still: the card never follows the finger and never changes.
const onFirstCard = computed(() => session.index === 0)

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
// swapped the card, so the row carries the old card out and the new one in —
// the new card slides in from the edge the gesture came from.
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

// The spring back: a release below the threshold, or into the first-card
// wall. Nothing committed, so the row simply settles to where it started.
function settleBack() {
  const from = dragX.value
  dragX.value = 0
  if (prefersReducedMotion() || from === 0) return
  startSlide(from)
}

// One move can be waiting for a frame: the newest press wins.
let queuedMove = null
let queuedFrame = false

function moveCard(direction, releasedX = 0) {
  if (!direction || held.value) return

  if (prefersReducedMotion()) {
    // No motion to wait for: change the card at once.
    endSlide()
    dragX.value = 0
    if (direction === 'next' && onLastCard.value) store.send('study.finish')
    else if (direction === 'next') store.send('card.next')
    else store.send('card.prev')
    return
  }

  // One phase at a time. A press while the new card is still settling drops
  // that move first and makes the new one on the next frame: the interrupted
  // movement is finished, never stacked, and two presses in one frame keep
  // the newest direction instead of both running.
  if (sliding.value || queuedFrame) {
    endSlide()
    queuedMove = direction
    if (!queuedFrame) {
      queuedFrame = true
      requestAnimationFrame(() => {
        queuedFrame = false
        const next = queuedMove
        queuedMove = null
        if (next) moveCard(next)
      })
    }
    return
  }

  dragX.value = 0
  // The swap is direct and the new card settles in from the edge the gesture
  // came from. Leaving the last card is the end of the run: the panel takes
  // the card's place instead of another card sliding in.
  if (direction === 'next' && onLastCard.value) {
    store.send('study.finish')
    return
  }
  store.send(direction === 'next' ? 'card.next' : 'card.prev')
  // The page pitch includes the visible gap. The direct swap restores the
  // current slot's position, so the settle makes up that pitch minus the
  // distance the finger already travelled; the gap never collapses mid-turn.
  const pitch = rowWidth() + PAGING_GAP
  startSlide(direction === 'next' ? pitch + releasedX : releasedX - pitch)
}

onBeforeUnmount(() => {
  queuedMove = null
  queuedFrame = false
  endSlide()
})

function onDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (held.value || sliding.value) return
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
  // the card directly, but nothing tracks the finger on the way there.
  if (!prefersReducedMotion()) {
    dragX.value = dragShift(dx, {
      canPrev: !onFirstCard.value,
      canNext: true,
      width: pointer.width,
    })
  }
}

function onUp() {
  if (!pointer) return
  const { axis, lastDx } = pointer
  pointer = null
  held.value = false
  if (axis === null) {
    store.send('card.flip')
    return
  }
  if (axis !== 'x') return
  // The finger travel names the direction. The first card's backward drag
  // names nothing at all: nothing moved, so nothing springs back.
  const direction = dragDirection(lastDx, {
    canPrev: !onFirstCard.value,
    canNext: true,
  })
  if (direction) {
    moveCard(direction, dragX.value)
    return
  }
  settleBack()
}

// The last card ends the run: the right-hand control becomes 完成. Pressing it
// runs the same move as a swipe, and the move itself ends the run on the last
// card, so both ways out of a card run behave identically.
function nextOrFinish() {
  moveCard('next')
}

function prevCard() {
  if (session.index === 0) return
  moveCard('prev')
}

function back() {
  store.send('nav.go', { screen: 'picker' })
}

function openSettings() {
  store.send('nav.go', { screen: 'settings' })
}
</script>

<template>
  <section class="cards">
    <header class="bar bar--sticky">
      <button class="icon-button" type="button" aria-label="返回" @click="back"><ArrowLeft :size="22" aria-hidden="true" /></button>
      <h1 class="bar-title">練習（{{ session.index + 1 }}/{{ session.items.length }}）</h1>
      <button class="icon-button" type="button" aria-label="設定" @click="openSettings"><SettingsIcon :size="22" aria-hidden="true" /></button>
    </header>

    <div
      v-if="item && !session.finished"
      class="card-stage"
      :class="{ 'card-stage--moving': held || sliding }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onUp"
    >
      <div
        ref="rowEl"
        class="card-window"
        :class="{ 'card-window--paging': held || sliding }"
        :style="{ transform: `translateX(${dragX}px)` }"
      >
        <div
          v-for="entry in slots"
          :key="entry.key"
          class="card-slot"
          :class="{ 'card-slot--current': entry.current }"
          :aria-hidden="entry.current ? undefined : 'true'"
          :data-at="entry.at"
          :style="{ transform: `translateX(calc(${entry.offset}% + ${entry.gap}px))` }"
        >
          <div
            v-if="entry.face"
            class="card"
            :class="{
              'card--current': entry.current,
              'card--flipped': session.flipped && entry.current,
              'card--no-turn': turning,
            }"
          >
            <div class="card-inner">
              <div
                class="card-side card-face"
                :aria-hidden="entry.current && session.flipped ? 'true' : undefined"
              >
                <div class="word">
                  <RubyWord
                    :text="entry.face.word"
                    :reading="entry.face.reading"
                    :show-reading="cardSettings.showReading"
                  />
                </div>
                <div v-if="entry.current && entry.face.tags.length" class="tags">
                  <span
                    v-for="tag in entry.face.tags"
                    :key="tag.kind"
                    class="tag"
                    :class="tag.className"
                  >{{ tag.text }}</span>
                </div>
                <p class="prompt">{{ entry.face.prompt }}</p>
              </div>

              <div
                class="card-side card-back"
                :aria-hidden="entry.current && session.flipped ? undefined : 'true'"
              >
                <div v-if="entry.current && entry.back.tags.length" class="tags">
                  <span
                    v-for="tag in entry.back.tags"
                    :key="tag.kind"
                    class="tag tag--answer"
                    :class="tag.className"
                  >{{ tag.text }}</span>
                </div>
                <div class="word">
                  <RubyWord
                    :text="entry.back.word"
                    :reading="entry.back.reading"
                    :show-reading="cardSettings.showReading"
                  />
                </div>
                <p class="gloss">{{ entry.back.gloss }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <CompletePanel
      v-if="session.finished"
      mode="card"
      :results="session.results"
    />

    <footer v-if="!session.finished" class="card-controls">
      <button
        class="button ghost control"
        type="button"
        :disabled="session.index === 0"
        @click="prevCard"
      >
        ‹ 上一張
      </button>
      <button class="button ghost control" type="button" @click="nextOrFinish">
        {{ onLastCard ? '完成' : '下一張 ›' }}
      </button>
    </footer>
  </section>
</template>

<style scoped>
.cards {
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

.card-stage {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0 6px;
  touch-action: pan-y;
  user-select: none;
  /* While paging, the stage reaches the column's true edge: the card can
     slide all the way out instead of stopping short of the side padding. The
     window inside keeps the content width, so the card never changes size. */
  margin-left: calc(-1 * var(--page-gutter));
  margin-right: calc(-1 * var(--page-gutter));
}

/* The paging window: one slot per mounted card, laid on top of each other and
   pushed sideways by the slot's own offset, so the 3rd slot always sits where
   the current card belongs. The window is the strip the finger drags — its
   own transform carries the whole row 1:1 while held and the settle move
   after release. A percentage transform on it would be measured against its
   own box, so only pixels move it.

   The stage's height is content-sized and every slot is absolute, so a 100%
   height here resolves to zero in Chromium. A real minimum height gives the
   slot faces a paint area. The stage, not this zero-width-at-rest clip path,
   clips the strip while it moves; at rest the neighbours are hidden. */
.card-window {
  position: relative;
  width: calc(100% - 2 * var(--page-gutter));
  min-height: 340px;
  will-change: transform;
}

.card-slot {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  /* The stage owns the gesture for every slot. Keeping the faces hit-testable
     makes a revealed neighbour a real card, not an untouchable picture. */
  pointer-events: auto;
}

/* No raised current slot: while paging, DOM order lets the next card paint
   into the edge uncovered by the current one. */

/* Only the current card is real to the reader: the other eight are mounted so a
   turn never lays anything out, but they are clipped, hidden and out of the
   accessibility tree, exactly like the dictionary's neighbours. */
.card-slot:not(.card-slot--current) {
  visibility: hidden;
}

.card-slot:not(.card-slot--current) .card {
  /* Neighbours must never flip or animate. */
  animation: none !important;
  transition: none !important;
}

/* While the row is under the finger or settling, the neighbours peek in at
   the edges: the drag is real, so what is behind it is really there. */
.card-window--paging .card-slot:not(.card-slot--current) {
  visibility: visible;
}

/* While the row slides, the stage clips it. A card that travels past the
   column edge would otherwise paint outside and give the page a horizontal
   scrollbar. At rest the stage stays open, so the card keeps its soft
   shadow. */
.card-stage--moving {
  /* Only the horizontal spill is clipped, so the card keeps its downward
     shadow while it travels. */
  overflow-x: clip;
}

.card {
  position: relative;
  width: 100%;
  min-height: 340px;
  perspective: 1600px;
  will-change: transform;
  cursor: pointer;
}

.card-inner {
  position: relative;
  width: 100%;
  min-height: 340px;
  transform-style: preserve-3d;
  /* One turn, decelerating: the card no longer snaps through the first half
     and then crawls through the second. */
  transition: transform 240ms var(--ease-turn);
}

.card--flipped .card-inner {
  transform: rotateY(180deg);
}

.card-side {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 20px;
  border-radius: 24px;
  background: var(--surface);
  border: 1px solid var(--line);
  box-shadow: 0 12px 30px rgba(20, 16, 50, 0.08);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.card-back {
  transform: rotateY(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .card-inner {
    transition: none;
  }
  .card-window {
    will-change: auto;
  }
}

/* Paging must stay flat: no rotation, no fade. The card travels in one straight
   line, so the turn is cut while it slides and the element can never play a
   rotateY transition during the move. */
.card--no-turn .card-inner {
  transition: none;
}

.card-face,
.card-back {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.word {
  font-size: 2.5rem;
  font-weight: 600;
}

.gloss {
  margin: 0;
  font-size: 1.05rem;
  color: var(--ink-soft);
}

.tags {
  display: flex;
  gap: 8px;
}

.tag {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  font-size: 0.78rem;
  color: var(--ink-soft);
  letter-spacing: 0.06em;
}

.prompt {
  margin: 6px 0 0;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
}

.card-controls {
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

.card-controls .control {
  min-height: 50px;
}

.control {
  flex: 1;
}
</style>

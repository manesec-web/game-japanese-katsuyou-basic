<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import RubyWord from '../components/RubyWord.vue'
import CompletePanel from '../components/CompletePanel.vue'
import { cardDirectionAt } from '../ui/swipe.js'
import { prefersReducedMotion } from '../ui/motion.js'
import { CARD_WINDOW } from '../ui/window.js'
import { usePagingWindow } from '../ui/paging-window.js'
import { cardEntries } from '../study/window-views.js'

const store = inject('store')
const session = store.session
// Which side the incoming card slides in from: 'next' enters from the right
// (travelling right to left), 'prev' mirrors it. The drag is invisible: the
// card never follows the finger, so there is nothing to spring back and
// nothing to settle twice.
const enterFrom = ref(null)

// The phase ends on its own DOM event, not on a timer that guesses how long
// the CSS takes. This value is only a safety net for an event that never
// arrives.
const ENTER_FALLBACK_MS = 600

// Paging is a flat slide, so the card never turns while it travels. A card the
// reader had flipped to its answer keeps that answer while it slides in, and
// the incoming card is snapped to its face off-screen before it enters.
const turning = computed(() => Boolean(enterFrom.value))

let pointer = null
let enterTimer = null

const item = computed(() => session.items[session.index] ?? null)
const cardSettings = computed(() => session.settings.card)
// The paging window: 9 mounted slots, the current card always in the 3rd. The
// row of positions is state that each turn shifts by one — delete the front,
// append the back — and every slot carries its own card's face and back.
const pagingSlotRow = usePagingWindow(session, CARD_WINDOW)
const slots = computed(() => cardEntries(session.items, pagingSlotRow.value, cardSettings.value))

function onDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  pointer = { x: event.clientX, y: event.clientY, axis: null, lastDx: 0 }
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onMove(event) {
  if (!pointer) return
  const dx = event.clientX - pointer.x
  const dy = event.clientY - pointer.y
  if (!pointer.axis) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    pointer.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  }
  if (pointer.axis !== 'x') return
  pointer.lastDx = dx
}

function onUp() {
  if (!pointer) return
  const axis = pointer.axis
  // The finger travel names the direction. The first card's backward drag
  // names nothing at all: nothing moved, so nothing springs back.
  const direction = axis === 'x' ? cardDirectionAt(pointer.lastDx, { atFirst: onFirstCard.value }) : null
  pointer = null
  if (direction) {
    moveCard(direction)
    return
  }
  if (axis === null) store.send('card.flip')
}

const onLastCard = computed(() => session.index >= session.items.length - 1)
// The first card has no card behind it, so its backward drag is completely
// still: it never names a direction and never changes the card.
const onFirstCard = computed(() => session.index === 0)

function endEnter() {
  clearTimeout(enterTimer)
  enterTimer = null
  enterFrom.value = null
}

function onCardAnimationEnd(event) {
  if (event.target !== event.currentTarget) return
  if (!enterFrom.value) return
  endEnter()
}

// One move can be waiting for a frame: the newest press wins.
let queuedMove = null
let queuedFrame = false

function moveCard(direction) {
  if (prefersReducedMotion()) {
    // No motion to wait for: change the card at once.
    enterFrom.value = null
    clearTimeout(enterTimer)
    enterTimer = null
    if (direction === 'next' && onLastCard.value) store.send('study.finish')
    else if (direction === 'next') store.send('card.next')
    else store.send('card.prev')
    return
  }

  // One phase at a time. A press while the new card is still sliding drops
  // the slide first and makes the move on the next frame: removing the
  // animation and restarting it in the same frame leaves the browser with no
  // class change to run, so the new slide would never start. Two presses in
  // one frame keep the newest direction instead of both running.
  if (enterFrom.value || queuedFrame) {
    endEnter()
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

  // The swap is direct and the new card slides in from the edge the gesture
  // came from. Leaving the last card is the end of the run: the panel takes
  // the card's place instead of another card sliding in.
  if (direction === 'next' && onLastCard.value) {
    store.send('study.finish')
    return
  }
  if (direction === 'next') store.send('card.next')
  else store.send('card.prev')
  enterFrom.value = direction
  clearTimeout(enterTimer)
  enterTimer = setTimeout(endEnter, ENTER_FALLBACK_MS)
}

onBeforeUnmount(() => {
  queuedMove = null
  queuedFrame = false
  clearTimeout(enterTimer)
})

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
      <button class="icon-button" type="button" aria-label="返回" @click="back">←</button>
      <h1 class="bar-title">練習（{{ session.index + 1 }}/{{ session.items.length }}）</h1>
      <button class="icon-button" type="button" aria-label="設定" @click="openSettings">⚙</button>
    </header>

    <div
      v-if="item && !session.finished"
      class="card-stage"
      :class="{ 'card-stage--moving': Boolean(enterFrom) }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onUp"
    >
      <div class="card-window">
        <div
          v-for="entry in slots"
          :key="entry.key"
          class="card-slot"
          :class="{ 'card-slot--current': entry.current }"
          :aria-hidden="entry.current ? undefined : 'true'"
          :data-at="entry.at"
          :style="{ transform: `translateX(${entry.offset}%)` }"
        >
          <div
            v-if="entry.face"
            class="card"
            :class="{
              'card--current': entry.current,
              'card--flipped': session.flipped && entry.current,
              'card--no-turn': turning,
              'card--enter-next': enterFrom === 'next' && entry.current,
              'card--enter-prev': enterFrom === 'prev' && entry.current,
            }"
            @animationend="entry.current && onCardAnimationEnd($event)"
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
  font-size: 1.25rem;
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
}

/* The paging window: one slot per mounted card, laid on top of each other and
   pushed sideways by the slot's own offset, so the 3rd slot always sits where
   the current card belongs. The window itself is never translated — a
   percentage transform on the window would be measured against the window's
   own (nine times wider) box, not the stage. */
.card-window {
  position: relative;
  width: 100%;
  height: 100%;
  overflow-x: clip;
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
  pointer-events: none;
}

.card-slot--current {
  pointer-events: auto;
  z-index: 1;
}

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

/* While the card slides in, the stage clips it. A card that travels to ±112%
   would otherwise paint outside the column and give the page a horizontal
   scrollbar. At rest the stage stays open, so the card keeps its soft
   shadow. */
.card-stage--moving {
  /* Only the horizontal spill is clipped, so the card keeps its downward
     shadow while it travels. */
  overflow-x: clip;
}

/* The window clips the neighbours; the moving class only adds the enter
   animation to the current card. */

.card {
  position: relative;
  width: 100%;
  min-height: 340px;
  perspective: 1600px;
  /* Nothing transitions at rest: the only transform in the card's life is the
     single enter slide, and it ends on the card's own resting state, so the
     settle frame changes nothing and cannot flash or move twice. The layer is
     promoted once and stays promoted — tearing `will-change` down at the exact
     settle frame is what used to flash on phones. */
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
}

/* Paging must stay flat: no rotation, no fade. The card travels in one straight
   line, so the turn is cut while it slides and the element can never play a
   rotateY transition during the move. */
.card--no-turn .card-inner {
  transition: none;
}

/* Entering: the new card is pushed in from the edge the gesture came from,
   one short decelerating slide. */
.card--enter-next {
  animation: card-enter-next 190ms var(--ease-slide);
}

.card--enter-prev {
  animation: card-enter-prev 190ms var(--ease-slide);
}

/* Swiping right-to-left brings the next card in from the right edge and moves
   it leftwards; swiping left-to-right mirrors that. */
@keyframes card-enter-next {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes card-enter-prev {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .card--enter-next,
  .card--enter-prev {
    animation: none;
    transition: none;
  }
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

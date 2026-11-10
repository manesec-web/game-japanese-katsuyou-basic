<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import RubyWord from '../components/RubyWord.vue'
import CompletePanel from '../components/CompletePanel.vue'
import { formName } from '../dict/forms.js'
import { backTags, frontTags } from '../study/card-tags.js'
import { cardDirectionAt, cardDrag } from '../ui/swipe.js'
import { prefersReducedMotion } from '../ui/motion.js'

const store = inject('store')
const session = store.session
const offset = ref(0)
const dragging = ref(false)
// Which direction the outgoing card is travelling, or null when it is still.
const leaving = ref(null)
// Which side the incoming card slides in from: 'next' enters from the right
// (travelling right to left), 'prev' mirrors it.
const enterFrom = ref(null)

// The phases end on their own DOM event, not on a timer that guesses how long
// the CSS takes. A timer shorter than the transition cuts the outgoing card
// off mid-slide and the new card then appears at the opposite edge, which is
// what made the turn feel like a rebound. These two values are only a safety
// net for an event that never arrives.
const LEAVE_FALLBACK_MS = 600
const ENTER_FALLBACK_MS = 600

// Paging is a flat slide, so the card never turns while it travels. A card the
// reader had flipped to its answer slides out showing that answer instead of
// spinning back to the face mid-flight, and the incoming card is snapped to its
// face off-screen before it enters.
const turning = computed(() => Boolean(leaving.value) || Boolean(enterFrom.value))

let pointer = null
let leaveTimer = null
let enterTimer = null

const item = computed(() => session.items[session.index] ?? null)
const cardSettings = computed(() => session.settings.card)
const source = computed(() => item.value?.verb?.[cardSettings.value.from] ?? null)
const target = computed(() => item.value?.verb?.[item.value?.targetForm] ?? null)
const showReading = computed(() => cardSettings.value.showReading)
const faceTags = computed(() => frontTags(cardSettings.value, source.value))
// The answer side always names the asked form and the verb's class.
const answerTags = computed(() => backTags(item.value?.targetForm, target.value))

function onDown(event) {
  if (event.pointerType === 'mouse' && event.button !== 0) return
  pointer = { x: event.clientX, y: event.clientY, axis: null, lastDx: 0 }
  dragging.value = true
  offset.value = 0
  event.currentTarget.setPointerCapture?.(event.pointerId)
}

function onMove(event) {
  if (!pointer || leaving.value) return
  const dx = event.clientX - pointer.x
  const dy = event.clientY - pointer.y
  if (!pointer.axis) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    pointer.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
  }
  if (pointer.axis !== 'x') return
  pointer.lastDx = dx
  if (prefersReducedMotion()) return
  // The first card has nothing behind it: a right-hand drag there is damped to
  // a third of the finger and capped, so the card pulls against the edge and
  // then springs back instead of leaving.
  offset.value = cardDrag(dx, { atFirst: onFirstCard.value })
}

function onUp() {
  if (!pointer) return
  const axis = pointer.axis
  // The raw finger travel names the direction: damping only shortens the
  // follow, and a damped first card is blocked before the threshold matters.
  const direction = axis === 'x' ? cardDirectionAt(pointer.lastDx, { atFirst: onFirstCard.value }) : null
  pointer = null
  dragging.value = false
  if (direction) {
    moveCard(direction)
    return
  }
  offset.value = 0
  if (axis === null) store.send('card.flip')
}

const onLastCard = computed(() => session.index >= session.items.length - 1)
// The first card has no card behind it, so its backward drag resists.
const onFirstCard = computed(() => session.index === 0)

// The outgoing card reaches the edge, then the item swaps while nothing is
// on screen, then the new card enters from the other edge at the same pace.
// Leaving the last card is the end of the run: the panel takes the card's place
// instead of the same card sliding back in.
function finishLeave() {
  const direction = leaving.value
  if (!direction) return
  clearTimeout(leaveTimer)
  leaveTimer = null
  offset.value = 0
  leaving.value = null
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

function endEnter() {
  clearTimeout(enterTimer)
  enterTimer = null
  enterFrom.value = null
}

function onCardTransitionEnd(event) {
  // The card's own transform only; the inner flip bubbles from a child.
  if (event.target !== event.currentTarget) return
  if (event.propertyName !== 'transform') return
  finishLeave()
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
    offset.value = 0
    leaving.value = null
    enterFrom.value = null
    clearTimeout(leaveTimer)
    clearTimeout(enterTimer)
    leaveTimer = null
    enterTimer = null
    if (direction === 'next' && onLastCard.value) store.send('study.finish')
    else if (direction === 'next') store.send('card.next')
    else store.send('card.prev')
    return
  }

  // One phase at a time. A press while the new card is still entering drops the
  // enter animation first and makes the move on the next frame: changing the
  // transform in the same frame as the animation is removed leaves the browser
  // with nothing to interpolate, so the leave transition never starts. Two
  // presses in one frame keep the newest direction instead of both running.
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

  // Let the card follow through and leave, then swap in the next card.
  leaving.value = direction
  clearTimeout(leaveTimer)
  leaveTimer = setTimeout(finishLeave, LEAVE_FALLBACK_MS)
}

onBeforeUnmount(() => {
  queuedMove = null
  queuedFrame = false
  clearTimeout(leaveTimer)
  clearTimeout(enterTimer)
})

// The last card ends the run: the right-hand control becomes 完成. Pressing it
// runs the same turn as a swipe, and the turn itself ends the run on the last
// card, so both ways out of a card run behave identically.
function nextOrFinish() {
  if (leaving.value) return
  moveCard('next')
}

function prevCard() {
  if (leaving.value || session.index === 0) return
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
      v-if="item && source && !session.finished"
      class="card-stage"
      :class="{ 'card-stage--moving': dragging || Boolean(leaving) || Boolean(enterFrom) }"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @pointerleave="onUp"
    >
      <div
        class="card"
        :class="{
          'card--flipped': session.flipped,
          'card--dragging': dragging || Boolean(leaving),
          'card--no-turn': turning,
          'card--leave-next': leaving === 'next',
          'card--leave-prev': leaving === 'prev',
          'card--enter-next': enterFrom === 'next',
          'card--enter-prev': enterFrom === 'prev',
        }"
        :style="leaving ? null : { transform: `translateX(${offset}px)` }"
        @transitionend="onCardTransitionEnd"
        @animationend="onCardAnimationEnd"
      >
        <div class="card-inner">
          <div class="card-side card-face" :aria-hidden="session.flipped ? 'true' : undefined">
            <div class="word">
              <RubyWord :text="source.vol" :reading="source.japanese" :show-reading="showReading" />
            </div>
            <div v-if="faceTags.length" class="tags">
              <span
                v-for="tag in faceTags"
                :key="tag.kind"
                class="tag"
                :class="tag.className"
              >{{ tag.text }}</span>
            </div>
            <p class="prompt">變成{{ formName(item.targetForm) }}</p>
          </div>

          <div class="card-side card-back" :aria-hidden="session.flipped ? undefined : 'true'">
            <div v-if="answerTags.length" class="tags">
              <span
                v-for="tag in answerTags"
                :key="tag.kind"
                class="tag tag--answer"
                :class="tag.className"
              >{{ tag.text }}</span>
            </div>
            <div class="word">
              <RubyWord
                :text="target.vol"
                :reading="target.japanese"
                :show-reading="showReading"
              />
            </div>
            <p class="gloss">{{ target.chinese }}</p>
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 0 6px;
  touch-action: pan-y;
  user-select: none;
}

/* While a card follows the finger or slides out, the stage clips it. A card
   that travels to ±112% would otherwise paint outside the column and give the
   page a horizontal scrollbar. At rest the stage stays open, so the card keeps
   its soft shadow. */
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
  /* A release below the threshold returns in a short decelerating step, so
     the card settles instead of springing back at the hand. */
  transition: transform 140ms var(--ease-slide);
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

.card--dragging {
  transition: none;
}

/* Paging must stay flat: no rotation, no fade. The card travels in one straight
   line, so the turn is cut for the whole phase and the element can never play a
   rotateY transition while it moves. */
.card--no-turn .card-inner {
  transition: none;
}

/* Leaving: the old card is pushed fully off the screen in the direction of
   travel, keeping the side the reader was looking at. The phase ends on the
   transition itself (see onCardTransitionEnd), so this duration and the JS
   fallback never have to agree. */
.card--leave-next {
  transform: translateX(-100%) !important;
  transition: transform 170ms var(--ease-exit);
}

.card--leave-prev {
  transform: translateX(100%) !important;
  transition: transform 170ms var(--ease-exit);
}

.card--enter-next {
  animation: card-enter-next 190ms var(--ease-slide);
}

.card--enter-prev {
  animation: card-enter-prev 190ms var(--ease-slide);
}

/* The moving phases stay on their own layer, so a phone repaints the card
   instead of dropping frames mid-slide. */
.card--dragging,
.card--leave-next,
.card--leave-prev,
.card--enter-next,
.card--enter-prev {
  will-change: transform;
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
  .card--leave-next,
  .card--leave-prev,
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

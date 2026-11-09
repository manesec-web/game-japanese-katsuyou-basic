<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import RubyWord from '../components/RubyWord.vue'
import CompletePanel from '../components/CompletePanel.vue'
import { formName } from '../dict/forms.js'
import { backTags, frontTags } from '../study/card-tags.js'
import { cardDirection, clampDrag } from '../ui/swipe.js'
import { prefersReducedMotion } from '../ui/motion.js'

const store = inject('store')
const session = store.session
const offset = ref(0)
const dragging = ref(false)
const leaving = ref(null)
// Which side the incoming card slides in from: 'next' enters from the left
// (travelling left to right), 'prev' mirrors it.
const enterFrom = ref(null)
const LEAVE_MS = 170
const ENTER_MS = 240

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
  offset.value = clampDrag(dx)
}

function onUp() {
  if (!pointer) return
  const axis = pointer.axis
  const dx = prefersReducedMotion() ? pointer.lastDx : offset.value
  const direction = axis === 'x' ? cardDirection(dx) : null
  pointer = null
  dragging.value = false

  if (direction) {
    moveCard(direction)
    return
  }
  offset.value = 0
  if (axis === null) store.send('card.flip')
}

function moveCard(direction) {
  const commit = () => {
    offset.value = 0
    leaving.value = null
    if (direction === 'next') store.send('card.next')
    else store.send('card.prev')
    enterFrom.value = direction
    clearTimeout(enterTimer)
    enterTimer = setTimeout(() => {
      enterFrom.value = null
      enterTimer = null
    }, ENTER_MS)
    leaveTimer = null
  }

  if (prefersReducedMotion()) {
    commit()
    return
  }

  // One phase at a time: a press while the new card is still entering finishes
  // the enter instead of running the leave transition and the enter animation
  // on the same element at once.
  clearTimeout(enterTimer)
  enterTimer = null
  enterFrom.value = null

  // Let the card follow through and leave, then swap in the next card.
  leaving.value = direction
  clearTimeout(leaveTimer)
  leaveTimer = setTimeout(commit, LEAVE_MS)
}

onBeforeUnmount(() => {
  clearTimeout(leaveTimer)
  clearTimeout(enterTimer)
})

const onLastCard = computed(() => session.index >= session.items.length - 1)

// The last card ends the run: the right-hand control becomes 完成. Every other
// press runs the page-turn motion, exactly like a swipe.
function nextOrFinish() {
  if (leaving.value) return
  if (onLastCard.value) {
    store.send('study.finish')
    return
  }
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
  perspective: 1200px;
  transition: transform 200ms ease;
  cursor: pointer;
}

.card-inner {
  position: relative;
  width: 100%;
  min-height: 340px;
  transform-style: preserve-3d;
  transition: transform 300ms ease;
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
   travel, keeping the side the reader was looking at. */
.card--leave-next {
  transform: translateX(-112%) !important;
  transition: transform 170ms ease;
}

.card--leave-prev {
  transform: translateX(112%) !important;
  transition: transform 170ms ease;
}

.card--enter-next {
  animation: card-enter-next 240ms ease;
}

.card--enter-prev {
  animation: card-enter-prev 240ms ease;
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

<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import RubyWord from '../components/RubyWord.vue'
import { groupLabel } from '../dict/forms.js'
import { orderedFormEntries } from '../study/reader-forms.js'
import { sentenceParts } from '../study/highlight.js'
import { readerDirection, clampDrag, swipeEnabled } from '../ui/swipe.js'
import { prefersReducedMotion } from '../ui/motion.js'

const store = inject('store')
const session = store.session
const offset = ref(0)
const dragging = ref(false)
let pointer = null

// Page-turn phases. `leaving` slides the current word out, then the command
// runs, then `entering` brings the new word in from the opposite edge.
const leaving = ref(null)
const entering = ref(null)
const LEAVE_MS = 170
const ENTER_MS = 240
let leaveTimer = null
let enterTimer = null

const item = computed(() => session.items[session.index] ?? null)
const defaultFormId = computed(() => session.settings.dict.defaultForm)
const showReading = computed(() => session.settings.dict.showReading)
const canPrev = computed(() => session.index > 0)
const canNext = computed(() => session.index < session.items.length - 1)
const moving = computed(() => leaving.value !== null || entering.value !== null)

// 預設顯示形式 first, everything else in the canonical order.
const formEntries = computed(() => orderedFormEntries(item.value?.verb, defaultFormId.value))

// The word slides sideways with the finger in a straight, parallel line — no
// rotation, no tilt, and no depth: the page stays flat, the way a phone moves
// between its own screens.
const dragStyle = computed(() => {
  if (!offset.value) return null
  return { transform: `translateX(${offset.value}px)` }
})

// A new word opens at the top of the page: the default form is the first block.
watch(
  () => [session.index, defaultFormId.value],
  () => window.scrollTo({ top: 0, behavior: 'auto' }),
)

function canGo(direction) {
  return direction === 'next' ? canNext.value : canPrev.value
}

// One path for gestures and for the footer controls: leave, swap, enter.
function go(direction) {
  if (!direction || !canGo(direction) || moving.value) return
  if (prefersReducedMotion()) {
    store.send(direction === 'next' ? 'dict.next' : 'dict.prev')
    return
  }
  leaving.value = direction
  leaveTimer = setTimeout(() => {
    store.send(direction === 'next' ? 'dict.next' : 'dict.prev')
    leaving.value = null
    entering.value = direction
    enterTimer = setTimeout(() => {
      entering.value = null
      enterTimer = null
    }, ENTER_MS)
    leaveTimer = null
  }, LEAVE_MS)
}

onBeforeUnmount(() => {
  clearTimeout(leaveTimer)
  clearTimeout(enterTimer)
})

function onDown(event) {
  // Above 550px the page shows its background: a desktop reader where text
  // selection matters more than swiping. Only the footer buttons page there.
  if (!swipeEnabled(window.innerWidth)) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (moving.value) return
  pointer = { x: event.clientX, y: event.clientY, axis: null, lastDx: 0 }
  dragging.value = true
  offset.value = 0
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
  if (prefersReducedMotion()) return
  offset.value = clampDrag(dx)
}

function onUp() {
  if (!pointer) return
  const dx = prefersReducedMotion() ? pointer.lastDx : offset.value
  const direction = pointer.axis === 'x' ? readerDirection(dx) : null
  pointer = null
  dragging.value = false
  offset.value = 0
  go(direction)
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
      <button class="icon-button" type="button" aria-label="返回" @click="back">←</button>
      <h1 class="bar-title">學習（{{ session.index + 1 }}/{{ session.items.length }}）</h1>
      <button class="icon-button" type="button" aria-label="設定" @click="openSettings">⚙</button>
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
      <article
        class="reader-page"
        :class="{
          'reader-page--dragging': dragging,
          'reader-page--leave-next': leaving === 'next',
          'reader-page--leave-prev': leaving === 'prev',
          'reader-page--enter-next': entering === 'next',
          'reader-page--enter-prev': entering === 'prev',
        }"
        :style="dragStyle"
      >
        <section
          v-for="entry in formEntries"
          :key="entry.id"
          class="form-block"
          :class="{ 'form-block--default': entry.isDefault }"
          :data-form="entry.id"
          :aria-current="entry.isDefault ? 'true' : undefined"
        >
          <h2 class="form-name">{{ entry.name }}</h2>
          <div class="word">
            <RubyWord
              :text="entry.data.vol"
              :reading="entry.data.japanese"
              :show-reading="showReading"
            />
          </div>
          <p class="gloss">{{ entry.data.chinese }}</p>
          <div v-if="entry.isFirst" class="tags">
            <span class="tag">{{ groupLabel(entry.data.group) }}</span>
            <span class="tag">第{{ item.lesson }}課</span>
          </div>

          <div class="block">
            <h3 class="block-title">例句：</h3>
            <div
              v-for="(sentence, index) in entry.data.sentence"
              :key="index"
              class="sentence"
            >
              <p class="sentence-ja" lang="ja"><span
                v-for="(part, at) in sentenceParts(sentence, entry.data.vol)"
                :key="at"
                :class="{ 'sentence-hit': part.highlight }"
              >{{ part.text }}</span></p>
              <p class="sentence-zh">{{ sentence.chinese }}</p>
            </div>
          </div>
        </section>
      </article>
    </div>

    <footer class="reader-controls">
      <button
        class="button ghost controls-button"
        type="button"
        :disabled="!canPrev || moving"
        @click="go('prev')"
      >
        ‹ 上一個
      </button>
      <button
        class="button ghost controls-button"
        type="button"
        :disabled="!canNext || moving"
        @click="go('next')"
      >
        下一個 ›
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

.reader-body {
  flex: 1;
  overflow: hidden;
  touch-action: pan-y;
  padding: 4px 4px 8px;
}

/* Where gesture paging is on, a drag must page rather than select text.
   Above 550px text selection stays available (see the swipe gate in the view). */
@media (max-width: 550px) {
  .reader-body {
    user-select: none;
    -webkit-user-select: none;
  }
}

.reader-page {
  transition: transform 200ms ease;
}

.reader-page--dragging {
  transition: none;
}

/* Leaving: the old word slides out in the direction of travel, flat and fully,
   like a page being pushed off the screen. */
.reader-page--leave-next {
  transform: translateX(-100%);
  transition: transform 170ms ease;
}

.reader-page--leave-prev {
  transform: translateX(100%);
  transition: transform 170ms ease;
}

/* Entering: the new word is pushed in from the edge the swipe came from. */
.reader-page--enter-next {
  animation: page-enter-next 240ms ease;
}

.reader-page--enter-prev {
  animation: page-enter-prev 240ms ease;
}

@keyframes page-enter-next {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes page-enter-prev {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .reader-page,
  .reader-page--leave-next,
  .reader-page--leave-prev,
  .reader-page--enter-next,
  .reader-page--enter-prev {
    transition: none;
    animation: none;
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
}

.gloss {
  margin: 8px 0 10px;
  font-size: 1rem;
  color: var(--ink-soft);
}

.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
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
}
</style>

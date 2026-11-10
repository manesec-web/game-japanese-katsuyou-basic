<script setup>
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import RubyWord from '../components/RubyWord.vue'
import { groupLabel } from '../dict/forms.js'
import { sentenceParts } from '../study/highlight.js'
import { readerDirection, swipeEnabled } from '../ui/swipe.js'
import { prefersReducedMotion } from '../ui/motion.js'
import { READER_WINDOW } from '../ui/window.js'
import { usePagingWindow } from '../ui/paging-window.js'
import { readerEntries } from '../study/window-views.js'

const store = inject('store')
const session = store.session
let pointer = null

// Page turn is one phase: the command swaps the word at once and the new page
// plays a single short slide from the edge the gesture came from. The drag is
// invisible — the page never follows the finger — so there is nothing to
// spring back and nothing to settle twice. The phase ends on the animation
// itself; the timer is only a safety net for an event that never arrives.
const entering = ref(null)
const PHASE_FALLBACK_MS = 600
let enterTimer = null

const item = computed(() => session.items[session.index] ?? null)
const defaultFormId = computed(() => session.settings.dict.defaultForm)
const showReading = computed(() => session.settings.dict.showReading)
const canPrev = computed(() => session.index > 0)
const canNext = computed(() => session.index < session.items.length - 1)
const moving = computed(() => entering.value !== null)

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

// One path for gestures and for the footer controls: swap at once, slide in.
function go(direction) {
  if (!direction || !canGo(direction) || moving.value) return
  // The scroll reset runs before the swap, so the slide never starts from a
  // scrolled position and a reset can never land after the page has settled.
  window.scrollTo({ top: 0, behavior: 'auto' })
  store.send(direction === 'next' ? 'dict.next' : 'dict.prev')
  if (prefersReducedMotion()) return
  entering.value = direction
  clearTimeout(enterTimer)
  enterTimer = setTimeout(endEnter, PHASE_FALLBACK_MS)
}

function endEnter() {
  clearTimeout(enterTimer)
  enterTimer = null
  entering.value = null
}

function onPageAnimationEnd(event) {
  if (event.target !== event.currentTarget) return
  if (!entering.value) return
  endEnter()
}

onBeforeUnmount(() => {
  clearTimeout(enterTimer)
})

function onDown(event) {
  // Above 550px the page shows its background: a desktop reader where text
  // selection matters more than swiping. Only the footer buttons page there.
  if (!swipeEnabled(window.innerWidth)) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  if (moving.value) return
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
  const direction = pointer.axis === 'x' ? readerDirection(pointer.lastDx) : null
  pointer = null
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
      <div class="reader-window">
        <article
          v-for="entry in slots"
          :key="entry.key"
          class="reader-page"
          :class="{
            'reader-page--current': entry.current,
            'reader-page--enter-next': entering === 'next' && entry.current,
            'reader-page--enter-prev': entering === 'prev' && entry.current,
          }"
          :aria-hidden="entry.current ? undefined : 'true'"
          :data-at="entry.at"
          :style="{ transform: `translateX(${entry.offset}%)` }"
          @animationend="entry.current && onPageAnimationEnd($event)"
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
              <div class="word">
                <RubyWord
                  :text="form.data.vol"
                  :reading="form.data.japanese"
                  :show-reading="showReading"
                />
              </div>
              <p class="gloss">{{ form.data.chinese }}</p>
              <div v-if="form.isFirst" class="tags">
                <span class="tag">{{ groupLabel(form.data.group) }}</span>
                <span class="tag">第{{ entry.lesson }}課</span>
              </div>

              <div class="block">
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

/* The paging window: one slot per mounted word, pushed sideways by the slot's
   own offset so the 3rd slot always sits where the current word belongs. The
   window itself is never translated. */
.reader-window {
  position: relative;
  width: 100%;
  min-height: 100%;
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
  /* Nothing transitions at rest: the only transform in the page's life is the
     single enter slide, and it ends on the page's own resting state, so the
     settle frame changes nothing and cannot flash or move twice. The layer is
     promoted once and stays promoted — tearing `will-change` down at the exact
     settle frame is what used to flash on phones. */
  will-change: transform;
}

/* Only the current page contributes to document flow; neighbours are taken
   out of flow so they never add scroll height or capture taps, and the window
   clips them so nothing shows past the column edge. */
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

/* Entering: the new word is pushed in from the edge the swipe came from, one
   short decelerating slide. */
.reader-page--enter-next {
  animation: page-enter-next 190ms var(--ease-slide);
}

.reader-page--enter-prev {
  animation: page-enter-prev 190ms var(--ease-slide);
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
  .reader-page--enter-next,
  .reader-page--enter-prev {
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

<script setup>
// The page's own scrollbar. The browser's bar is hidden, so this draws a thin
// thumb against the column's right edge, keeps its length and position in step
// with the page, and gets out of the way when the page stops moving. All the
// numbers come from `src/ui/scrollbar.js`; this file only wires events to it.
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { rightInset, SCROLLBAR, thumbMetrics, trackHeight } from '../ui/scrollbar.js'

const visible = ref(false)
const length = ref(0)
const offset = ref(0)
const fromRight = ref(SCROLLBAR.inset)

let fadeTimer = null
let frame = 0
let observer = null

function read() {
  const column = document.querySelector('.column')
  const columnRight = column ? column.getBoundingClientRect().right : 0
  const viewport = window.innerHeight
  fromRight.value = rightInset(window.innerWidth, columnRight)
  const metrics = thumbMetrics({
    scrollTop: window.scrollY,
    viewport,
    content: document.documentElement.scrollHeight,
    track: trackHeight(viewport),
  })
  length.value = metrics.length
  offset.value = metrics.offset
  if (!metrics.visible) visible.value = false
  return metrics.visible
}

// Only a page that moves shows the thumb; it leaves again once the page has
// been still for a moment.
function reveal() {
  if (!read()) return
  visible.value = true
  clearTimeout(fadeTimer)
  fadeTimer = setTimeout(() => {
    visible.value = false
    fadeTimer = null
  }, SCROLLBAR.fadeDelay)
}

function onScroll() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    reveal()
  })
}

function onResize() {
  read()
}

onMounted(() => {
  read()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onResize)
  // The column's height changes with the screen, with a dropdown opening and
  // with a different lesson count, so the thumb is re-measured whenever it does.
  const column = document.querySelector('.column')
  if (typeof ResizeObserver === 'function' && column) {
    observer = new ResizeObserver(() => read())
    observer.observe(column)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onResize)
  if (frame) cancelAnimationFrame(frame)
  if (observer) observer.disconnect()
  clearTimeout(fadeTimer)
})
</script>

<template>
  <div
    v-if="length > 0"
    class="page-scrollbar"
    :class="{ 'page-scrollbar--on': visible }"
    :style="{
      right: `${fromRight}px`,
      height: `${length}px`,
      transform: `translateY(${SCROLLBAR.edgeInset + offset}px)`,
    }"
    aria-hidden="true"
  ></div>
</template>

<style scoped>
.page-scrollbar {
  position: fixed;
  top: 0;
  width: 4px;
  border-radius: 999px;
  background: rgba(36, 33, 58, 0.32);
  /* A hint of a lighter edge keeps the thumb readable over the warm column. */
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.18);
  z-index: 4;
  opacity: 0;
  pointer-events: none;
  transition: opacity 160ms ease;
}

.page-scrollbar--on {
  opacity: 1;
}

/* Under reduced motion the thumb still appears and leaves, it just does not
   fade: the same rule the rest of the app uses. */
@media (prefers-reduced-motion: reduce) {
  .page-scrollbar {
    transition: none;
  }
}
</style>

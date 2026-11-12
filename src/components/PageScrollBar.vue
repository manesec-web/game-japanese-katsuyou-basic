<script setup>
// The page's own scrollbar. `usePageScrollbar` owns measurement, mouse
// proximity, dragging and the fade; this component only renders that state.
import { onMounted } from 'vue'
import { usePageScrollbar } from '../ui/page-scrollbar.js'

const thumb = usePageScrollbar()
onMounted(thumb.attach)
</script>

<template>
  <div
    v-if="thumb.length.value > 0"
    class="page-scrollbar"
    :class="{
      'page-scrollbar--on': thumb.visible.value,
      'page-scrollbar--dragging': thumb.dragging.value,
    }"
    :style="{
      right: `${thumb.fromRight.value}px`,
      height: `${thumb.length.value}px`,
      transform: `translateY(${thumb.edgeInset.value + thumb.offset.value}px)`,
    }"
    aria-hidden="true"
    @pointerdown="thumb.dragStart"
    @pointermove="thumb.dragMove"
    @pointerup="thumb.dragEnd"
    @pointercancel="thumb.dragEnd"
    @lostpointercapture="thumb.dragEnd"
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
  user-select: none;
  touch-action: none;
  transition: opacity 160ms ease;
}

/* A 20px-wide, slightly taller invisible grab area around the 4px drawing.
   It exists only while the thumb is shown on a fine-pointer device. */
.page-scrollbar::before {
  content: '';
  position: absolute;
  inset: -6px -8px;
}

.page-scrollbar--on {
  opacity: 1;
}

@media (hover: hover) and (pointer: fine) {
  .page-scrollbar--on {
    pointer-events: auto;
    cursor: grab;
  }

  .page-scrollbar--dragging {
    cursor: grabbing;
  }
}

/* Under reduced motion the thumb still appears and leaves, it just does not
   fade: the same rule the rest of the app uses. */
@media (prefers-reduced-motion: reduce) {
  .page-scrollbar {
    transition: none;
  }
}
</style>

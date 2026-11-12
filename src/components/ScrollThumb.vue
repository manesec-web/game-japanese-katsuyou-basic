<script setup>
// The drawn thumb of a dropdown list: the same 4px rounded bar the page draws,
// placed inside the list's frame. Presentational only — `useElementThumb`
// supplies the geometry/fade and handles the events forwarded here.
import { LIST_SCROLLBAR } from '../ui/scrollbar.js'

defineProps({
  visible: { type: Boolean, default: false },
  dragging: { type: Boolean, default: false },
  length: { type: Number, default: 0 },
  offset: { type: Number, default: 0 },
})
const emit = defineEmits(['drag-start', 'drag-move', 'drag-end'])
</script>

<template>
  <span
    v-if="length > 0"
    class="list-thumb"
    :class="{ 'list-thumb--on': visible, 'list-thumb--dragging': dragging }"
    :style="{
      right: `${LIST_SCROLLBAR.inset}px`,
      height: `${length}px`,
      transform: `translateY(${offset}px)`,
    }"
    aria-hidden="true"
    @pointerdown="emit('drag-start', $event)"
    @pointermove="emit('drag-move', $event)"
    @pointerup="emit('drag-end', $event)"
    @pointercancel="emit('drag-end', $event)"
    @lostpointercapture="emit('drag-end', $event)"
  ></span>
</template>

<style scoped>
.list-thumb {
  position: absolute;
  top: 0;
  width: 4px;
  border-radius: 999px;
  background: rgba(36, 33, 58, 0.32);
  /* A hint of a lighter edge keeps the thumb readable over the white panel. */
  box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.18);
  pointer-events: none;
  opacity: 0;
  user-select: none;
  touch-action: none;
  transition: opacity 160ms ease;
}

/* The visual bar stays 4px wide. Only a visible fine-pointer thumb gains this
   larger, transparent grab area, so a hidden bar cannot swallow an option's
   click and a phone never loses its normal touch-scroll gesture. */
.list-thumb::before {
  content: '';
  position: absolute;
  inset: -6px -8px;
}

.list-thumb--on {
  opacity: 1;
}

@media (hover: hover) and (pointer: fine) {
  .list-thumb--on {
    pointer-events: auto;
    cursor: grab;
  }

  .list-thumb--dragging {
    cursor: grabbing;
  }
}

/* Under reduced motion the thumb still appears and leaves, it just does not
   fade: the same rule the page's bar uses. */
@media (prefers-reduced-motion: reduce) {
  .list-thumb {
    transition: none;
  }
}
</style>

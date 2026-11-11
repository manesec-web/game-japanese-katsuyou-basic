<script setup>
// The drawn thumb of a dropdown list: the same 4px rounded bar the page draws,
// placed inside the list's frame. Presentational only — `useElementThumb`
// supplies the length, the offset and the fade.
import { LIST_SCROLLBAR } from '../ui/scrollbar.js'

defineProps({
  visible: { type: Boolean, default: false },
  length: { type: Number, default: 0 },
  offset: { type: Number, default: 0 },
})
</script>

<template>
  <span
    v-if="length > 0"
    class="list-thumb"
    :class="{ 'list-thumb--on': visible }"
    :style="{
      right: `${LIST_SCROLLBAR.inset}px`,
      height: `${length}px`,
      transform: `translateY(${offset}px)`,
    }"
    aria-hidden="true"
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
  transition: opacity 160ms ease;
}

.list-thumb--on {
  opacity: 1;
}

/* Under reduced motion the thumb still appears and leaves, it just does not
   fade: the same rule the page's bar uses. */
@media (prefers-reduced-motion: reduce) {
  .list-thumb {
    transition: none;
  }
}
</style>

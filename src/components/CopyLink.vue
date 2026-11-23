<script setup>
import { inject, ref } from 'vue'

// A small text button that copies the current screen's deep-link URL to the
// clipboard and briefly reads 已複製鏈接. The URL and the clipboard write live in
// `link.copy` (command) and `deepLinkUrl` (pure), so this view only dispatches
// and paints the transient feedback.
const store = inject('store')

const copied = ref(false)
let timer = null

async function copy() {
  const result = await store.send('link.copy', {})
  if (!result.ok) return
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
  }, 1600)
}
</script>

<template>
  <button class="copy-link" type="button" @click="copy">
    {{ copied ? '已複製鏈接' : '分享' }}
  </button>
</template>

<style scoped>
/* The same type and hover as the reader's 變形原理 link and the settings
   icon-button grey, so the button reads as a quiet text control. */
.copy-link {
  flex: 0 0 auto;
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-soft);
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  cursor: pointer;
  transition: background-color 140ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .copy-link:hover {
    background: var(--tint);
  }
}

@media (prefers-reduced-motion: reduce) {
  .copy-link {
    transition: none;
  }
}
</style>

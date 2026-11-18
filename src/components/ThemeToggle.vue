<script setup>
// The start screen's theme switch. It sits in the blank space to the right of
// the home head's 動詞轉型練習 line; the icon shows the theme the press would
// switch to, and the label names it for assistive technology.
import { computed, inject } from 'vue'
import { Moon, Sun } from 'lucide-vue-next'

const store = inject('store')
const dark = computed(() => store.session.theme?.value === 'dark')
const label = computed(() => (dark.value ? '切換為淺色模式' : '切換為深色模式'))

function toggle() {
  store.send('theme.toggle')
}
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :aria-label="label"
    :aria-pressed="dark ? 'true' : 'false'"
    :title="label"
    @click="toggle"
  >
    <Sun v-if="dark" :size="18" :stroke-width="2" aria-hidden="true" />
    <Moon v-else :size="18" :stroke-width="2" aria-hidden="true" />
  </button>
</template>

<style scoped>
/* A round 36px control: the same height as a `.button`, but it is a single
   icon so the circle keeps the tap target comfortable without a text label
   taking space. Its position belongs to whoever places it — on home that is
   the subtitle row's blank right-hand space. */
.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 50%;
  background: var(--surface);
  color: var(--ink-soft);
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease, transform 140ms ease;
}

.theme-toggle:hover {
  background: var(--tint);
  color: var(--ink);
}

.theme-toggle:active {
  transform: scale(0.97);
}
</style>

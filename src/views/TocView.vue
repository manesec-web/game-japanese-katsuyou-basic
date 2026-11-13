<script setup>
import { computed, inject, nextTick, onMounted } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { tocGroups } from '../study/toc.js'

const store = inject('store')
const session = store.session

// The run's frozen words, grouped by lesson. The rows carry their run index,
// so the only work this view does is print what the pure helper built.
const groups = computed(() => tocGroups(session.items, session.index))

function back() {
  store.send('nav.go', { screen: 'reader' })
}

function jump(index) {
  store.send('dict.goto', { index })
}

// A long run opens with the current word already in view; a run that fits on
// screen keeps its first row at the top. The page may arrive scrolled from the
// reader, so the top comes first either way.
onMounted(async () => {
  window.scrollTo({ top: 0, behavior: 'auto' })
  await nextTick()
  const current = document.querySelector('.toc-row[aria-current="true"]')
  if (!current) return
  if (document.documentElement.scrollHeight <= window.innerHeight) return
  current.scrollIntoView({ block: 'center', behavior: 'auto' })
})
</script>

<template>
  <section class="toc">
    <header class="bar bar--sticky">
      <button class="icon-button" type="button" aria-label="返回" @click="back"><ArrowLeft :size="22" aria-hidden="true" /></button>
      <h1 class="bar-title">單詞目錄</h1>
      <span class="bar-spacer"></span>
    </header>

    <div
      v-for="group in groups"
      :key="`${group.lesson}-${group.rows[0].index}`"
      class="toc-group"
    >
      <h2 class="toc-lesson">第{{ group.lesson }}課</h2>
      <button
        v-for="row in group.rows"
        :key="row.index"
        class="toc-row"
        :class="{ 'toc-row--current': row.current }"
        type="button"
        :aria-current="row.current ? 'true' : undefined"
        @click="jump(row.index)"
      >
        <span class="toc-word">{{ row.word }}</span>
        <span class="tag">第{{ row.lesson }}課</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.toc {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding-bottom: 10px;
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

.bar-spacer {
  flex: 0 0 48px;
}

.icon-button {
  border: 0;
  background: transparent;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  cursor: pointer;
  flex: 0 0 48px;
}

.icon-button:hover {
  background: rgba(36, 33, 58, 0.06);
}

/* A lesson heading sits above the first row of its group; the rows themselves
   are spaced apart instead of separated by drawn rules. */
.toc-group {
  margin-top: 4px;
}

.toc-lesson {
  margin: 10px 0 8px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
}

.toc-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  height: 44px;
  padding: 0 14px;
  margin: 0 0 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  font: inherit;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: transform 140ms ease, background 140ms ease;
}

.toc-row:hover {
  background: rgba(36, 33, 58, 0.06);
}

.toc-row:active {
  transform: scale(0.97);
}

/* The word the reader is on keeps its tint while the list is open. */
.toc-row--current {
  background: rgba(74, 63, 159, 0.1);
  border-color: var(--accent);
}

.toc-row--current .toc-word {
  color: var(--accent);
  font-weight: 600;
}

.toc-word {
  font-size: 1.05rem;
}

.tag {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--line);
  font-size: 0.78rem;
  color: var(--ink-soft);
  letter-spacing: 0.06em;
}
</style>

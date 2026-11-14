<script setup>
import { computed, inject, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Search, X } from 'lucide-vue-next'
import { filterTocGroups } from '../study/toc.js'

const store = inject('store')
const session = store.session

// The search box is a toggle above the list; while it is open the query
// filters the frozen run in place, and closing it shows the full list again.
const searchOpen = ref(false)
const query = ref('')

// The run's frozen words, grouped by lesson and filtered by the search query.
// The rows carry their run index, so the only work this view does is print
// what the pure helper built.
const groups = computed(() =>
  filterTocGroups(session.items, session.index, searchOpen.value ? query.value : ''),
)

function back() {
  store.send('nav.go', { screen: 'reader' })
}

function jump(index) {
  store.send('dict.goto', { index })
}

function toggleSearch() {
  searchOpen.value = !searchOpen.value
}

function clearSearch() {
  query.value = ''
}

// A filter that shortens the list pulls the page back to the top, so the
// matches are the first thing the user sees instead of a blank stretch.
watch(query, () => window.scrollTo({ top: 0, behavior: 'auto' }))

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
      <button class="icon-button" type="button" aria-label="搜尋" :aria-pressed="searchOpen" @click="toggleSearch"><Search :size="22" aria-hidden="true" /></button>
    </header>

    <div v-if="searchOpen" class="toc-search">
      <div class="toc-search-box">
        <input
          v-model="query"
          class="toc-search-input"
          type="text"
          placeholder="搜尋單詞或課號"
          aria-label="搜尋單詞"
        />
        <button class="toc-search-clear" type="button" aria-label="清空" @click="clearSearch"><X :size="18" aria-hidden="true" /></button>
      </div>
    </div>

    <p v-if="groups.length === 0" class="toc-empty">沒有符合的單詞</p>

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

/* The search box pins below the top bar, on the column colour, so rows scroll
   underneath it instead of through it. */
.toc-search {
  position: sticky;
  top: 48px;
  z-index: 2;
  background: var(--column);
  padding: 2px 0 10px;
}

.toc-search-box {
  position: relative;
}

.toc-search-input {
  width: 100%;
  height: 44px;
  padding: 0 44px 0 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  font: inherit;
  font-size: 1rem;
  color: var(--ink);
}

.toc-search-input::placeholder {
  color: var(--ink-soft);
}

.toc-search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.toc-search-clear {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 0;
  background: transparent;
  color: var(--ink-soft);
  border-radius: 8px;
  cursor: pointer;
}

.toc-search-clear:hover {
  background: rgba(36, 33, 58, 0.06);
  color: var(--ink);
}

.toc-empty {
  margin: 24px 0;
  text-align: center;
  font-size: 0.95rem;
  color: var(--ink-soft);
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

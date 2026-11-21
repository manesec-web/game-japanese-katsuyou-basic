<script setup>
import { computed, inject, ref, watch } from 'vue'
import { ArrowLeft, Search, X } from 'lucide-vue-next'
import { exampleGroups, exampleRows } from '../study/rule.js'

const store = inject('store')
const session = store.session

// The search box is a toggle above the list; while open, the query filters the
// whole dictionary in place. A press selects that verb as the example word and
// returns to 變形說明.
const searchOpen = ref(false)
const query = ref('')

const rows = computed(() => exampleRows(store.deps.library))
// The picker lists the current 從 form: 從 = ます形 shows ます形 words, 從 =
// 辭書形 shows 辭書形 words, and so on.
const groups = computed(() => exampleGroups(rows.value, searchOpen.value ? query.value : '', session.rule.from))

function back() {
  store.send('nav.go', { screen: 'rule' })
}

function select(row) {
  store.send('rule.selectExample', { lesson: row.lesson, index: row.index })
}

function toggleSearch() {
  searchOpen.value = !searchOpen.value
}

function clearSearch() {
  query.value = ''
}

watch(query, () => window.scrollTo({ top: 0, behavior: 'auto' }))
</script>

<template>
  <section class="example">
    <header class="bar bar--sticky">
      <button class="icon-button" type="button" aria-label="返回" @click="back"><ArrowLeft :size="22" aria-hidden="true" /></button>
      <h1 class="bar-title">選字</h1>
      <button class="icon-button" type="button" aria-label="搜尋" :aria-pressed="searchOpen" @click="toggleSearch"><Search :size="22" aria-hidden="true" /></button>
    </header>

    <div v-if="searchOpen" class="example-search">
      <div class="example-search-box">
        <input
          v-model="query"
          class="example-search-input"
          type="text"
          placeholder="搜尋單詞、讀音或課號"
          aria-label="搜尋單詞"
        />
        <button class="example-search-clear" type="button" aria-label="清空" @click="clearSearch"><X :size="18" aria-hidden="true" /></button>
      </div>
    </div>

    <p v-if="groups.length === 0" class="example-empty">沒有符合的單詞</p>

    <div v-for="group in groups" :key="group.lesson" class="example-group">
      <h2 class="example-lesson">第{{ group.lesson }}課</h2>
      <button
        v-for="row in group.rows"
        :key="`${row.lesson}-${row.index}`"
        class="example-row"
        type="button"
        @click="select(row)"
      >
        <span class="example-word">
          <span
            v-for="(part, partIndex) in row.parts"
            :key="partIndex"
            :class="{ 'example-hit': part.highlight }"
          >{{ part.text }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.example {
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
  background: var(--tint);
}

.example-search {
  position: sticky;
  top: 48px;
  z-index: 2;
  background: var(--column);
  padding: 2px 0 10px;
}

.example-search-box {
  position: relative;
}

.example-search-input {
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

.example-search-input::placeholder {
  color: var(--ink-soft);
}

.example-search-input:focus {
  outline: none;
  border-color: var(--accent);
}

.example-search-clear {
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

.example-search-clear:hover {
  background: var(--tint);
  color: var(--ink);
}

.example-empty {
  margin: 24px 0;
  text-align: center;
  font-size: 0.95rem;
  color: var(--ink-soft);
}

.example-group {
  margin-top: 4px;
}

.example-lesson {
  margin: 10px 0 8px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
}

.example-row {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 44px;
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

.example-row:hover {
  background: var(--tint);
}

.example-row:active {
  transform: scale(0.97);
}

.example-word {
  font-size: 1.05rem;
}

.example-hit {
  color: var(--error);
}
</style>

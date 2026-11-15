<script setup>
import { computed, inject, ref, watch } from 'vue'
import { ArrowLeft, ChevronDown } from 'lucide-vue-next'
import { FORMS, formName, groupLabel } from '../dict/forms.js'
import { RULE_CONTENT } from '../data/rule-content.js'
import { RULE_TIPS, exampleVerb, findRule, ruleTitle, targetFormIds } from '../study/rule.js'
import { deriveChange } from '../study/rule-demo.js'
import ScrollThumb from '../components/ScrollThumb.vue'
import { useElementThumb } from '../ui/element-thumb.js'

const store = inject('store')
const session = store.session

// The two dropdowns are their own scroll containers, each with a drawn thumb.
const fromOpen = ref(false)
const toOpen = ref(false)
const fromListRef = ref(null)
const toListRef = ref(null)
const fromThumb = useElementThumb()
const toThumb = useElementThumb()
watch(fromListRef, (el) => fromThumb.attach(el), { flush: 'post' })
watch(toListRef, (el) => toThumb.attach(el), { flush: 'post' })

const fromId = computed(() => session.rule.from)
const toId = computed(() => session.rule.to)
const toOptions = computed(() => targetFormIds(fromId.value))
const title = computed(() => ruleTitle(fromId.value, toId.value))
const content = computed(() => findRule(RULE_CONTENT, fromId.value, toId.value))

// The chosen example word and its two forms.
const example = computed(() => exampleVerb(store.deps.library, session.rule.example))
const exampleFrom = computed(() => example.value?.verb?.[fromId.value] ?? null)
const exampleTo = computed(() => example.value?.verb?.[toId.value] ?? null)

const derived = computed(() => {
  if (!exampleFrom.value || !exampleTo.value) return null
  return deriveChange({
    from: {
      vol: exampleFrom.value.vol,
      japanese: exampleFrom.value.japanese,
      group: exampleFrom.value.group,
    },
    to: {
      vol: exampleTo.value.vol,
      japanese: exampleTo.value.japanese,
      group: exampleTo.value.group,
    },
  })
})

function back() {
  store.send('nav.go', { screen: 'learn' })
}

function openFrom() {
  fromOpen.value = !fromOpen.value
  toOpen.value = false
}

function openTo() {
  toOpen.value = !toOpen.value
  fromOpen.value = false
}

function setFrom(formId) {
  store.send('rule.setFrom', { form: formId })
  fromOpen.value = false
}

function setTo(formId) {
  store.send('rule.setTo', { form: formId })
  toOpen.value = false
}

function pickExample() {
  store.send('nav.go', { screen: 'example' })
}

// One segment of a coloured example cell: 'change' paints purple, 'removed'
// paints red with a double underline, anything else is plain text.
function segClass(seg) {
  if (!seg || !seg.c) return ''
  return seg.c === 'change' ? 'seg--change' : 'seg--removed'
}
</script>

<template>
  <section class="rule">
    <header class="bar bar--sticky">
      <button class="icon-button" type="button" aria-label="返回" @click="back"><ArrowLeft :size="22" aria-hidden="true" /></button>
      <h1 class="bar-title">變形說明</h1>
      <span class="bar-spacer"></span>
    </header>

    <div class="rule-body">
      <p class="section-label">變形設置</p>

      <div class="field">
        <span class="field-label">從</span>
        <div class="field-body">
          <button class="form-select" type="button" :aria-expanded="fromOpen" @click="openFrom">
            <span>{{ formName(fromId) }}</span>
            <ChevronDown :size="16" class="chevron" :class="{ 'chevron--up': fromOpen }" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div v-if="fromOpen" class="form-list-frame">
        <div ref="fromListRef" class="form-list">
          <button
            v-for="form in FORMS"
            :key="form.id"
            class="form-option"
            :class="{ 'form-option--on': fromId === form.id }"
            type="button"
            @click="setFrom(form.id)"
          >
            {{ form.name }}
          </button>
        </div>
        <ScrollThumb
          :visible="fromThumb.visible.value"
          :dragging="fromThumb.dragging.value"
          :length="fromThumb.length.value"
          :offset="fromThumb.offset.value"
          @drag-start="fromThumb.dragStart"
          @drag-move="fromThumb.dragMove"
          @drag-end="fromThumb.dragEnd"
        />
      </div>

      <div class="field">
        <span class="field-label">到</span>
        <div class="field-body">
          <button class="form-select" type="button" :aria-expanded="toOpen" @click="openTo">
            <span>{{ formName(toId) }}</span>
            <ChevronDown :size="16" class="chevron" :class="{ 'chevron--up': toOpen }" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div v-if="toOpen" class="form-list-frame">
        <div ref="toListRef" class="form-list">
          <button
            v-for="form in toOptions"
            :key="form"
            class="form-option"
            :class="{ 'form-option--on': toId === form }"
            type="button"
            @click="setTo(form)"
          >
            {{ formName(form) }}
          </button>
        </div>
        <ScrollThumb
          :visible="toThumb.visible.value"
          :dragging="toThumb.dragging.value"
          :length="toThumb.length.value"
          :offset="toThumb.offset.value"
          @drag-start="toThumb.dragStart"
          @drag-move="toThumb.dragMove"
          @drag-end="toThumb.dragEnd"
        />
      </div>

      <!-- A drawn 1px rule, the same .hrule element the settings screen uses,
           separates the 變形設置 block from the explanation heading. -->
      <span class="hrule" aria-hidden="true"></span>
      <h2 class="rule-title">{{ title }}</h2>

      <template v-if="content">
        <section v-for="(section, sectionIndex) in content.sections" :key="sectionIndex" class="rule-section">
          <h3 class="rule-section-heading">{{ section.heading }}</h3>
          <p v-if="section.rule" class="rule-line">{{ section.rule }}</p>
          <!-- The 段 / 音便 mapping follows 變形設置: 字典→ます shows う→い,
               while ます→て shows い、ち、り→って. Reverse pairs flip it. -->
          <div v-if="section.map" class="rule-map">
            <p class="rule-map-label">{{ section.map.label }}</p>
            <div v-for="(item, itemIndex) in section.map.rows" :key="itemIndex" class="rule-map-row">
              <span class="rule-map-line" lang="ja">{{ item.line }}</span>
              <span v-if="item.note" class="rule-map-note">{{ item.note }}</span>
            </div>
          </div>
          <table class="rule-table">
            <thead>
              <tr>
                <th v-for="col in section.columns" :key="col">{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in section.rows" :key="rowIndex">
                <td class="rule-cell">
                  <span v-for="(seg, segIndex) in row.from" :key="segIndex" :class="segClass(seg)">{{ seg.t }}</span>
                </td>
                <td v-if="row.change" class="rule-cell rule-cell--change">
                  <span v-for="(seg, segIndex) in row.change" :key="segIndex" :class="segClass(seg)">{{ seg.t }}</span>
                </td>
                <td class="rule-cell">
                  <span v-for="(seg, segIndex) in row.to" :key="segIndex" :class="segClass(seg)">{{ seg.t }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <!-- Special cases (う→わ, 行く, ある, する→できる, …) printed as
               warnings and tips after the table. Pure data from the builder. -->
          <ul v-if="section.notes && section.notes.length" class="rule-notes">
            <li v-for="(note, noteIndex) in section.notes" :key="noteIndex" :class="['rule-note', 'rule-note--' + note.c]">{{ note.t }}</li>
          </ul>
        </section>
      </template>
      <!-- While a pair is still being authored this line stands in; the
           completeness test fails before an unauthored pair can ship. -->
      <p v-else class="rule-missing">該變形的說明尚未完成。</p>

      <span class="hrule" aria-hidden="true"></span>
      <section class="rule-example">
        <p class="section-label">例如</p>
        <button class="example-pick" type="button" @click="pickExample">
          <span>{{ example && exampleFrom ? exampleFrom.vol : '選擇單詞作為例子' }}</span>
          <span class="example-pick-arrow" aria-hidden="true">→</span>
        </button>

        <template v-if="example && exampleFrom && exampleTo">
          <p class="example-pair" lang="ja">{{ exampleFrom.vol }} → {{ exampleTo.vol }}</p>

          <!-- A missing derivation (including 不規則 / 例外) still shows the
               reason and the plain 從 → 到 pair; it never leaves a blank. -->
          <p v-if="derived && derived.reason" class="example-reason">
            因為 {{ exampleFrom.vol }} 是 {{ groupLabel(exampleFrom.group) }}，所以 {{ derived.reason }}。
          </p>

          <div v-if="derived && derived.kind !== 'irregular'" class="example-principle">
            <p class="principle-label">原理：</p>
            <p class="principle-word" lang="ja">
              <span>{{ derived.base }}</span>
              <span v-if="derived.fromChange" class="principle-kana">{{ derived.fromChange }}</span>
              <span v-if="derived.removed" class="principle-struck">{{ derived.removed }}</span>
            </p>
            <p v-if="derived.changeFrom" class="principle-change" lang="ja">{{ derived.changeFrom }} → {{ derived.changeTo }}</p>
            <p v-if="derived.added" class="principle-add-line" lang="ja">＋ {{ derived.added }}</p>
            <!-- `added` is the whole new ending; `toChange` is its first kana,
                 already included, so the result line prints `added` only. -->
            <p class="principle-result" lang="ja">
              <span>{{ derived.base }}</span>
              <span v-if="derived.added" class="principle-added">{{ derived.added }}</span>
            </p>
          </div>

        </template>
      </section>

      <span class="hrule" aria-hidden="true"></span>
      <section class="rule-tips">
        <p class="section-label">小提示</p>
        <ol class="tips-list">
          <li v-for="(tip, tipIndex) in RULE_TIPS" :key="tipIndex">{{ tip }}</li>
        </ol>
      </section>
    </div>
  </section>
</template>

<style scoped>
.rule {
  min-height: 100%;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
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

.rule-body {
  padding-top: 4px;
}

.section-label {
  margin: 14px 0 10px;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
}

.field {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}

.field-label {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  flex: 0 0 28px;
}

.field-body {
  flex: 1;
}

.form-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}

.chevron {
  transition: transform 0.18s ease;
}

.chevron--up {
  transform: rotate(180deg);
}

.form-list-frame {
  position: relative;
  margin: 8px 0 0 38px;
}

.form-list {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  max-height: 320px;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.form-list::-webkit-scrollbar {
  display: none;
}

.form-option {
  display: block;
  width: 100%;
  min-height: 40px;
  padding: 0 14px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  background-clip: padding-box;
  color: var(--ink);
  font: inherit;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
}

.form-option:last-child {
  border-bottom: 0;
}

.form-option:hover {
  background-color: var(--surface-strong);
}

.form-option:active {
  transform: none;
  background-color: var(--surface-strong);
}

.form-option--on {
  color: var(--accent);
  font-weight: 600;
}

/* The three section labels (變形設置 / 例如 / 小提示) share one style, with a
   drawn 1px .hrule above the heading and above each of the last two. The rule
   is its own element, so no border on a neighbour changes colour or length. */
.rule-body > .hrule {
  margin: 20px 0 0;
}

.rule-title {
  margin: 14px 0 14px;
  font-size: 1.15rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.rule-section {
  margin-bottom: 22px;
}

.rule-section-heading {
  margin: 0 0 6px;
  font-size: 1rem;
  font-weight: 600;
}

.rule-line {
  margin: 0 0 10px;
  font-size: 0.92rem;
  line-height: 1.6;
  color: var(--ink-soft);
}

/* The 段 / 音便 mapping: one centred line per group, with its optional note. */
.rule-map {
  margin: 2px 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
}

.rule-map-label {
  margin: 0 0 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-soft);
}

.rule-map-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin: 6px 0;
}

.rule-map-line {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--highlight);
  letter-spacing: 0.04em;
}

.rule-map-note {
  font-size: 0.78rem;
  color: var(--muted);
}

/* Special cases: warnings in the error colour, tips in the soft ink. */
.rule-notes {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.rule-note {
  padding: 8px 12px;
  margin: 6px 0;
  border-left: 3px solid var(--line);
  border-radius: 0 8px 8px 0;
  background: var(--surface);
  font-size: 0.86rem;
  line-height: 1.65;
  color: var(--ink-soft);
}

.rule-note--warn {
  border-left-color: var(--error);
  color: var(--error);
}

.rule-note--tip {
  border-left-color: var(--accent);
}

/* The middle 變形 column reads as a short centred annotation. */
.rule-cell--change {
  text-align: center;
}

/* The changing kana reads in purple; the removed suffix reads in red with a
   double strikethrough (紅色雙刪除線、紅色字體). */
.seg--change {
  color: var(--highlight);
}

.seg--removed {
  color: var(--error);
  text-decoration: line-through;
  text-decoration-style: double;
}

.rule-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.rule-table th,
.rule-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  vertical-align: top;
}

.rule-table th {
  font-weight: 600;
  color: var(--ink-soft);
  font-size: 0.8rem;
  letter-spacing: 0.06em;
}

.rule-table tbody tr:last-child td {
  border-bottom: 0;
}

.rule-missing {
  margin: 0 0 22px;
  font-size: 0.92rem;
  color: var(--muted);
}

.rule-example {
  margin-top: 0;
  padding-top: 0;
}

.example-pick {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
}

.example-pick-arrow {
  color: var(--ink-soft);
  font-size: 1.1rem;
}

.example-pair {
  margin: 12px 0 0;
  font-size: 1.2rem;
  font-weight: 600;
  text-align: center;
}

.example-reason {
  margin: 12px 0 0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.example-principle {
  margin-top: 12px;
}

.principle-label {
  margin: 0 0 6px;
  font-size: 0.9rem;
  color: var(--ink-soft);
}

.principle-word {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 600;
  text-align: center;
}

/* The changing kana reads in purple. */
.principle-kana {
  color: var(--highlight);
}

/* The removable suffix: error colour and a double strikethrough in that same
   colour (字體紅色、刪除線紅色), while the unchanged stem keeps its ink. */
.principle-struck {
  color: var(--error);
  text-decoration-line: line-through;
  text-decoration-style: double;
}

.principle-change {
  margin: 8px 0 0;
  font-size: 1.1rem;
  font-weight: 600;
  text-align: center;
  color: var(--highlight);
}

/* The added suffix reads in a dark blue, distinct from the purple kana. */
.principle-add-line {
  margin: 4px 0 0;
  font-size: 1.1rem;
  font-weight: 600;
  text-align: center;
  color: #1d4ed8;
}

.principle-added {
  color: #1d4ed8;
}

.principle-result {
  margin: 8px 0 0;
  font-size: 1.6rem;
  font-weight: 600;
  text-align: center;
}

.rule-tips {
  margin-top: 0;
  padding-top: 0;
}

/* 小提示 is a numbered list: 1. … 2. … */
.tips-list {
  margin: 0;
  padding-left: 1.4em;
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--ink-soft);
}

.tips-list li {
  margin: 6px 0;
  padding-left: 0.2em;
}
</style>

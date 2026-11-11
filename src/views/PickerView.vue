<script setup>
import { computed, inject, ref } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { FORMS, formName } from '../dict/forms.js'
import { canStart, nextSelectAllTargets, startHint } from '../dict/settings.js'
import { EMPTY_LESSON_HINT, selectAllLabel } from '../dict/lessons.js'

const store = inject('store')
const session = store.session
const formsOpen = ref(false)

const mode = computed(() => session.mode)
const settings = computed(() => session.settings[session.mode])
const needsForms = computed(() => session.mode !== 'dict')
const startEnabled = computed(() => canStart(session.settings, session.mode))
const selectAllText = computed(() => selectAllLabel(session.lessons, settings.value.lessons))
const startHintText = computed(() => startHint(session.settings, session.mode))

function toggleLesson(entry) {
  store.send('lessons.toggle', { lesson: entry.lesson })
}

function selectFrom(formId) {
  store.send('settings.patch', { patch: { [session.mode]: { from: formId } } })
  formsOpen.value = false
}

function selectTarget(formId) {
  const to = settings.value.to.includes(formId)
    ? settings.value.to.filter((id) => id !== formId)
    : [...settings.value.to, formId]
  store.send('settings.patch', { patch: { [session.mode]: { to } } })
}

function selectAllTargets() {
  store.send('settings.patch', {
    patch: { [session.mode]: { to: nextSelectAllTargets(settings.value.to, settings.value.from) } },
  })
}

function start() {
  store.send('study.start')
}

function back() {
  store.send('nav.go', { screen: 'home' })
}
</script>

<template>
  <section class="picker">
    <header class="bar bar--sticky">
      <button class="icon-button" type="button" aria-label="返回" @click="back"><ArrowLeft :size="22" aria-hidden="true" /></button>
      <h1 class="bar-title">詞彙</h1>
    </header>

    <div class="section-head">
      <span class="section-label">課次</span>
      <button
        class="text-button"
        type="button"
        @click="store.send('lessons.selectAll')"
      >
        {{ selectAllText }}
      </button>
    </div>

    <div class="chip-grid">
      <span v-for="entry in session.lessons" :key="entry.lesson" class="chip-wrap">
        <button
          class="chip chip--lesson"
          :class="{
            'chip--on': settings.lessons.includes(entry.lesson),
            'chip--empty': !entry.hasVerbs,
          }"
          :disabled="!entry.hasVerbs"
          type="button"
          :aria-pressed="settings.lessons.includes(entry.lesson)"
          :aria-describedby="entry.hasVerbs ? undefined : `hint-lesson-${entry.lesson}`"
          @click="toggleLesson(entry)"
        >
          第{{ entry.lesson }}課
        </button>
        <span
          v-if="!entry.hasVerbs"
          :id="`hint-lesson-${entry.lesson}`"
          class="chip-tip"
          aria-hidden="true"
        >
          {{ EMPTY_LESSON_HINT }}
        </span>
      </span>
    </div>

    <div v-if="needsForms" class="field">
      <span class="field-label">從</span>
      <div class="field-body">
        <button
          class="form-select"
          type="button"
          :aria-expanded="formsOpen"
          @click="formsOpen = !formsOpen"
        >
          <span>{{ formName(settings.from) }}</span>
          <span class="chevron" :class="{ 'chevron--up': formsOpen }">⌄</span>
        </button>
      </div>
    </div>

    <div v-if="needsForms && formsOpen" class="form-list">
      <button
        v-for="form in FORMS"
        :key="form.id"
        class="form-option"
        :class="{ 'form-option--on': settings.from === form.id }"
        type="button"
        @click="selectFrom(form.id)"
      >
        {{ form.name }}
      </button>
    </div>

    <div v-if="needsForms" class="targets">
      <div class="targets-head">
        <span class="field-label">到</span>
        <button class="text-button" type="button" @click="selectAllTargets">全選</button>
      </div>
      <div class="form-chips">
        <button
          v-for="form in FORMS"
          :key="form.id"
          class="chip chip--form"
          :class="{ 'chip--on': settings.to.includes(form.id) }"
          type="button"
          :aria-pressed="settings.to.includes(form.id)"
          @click="selectTarget(form.id)"
        >
          {{ form.name }}
        </button>
      </div>
    </div>

    <footer class="picker-footer">
      <p v-if="startHintText" class="start-hint" role="status">{{ startHintText }}</p>
      <button
        class="button primary picker-start"
        type="button"
        :disabled="!startEnabled"
        @click="start"
      >
        開始
      </button>
    </footer>
  </section>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: 8px 0 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
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
}

.icon-button:hover {
  background: var(--surface);
}

.bar-title {
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 20px 0 10px;
}

.section-label {
  font-size: 0.8rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.text-button {
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 600;
  min-height: 32px;
  padding: 0 8px;
  cursor: pointer;
}

.chip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 8px;
}

.chip-wrap {
  position: relative;
  display: block;
}

.chip--lesson {
  width: 100%;
}

/* Hint on a lesson chip that has no verbs. Hover or keyboard focus shows it. */
.chip-tip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  z-index: 3;
  transform: translateX(-50%);
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--ink);
  color: #fff;
  font-size: 0.72rem;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.14s ease;
}

.chip-wrap:hover .chip-tip,
.chip-wrap:focus-within .chip-tip {
  opacity: 1;
}

.chip {
  min-height: 36px;
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  /* Buttons do not inherit the app font by default; Arial's CJK fallback
     inflates the line box and defeats the 36px height. */
  font: inherit;
  font-size: 0.85rem;
  line-height: 1.25;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.chip:hover:not(:disabled) {
  border-color: var(--accent);
}

.chip--on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

.chip--empty:disabled {
  color: var(--muted);
  background: transparent;
  border-color: var(--line);
  opacity: 0.45;
  cursor: default;
  /* Let the pointer reach the wrapper so its hint can show. */
  pointer-events: none;
}

.field {
  display: flex;
  /* The label centres against the 36px form control beside it. It used to be
     nudged down with padding, which left the glyph sitting below the control's
     centre instead of on it. */
  align-items: center;
  gap: 10px;
  margin-top: 24px;
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
  width: 100%;
  min-height: 36px;
  padding: 0 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font-size: 0.95rem;
  cursor: pointer;
}

.chevron {
  transition: transform 0.18s ease;
}

.chevron--up {
  transform: rotate(180deg);
}

.form-list {
  margin: 8px 0 0 38px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  max-height: 320px;
  overflow-y: auto;
  /* The page hides its own scrollbar; this list is a scroll container of its
     own, so it opts back in and keeps the native bar. */
  scrollbar-width: auto;
}

.form-option {
  display: block;
  width: 100%;
  min-height: 40px;
  padding: 0 14px;
  border: 0;
  border-bottom: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

.form-option:last-child {
  border-bottom: 0;
}

.form-option:hover {
  background: var(--surface-strong);
}

.form-option--on {
  color: var(--accent);
  font-weight: 600;
}


.targets {
  margin-top: 26px;
}

.targets-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 10px;
}

.targets-head .field-label {
  flex: none;
  padding-top: 0;
}

/* 到: one bordered button per form, equal size, wrapping when narrow. */
.form-chips {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 8px;
}

.chip--form {
  width: 100%;
  min-height: 36px;
  padding: 0 6px;
  border: 1px solid var(--line);
  font-size: 0.8rem;
}

.start-hint {
  margin: 0 0 10px;
  text-align: center;
  font-size: 0.86rem;
  letter-spacing: 0.02em;
  color: var(--accent);
}

/* 開始 is the one primary action on this screen, so it keeps a tall target. */
.picker-start {
  width: 100%;
  min-height: 50px;
  font-size: 17px;
  font-weight: 600;
}

.picker-footer {
/* The fade band lives entirely above the controls: solid column colour behind
   the buttons, transparency only in the top padding. No hairline underline. */

  position: sticky;
  bottom: 0;
  /* margin-top: auto keeps the footer hugging the column bottom on short
     content; the 10px of column padding below it is all the space there is. */
  margin-top: auto;
  padding: 28px 0 max(20px, env(safe-area-inset-bottom));
  background: linear-gradient(
    to top,
    var(--column) 0,
    var(--column) calc(100% - 28px),
    transparent 100%
  );
}
</style>

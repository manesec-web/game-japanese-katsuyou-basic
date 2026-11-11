<script setup>
import { computed, inject, ref } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { FORMS, formName } from '../dict/forms.js'
import { REVEAL_CHOICES } from '../dict/quiz.js'

const store = inject('store')
const session = store.session
const formsOpen = ref(false)

const mode = computed(() => session.mode)
const settings = computed(() => session.settings[session.mode])
const backScreen = computed(
  () => ({ dict: 'reader', card: 'card', quiz: 'quiz' })[session.mode] ?? 'home',
)

function back() {
  store.send('nav.go', { screen: backScreen.value })
}

function patch(fields) {
  store.send('settings.patch', { patch: { [session.mode]: fields } })
}

function chooseForm(formId) {
  patch({ defaultForm: formId })
  formsOpen.value = false
}

function toggle(field) {
  patch({ [field]: !settings.value[field] })
}
</script>

<template>
  <section class="settings">
    <header class="bar bar--sticky">
      <button class="icon-button" type="button" aria-label="返回" @click="back"><ArrowLeft :size="22" aria-hidden="true" /></button>
      <h1 class="bar-title">設定</h1>
      <span class="bar-spacer"></span>
    </header>

    <div v-if="mode === 'dict'" class="row">
      <span class="row-label">預設顯示形式</span>
      <button
        class="form-select"
        type="button"
        :aria-expanded="formsOpen"
        @click="formsOpen = !formsOpen"
      >
        <span>{{ formName(settings.defaultForm) }}</span>
        <span class="chevron" :class="{ 'chevron--up': formsOpen }">⌄</span>
      </button>
    </div>

    <div v-if="mode === 'dict' && formsOpen" class="form-list">
      <button
        v-for="form in FORMS"
        :key="form.id"
        class="form-option"
        :class="{ 'form-option--on': settings.defaultForm === form.id }"
        type="button"
        @click="chooseForm(form.id)"
      >
        {{ form.name }}
      </button>
    </div>

    <div v-if="mode === 'card'" class="row">
      <span class="row-label">一開始顯示幾類動詞</span>
      <button
        class="switch"
        :class="{ 'switch--on': settings.showGroup }"
        type="button"
        role="switch"
        :aria-checked="settings.showGroup"
        @click="toggle('showGroup')"
      >
        <span class="switch-knob"></span>
      </button>
    </div>

    <div v-if="mode === 'quiz'" class="row row--stacked">
      <div class="row-head">
        <span class="row-label">錯 {{ settings.revealAfter }} 題就顯示答案</span>
      </div>
      <div class="choice-chips">
        <button
          v-for="count in REVEAL_CHOICES"
          :key="count"
          class="choice"
          :class="{ 'choice--on': settings.revealAfter === count }"
          type="button"
          :aria-pressed="settings.revealAfter === count"
          :aria-label="`錯${count}題就顯示答案`"
          @click="patch({ revealAfter: count })"
        >
          {{ count }}
        </button>
      </div>
    </div>

    <div v-if="mode === 'quiz'" class="row">
      <span class="row-label">自動提交答案</span>
      <button
        class="switch"
        :class="{ 'switch--on': settings.autoSubmit }"
        type="button"
        role="switch"
        :aria-checked="settings.autoSubmit"
        @click="toggle('autoSubmit')"
      >
        <span class="switch-knob"></span>
      </button>
    </div>

    <div class="row">
      <span class="row-label">顯示平假名注音</span>
      <button
        class="switch"
        :class="{ 'switch--on': settings.showReading }"
        type="button"
        role="switch"
        :aria-checked="settings.showReading"
        @click="toggle('showReading')"
      >
        <span class="switch-knob"></span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.settings {
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

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
  border-bottom: 1px solid var(--line);
}

.row-label {
  font-size: 0.95rem;
}

.row--stacked {
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 8px;
  padding: 12px 0;
}

.row-head {
  display: flex;
  justify-content: space-between;
}

.choice-chips {
  display: flex;
  gap: 8px;
}

.choice {
  flex: 1;
  min-height: 36px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 0.95rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.choice:hover {
  border-color: var(--accent);
}

.choice--on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

.form-select {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font-size: 0.9rem;
  cursor: pointer;
  max-width: 60%;
}

.chevron {
  transition: transform 0.18s ease;
}

.chevron--up {
  transform: rotate(180deg);
}

.form-list {
  margin: 10px 0 18px;
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

.form-option--on {
  color: var(--accent);
  font-weight: 600;
}

.switch {
  position: relative;
  width: 52px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(36, 33, 58, 0.15);
  cursor: pointer;
  transition: background 180ms ease;
  padding: 0;
}

.switch--on {
  background: var(--accent);
  border-color: var(--accent);
}

.switch-knob {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: transform 180ms ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

.switch--on .switch-knob {
  transform: translateX(20px);
}
</style>

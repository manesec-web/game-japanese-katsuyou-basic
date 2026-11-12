<script setup>
import { computed, inject, ref, watch } from 'vue'
import { ArrowLeft, ChevronDown } from 'lucide-vue-next'
import { FORMS, formName } from '../dict/forms.js'
import { REVEAL_CHOICES } from '../dict/quiz.js'
import {
  nextSelectAllDisplayForms,
  selectAllDisplayLabel,
} from '../dict/settings.js'
import ScrollThumb from '../components/ScrollThumb.vue'
import { useElementThumb } from '../ui/element-thumb.js'

const store = inject('store')
const session = store.session
const formsOpen = ref(false)
// The 預設顯示形式 list is its own scroll container with a drawn thumb.
const formListRef = ref(null)
const formThumb = useElementThumb()
watch(formListRef, (el) => formThumb.attach(el), { flush: 'post' })

const mode = computed(() => session.mode)
const settings = computed(() => session.settings[session.mode])
const backScreen = computed(
  () => ({ dict: 'reader', card: 'card', quiz: 'quiz' })[session.mode] ?? 'home',
)
const displaySelectAllText = computed(() => selectAllDisplayLabel(settings.value.displayForms))

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

function toggleDisplayForm(formId) {
  // The 預設顯示形式 cannot be switched off: the reader opens on its block, so
  // its chip is a disabled button and this guard keeps that rule if the event
  // arrives anyway.
  if (formId === settings.value.defaultForm) return
  const current = settings.value.displayForms
  if (current.includes(formId)) {
    // Keep at least one form visible so the reader never comes up empty.
    if (current.length === 1) return
    patch({ displayForms: current.filter((id) => id !== formId) })
  } else {
    patch({ displayForms: [...current, formId] })
  }
}

function selectAllDisplayForms() {
  patch({
    displayForms: nextSelectAllDisplayForms(
      settings.value.displayForms,
      settings.value.defaultForm,
    ),
  })
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
        <ChevronDown :size="16" class="chevron" :class="{ 'chevron--up': formsOpen }" aria-hidden="true" />
      </button>
    </div>

    <template v-if="mode === 'dict' && formsOpen">
      <!-- 不要加綫，很醜！ -->
      <!-- <span class="hrule" aria-hidden="true"></span> -->
      <div class="form-list-frame">
        <div ref="formListRef" class="form-list">
          <template v-for="(form, index) in FORMS" :key="form.id">
            <button
              class="form-option"
              :class="{ 'form-option--on': settings.defaultForm === form.id }"
              type="button"
              @click="chooseForm(form.id)"
            >
              {{ form.name }}
            </button>
            <!-- Every option but the last is followed by the rule, so the list
                 needs no :last-child override to drop its closing line. -->
            <span v-if="index < FORMS.length - 1" class="hrule" aria-hidden="true"></span>
          </template>
        </div>
        <ScrollThumb
          :visible="formThumb.visible.value"
          :dragging="formThumb.dragging.value"
          :length="formThumb.length.value"
          :offset="formThumb.offset.value"
          @drag-start="formThumb.dragStart"
          @drag-move="formThumb.dragMove"
          @drag-end="formThumb.dragEnd"
        />
      </div>
    </template>

    <template v-if="mode === 'dict'">
      <span class="hrule" aria-hidden="true"></span>
      <div class="row row--stacked">
        <div class="row-head">
          <span class="row-label">選擇顯示的類型</span>
          <button class="text-button" type="button" @click="selectAllDisplayForms">{{ displaySelectAllText }}</button>
        </div>
        <div class="form-chips">
          <span v-for="form in FORMS" :key="form.id" class="chip-wrap">
            <button
              class="chip"
              :class="{
                'chip--on': settings.displayForms.includes(form.id),
                'chip--locked': form.id === settings.defaultForm,
              }"
              type="button"
              :disabled="form.id === settings.defaultForm"
              :aria-pressed="settings.displayForms.includes(form.id)"
              :aria-describedby="form.id === settings.defaultForm ? 'hint-default-form' : undefined"
              @click="toggleDisplayForm(form.id)"
            >
              {{ form.name }}
            </button>
            <!-- The 預設顯示形式 is the block the reader opens on, so it cannot
                 be switched off; the tooltip says why the chip is disabled. -->
            <span
              v-if="form.id === settings.defaultForm"
              id="hint-default-form"
              class="chip-tip"
              aria-hidden="true"
            >
              這是預設顯示形式，必須顯示，不能取消
            </span>
          </span>
        </div>
      </div>
    </template>

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

    <!-- 錯 N 題就顯示答案 opens quiz mode, so no rule above it. -->
    <template v-if="mode === 'quiz'">
      <div class="row row--stacked">
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
      <span class="hrule" aria-hidden="true"></span>
      <div class="row">
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
    </template>

    <span class="hrule" aria-hidden="true"></span>
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

    <template v-if="mode === 'dict'">
      <span class="hrule" aria-hidden="true"></span>
      <div class="row row--stacked">
        <div class="row-head">
          <span class="row-label">跳過錯誤的單詞</span>
          <button
            class="switch"
            :class="{ 'switch--on': settings.skipErrorUsage }"
            type="button"
            role="switch"
            :aria-checked="settings.skipErrorUsage"
            aria-label="跳過錯誤的單詞"
            @click="toggle('skipErrorUsage')"
          >
            <span class="switch-knob"></span>
          </button>
        </div>
        <p class="row-note">跳過錯誤的詞語，例如：「始まられる」。因為「始まる」是自動詞，所以「〜を始まられる」不成立，跳過這類不成立的動詞。</p>
      </div>
    </template>

    <template v-if="mode === 'card'">
      <span class="hrule" aria-hidden="true"></span>
      <div class="row row--stacked">
        <div class="row-head">
          <span class="row-label">跳過錯誤的單詞</span>
          <button
            class="switch"
            :class="{ 'switch--on': settings.skipErrorUsage }"
            type="button"
            role="switch"
            :aria-checked="settings.skipErrorUsage"
            aria-label="跳過錯誤的單詞"
            @click="toggle('skipErrorUsage')"
          >
            <span class="switch-knob"></span>
          </button>
        </div>
        <p class="row-note">跳過錯誤的詞語，例如：「始まられる」。因為「始まる」是自動詞，所以「〜を始まられる」不成立，跳過這類不成立的動詞。</p>
      </div>
    </template>

    <template v-if="mode === 'quiz'">
      <span class="hrule" aria-hidden="true"></span>
      <div class="row row--stacked">
        <div class="row-head">
          <span class="row-label">跳過錯誤的單詞</span>
          <button
            class="switch"
            :class="{ 'switch--on': settings.skipErrorUsage }"
            type="button"
            role="switch"
            :aria-checked="settings.skipErrorUsage"
            aria-label="跳過錯誤的單詞"
            @click="toggle('skipErrorUsage')"
          >
            <span class="switch-knob"></span>
          </button>
        </div>
        <p class="row-note">跳過錯誤的詞語，例如：「始まられる」。中途開啟會移除剩餘的不成立題目，關閉則把它們補回題目尾端。</p>
      </div>
    </template>
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

/* Rows carry no line of their own: the separator between two rows is a
   `.hrule` element (src/styles/app.css), so the rule no longer changes colour
   under a hover or press tint and no longer shrinks with a pressed row. */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 52px;
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
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.row-note {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--muted);
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

/* 預設顯示形式: a dropdown single choice. */
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

.form-list-frame {
  position: relative;
  margin: 10px 0 18px;
}

.form-list {
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  max-height: 320px;
  overflow-y: auto;
  /* Keep a list-edge gesture inside this panel instead of handing it to the
     root page; the panel's own vertical scrolling remains enabled. */
  overscroll-behavior-y: contain;
  -webkit-overflow-scrolling: touch;
  /* The page hides its own scrollbar; this list hides the native bar too and
     draws the same thumb the page uses, inside its own frame. */
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
  background: transparent;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}

/* The list's separators are `.hrule` elements between the options, so the row's
   fill may cover the whole row and nothing has to be clipped to the padding
   box to keep a divider one colour. */
.form-option:hover {
  background-color: var(--surface-strong);
}

/* A pressed option row keeps its width and its position against the list's
   edge: the row is a row of a panel, not a free-standing button. The tint is
   the whole press feedback here. */
.form-option:active {
  transform: none;
  background-color: var(--surface-strong);
}

.form-option--on {
  color: var(--accent);
  font-weight: 600;
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

/* 選擇顯示的類型: one bordered chip per form, like the 到 block in the
   picker. Deselecting a chip hides that form in the reader; the chip of the
   current 預設顯示形式 is disabled and explains itself in a tooltip, so the
   grid wraps each chip and its tip in a `.chip-wrap`. Each button fills its
   cell from edge to edge, like the quiz settings' `.choice` group, so the
   labels sit in a tidy grid instead of leaving ragged gaps. */
.form-chips {
  display: grid;
  /* 112px clears the longest form name (ませんでした形) at 0.8rem, so a
     nowrap label never widens its own track. */
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px;
}

.chip-wrap {
  position: relative;
  display: flex;
  min-width: 0;
}

/* The reason a locked chip cannot be pressed: the same inline tooltip the
   lesson chips use in the picker. Shown on hover of the wrapper (the button
   itself is disabled) and on focus of anything inside it. */
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
  line-height: 1.35;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.16s ease;
}

.chip-wrap:hover .chip-tip,
.chip-wrap:focus-within .chip-tip {
  opacity: 1;
}

.chip {
  width: 100%;
  min-width: 0;
  min-height: 36px;
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease;
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

/* The locked 預設顯示形式 chip looks exactly like the picker's disabled 第1課
   chip: transparent body, muted grey label, divider-colour border, 45% opacity
   and no pointer events. It is still pressed ("on") in the data, so this rule
   follows `.chip--on` to override that filled look. Hovering reaches the
   wrapper instead, which is what shows the explanatory tooltip. */
.chip--locked:disabled {
  color: var(--muted);
  background: transparent;
  border-color: var(--line);
  font-weight: 400;
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
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

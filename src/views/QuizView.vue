<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue'
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-vue-next'
import RubyWord from '../components/RubyWord.vue'
import CompletePanel from '../components/CompletePanel.vue'
import { formName } from '../dict/forms.js'
import { buildKeyboard, missHint, questionFor, revealAfterFor } from '../dict/quiz.js'
import { typingEdits } from '../ui/typing.js'

const store = inject('store')
const session = store.session
const toast = ref('')
const shaking = ref(false)
let toastTimer = null
let shakeTimer = null

const item = computed(() => session.items[session.index] ?? null)
const source = computed(() => item.value?.verb?.[session.settings.quiz.from] ?? null)
const target = computed(() => item.value?.verb?.[item.value?.targetForm] ?? null)
const showReading = computed(() => session.settings.quiz.showReading)
const answer = computed(() => session.answer)
const question = computed(
  () =>
    item.value && questionFor(formName(item.value.targetForm), item.value.targetForm),
)
const keyboard = computed(() => buildKeyboard(target.value?.japanese ?? ''))
const canCheck = computed(
  () => !answer.value.revealed && answer.value.input.trim() !== '',
)
// '再答錯 X 題就顯示答案' after a miss, before the answer is revealed.
const hint = computed(() => {
  if (answer.value.revealed || answer.value.wrong === 0) return null
  return missHint(answer.value.wrong, revealAfterFor(session.settings.quiz))
})

function announce(result) {
  if (!result || !result.ok) return
  const status = result.result?.status
  if (!status) return
  // A correct answer keeps the 回答正確 toast; a miss shakes the field and
  // turns it red instead of showing a 回答錯誤 toast.
  if (status === 'correct') showToast('回答正確')
  else shake()
}

function shake() {
  // Re-trigger the shake animation even on consecutive misses.
  shaking.value = false
  requestAnimationFrame(() => {
    shaking.value = true
  })
  clearTimeout(shakeTimer)
  shakeTimer = setTimeout(() => {
    shaking.value = false
  }, 360)
}

function showToast(text) {
  toast.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 1600)
}

function pressKey(char) {
  if (answer.value.revealed) return
  announce(store.send('quiz.input', { op: 'append', text: char }))
}

function onBackspace() {
  if (answer.value.revealed) return
  store.send('quiz.input', { op: 'backspace' })
}

function onInput(event) {
  const current = answer.value.input
  const next = event.target.value
  if (answer.value.revealed) {
    event.target.value = current
    return
  }
  const edits = typingEdits(current, next)
  let last = null
  for (const edit of edits) last = store.send('quiz.input', edit)
  if (last) announce(last)
  event.target.value = session.answer.input
}

function check() {
  if (!canCheck.value) return
  announce(store.send('quiz.submit'))
}

function next() {
  store.send('quiz.advance')
}

function back() {
  store.send('nav.go', { screen: 'picker' })
}

function openSettings() {
  store.send('nav.go', { screen: 'settings' })
}

onBeforeUnmount(() => {
  clearTimeout(toastTimer)
  clearTimeout(shakeTimer)
})
</script>

<template>
  <section class="quiz">
    <header class="bar bar--sticky">
      <button class="icon-button" type="button" aria-label="返回" @click="back"><ArrowLeft :size="22" aria-hidden="true" /></button>
      <h1 class="bar-title">{{ session.items.length ? `測驗（${session.index + 1}/${session.items.length}）` : '測驗' }}</h1>
      <button class="icon-button" type="button" aria-label="設定" @click="openSettings"><SettingsIcon :size="22" aria-hidden="true" /></button>
    </header>

    <div v-if="item && source && !session.finished" class="quiz-body">
      <div class="prompt">
        <div class="word">
          <RubyWord
            :text="source.vol"
            :reading="source.japanese"
            :show-reading="showReading"
          />
        </div>
        <p class="question">{{ question }}</p>
      </div>

      <div class="answer-row">
        <div class="field" :class="{ 'field--error': answer.verdict === 'wrong', 'field--shake': shaking }">
          <input
            class="answer-input"
            type="text"
            lang="ja"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            :value="answer.input"
            :disabled="answer.revealed"
            aria-label="答案"
            @input="onInput"
          />
          <button
            class="field-backspace"
            type="button"
            aria-label="刪除"
            :disabled="answer.revealed"
            @click="onBackspace"
          >
            ⌫
          </button>
        </div>
        <button
          class="button primary check-button"
          type="button"
          :disabled="!canCheck"
          @click="check"
        >
          檢查
        </button>
      </div>

      <p v-if="hint" class="miss-hint" role="status">{{ hint }}</p>

      <div class="keyboard-area">
        <div class="keyboard" :class="{ 'keyboard--locked': answer.revealed }">
          <button
            v-for="(key, index) in keyboard"
            :key="`${index}-${key}`"
            class="key"
            type="button"
            :disabled="answer.revealed"
            @click="pressKey(key)"
          >
            {{ key }}
          </button>
        </div>

        <!-- The revealed answer sits on top of the keyboard and covers it. -->
        <div v-if="answer.revealed" class="reveal">
          <p class="reveal-label">答案</p>
          <div class="reveal-word">
            <RubyWord
              :text="target.vol"
              :reading="target.japanese"
              :show-reading="showReading"
            />
          </div>
          <p class="reveal-reading" lang="ja">{{ target.japanese }}</p>
          <button class="button primary next-button" type="button" @click="next">
            下一題
          </button>
        </div>
      </div>
    </div>

    <CompletePanel
      v-if="session.finished"
      mode="quiz"
      :results="session.results"
    />

    <transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </transition>
  </section>
</template>

<style scoped>
.quiz {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  position: relative;
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

.prompt {
  margin: 14px 0 18px;
}

.word {
  font-size: 2.3rem;
  font-weight: 600;
}

.question {
  margin: 8px 0 0;
  font-size: 1rem;
  letter-spacing: 0.06em;
  color: var(--ink-soft);
}

.answer-row {
  display: flex;
  align-items: stretch;
  gap: 10px;
}

.field {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
  padding-right: 44px;
}

.field--error {
  border-color: var(--error);
}

.field--error .answer-input {
  color: var(--error);
}

.field--shake {
  animation: field-shake 320ms ease;
}

@keyframes field-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.answer-input {
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  font: inherit;
  font-size: 1.15rem;
  color: var(--ink);
}

.answer-input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.field-backspace {
  position: absolute;
  right: 2px;
  top: 2px;
  bottom: 2px;
  width: 40px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 1rem;
  cursor: pointer;
}

.field-backspace:disabled {
  opacity: 0.4;
  cursor: default;
}

.check-button {
  flex: 0 0 auto;
  padding: 0 14px;
  font-weight: 600;
}

.check-button:disabled,
.key:disabled {
  opacity: 0.45;
  cursor: default;
}

.keyboard-area {
  position: relative;
  margin-top: 14px;
}

.miss-hint {
  margin: 12px 0 0;
  font-size: 0.86rem;
  letter-spacing: 0.04em;
  color: var(--accent);
}

.keyboard {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.key {
  min-height: 48px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font-size: 1.05rem;
  cursor: pointer;
}

.key:hover:not(:disabled) {
  border-color: var(--accent);
}

.keyboard--locked {
  opacity: 0.55;
}

.reveal {
  position: absolute;
  inset: -6px -4px;
  z-index: 4;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 14px 16px;
  border: 1px solid var(--accent);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 16px 34px rgba(20, 16, 50, 0.18);
}

.reveal-label {
  margin: 0 0 6px;
  font-size: 0.78rem;
  letter-spacing: 0.16em;
  color: var(--ink-soft);
  text-transform: uppercase;
}

.reveal-word {
  font-size: 2rem;
  font-weight: 600;
}

.reveal-reading {
  margin: 4px 0 12px;
  color: var(--ink-soft);
}

.next-button {
  width: 100%;
}

.toast {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 999px;
  background: var(--ink);
  color: #fff;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  box-shadow: 0 10px 24px rgba(20, 16, 50, 0.25);
  z-index: 30;
}

.toast-enter-active,
.toast-leave-active {
  transition: transform 220ms ease, opacity 220ms ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -64px);
}
</style>

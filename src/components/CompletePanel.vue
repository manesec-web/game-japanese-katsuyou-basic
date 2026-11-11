<script setup>
import { inject } from 'vue'
import {
  accuracy,
  COMPLETE_TITLE,
  confettiPieces,
  isPerfectScore,
  practiceEmoji,
  scoreEmoji,
} from '../study/results.js'

const props = defineProps({
  mode: { type: String, required: true },
  results: { type: Object, required: true },
})

const store = inject('store')

// The run is over when this panel mounts, so the numbers and the emoji are
// drawn once here. Reading them from a computed would re-roll the emoji on
// every re-render. Both modes show one emoji, above the title.
const percent = accuracy(props.results)
const celebration = props.mode === 'quiz' ? scoreEmoji(percent) : practiceEmoji()
const perfect = isPerfectScore(percent)
const confetti = perfect ? confettiPieces() : []

const bandLabel = `${percent}%`

function home() {
  store.send('nav.go', { screen: 'home' })
}
</script>

<template>
  <section class="complete" :class="{ 'complete--perfect': perfect }" role="status">
    <div v-if="perfect" class="confetti" aria-hidden="true">
      <span
        v-for="piece in confetti"
        :key="piece.id"
        class="confetti-piece"
        :style="{
          left: `${piece.left}%`,
          fontSize: `${piece.size}px`,
          animationDelay: `${piece.delay}s`,
          animationDuration: `${piece.duration}s`,
          '--drift': `${piece.drift}px`,
        }"
      >{{ piece.emoji }}</span>
    </div>

    <p v-if="celebration" class="complete-emoji" aria-hidden="true">{{ celebration }}</p>

    <p class="complete-title">{{ COMPLETE_TITLE }}</p>

    <template v-if="mode === 'quiz'">
      <div class="score">
        <span class="score-correct">正確 {{ results.correct }} 題</span>
        <span class="score-wrong">錯誤 {{ results.wrong }} 題</span>
      </div>

      <div
        class="bar"
        role="img"
        :aria-label="`正確率 ${percent}%`"
      >
        <span class="bar-fill" :style="{ width: `${percent}%` }"></span>
      </div>
      <p class="percent">{{ bandLabel }}</p>

      <div v-if="results.misses.length" class="misses">
        <p class="misses-title">錯誤的單詞</p>
        <ul class="miss-list">
          <li v-for="(miss, index) in results.misses" :key="`${index}-${miss.vol}`" class="miss">
            <span class="miss-word">{{ miss.vol }}</span>
            <span class="miss-form">{{ miss.formName }}</span>
            <span class="miss-answer">{{ miss.answer }}</span>
          </li>
        </ul>
      </div>
    </template>

    <button class="button primary complete-home" type="button" @click="home">
      返回主頁
    </button>
  </section>
</template>

<style scoped>
.complete {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin: 24px 0;
  padding: 24px 18px;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 12px 30px rgba(20, 16, 50, 0.08);
  text-align: center;
}

/* A perfect quiz run gets falling emoji behind the card contents. */
.confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.confetti-piece {
  position: absolute;
  top: -12%;
  line-height: 1;
  animation-name: confetti-fall;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes confetti-fall {
  from {
    transform: translate3d(0, -10%, 0) rotate(0deg);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  to {
    transform: translate3d(var(--drift, 0px), 1150%, 0) rotate(360deg);
    opacity: 0;
  }
}

/* The panel contents stay above the confetti. */
.complete > :not(.confetti) {
  position: relative;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  .confetti {
    display: none;
  }
}

/* The congratulation emoji is the piece of colour on the panel: big enough
   to read as the drawing it is, not a stray character in the title's line. */
.complete-emoji {
  margin: 0;
  font-size: 4rem;
  line-height: 1.1;
}

.complete-title {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.score {
  display: flex;
  gap: 18px;
  font-size: 0.95rem;
}

.score-correct {
  color: var(--accent);
  font-weight: 600;
}

.score-wrong {
  color: var(--ink-soft);
}

.bar {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: var(--surface-strong);
  overflow: hidden;
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width 260ms ease;
}

.percent {
  margin: 0;
  font-size: 0.86rem;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}

.misses {
  width: 100%;
  text-align: left;
}

.misses-title {
  margin: 0 0 8px;
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  color: var(--ink-soft);
  text-transform: uppercase;
}

.miss-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}

.miss {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--surface-strong);
  font-size: 0.9rem;
}

.miss-word {
  font-weight: 600;
}

.miss-form {
  color: var(--ink-soft);
  font-size: 0.82rem;
}

.miss-answer {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  color: var(--accent);
}

.complete-home {
  width: 100%;
  /* Same height in both modes: card and quiz share this one button. */
  height: 60px;
  min-height: 60px;
  margin-top: 6px;
  font-weight: 600;
}
</style>

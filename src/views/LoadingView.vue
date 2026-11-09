<script setup>
import { computed, inject } from 'vue'
import { bootstrap } from '../ui/bootstrap.js'

const store = inject('store')
const boot = computed(() => store.session.boot)
const percent = computed(() => {
  if (!boot.value.total) return 0
  return Math.round((boot.value.checked / boot.value.total) * 100)
})

function retry() {
  bootstrap(store)
}
</script>

<template>
  <section class="loading">
    <p class="loading-text">Loading ...</p>
    <div
      class="progress"
      role="progressbar"
      aria-label="Loading"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="percent"
    >
      <div class="progress-fill" :style="{ width: `${percent}%` }"></div>
    </div>
    <div v-if="boot.error" class="loading-error">
      <p class="error-text">載入失敗（lesson {{ boot.error.lesson }}）</p>
      <p v-if="boot.error.message" class="error-detail">{{ boot.error.message }}</p>
      <button class="button primary" type="button" @click="retry">重試</button>
    </div>
  </section>
</template>

<style scoped>
.loading {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 60vh;
  justify-content: center;
}

.loading-text {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.06em;
}

.progress {
  height: 10px;
  border-radius: 999px;
  background: rgba(36, 33, 58, 0.1);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4a3f9f, #c9853f);
  transition: width 220ms ease;
}

.loading-error {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.error-text {
  margin: 0;
  color: #8a2f3a;
}

.error-detail {
  margin: 0;
  max-width: 100%;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--ink-soft);
  word-break: break-word;
}
</style>

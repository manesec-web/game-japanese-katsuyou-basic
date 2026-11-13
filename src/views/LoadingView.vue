<script setup>
import { computed, inject, ref } from 'vue'
import { bootstrap } from '../ui/bootstrap.js'
import { bootPercent } from '../ui/boot-progress.js'
import SiteHead from '../components/SiteHead.vue'
import BuildFooter from '../components/BuildFooter.vue'
import AboutSheet from '../components/AboutSheet.vue'

const store = inject('store')
const sheetOpen = ref(false)
const boot = computed(() => store.session.boot)
const percent = computed(() => bootPercent(boot.value))

function retry() {
  bootstrap(store)
}
</script>

<template>
  <section class="loading">
    <div class="loading-head">
      <SiteHead />
    </div>

    <div class="loading-body">
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
    </div>

    <BuildFooter @open="sheetOpen = true" />
    <AboutSheet :open="sheetOpen" @close="sheetOpen = false" />
  </section>
</template>

<style scoped>
/* The loading screen carries the same head and credit line as the home screen,
   so the first paint already looks like the site. The head and the footer stay
   put while boot runs, and while an error offers retry. */
.loading {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: calc(100dvh - 64px);
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  gap: 24px;
}

.loading-head {
  margin-top: 12vh;
}

.loading-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.loading-text {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.06em;
  text-align: center;
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

@media (max-width: 550px) {
  /* Full-bleed column, matching the home screen. */
  .loading {
    min-height: calc(100dvh - 20px);
  }
}
</style>

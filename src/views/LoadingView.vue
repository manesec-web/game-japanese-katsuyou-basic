<script setup>
import { computed, inject, ref } from 'vue'
import { bootstrap } from '../ui/bootstrap.js'
import BuildFooter from '../components/BuildFooter.vue'
import AboutSheet from '../components/AboutSheet.vue'
import logoUrl from '../../docs/logo/logo-512.png'

const store = inject('store')
const sheetOpen = ref(false)
const boot = computed(() => store.session.boot)

function retry() {
  bootstrap(store)
}
</script>

<template>
  <section class="loading">
    <div class="loading-icon">
      <img class="loading-logo" :src="logoUrl" alt="大家の日本語" />
    </div>

    <div class="loading-body">
      <!-- The circular arc spinner takes the place of the old "Loading ..."
           line and linear bar: it spins while boot runs and is swapped for the
           error + retry when boot fails. -->
      <div v-if="!boot.error" class="loader" role="status" aria-label="載入中"></div>
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
.loading {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: calc(100dvh - 64px);
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  gap: 24px;
}

/* The brand mark replaces the three-line head: a square 1:1 logo icon. */
.loading-icon {
  margin-top: 12vh;
  text-align: center;
}

.loading-logo {
  width: 80%;
  aspect-ratio: 1 / 1;
  max-width: 384px;
  border-radius: 18px;
}

.loading-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

/* Circular arc spinner. The ring reads from the theme tokens (--track for the
   resting ring, --accent for the sweeping arc) so it follows light and dark. */
.loader {
  width: 60px;
  aspect-ratio: 1;
  border: 15px solid var(--track);
  border-radius: 50%;
  position: relative;
  transform: rotate(45deg);
}

.loader::before {
  content: '';
  position: absolute;
  inset: -15px;
  border-radius: 50%;
  border: 15px solid var(--accent);
  animation: loader-sweep 2s infinite linear;
}

@keyframes loader-sweep {
  0% {
    clip-path: polygon(50% 50%, 0 0, 0 0, 0 0, 0 0, 0 0);
  }
  25% {
    clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 0, 100% 0, 100% 0);
  }
  50% {
    clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 100% 100%, 100% 100%);
  }
  75% {
    clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 0 100%, 0 100%);
  }
  100% {
    clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 0 100%, 0 0);
  }
}

/* Without motion the sweep holds still; a fixed arc still reads as loading
   until the screen swaps. */
@media (prefers-reduced-motion: reduce) {
  .loader::before {
    animation: none;
    clip-path: polygon(50% 50%, 0 0, 100% 0, 100% 100%, 0 100%, 0 0);
  }
}

.loading-error {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.error-text {
  margin: 0;
  color: var(--error-strong);
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

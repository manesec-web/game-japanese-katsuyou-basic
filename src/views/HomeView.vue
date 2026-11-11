<script setup>
import { inject, ref } from 'vue'
import SiteHead from '../components/SiteHead.vue'
import BuildFooter from '../components/BuildFooter.vue'
import AboutSheet from '../components/AboutSheet.vue'

const store = inject('store')
const sheetOpen = ref(false)

function enter(mode) {
  store.send('nav.go', { screen: 'picker', mode })
}
</script>

<template>
  <section class="home">
    <div class="home-head">
      <SiteHead />
    </div>

    <div class="home-actions">
      <button class="button primary home-button" type="button" @click="enter('dict')">字典</button>
      <button class="button primary home-button" type="button" @click="enter('card')">翻卡學習</button>
      <button class="button primary home-button" type="button" @click="enter('quiz')">測驗</button>
    </div>

    <BuildFooter feedback @open="sheetOpen = true" />
    <AboutSheet :open="sheetOpen" @close="sheetOpen = false" />
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: calc(100dvh - 64px);
  padding-bottom: max(8px, env(safe-area-inset-bottom));
  gap: 32px;
}

.home-head {
  margin-top: 8vh;
}

.home-actions {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* The first three choices on the home screen stay tall and easy to hit. */
.home-button {
  min-height: 60px;
  font-size: 18px;
  letter-spacing: 0.08em;
}

@media (max-width: 550px) {
  /* Full-bleed column: only its 20px top padding sits above the content. */
  .home {
    min-height: calc(100dvh - 20px);
  }
}
</style>

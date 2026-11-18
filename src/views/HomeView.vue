<script setup>
import { inject, ref } from 'vue'
import SiteHead from '../components/SiteHead.vue'
import ThemeToggle from '../components/ThemeToggle.vue'
import BuildFooter from '../components/BuildFooter.vue'
import AboutSheet from '../components/AboutSheet.vue'

const store = inject('store')
const sheetOpen = ref(false)

function enter(mode) {
  store.send('nav.go', { screen: 'picker', mode })
}

function openLearn() {
  store.send('nav.go', { screen: 'learn' })
}
</script>

<template>
  <section class="home">
    <div class="home-head">
      <SiteHead>
        <template #aside>
          <span class="home-theme">
            <ThemeToggle />
          </span>
        </template>
      </SiteHead>
    </div>

    <div class="home-actions">
      <button class="button primary home-button" type="button" @click="openLearn">學習</button>
      <button class="button primary home-button" type="button" @click="enter('dict')">字典</button>
      <button class="button primary home-button" type="button" @click="enter('card')">翻卡練習</button>
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

/* The theme switch rides on the head's subtitle line, a short gap after the
   習 of 動詞轉型練習: it takes the right track of SiteHead's subtitle grid, so
   it starts where that word ends and the label stays centred. The grid
   centres its items vertically on the line. */
.home-theme {
  display: inline-flex;
  grid-column: 3;
  justify-self: start;
  margin-left: 8px;
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

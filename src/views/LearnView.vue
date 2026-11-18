<script setup>
import { inject } from 'vue'
import { ArrowLeft } from 'lucide-vue-next'
import { FORMS } from '../dict/forms.js'

const store = inject('store')

function back() {
  store.send('nav.go', { screen: 'home' })
}

function open(formId) {
  store.send('rule.open', { to: formId })
}
</script>

<template>
  <section class="learn">
    <header class="bar bar--sticky">
      <button class="icon-button" type="button" aria-label="返回" @click="back"><ArrowLeft :size="22" aria-hidden="true" /></button>
      <h1 class="bar-title">變形目錄</h1>
      <span class="bar-spacer"></span>
    </header>

    <div class="learn-list">
      <button
        v-for="form in FORMS"
        :key="form.id"
        class="learn-row"
        type="button"
        @click="open(form.id)"
      >
        {{ form.name }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.learn {
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
  letter-spacing: 0.02em;
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

.icon-button:hover {
  background: var(--tint);
}

.learn-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
}

/* One 44px outlined row per form, like the 單詞目錄 rows. */
.learn-row {
  width: 100%;
  min-height: 44px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 1.05rem;
  text-align: left;
  cursor: pointer;
  transition: transform 140ms ease, background 140ms ease;
}

.learn-row:hover {
  background: var(--tint);
}

.learn-row:active {
  transform: scale(0.97);
}
</style>

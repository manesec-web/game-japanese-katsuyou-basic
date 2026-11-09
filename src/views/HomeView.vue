<script setup>
import { inject, ref } from 'vue'

const store = inject('store')
const sheetOpen = ref(false)

function enter(mode) {
  store.send('nav.go', { screen: 'picker', mode })
}
</script>

<template>
  <section class="home">
    <header class="home-head">
      <h1 class="home-title">大家の日本語</h1>
      <p class="home-subtitle">轉型練習</p>
      <p class="home-lede">涵蓋初級 1 – 50 課的單詞</p>
    </header>

    <div class="home-actions">
      <button class="button primary home-button" type="button" @click="enter('dict')">字典</button>
      <button class="button primary home-button" type="button" @click="enter('card')">翻卡學習</button>
      <button class="button primary home-button" type="button" @click="enter('quiz')">測驗</button>
    </div>

    <footer class="home-footer">
      <button class="footer-feedback" type="button" @click="sheetOpen = true">
        🥺 如果有 BUG 記得告訴我！
      </button>
      <button class="footer-link" type="button" @click="sheetOpen = true">
        Build with ❤ by Mane
      </button>
    </footer>

    <div v-if="sheetOpen" class="sheet-backdrop" @click.self="sheetOpen = false">
      <div class="sheet" role="dialog" aria-label="About">
        <p class="sheet-line">
          本項目已經開源，<a
            class="sheet-link sheet-repo"
            href="https://github.com/manesec-web/game-japanese-katsuyou-basic"
            target="_blank"
            rel="noopener noreferrer"
          >這裏</a
          >可以獲得源代碼。
        </p>

        <div class="sheet-block">
          <p class="sheet-heading">意見 &amp; Bug 反饋：</p>
          <ol class="sheet-list">
            <li>
              <a
                class="sheet-link sheet-issue"
                href="https://github.com/manesec-web/game-japanese-katsuyou-basic/issues/new"
                target="_blank"
                rel="noopener noreferrer"
              >提交ISSUE</a
              >
            </li>
            <li>
              或者發送郵件到
              <a class="sheet-link sheet-mail" href="mailto:mane@manesec.com"
              >mane@manesec.com</a
              >
            </li>
          </ol>
        </div>

        <p class="sheet-thanks">🥺 どうもありがとうございます。</p>

        <button class="button ghost" type="button" @click="sheetOpen = false">關閉</button>
      </div>
    </div>
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
  margin-top: 12vh;
  text-align: center;
}

.home-title {
  margin: 0;
  font-size: clamp(1.9rem, 7.4vw, 2.6rem);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.home-subtitle {
  margin: 10px 0 0;
  font-size: clamp(1.05rem, 4.2vw, 1.35rem);
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--accent);
}

.home-lede {
  margin: 10px 0 0;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
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

.home-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
  padding-bottom: 8px;
}

.home-footer button {
  border: 0;
  background: none;
  color: var(--ink-soft);
  font-size: 13px;
  padding: 8px 14px;
  cursor: pointer;
  min-height: 36px;
}

.home-footer .footer-feedback {
  color: var(--accent);
  font-weight: 600;
}

.sheet-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(16, 12, 40, 0.45);
  padding: 16px;
  z-index: 20;
}

.sheet {
  width: min(100%, 480px);
  background: var(--column);
  border-radius: 22px;
  box-shadow: var(--shadow);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sheet-link {
  color: var(--accent);
  word-break: break-all;
  font-size: 14px;
}

.sheet-line {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.6;
}

.sheet-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sheet-heading {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.sheet-list {
  margin: 0;
  padding-left: 1.4em;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.9rem;
  line-height: 1.6;
}

.sheet-thanks {
  margin: 0;
  font-size: 0.9rem;
  color: var(--ink-soft);
}
</style>

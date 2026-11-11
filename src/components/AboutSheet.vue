<script setup>
// The About panel: the same sheet on the home screen and the loading screen.
// The parent owns whether it is open.
defineProps({
  open: { type: Boolean, default: false },
})

defineEmits(['close'])
</script>

<template>
  <div v-if="open" class="sheet-backdrop" @click.self="$emit('close')">
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
              href="https://github.com/manesec-web/game-japanese-katsuyou-basic/issues/"
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

      <button class="button ghost" type="button" @click="$emit('close')">關閉</button>
    </div>
  </div>
</template>

<style scoped>
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

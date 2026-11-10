<script setup>
// The build credit line. The home screen adds the bug-report line above it;
// the loading screen shows the credit alone. Either line opens the About sheet,
// which the parent owns. The class names are the ones the browser harness and
// the spec already name.
defineProps({
  feedback: { type: Boolean, default: false },
})

defineEmits(['open'])
</script>

<template>
  <footer class="build-footer">
    <button v-if="feedback" class="footer-feedback" type="button" @click="$emit('open')">
      🥺 如果有 BUG 記得告訴我！
    </button>
    <button class="footer-link" type="button" @click="$emit('open')">
      Build with ❤ by Mane
    </button>
  </footer>
</template>

<style scoped>
.build-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  text-align: center;
  padding-bottom: 8px;
}

.build-footer button {
  border: 0;
  background: none;
  color: var(--ink-soft);
  font-size: 13px;
  padding: 8px 14px;
  cursor: pointer;
  min-height: 36px;
}

.build-footer .footer-feedback {
  color: var(--accent);
  font-weight: 600;
}
</style>

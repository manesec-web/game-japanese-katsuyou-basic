<script setup>
import { computed } from 'vue'
import { alignReading } from '../dict/ruby.js'

const props = defineProps({
  text: { type: String, required: true },
  reading: { type: String, default: '' },
  showReading: { type: Boolean, default: true },
})

const tokens = computed(() => {
  if (!props.showReading) return Array.from(props.text).map((char) => ({ text: char, ruby: null }))
  return alignReading(props.text, props.reading).tokens
})
</script>

<template>
  <span class="ruby-word" :lang="'ja'">
    <template v-for="(token, index) in tokens" :key="index">
      <ruby v-if="token.ruby">{{ token.text }}<rt>{{ token.ruby }}</rt></ruby>
      <span v-else>{{ token.text }}</span>
    </template>
  </span>
</template>

<style scoped>
.ruby-word {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: flex-end;
  line-height: 1.1;
}

.ruby-word ruby {
  display: inline-flex;
  flex-direction: column-reverse;
  align-items: center;
  margin-right: 0.02em;
}

.ruby-word rt {
  font-size: 0.45em;
  line-height: 1.2;
  color: var(--ink-soft);
  letter-spacing: 0.02em;
  font-weight: 400;
}
</style>

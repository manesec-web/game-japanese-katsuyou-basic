<script setup>
import { computed } from 'vue'
import { alignReading } from '../dict/ruby.js'

const props = defineProps({
  text: { type: String, required: true },
  reading: { type: String, default: '' },
  showReading: { type: Boolean, default: true },
  error: { type: Boolean, default: false },
})

const tokens = computed(() => {
  if (!props.showReading) return Array.from(props.text).map((char) => ({ text: char, ruby: null }))
  return alignReading(props.text, props.reading).tokens
})
</script>

<template>
  <span class="ruby-word" :class="{ 'ruby-word--error': error }" :lang="'ja'">
    <template v-for="(token, index) in tokens" :key="index">
      <ruby v-if="token.ruby"><rb>{{ token.text }}</rb><rt>{{ token.ruby }}</rt></ruby>
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

/* An error word keeps its error colour and now carries a double strike: the
   colour marks the misuse and the two lines make it read as deleted at a
   glance. The decoration goes on the base boxes — `rb` and the plain spans —
   because a flex item does not inherit its container's decoration, and it
   deliberately skips `rt` so the reading is not struck too. The line colour is
   left at currentColor, so it stays the error colour of the word. */
.ruby-word--error {
  color: var(--error);
}

.ruby-word--error rb,
.ruby-word--error > span {
  text-decoration-line: line-through;
  text-decoration-style: double;
}

.ruby-word--error rt {
  color: var(--error);
}
</style>

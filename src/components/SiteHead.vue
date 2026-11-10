<!-- The three-line head shared by the loading screen and the home screen. -->
<template>
  <header class="site-head">
    <h1 class="site-title">大家の日本語</h1>
    <p class="site-subtitle">轉型練習</p>
    <p class="site-lede">涵蓋初級 1 – 50 課的單詞</p>
  </header>
</template>

<style scoped>
.site-head {
  text-align: center;
}

.site-title {
  margin: 0;
  font-size: clamp(1.9rem, 7.4vw, 2.6rem);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.site-subtitle {
  margin: 10px 0 0;
  font-size: clamp(1.05rem, 4.2vw, 1.35rem);
  font-weight: 600;
  letter-spacing: 0.16em;
  color: var(--accent);
}

.site-lede {
  margin: 10px 0 0;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
  color: var(--ink-soft);
}
</style>

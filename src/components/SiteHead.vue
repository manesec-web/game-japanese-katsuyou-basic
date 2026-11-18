<!-- The three-line head shared by the loading screen and the home screen.
     The subtitle row accepts an `aside` slot: the home screen drops the theme
     switch immediately to the right of 動詞轉型練習, so the button sits on that
     line instead of over the head's corner. The row is a three-track grid
     (`1fr auto 1fr`): the subtitle sits in the centred middle track, and the
     slot content starts in the right track, which begins exactly at the last
     character's edge. The two `1fr` tracks are equal, so the subtitle stays
     centred while the button has its own column. -->
<template>
  <header class="site-head">
    <h1 class="site-title">大家の日本語</h1>
    <div class="site-subtitle-row">
      <p class="site-subtitle">動詞轉型練習</p>
      <slot name="aside" />
    </div>
    <p class="site-lede">涵蓋初級 1 – 50 課的動詞</p>
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

/* The subtitle track: `1fr auto 1fr` keeps the label in the centre of the
   head while the right track (starting at the label's last character) holds
   an optional aside such as the theme switch. */
.site-subtitle-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  margin-top: 10px;
}

.site-subtitle {
  grid-column: 2;
  margin: 0;
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

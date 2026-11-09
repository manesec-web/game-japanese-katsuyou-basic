# Changelog

Dated, newest last. Each entry: what changed, why, and what was verified.

## 2026-11-09

### Docs baseline (task 0)

- Added `docs/roadmap.md`: task board T1–T8 with status and acceptance
  evidence, ground rules, resume instructions.
- Added `docs/architecture.md`: command contract, dispatch return shape,
  session model, file map, dictionary delivery plan, testing strategy,
  styling/motion notes.
- Added `docs/progress.md`: current state, commands run, exact next step,
  open gaps.
- Added `docs/changelog.md` (this file).
- Why: the goal requires a future session to resume without re-reading
  history; English docs are the hand-off artifact.
- Verified: files written; no code exists yet, so no test/build run applies.

### T1 engine skeleton

- Added Vite + Vue 3 project (`package.json`, `vite.config.js`, `index.html`).
- `vite.config.js`: `base: './'`, `build.outDir: 'output'`, dev middleware
  serving `vol/lesson_N.json` at `/dict/lesson_N.json`, and a `writeBundle`
  copy of all 50 lessons into `output/dict/`. Missing sources fail the build.
- `src/engine/registry.js`: `createRegistry()` with register/registerAll/get/
  list/dispatch; rejects duplicate ids; async-aware `settle()` returns a
  Promise of the same envelope.
- `src/engine/session.js`: `createSession()` with screen, mode, boot progress.
- `src/commands/nav.js`: `nav.go` with optional mode for picker entry.
- `src/dict/forms.js`: 15 form ids + on-screen names + group labels, in the
  canonical order.
- Thin `src/App.vue`, `src/main.js`, `src/ui/store.js` (`reactive` session +
  `send`), `src/styles/app.css` (gradient shell, 480px column, reduced-motion
  fallback).
- Verified: `npm test` 8/8, `npm run build` wrote `output/index.html` and 50
  dict files, `git check-ignore output` matched.

### T2 hashing and boot

- `scripts/write-sha256.mjs`: hashes raw bytes of `vol/lesson_1..50.json`
  into `src/data/dict-manifest.json` (algorithm/total/lessons array);
  `--check` exits 1 on mismatch. `pretest` and `prebuild` run `--check`.
- `src/dict/hash.js`: Web Crypto SHA-256, lowercase hex, rejects non-bytes.
- `src/storage/opfs.js`: `katsuyou-dict` directory adapter (read returns
  null on NotFound, write via createWritable, remove).
- `src/dict/boot.js`: sequential verify; missing/corrupt copies download up
  to twice; write only after a matching hash; stop with
  `boot.error = { lesson, file, message }` when both attempts mismatch;
  `boot.checked` increments per verified lesson; `boot.total` from manifest.
- `src/commands/boot.js`: `app.boot` with injectable `fetchLesson`/`opfs`/
  `manifest` for tests; `boot.running` guards double runs; failures throw
  `BootError` (`code: boot-failed`) which dispatch converts to
  `{ ok: false, error: { code, details } }`.
- Verified: 14 new tests (hash + boot) with fake fetch/OPFS, including empty
  vols lessons 1/3/8/12; manifest tamper/restore demonstration; overall
  `npm test` 22/22; `npm run build` still succeeds.

### T3 loading, boot wiring, home

- Added `src/ui/bootstrap.js`: runs `app.boot`, then `nav.go home` on success;
  loading retry reuses the same function.
- `src/views/LoadingView.vue`: `Loading ...`, progress bar bound to
  `boot.checked / boot.total`, `載入失敗（lesson N）` + 重試 when
  `boot.error` is set.
- `src/views/HomeView.vue`: stacked 字典 / 翻卡學習 / 測驗 buttons entering
  `picker` with an optional `mode` on `nav.go`; footer `Build with ❤ by Mane`
  opens a bottom sheet with the GitHub link (`target="_blank"`).
- `src/App.vue` switches loading/home/placeholder; `src/main.js` boots on
  entry; `nav.go` gained the optional `mode` parameter.
- Verified: `npm test` 22/22, `npm run build`; new Playwright walk-through
  `scripts/browser-check.mjs` (vite preview + cached Chromium) passed 11
  checks: loading copy, progress advance, 50 dict fetches, OPFS 50 files,
  column ≤480px, three entries opening picker, footer sheet link + new tab.

### T4 lesson picker

- Added `src/dict/settings.js` (defaults, normalize, validate, applyPatch,
  全選 到 rules, canStart), `src/storage/settings.js` (localStorage
  `katsuyou-settings`, invalid JSON resets to defaults),
  `src/engine/errors.js` (`CommandError`), `src/dict/library.js`
  (parses verified OPFS lessons once; summary/hasVerbs/verbLessons/getVerbs).
- Commands: `lessons.toggle` (`lesson-empty` error for empty lessons, per-mode
  list, persists), `lessons.selectAll` (all verb lessons, clears when all
  selected, persists), `settings.patch` (whole patch rejected with
  `invalid-settings`; 從 removed from 到 with fallback target).
- `src/views/PickerView.vue`: 詞彙 title (fixed after browser check found mode
  names leaking into the title), back, 課次 with 全選, 50 chips with three looks,
  disabled empty lessons, 從 single-select list, 到 chips + 全選, sticky 開始
  disabled by `canStart`.
- `src/App.vue` renders the picker; `src/main.js` wires library + settings
  storage into commands and the store.
- Verified: 25 new unit tests (settings, lessons, storage) → `npm test` 47/47;
  `npm run build`; browser walk-through 27 checks including empty lesson 1,
  select-all 46 lessons + clear, 從→到 removal, and reload persistence.

### T5 dictionary reader

- Added `src/dict/ruby.js` (alignment rules: katakana normalized only for
  matching, okurigana alone, kanji run takes slice up to next okurigana, whole
  reading above the word on mismatch) + `src/components/RubyWord.vue`.
- `src/dict/items.js` builds study items (dict = verb order; card/quiz =
  verbs × target forms); `src/commands/study.js` (`study.start` guarded by
  `canStart`, resets index/flip/answer, opens reader/card/quiz);
  `src/commands/dict.js` (`dict.next`/`dict.prev`, clamped, reader-only).
- `src/views/ReaderView.vue`: 學習（n/total）, back to picker, gear, default-form
  entry with ruby/gloss/tags/例句, 字典形 section with its own 例句, swipe (72px
  threshold, drag follows, springs back, bounds), and reader navigation controls.
- `src/views/SettingsView.vue`: back returns to the mode's study screen;
  dict 預設顯示形式 list + 顯示平假名注音 switch (card/quiz switches scaffolded).
- `src/ui/swipe.js` (threshold 72, clamp 140), session gains items/index/
  flipped/answer.
- Verified: 17 new unit tests (ruby 9, items 3, dict commands 6 → 65 total);
  browser walk-through 42 checks: reader title/word/furigana, 40px spring-back,
  120px right swipe, left swipe, next control, settings form change, ruby off,
  and form/reading persistence after reload.

### T6 flashcards

- `src/commands/card.js`: `card.flip`, `card.next`, `card.prev`; navigation
  clamps and always resets `flipped` to false.
- `src/views/CardView.vue`: 練習（n/total）, back to picker, gear, face = source
  form with ruby, verb-class tag while 一開始顯示幾類動詞 is on, `變成{目標}`
  line; back = target word, reading, Chinese gloss; tap flips (gesture
  disambiguation: a horizontal move never flips), 72px swipe threshold, new
  card opens on its face.
- Verified: 5 new card command tests (70 total then); browser 54 checks with
  tap/back/tap-again, swipe forward/back, new card on face, class-switch off
  hides the tag.

### T7 quiz

- `src/dict/quiz.js`: NFKC + whitespace + katakana→hiragana normalization,
  grading against `japanese` or `vol`, 25-key keyboard generator (5 per row,
  every distinct reading character, unique random kana fillers, injected RNG
  for tests, grows past 25 when needed), question copy helper.
- `src/commands/quiz.js`: `quiz.input` (append/backspace, auto-submit honours
  the setting), `quiz.submit` (correct advances immediately and clears;
  wrong keeps input; third wrong reveals and locks), `quiz.advance`
  (only after reveal).
- `src/views/QuizView.vue`: 練習（n/total）, source prompt + 原型/`{name}是什麼？`,
  controlled input with an in-field backspace, external 檢查, 5×5 keyboard,
  reveal panel with `vol` + `japanese`, 下一題, 1.6s 回答正確/回答錯誤 toast.
- Fixed 自動提交答案 default to **on**, as the spec states (was false).
- `src/ui/typing.js` moves text-field diffing out of the view; 4 tests.
- Verified: 16 new unit tests (keyboard/normalization + quiz commands) →
  `npm test` 95/95; browser 80 checks: correct from the on-screen keyboard
  with auto-submit, wrong three times on one item, reveal waits for 下一題,
  field/keyboard disabled after reveal, settings show auto-submit on.

### T8 motion, reduced motion, verification

- `src/App.vue` switched to a keyed component map with a 220ms fade
  (`mode="out-in"`); `src/styles/app.css` adds the slow gradient drift, a
  faint CSS grain overlay, and a global pressed-button scale.
- `src/ui/motion.js`; reader/card gestures skip drag-follow under
  `prefers-reduced-motion: reduce` and still change the item on a 72px swipe.
- Reduced-motion CSS freezes the background (`animation: none !important`),
  keeps a short fade for screen changes, and disables other animations.
- Added boot-failure browser coverage: aborting two downloads shows
  `載入失敗（lesson 1）`, stops the bar, and 重試 re-runs boot to home.
- Verified: `npm test` 13 files / 95 tests passing; `npm run build` writes
  `output/index.html` + `output/dict/` with exactly 50 lesson files;
  browser walk-through 87 checks across all seven screens plus reduced
  motion and the failure path.

### Post-audit fixes

- Picker chips now use the spec copy `第1課` … `第50課` (previously bare
  numbers); the browser suite asserts the first and last labels.
- Fixed card swipe under `prefers-reduced-motion: reduce`: `CardView.onUp`
  now resolves the swipe from the tracked drag distance, so cards change
  directly instead of staying put.
- Card swipes now follow through and leave (180ms) before the next card
  slides in (200ms entrance); reduced motion still swaps instantly.
- Controls raised to the spec's 48px minimum: footer tap target and the
  settings switches (26px knob inside a 48px control).
- OPFS failures now carry a readable reason: "OPFS is unavailable on this
  origin; serve over http://localhost, http://127.0.0.1, or HTTPS". The
  loading screen prints `boot.error.message` under the lesson number.
- Added `docs/serving.md`: dev/preview/Python instructions, the repo-root
  failure (raw `.vue` modules + 404 `dict/`), and secure-context/OPFS
  troubleshooting for `載入失敗（lesson 1）`.
- Verified: `npm test` 95/95; `npm run build`; browser suite now 92 checks,
  including chip labels, 48px controls, reduced-motion card swipe, and the
  boot failure path. Also reproduced the non-localhost HTTP failure in
  Chromium (`isSecureContext: false`, `navigator.storage.getDirectory`
  missing) to confirm the diagnosis.

### Revision 2 — UX changes (in progress)

- User decisions: all 15 dictionary forms fully expanded (name, word, reading,
  gloss, three sentence pairs each); reader-only label rename; 3D card flip;
  到 header row with 全選 right-aligned above the chips; full-bleed column at
  ≤480px; `docs/spec.md` amended to match.
- `docs/spec.md`: picker 到 header rule, reader all-forms body + default
  highlight/scroll, reader `上一個`/`下一個` controls, `rotateY` card flip,
  full-bleed rule, reduced-motion flip.
- `docs/roadmap.md`: new "Revision 2" task board (R1–R7).
- Verified: documentation only so far; no test/build change yet.

### Revision 2 — R2 reader: all 15 forms

- `src/views/ReaderView.vue` now lists every form the verb carries, in canonical
  order: form name, word with ruby, Chinese gloss, group/lesson tags, and that
  form's three例句 pairs (45 sentence pairs per word).
- The old default-form-only body and the duplicate bottom 字典形 section are
  removed; 字典形 is simply the first block.
- The 預設顯示形式 block is marked (accent border, `aria-current`) and the
  page scrolls it into view when the word opens or the default changes.
- The reader header is sticky so back/gear stay reachable on the long page.
- Verified: browser suite 98 checks, including 15 form blocks, 45 sentence
  pairs, a single 字典形 block, last form 使役形, default highlighting and
  default-form persistence after reload; `npm test` 95/95 unchanged.

### Revision 2 — R3 labels, R4 3D flip

- Reader footer controls renamed to `‹ 上一個` / `下一個 ›`; card controls
  intentionally stay `‹ 上一張` / `下一張 ›`.
- `src/views/CardView.vue` rebuilt as a two-sided 3D card: both faces stay
  mounted on a `preserve-3d` inner element, a tap rotates it `rotateY` in
  300ms, and swipe follow/leave/enter transforms stay on the outer card.
  Under `prefers-reduced-motion: reduce` the inner transition is removed
  (instant flip).
- Browser checks: exact reader/card labels; two mounted faces; mid-animation
  `matrix3d` transform; flip state completes on the back; tap-again returns
  to face; new cards start on the face; reduced motion flips instantly with
  `transition-duration: 0s`. Suite now 107 checks.

### Revision 2 — R5 到 header row

- `src/views/PickerView.vue`: the 到 block is now a full-width `.targets`
  section with a header row — 到 on the left, 全選 on the right — directly
  above the 15 form chips. The old left label column / inline head is gone.
  The 全選 toggle rule is unchanged (`nextSelectAllTargets`).
- Browser checks compare bounding boxes: header exists and labels 到, 全選
  is held there, its bottom is above the first chip's top, its right edge is
  within 40px of the column's right edge, and its left edge is past 120px
  from the column's left edge. Suite now 113 checks.

### Revision 2 — R6 full-bleed column

- `src/styles/app.css`: `@media (max-width: 480px)` removes the shell padding
  and the column's radius, shadow and side margins; the column fills the
  viewport with only inner padding (`20px 16px` plus safe-area bottom). Wider
  viewports keep the rounded 480px frame.
- Browser checks at 390px: shell padding 0, radius 0, shadow none, column
  width equals the viewport. At 800px: margins restored, radius 28px, shadow
  present, column ≤480px. Suite now 121 checks.

### Revision 2 — R7 final verification

- `npm test`: 13 files / 95 tests passing.
- `npm run build`: `output/index.html` present, `output/dict/` exactly 50
  lesson files, `output/` still gitignored.
- `node scripts/browser-check.mjs`: 121 checks passing across loading,
  home, picker, reader, settings, cards, quiz, reduced motion, the boot
  failure path, and all five revision-2 changes.
- Re-read the five requests against the artifact: all 15 forms shown with
  gloss + sentences; reader controls 上一個/下一個; 3D flip with reduced-motion
  fallback; 到 header with right-aligned 全選 above chips; full-bleed at
  ≤480px and framed at wider widths. No stale `上一顆/下一顆` text remains in
  code or docs.

### Revision 3 — UI optimisation pass (U1–U9)

- Layout: the narrow breakpoint moves 480 → 550px; at ≤550px the column fills
  the browser and the gradient/grain background is dropped. Above it nothing
  changes. Verified at 390/550/551/800px.
- Picker: 到's form buttons are a wrapping grid with a visible border and equal
  size; verb-less lessons carry a hover/focus hint `該課沒有動詞`; the lesson
  control reads `全選` / `取消全選` (`src/dict/lessons.js`, tests).
- Defaults: `預設顯示形式` and card/quiz `從` now both default to ます形
  (`到` stays 字典形). `settings.js` + storage tests cover a fresh browser and
  an older saved object with missing fields.
- Reader: `src/study/reader-forms.js` puts the default form first; the other
  blocks keep word/gloss/sentences but drop their form-name tag; the pager
  footer is pinned to the bottom; gestures page only at ≤550px (above that,
  drags select text — `user-select: none` inside the narrow media query keeps
  swipes working over sentences).
- Cards: the list is shuffled once at 開始 (`src/study/shuffle.js`); swiping
  right slides the next card in from the left edge (measured -60px → 0); the
  last card's right control becomes `完成` and opens the completion screen.
- Quiz: new `錯 X 題就顯示答案` setting (1–5, default 3), the
  `再答錯 X 題就顯示答案` countdown, and the revealed answer rendered as an
  overlay that covers the keyboard (100% overlap, keyboard centre resolves
  inside the panel). Results tally + completion panel with 正確/錯誤 counts,
  percentage bar and the missed-word list (`src/study/results.js`).
- Verified: `npm test` 17 files / 137 tests; `npm run build` with `output/index.html`
  and 50 dict files; `node scripts/browser-check.mjs` 158 checks passing.

### Revision 4 — home title/About, uniform reader blocks, animated card buttons

- Home (`HomeView.vue`): h1 `日語動詞變形練習`; footer now has
  `🥺 如果有 BUG 記得告訴我！` above `Build with ❤ by Mane`, both opening one
  sheet. The sheet carries the open-source sentence with the repo link,
  `意見 & Bug 反饋：` with `提交ISSUE` (repo `/issues/new`, new tab, noopener)
  and `mailto:mane@manesec.com`, then `🥺 どうもありがとうございます。` and 關閉.
- Reader (`reader-forms.js`, `ReaderView.vue`): the first block's accent panel
  is gone — all 15 blocks use one format (same padding, hairline separator,
  transparent background, no radius, no inset margins). Every block keeps its
  `〜形` heading; the 群組/第N課 pills render only on the first block, so the
  page holds exactly two pills. Default form is simply first.
- Pinned footers (reader, cards, picker): the underline was removed and the
  transparent fade kept, with the fade band raised to 28px inside the top
  padding so the buttons sit on solid colour (buttons 52px, footer 88–90px).
  This supersedes the earlier opaque-footer attempt.
- Cards (`card-tags.js`, `CardView.vue`): `下一張`/`上一張` run the page-turn
  leave/enter motion instead of swapping; the answer side always shows the
  asked form as a tag (ignores the class and reading switches).
- Picker (`settings.js` `startHint`, `PickerView.vue`): emptying 到 shows
  `請至少選擇一個轉型才可以開始` above 開始 and keeps it disabled.
- Verified: `npm test` 151 tests; `npm run build` with 50 dict files;
  `node scripts/browser-check.mjs` 182 checks; 390/550/1280 sweep clean.

### Revision 5 — UI polish pass (home copy, geometry, sticky bars, highlight, paging, completion emoji)

- Home (`HomeView.vue`, `index.html`): three lines above the entries —
  `大家の日本語` (large), `轉型練習` (medium), `涵蓋初級 1 – 50 課的單詞`
  (supporting). Document title follows it.
- Control geometry (`app.css`, all views): `.button` and chips are 36px tall
  with a 10px radius (was 48–52px / 12–16px, which read as pills). Buttons
  needed `font: inherit` — without it the CJK fallback font inflated the line
  box and defeated the fixed height.
- Sticky bars: one shared `.bar--sticky` rule pins the back bar and title on
  picker, reader, card, quiz and settings.
- Picker hint (`settings.js` `startHint`): with no lesson selected the footer
  reads `請至少選擇一門課程才可以開始`, ahead of the existing 到 hint.
- Bottom height: non-home screens lose the extra bottom space; content ends
  10px above the column. Screens with a pinned footer carry their own 20px so
  the primary control never sits flush with the window edge.
- Reader sentences (`study/highlight.js`): each form's own `vol` is painted in
  the new `--highlight` purple wherever it appears in 例句. A test locks the
  data invariant that all 5790 forms contain their own word in a sentence.
- Reader paging (`ui/swipe.js`, `ReaderView.vue`): right-to-left = next,
  left-to-right = previous, with a parallel slide plus z-depth (`matrix3d`,
  1600px perspective, no rotation) so the change has depth without tilting the
  text. Cards moved to the same direction with mirrored leave/enter motion.
- Completion (`study/results.js`, `CompletePanel.vue`): card practice shows one
  random bowing figure under 恭喜…; the quiz shows five emoji from the row that
  matches the score floored to its decade (87% → 80% row, 90% → 90% row); a
  100% run additionally scatters a falling-emoji confetti layer, suppressed
  under `prefers-reduced-motion`. Picks are drawn once per mount.
- Why: the user's UI review, applied in two rounds. Their later revisions,
  quoted verbatim, are what the numbers above follow:
  - "一開始的選擇按鈕要高一點，點進去裏面的開始按鈕也要高一點。 60px差不多"
  - "改成50px的高度差不多" (開始 and the reader/card footer controls)
  - "主頁的按鈕改成60px，其他的不用改。"
  - "所有開始的下面的空白加到20px吧。"
  - "學習哪裏，下面的上一個和下一個貼近瀏覽器的底部，所以看起來按鈕下面就被遮住了。"
  - "練習的翻卡順序反了，左到右應該是上一個單詞，右到左是下一個單詞。"
  - "學習單詞的翻頁改成平行翻頁吧，就和iphone的左右滑動差不多。"
- Verified: `npm test` 182 tests (19 files); `npm run build` with 50 dict
  files and `output/index.html`; `node scripts/browser-check.mjs` 223 checks,
  including the lesson hint, sticky bars, purple sentence mark, reversed swipe
  with parallel 3D depth, band emoji, confetti and reduced-motion behaviour.

### Revision 6 — one emoji above the congrats line, 60px 返回主頁, flat paging, no horizontal scrollbar

- Completion (`src/study/results.js`, `src/components/CompletePanel.vue`): both
  modes now show exactly one emoji above 恭喜，你已經做完了練習。 — card mode
  draws from the bowing trio, quiz mode draws a single emoji from the row that
  matches the score band. `scoreEmojis` (five picks) and `pickDistinct` were
  removed; `scoreEmoji` returns one string. 返回主頁 is 60px tall in both modes.
- Reader paging (`src/views/ReaderView.vue`): the page-turn is now a flat
  horizontal slide — no fade, no z-depth, no `perspective`. The outgoing page
  translates a full 100% sideways and the incoming one is pushed in from the
  opposite edge.
- Card paging (`src/views/CardView.vue`, `src/styles/app.css`): a card sliding to
  ±112% used to paint outside the column and widen the page, which showed a
  horizontal scrollbar that then disappeared. The stage now clips horizontally
  only while a card is moving, and `html`/`body`/`#app`/`.app-shell` use
  `overflow-x: clip` (not `hidden`, which would make them scroll containers and
  break the sticky top bars).
- Why: the user's review, quoted verbatim:
  - "emoji在恭喜，你已經做完了練習的上面，只是要隨機一個，不是全部。另外這個返回主頁的按鈕要高度60px，練習的結算畫面返回的按鈕也是。"
  - "學習那裏的移動畫面應該是水平移動的，就和iphone那個頁面一樣"
  - "瀏覽器底部出現水平捲軸，然後消失。就是在翻卡練習的時候"
- Verified: `npm test` 181 tests (19 files); `npm run build` with 50 dict files
  and `output/index.html`; `node scripts/browser-check.mjs` 233 checks. A
  negative control with the clip removed measured `document.scrollWidth` 562
  against a 390 viewport during a rightward card move, so the new
  "a rightward card move widens no scroll" check does catch the reported bug.

## 2026-11-09 (dictionary cache: OPFS → IndexedDB)

- `src/storage/idb.js` replaces `src/storage/opfs.js`. The cache now lives in
  the IndexedDB database `katsuyou-dict`, object store `lessons`, one record
  per lesson file (`lesson_N.json` → raw bytes). Public shape is unchanged
  (`read`/`write`/`remove`), so `src/dict/boot.js`, `src/dict/library.js`,
  and `src/commands/boot.js` only renamed their injected dependency from
  `opfs` to `store`.
- Why: the user reported that OPFS is a poor fit in private (無痕) windows,
  where `navigator.storage.getDirectory()` is unavailable and boot stops on
  lesson 1.
- Added `fake-indexeddb` as a dev dependency; `src/storage/idb.test.js` covers
  write→read, `ArrayBuffer` input, missing record → `null`, overwrite,
  `remove` true/false, a missing API, and an open failure.
- `scripts/browser-check.mjs` now counts IndexedDB records instead of OPFS
  entries, and adds three regression checks: reload after each mode verifies
  stored lessons with zero downloads, and a fresh (private-style) context
  boots, stores 50 lessons, then reloads without downloading.
- Measured on a plain-HTTP non-localhost origin (`http://insecure.test`,
  simulated via Chromium `--host-resolver-rules`): IndexedDB is available
  (`typeof indexedDB !== 'undefined'`) but `crypto.subtle` is `undefined`, so
  boot still stops on lesson 1 with `download 2 could not be hashed: Cannot
  read properties of undefined (reading 'digest')`. `docs/serving.md` records
  this; plain-HTTP LAN hosting is still unsupported, now because of SHA-256
  rather than storage.
- Verified: `npm test` 20 files / 188 tests; `npm run build` with 50 dict
  files and `output/index.html`; `node scripts/browser-check.mjs` 240 checks.

### Card paging from a flipped card (animation fix)

- `src/views/CardView.vue`: paging no longer plays the 3D turn. A new
  `card--no-turn` class (driven by `leaving || enterFrom`) sets
  `.card-inner { transition: none }` for the whole phase, so a card the reader
  flipped to its answer slides out on that side instead of spinning back to
  the face mid-flight; the incoming card is snapped to its face while it is
  still off-screen.
- Dropped the opacity fade from both phases: the leave transition and the
  enter keyframes are now full-width `translateX` only (`-112%`/`100%` →
  `0`), matching the reader's flat page turn.
- `moveCard` keeps one phase at a time: a press while the new card is
  entering clears the enter timer instead of running the leave transition and
  the enter animation on the same DOM node together (leave 170ms, enter
  240ms).
- Why: the report said paging away from a reversed card looked wrong. Measured
  before the fix at 390×844: the outgoing card held
  `matrix3d(-1,0,0,…)` (rotateY 180) while fading 1 → 0.017, and at commit
  the reused node entered at opacity 0.31 with the inner mid-rotation
  (`matrix3d(-0.769, 0, -0.640, …)`, ~140°) and still ~63° a frame later.
- Verified: `npm test` 20 files / 188 tests; `npm run build` writes
  `output/index.html` + 50 files in `output/dict/`; `node
  scripts/browser-check.mjs --screenshots` passes. Seventeen new checks cover
  both directions from a flipped card: the outgoing card keeps its side and
  its inner transform is unchanged between samples, the card's transform
  stays `matrix(1,0,0,1,tx,0)` (never `matrix3d`), opacity stays `1`, the
  incoming card is already on its face, and the settled card rests at
  `none`.

### Answer side always names the verb class

- `src/study/card-tags.js`: `backTags(targetFormId, target)` now returns two
  pills, the asked form first and then `groupLabel(target.group)`, and it reads
  no setting. `frontTags` is unchanged, so the face's class pill still follows
  一開始顯示幾類動詞.
- `src/views/CardView.vue`: the answer side passes the target form data into
  `backTags`, so a flipped card reads `字典形` + `2類動詞` even with the class
  switch off.
- `docs/spec.md`: the Cards section now states the two answer tags, their order,
  and that both ignore the class and reading switches.
- Why: the user reported the answer side did not say which class the verb
  belongs to, and asked for the class on the answer even when the class display
  setting is off.
- Verified: `npm test` 20 files / 191 tests; `npm run build` writes
  `output/index.html` + 50 files in `output/dict/`; `node
  scripts/browser-check.mjs --screenshots` 260 checks, 0 FAIL. New checks run
  with the class switch off: the face has no `.card-face .tag--group`, the back
  shows the form then the matching class label, the form pill sits left of the
  class pill, and both pills share one row. The old unscoped `.tag--group`
  count was scoped to `.card-face`, because both card faces are always in the
  DOM.

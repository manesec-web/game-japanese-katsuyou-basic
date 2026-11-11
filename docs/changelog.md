# Changelog

Dated, newest last. Each entry: what changed, why, and what was verified.
The `## 2026-11-10` headings record work requested on 2026-11-10 even
though they were written later; the revision number is the ordering key.
Historical per-revision test/check counts are evidence for that revision,
not the current verification totals.

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
  `意見 & Bug 反饋：` with `提交ISSUE` (repo `/issues/`, new tab, noopener)
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

## 2026-11-09 (documentation refresh)

- Added `README.md`: product overview, the three modes, every user-facing
  behaviour, quick start, npm scripts, project tree, dictionary schema and
  the 15 forms, architecture summary, test/build commands with current counts,
  browser support, deployment notes, document index, and reporting channels.
- `docs/architecture.md`: the file map now lists the files that actually exist
  (`src/dict/quiz.js` instead of the never-created `src/dict/keyboard.js`,
  `src/storage/idb.js` instead of OPFS, plus `src/study/`, `src/ui/`,
  `src/commands/index.js`, `src/engine/errors.js`, `src/engine/settle.js`
  and `scripts/browser-check.mjs`). Removed the nonexistent `public/` entry.
  Added the full error-code list (`library-missing`, `library-invalid`,
  `lesson-empty`, `invalid-settings`, `no-items`, `quiz-no-item`),
  documented the browser suite, and corrected the geometry summary
  (settings rows 52px, quiz keys 48px, 返回主頁 60px).
- `docs/progress.md`: rewritten around the current state. It no longer claims
  "no commits" (the repo is at `933c30b`) and no longer attributes the
  `載入失敗（lesson 1）` failure to OPFS: since revision 7 the cause on a
  plain-HTTP non-localhost origin is the missing `crypto.subtle`. Adds the
  verified commands, a one-line history of T1–T8 and revisions 2–9, and the
  list of unverified paths.
- `docs/roadmap.md`: records revisions 5–9 (previously only in the changelog
  and progress notes), states that everything is done, and names publishing
  `output/` as the only remaining step.
- `docs/spec.md`: corrected the stale sizing sentence — settings rows are 52px
  (they hold a switch), quiz keys are 48px, and 返回主頁 is 60px.
- `docs/serving.md`: added a build self-check block and a GitHub Pages note
  (that file was then rewritten for the subpath base; see the entry below).
- `src/views/HomeView.vue`: the About sheet's copy now matches `docs/spec.md`
  (`提交ISSUE` opens `/issues/`, thanks line `🥺 どうもありがとうございます。`).
  No behaviour changed; this closes two copy drifts that had gone unrecorded.
- Verified after the edits: `npm test` 20 files / 191 tests; `npm run
  build` with 50 files in `output/dict/`; `node scripts/browser-check.mjs`
  259 checks passing (260 on a rerun; the seeded keyboard filler moves the
  total by one).

### GitHub Pages subpath base

- `vite.config.js`: `base` changed from `'./'` to `'/game-japanese-katsuyou-basic/'`
  (trailing slash kept) so the build targets the repository's Pages project
  path. The dev dictionary middleware now strips that prefix before matching
  `/dict/lesson_N.json`, so it answers both under the subpath and at the root.
- `scripts/browser-check.mjs`: `BASE` is `http://localhost:PORT` plus the same
  subpath, and a new check asserts `document.baseURI` ends with it.
- Docs: `docs/serving.md` (dev/preview URLs, the Python recipe now mounts
  `output/` at the subpath, `file://` no longer works, Pages publishing steps),
  `docs/architecture.md` (dev/build/runtime paths and the file-map base value),
  `docs/spec.md` (the Build section), `AGENTS.md` (layout note + dict-serving
  line), `README.md` (dev, deploy and local-serving copy).
- Why: the site is deployed as a GitHub Pages **project** site, which serves
  the repository under `/game-japanese-katsuyou-basic/`; the previous relative
  base happened to work, but nothing pinned the prefix. The Pages URL itself
  was still 404 at the time of this entry, so the prefix is verified through
  `vite preview` and the browser harness, not on a live `github.io` origin.
- Verified: `npm test` 20 files / 191 tests; `npm run build` writes
  `output/index.html` with both asset refs prefixed
  (`/game-japanese-katsuyou-basic/assets/…`) and 50 files in `output/dict/`;
  live dev run on :5330 (`/` → 302 to the subpath, `/game-japanese-katsuyou-basic/`
  → 200, `…/dict/lesson_1.json` → 200 `application/json` with 38 bytes ==
  `vol/lesson_1.json`, `…/dict/lesson_99.json` → 404);
  `node scripts/browser-check.mjs --screenshots` passes 260 checks (0 FAIL).
- Not verified: a real `https://<user>.github.io/…` origin, and no Pages
  workflow was added (deployment stays manual, by the user's choice).

## 2026-11-11 (mobile chrome: zoom lock and calmer paging)

Reported by the user: on a phone in Chrome a double tap zooms the page, and the
card turn and page turn animations rebound so hard they feel unpleasant.

### Where the rebound actually comes from (measured, before the fix)

Tool: `node scripts/motion-probe.mjs` (new). It drives the built site in
headless Chromium (390×844, `isMobile`, `hasTouch`), samples `transform`
frame by frame with `requestAnimationFrame` and prints the position trace.

Reader, 120px drag released past the 72px threshold (single element reused,
so one trace shows leave → handover → enter):

```
14ms:-120  64ms:-236  114ms:-322  164ms:-348 | 214ms:+293  264ms:140
314ms:52   364ms:12   414ms:0
```

Card, same gesture (leave target is −112% = −437px):

```
15ms:-120  65ms:-261  115ms:-366  165ms:-399 | 215ms:+300  265ms:143
315ms:53   365ms:13   415ms:0
```

Three separate defects, not a matter of taste — and note the widths: the reader
page is 350px and the card is 358px, not the 390px viewport, so
`translateX(-100%)` is −350px and −358px.

1. **The turn stops dead at the edge and then bursts in.** Every phase used
   `ease` (slow-fast-slow), so the exit decelerated to a near stop as it left:
   `−343` at 148ms → `−348` at 165ms, about **294px/s**. The entry then started
   at its fastest, about **2634px/s**. That is a **9.2x** jump in speed across
   the handover, with a gap in between where nothing moves at the edges. The
   eye reads stop-and-burst as a rebound against the hand, and nothing actually
   moves backwards.
2. **The two halves ran for different times.** Exit 170ms, entry 240ms,
   measured over the same distance, so even without the curve mismatch the pace
   changed at the handover.
3. **The flip was a snap with a long tail.** `.card-inner` ran `rotateY` 0→180°
   in 300ms with `ease` and `perspective: 1200px`: 0 → 40° → 104° → 144° → 166°
   → 177° → 180° at 50ms intervals, so the turn lurched through its first half
   and then crawled, while the 1200px perspective exaggerated the card edges.

Released below the threshold, both screens sprang back from the released offset
to 0 in 200ms with `ease` (`60 → 36 → 12 → 2 → 0`, a 197ms settle at a
680px/s peak) — an elastic return after the finger had already lifted.

There is no overshoot anywhere (no cubic-bezier with a control point past 1) and
nothing moves backwards on screen, so the discomfort is the stop-and-burst handover and the front-loaded flip, not a literal bounce
past the resting point.

One wrong reading to record, because it shaped the first attempt: the probe
initially reported a bogus `−90°` on the flip's opening frame. `getComputedStyle`
returns a flattened 2-D `matrix()` at the start and end of a 3-D turn, and the
probe was parsing it as `matrix3d`. The probe now parses both shapes, and the
"half the turn in 41ms" claim above is the corrected reading.

### Zoom

`index.html` shipped `width=device-width, initial-scale=1, viewport-fit=cover`
with no scale ceiling, and only the two gesture surfaces declared
`touch-action: pan-y`. Pinch zoom is reproducible in headless Chromium (CDP
`Input.dispatchTouchEvent` takes `visualViewport.scale` from 1 to 5 on an
unrestricted page). Chrome's *double tap* zoom is Android-only and cannot be
reproduced in headless Chromium at all: two quick taps leave `scale` at 1 even
on a page with no restrictions, so that half of the report is documented as
measured, not reproduced.

### Zoom lock

- `index.html`: the viewport is now
  `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no,
  viewport-fit=cover`. Both ceiling forms are present because Chrome Android
  has historically ignored `user-scalable=no` on its own.
- `src/styles/app.css`: `html, body` declare `touch-action: manipulation`, so a
  double tap cannot become a zoom gesture on the screens that declare no
  touch-action of their own (home, picker, settings, quiz, the bars). The
  gesture surfaces keep their narrower `pan-y`, which is what lets them own the
  horizontal swipe.
- The user chose to lock pinch as well, so the page is a fixed-size phone
  screen. Chrome's "force enable zoom" accessibility override still wins over
  any page, which is why the page cannot be described as fully zoom-proof.
- Verified: `node scripts/browser-check.mjs` — the new negative control pinches
  a page with no restrictions and scales 1 → 5, then the app is pinched and
  double tapped on all seven screens (`loading`, `home`, `picker`,
  `dictionary`, `cards`, `quiz`, `settings`) and holds `scale: 1`, the same
  `innerWidth` and the same `clientWidth`, staying on the same screen. 294
  checks, 0 FAIL. Removing the ceiling from the served HTML with a route
  rewrite puts the zoom straight back: home pinch `1 → 5`, so the check is not
  vacuous.
- Not verified: a real phone. Chrome's double tap zoom is Android-only and
  never fires in headless Chromium (two quick CDP taps leave `scale` at 1 even
  on an unrestricted page), so the double tap is covered by the two
  declarative causes plus the pinch that shares them.

### Calmer paging

What changed, in the two views and the stylesheet:

- **The phases end on their own DOM event, not on a timer.** `ReaderView.vue`
  and `CardView.vue` used `LEAVE_MS = 170` / `ENTER_MS = 240` and swapped the
  item on a `setTimeout`. The timer started before the browser began the
  transition, so the swap could fire while the item was still moving. The swap
  now runs on the `transitionend` of the exit (and the enter phase ends on its
  `animationend`), with a 600ms fallback only as a safety net. The CSS owns
  every duration and the JS no longer has to agree with it.
- **The exit accelerates and the entry decelerates.** New tokens in
  `src/styles/app.css`: `--ease-exit: cubic-bezier(0.4, 0, 1, 1)` (Material's
  accelerate) and `--ease-slide: cubic-bezier(0.4, 0.3, 0.5, 1)` (a
  decelerating settle). Both halves are near their fastest as the item crosses
  the edge, so the pace carries across the swap instead of stopping and
  restarting. Measured after the change:

  | | exit into the swap | entry out of it | ratio |
  |---|---|---|---|
  | reader page | 2055–2079px/s | 2043–2068px/s | 1.01x |
  | card | 2127–2164px/s | 2102–2127px/s | 1.00–1.02x |

  against 9.2x before. The exit is 170ms and the entry 190ms (was 240ms).
- **Releasing below the threshold settles in 140ms**, decelerating into rest
  (`60 → 36 → 8 → 0`, a 147–164ms settle), where it was 200ms with `ease`.
- **The card turn is one shorter turn.** `rotateY` 240ms with
  `--ease-turn: cubic-bezier(0.4, 0, 0.2, 1)` and `perspective: 1600px` (was
  300ms, `ease`, 1200px). The angle now goes 0 → 27° → 116° → 161° → 177° → 180°
  at 50ms intervals and reaches 180° at about 240ms instead of 300ms.
- **The moving element gets `will-change: transform` for the duration of the
  turn**, so a phone repaints the card/page instead of dropping frames mid-slide.
- A press during the still-running entry now drops the animation and makes the
  move on the next frame. Changing the transform in the same frame as the
  animation is removed leaves the browser nothing to interpolate, so the exit
  transition never started and the turn stalled until the fallback fired. The
  walk-through caught this.

What did not change: the 72px threshold, one-to-one drag-follow, the leave and
enter directions, the clip that keeps the page from widening, the 「starts on
its face」 rule, and the `prefers-reduced-motion: reduce` branches (instant
swap, no slide, no flip transition).

Verified: `node scripts/browser-check.mjs` 316 checks, 0 FAIL, including new
frame-by-frame assertions on both screens — nothing moves backwards while it
is on screen, nothing overshoots its resting point, the swap happens at least
90% of a width off screen, the exit/entry speeds stay within 1.6x of each
other, a 55px drag settles inside 160ms (reader) / 180ms (cards), the flip
never passes 180° or turns back on itself, and the flip is at most 260ms.

These assertions are not vacuous: with the two views temporarily reverted to
the old code, the walk-through fails with `short drag settles back within
160ms 197ms`, `the pace holds across the swap exit 286 px/s, entry 2634 px/s
(9.19x)`, `card turn: the pace holds ... (1.85x)` and `the swap happens fully
off screen` false.

## 2026-11-11 (drawn scrollbar, centred 從 label, last-card finish)

Three reports from the user, all on the phone layout:

### The page draws its own scrollbar

- `src/ui/scrollbar.js` (new, pure): `SCROLLBAR` constants (4px wide, 3px
  inset, 16px track inset top and bottom, 28px minimum thumb, 1s fade delay),
  `trackHeight`, `thumbMetrics` (thumb length and offset from scroll position,
  viewport and content height) and `rightInset` (how far the thumb sits from
  the window's right edge: the column's margin on a wide screen, the inset on
  the full-bleed phone layout). `src/ui/scrollbar.test.js` covers fits-on-one-
  screen (no thumb), proportional length, top/middle/bottom offsets, clamping
  after overscroll, the minimum thumb, and the right inset at 390px and 900px.
- `src/components/PageScrollBar.vue` (new, thin): one `scroll` listener
  throttled with `requestAnimationFrame`, one `resize` listener, and a
  `ResizeObserver` on `.column` (its height changes with the screen, with a
  dropdown opening and with a different lesson count). It renders
  `pointer-events: none`, `position: fixed`, `aria-hidden`, and asks the pure
  module for every number.
- `src/styles/app.css`: `html { scrollbar-width: none }` plus
  `html::-webkit-scrollbar, body::-webkit-scrollbar { display: none }` hides
  the browser bar. Those selectors are deliberately narrow: the two inner
  dropdown lists are scroll containers of their own, and
  `scrollbar-width` inherits, so `PickerView`'s and `SettingsView`'s
  `.form-list` set `scrollbar-width: auto` to keep their native bars.
- Verified in `scripts/browser-check.mjs` (18 new checks on its own page):
  native bar hidden, dropdown keeps a native bar, nothing drawn on a page that
  fits, 4px wide, length within 2px of `track × viewport/content`, 3px from
  the column edge, first frame at 16px, `pointer-events: none` (the element
  under the thumb is the column, not the thumb), the thumb only appears on
  scroll, follows the page, reaches the track's end at the bottom, is gone
  1.3s after the page stops, still sits on the column edge at 900px wide,
  and under reduced motion `transition-duration` is `0s` while the thumb
  still shows.

### 從 is centred on the form control

- `src/views/PickerView.vue`: `.field` was `align-items: flex-start` and
  `.field-label` carried `padding-top: 14px`. Measured at 390×844, the label
  box centre was 610.6px against the control's 612px, and because the padding
  lived inside the label box the glyph itself sat about 5.6px *below* the
  control's centre line. `.field` now centres the row and the padding is gone:
  label centre 612px, control centre 612px, delta 0.0px. The 到 / 全選 header
  row already measured 0 and is untouched.
- Verified: three checks in each of the card picker and the quiz picker
  (centre within 1px, the glyph box inside the control's height, and the row
  centring rather than padding). Reverting `PickerView.vue` to the old rules
  fails them with `-1.4px (610.6 vs 612)` and `flex-start / padding-top 14px`.

### Swiping off the last card finishes the run

- The last card's 完成 button already ended the run, but a right-to-left swipe
  on it called `card.next`, which clamps at the end: the card slid out and the
  *same* card slid back in, so the run looked unfinished. `CardView.vue` now
  ends the run when the exit of a `next` move happens on the last card: the
  card plays its usual leave, then `study.finish` replaces it with the
  completion panel instead of entering a new card. The footer button goes
  through the same `moveCard` path, so the button and the swipe cannot drift
  apart, and the `prefers-reduced-motion` branch applies the same rule.
- Verified (19 new checks on their own page, lesson 5 = 3 cards): the first
  card ignores a right-hand swipe; a `next` swipe on card 1 and card 2 only
  advances and never completes; reaching card 3 does not complete by itself
  and its control reads 完成; a `next` swipe on card 3 shows the completion
  panel, hides the card and the controls, keeps the `恭喜，你已經做完了練習。`
  copy, offers 返回主頁, and leaves no `card--enter/leave-*` class behind; reduced
  motion behaves the same. Removing the last-card rule while keeping the
  button path fails with `swiping off the last card finishes the run
  title 練習（3/3）` plus the panel checks.

## 2026-11-10

### vol/ linguistic review: 15 conjugations kept, usage notes added

- Reviewed every conjugation in `vol/lesson_1..50.json` (386 verbs x 15 forms)
  for grammatical correctness and daily usage. Every verb still carries all
  15 forms; nothing was removed. 271 form entries that are wrong or unused in
  daily Japanese now carry a `note` field explaining why:
  - potentials that are really a different verb (`\u7247\u4ed8\u304f\u2192\u7247\u4ed8\u3051\u308b`,
    `\u7d9a\u304f\u2192\u7d9a\u3051\u308b`, `\u5c4a\u304f\u2192\u5c4a\u3051\u308b`, `\u53f6\u3046\u2192\u53f6\u3048\u308b`,
    `\u6e1b\u308b\u2192\u6e1b\u3089\u305b\u308b`, ...): `\u300cX\u300d\u662f\u932f\u7684：\u9019\u662f\u53e6\u4e00\u500b\u52d5\u8a5e...`;
  - potentials of non-volitional verbs (`\u308f\u304b\u308c\u308b`, `\u3067\u304d\u3089\u308c\u308b`,
    `\u898b\u3048\u3089\u308c\u308b`, `\u8981\u308c\u308b`, the `-\u3089\u308c\u3089\u308c\u308b` batch of L29/L43,
    ...): `\u300c\u52d5\u8a5e\u300d\u662f\u7121\u610f\u5fd7\u52d5\u8a5e\uff0c\u9019\u500b\u53ef\u80fd\u5f62\u65e5\u5e38\u4e0d\u7528`;
  - dictionary-attested but uncommon (`\u9055\u3048\u308b`, `\u77e5\u308c\u308b`, `\u3067\u304d\u3088\u3046`,
    `\u8db3\u308a\u3088\u3046`): `\u5b57\u5178\u88e1\u6709\u300cX\u300d\uff0c\u4f46\u662f\u65e5\u5e38\u4e0d\u7528`;
  - honorific shapes stored under the passive (`\u3042\u3089\u308c\u308b`,
    `\u304f\u308c\u3089\u308c\u308b`, `\u6b8b\u3089\u308c\u308b`, ...): `\u662f\u5c0a\u656c\u7528\u6cd5\uff0c\u4e0d\u662f\u53d7\u8eab\u5f62`;
  - forced volitional/imperative/causative shapes (`\u9055\u304a\u3046`,
    `\u8981\u308d\u3046`, `\u898b\u3048\u308d`, `\u3067\u304d\u308d`, `\u6d88\u3048\u3055\u305b\u308b`, ...):
    `\u300cX\u300d\u65e5\u5e38\u4e0d\u7528`.
- Attested-but-formal shapes stay without a note (`\u3042\u308d\u3046`, `\u3042\u308c`,
  `\u308f\u304b\u308c`, `\u6d88\u3048\u308d`, `\u6b62\u307e\u308c`, `\u3042\u308a\u3048\u308b`, `\u306a\u308c\u308b`,
  `\u601d\u3048\u308b`, `\u9593\u306b\u5408\u3048\u308b`, `\u4e0a\u304c\u308c\u308b`, `\u6ed1\u308c\u308b`,
  `\u592a\u308c\u308b`, `\u5931\u6557\u3067\u304d\u308b`, `\u6e1b\u3089\u308c\u308b`, `\u6163\u308c\u3089\u308c\u308b`, ...).
- Kanji fixes: L28 `\u54ac\u3080` (\u54ac\u3080) -> `\u564e\u3080` (\u564e\u3080) and L30
  `\u7e8f\u3081\u308b` -> `\u307e\u3068\u3081\u308b` across all forms and sentences.
- Rewrote 13 ungrammatical example sentences on kept forms
  (`\u88ab\u3089\u308c\u308b` direct passive, `\u9045\u308c\u3089\u308c\u308b` / `\u5012\u308c\u3089\u308c\u308b`
  indirect passives, `\u4e0a\u304c\u3089\u305b\u308b`, `\u306a\u308c\u308b`).
- No UI change: the `note` field is data only; every view renders exactly as
  before. `src/study/items.js` and the test files are untouched.
- Verified: `node scripts/check-conjugation.mjs` -> only the 63 intentional
  same-verb-re-taught duplicates, all 15 forms present per verb (5790 form
  entries); `npm test` 208/208; `npm run build` ok with `output/dict/` = 50
  files; `node scripts/write-sha256.mjs --check` ok;
  `node scripts/browser-check.mjs` -> 379 checks passed.

## 2026-11-10 (revision 14)

### Paging without follow or bounce (requested 2026-11-10)

- Why: on a phone the paging gesture was painful to watch ("看到頭會很痛").
  The user described it exactly: swiping the word left, the next word slides in
  and settles ("歸位"), then it flashes once and settles again ("閃一下，然後在
  歸位"). Desktop never showed this because it has no gesture paging. The fix
  they chose: keep the swipe, remove the bounce visual entirely (follow and
  spring-back), swap directly with one short slide-in — like the reduced-motion
  path, but with the slide kept.
- Spec change (`docs/spec.md`), written before the code:
  - The word/card never follows the finger; the drag itself is invisible.
  - Past the 72px threshold the release swaps the item at once and the new item
    plays one short decelerating slide-in (about 190ms) from the edge the swipe
    came from. A sub-threshold drag has no visual effect at all — nothing
    springs back because nothing moved.
  - Once the item settles it never moves again: no flash, no second slide.
  - The first card's backward drag is completely still (no damped follow, no
    40px cap, no spring-back); it still never names a direction or changes the
    card. The reader's first word and the last-card finish are unchanged.
  - Footer controls (上一個/下一個, 上一張/下一張) run the same direct swap +
    slide. Reduced motion still swaps at once.
- This supersedes the "follows the finger / settles back in 140ms / first card
  resists at a third of the finger capped at 40px" clauses from revisions 6,
  11 and 13a.
- Docs synced in this entry: `docs/roadmap.md` (revision 14 board),
  `docs/architecture.md` (motion notes), `docs/progress.md`, `AGENTS.md`
  (T5/T6 acceptance lines).
- Implemented in the same revision: `ReaderView.vue` and `CardView.vue` now
  page in one phase (direct swap + one 190ms slide-in, ending on the item's
  resting state), the drag follow and the leave/spring transitions are gone,
  `window.scrollTo` runs before the swap, and `will-change` stays on the paging
  element permanently so nothing is torn down at the settle frame — the flash
  ("歸位完成之後就閃一下，然後在歸位") had its suspects removed at the source.
  `src/ui/swipe.js` is trimmed to threshold/direction resolution; `clampDrag`,
  `resistDrag`, `cardDrag`, `EDGE_RESIST_*` and `SWIPE_MAX` are deleted.
- Verified: `npm test` 21 files / 205 tests (0 failures; the follow/回彈 tests
  were replaced by the stillness rule); `npm run build` ok (`output/dict/` = 50,
  `output/index.html`); `node scripts/browser-check.mjs` 382 checks passing,
  including `checkSlide` traces (no follow, one monotonic slide, nothing after
  the settle), the still first card, the still first/last word, tap-flip,
  the last-card finish and the reduced-motion paths. Not verified: real
  iOS/Android devices (repo-wide limitation — headless Chromium only).
- Housekeeping: the working tree carried uncommitted `vol/` edits from the
  2026-11-10 linguistic review (43 files, sentences and notes), and
  `src/data/dict-manifest.json` was stale for `lesson_6.json` — the manifest
  was regenerated from `vol/` (`node scripts/write-sha256.mjs`), and
  `--check` passes. `vol/` itself is untouched.

## 2026-11-10 (revision 15)

### The paging window: 9 cards, 5 words, current item always 3rd

- Why: the phone paging still cost a full re-render at the swap — the dictionary
  page is fifteen form blocks, and it was rebuilt while the incoming slide ran.
  The request: render several items at once, keep the screen on the 3rd slot, and
  make a swipe only drop the item at one end and add one at the other.
- Provenance: the sizes come from the user's instruction in this session —
  「單詞改9張，字典改5張」 (cards 9, dictionary 5), given after the first request
  named 5 for both. If that changes again, change `CARD_WINDOW` /
  `READER_WINDOW` in `src/ui/window.js` and the spec line together.
- Spec change (`docs/spec.md`), written before the code: a new
  "The paging window" section. The dictionary reader keeps 5 words mounted and
  翻卡學習 keeps 9 cards mounted; the current item always sits in the 3rd slot;
  a next turn deletes the front slot and appends the next list item at the back,
  a prev turn mirrors it; slots past either end render nothing; the window is
  invisible (only the current item is ever on screen, the neighbours sit outside
  the clipped container) and changes nothing about the motion from revision 14.
- Implemented: `src/ui/window.js` (`CARD_WINDOW = 9`, `READER_WINDOW = 5`,
  `CURRENT_SLOT = 2`, `windowSlots`, `windowOffset`, `slotKey`, `shiftWindow`),
  `src/ui/paging-window.js` (`usePagingWindow`, which keeps the row as state and
  hands each turn to `shiftWindow`, so production really does one front delete
  and one back append instead of deriving the row again) and
  `src/study/window-views.js`, which turns the window into per-slot card/reader
  data so the `.vue` files only loop and print. Both views stopped translating
  the row and now push each slot sideways by its own offset, keyed by the item's
  list position, so Vue keeps the nodes of the items that stay and creates only
  the one that entered. The duplicate `gloss` line and the leftover
  `formEntries` computed are gone.
- Tests: `src/ui/window.test.js` (13 tests: 3rd-slot invariant, front-delete /
  back-append both ways, ends refused, paging command ids and params unchanged),
  `src/ui/paging-window.test.js` (6 tests: the kept row shifts one turn at a
  time, only one end changes per turn, a new list re-derives, the last item
  stops at its end) and `src/study/window-views.test.js` (10 tests: 9/5 slots,
  one current, offsets 0/±100, every slot holds its own item rather than a copy
  of the current one, tags per card, one new key per turn).
- Browser check: new geometry and DOM assertions instead of trusting the old
  count — 5 reader pages / 9 card slots mounted, exactly one current, the current
  item at x=0 and as wide as the window, no neighbour inside the container,
  neighbours hidden, different words per slot, the window sliding one slot per
  turn, the front node leaving and exactly one node arriving at the back, the
  survivors keeping their identity marker, and the counter following the current
  card. The motion trace now re-resolves the current node every frame, because a
  trace pinned to the old node would follow the outgoing item off the edge.
- A local `const window = usePagingWindow(...)` shadowed the global `window`
  object in `ReaderView.vue` and broke every swipe for one build (`go()` threw
  at `window.scrollTo` before dispatching `dict.next`); the row ref is now
  `pagingSlotRow` and the browser check caught it.
- Verified: `npm test` 24 files / 234 tests (0 failures); `node
  scripts/write-sha256.mjs --check` ok (50 lessons); `npm run build` ok
  (`output/dict/` = 50, `output/index.html`); `node scripts/browser-check.mjs`
  411 checks passing, including that only the current item of either window is
  in the accessibility tree (the card neighbours are `visibility: hidden` and
  `aria-hidden`, like the dictionary's). Not verified: real iOS/Android devices (repo-wide
  limitation — headless Chromium only), and no reduction in mounted-node count
  was measured on a physical phone.

## 2026-11-11

### Revision 16 — finger-tracking paging, Lucide icons, notes and docs pass

The user reviewed the built site and asked for seven changes (quoted):
"1. 單詞和字典的動畫不跟手，按住無法實現跟手的拖動（*重要 2. 返回按鈕的圖標很奇怪，
設定的按鈕也是，使用第三方圖標庫會好一些。 3. 結算畫面的emoji大一點。 4. 字典裏的
單詞居中、中文居中、TAG 居中。加入一個 Note 和例句一樣，不需要居中，但是要使用
顔色標記這段話。這個Note 放在例句上面。然後如果出現 Error 是true的，就使用雙刪除線，
不需要單詞的修改顔色。 5. 完成後更新所有markdown文件，最後然後重寫README.md 來引用
docs裏面的文件。 6. 提交 Issue 的鏈接設置成 .../issues/ 不要 new。 7. 最後修改所有
的markdown文件，然後把所有docs的内容加入到README.md，顯得專業一點。"
Confirmed by questionnaire: both the dictionary and 翻卡學習 get the
finger-tracking drag (superseding revision 14's invisible drag), the icon
library is Lucide (npm, tree-shaken inline SVG — no CDN), and both note kinds
(form-level and sentence-level) are shown.

- **16a Finger-tracking drag** (`src/ui/drag.js` new, `src/ui/motion.js`
  `slideRow`, `ReaderView.vue`, `CardView.vue`): while a horizontal drag is
  held, the paging window's row translates with the finger 1:1 (clamped to one
  item width, so at most the mounted neighbour peeks in at the edge). On
  release past 72px the row finishes the page as one ~190ms decelerating move
  from where the finger left it (the Web Animations API runs it imperatively,
  so a press during a settle drops that move and starts the next — no class
  restart, no rAF dance); the command swaps the item under that move, so the
  window advance stays invisible. A shorter drag settles back to rest. Walls
  are stillness at any distance: the first card's backward drag, the first
  word's backward drag and the last word's forward drag never move the row.
  The last-card finish, the tap flip and `prefers-reduced-motion` (invisible
  drag, direct swap) are unchanged. `docs/spec.md` paging clauses rewritten
  before the code; the enter-slide keyframes and the rAF queue are gone.
- **16b Lucide icons** (`lucide-vue-next`): every `←` / `⚙` text button in
  Picker/Reader/Card/Quiz/Settings is now an inlined Lucide SVG (`ArrowLeft`,
  `Settings`, 22px, centred in the same 48px button; `aria-label` unchanged).
- **16c Completion emoji**: `.complete-emoji` 2rem → 4rem — the panel's one
  piece of colour, on card and quiz completion alike.
- **16d Dictionary notes and layout** (`reader-forms.js` entries now carry
  `note` + `errorUsage`; `ReaderView.vue`; `--note: #b45309`): the word, gloss
  and tag row are centred in the block while the note and the sentences keep
  the reading edge. The form's `note` renders above the 例句： block, laid out
  like a sentence and marked in the note colour; each sentence's own `note`
  rides under its Chinese line in the same colour. A form flagged
  `error_usage` shows its word with a double strikethrough and no colour
  change; it has no sentences, so the 例句： block is not drawn and its note
  stands alone.
- **16e Issue link**: `提交ISSUE` now opens `.../issues/` (the issue list) in
  `AboutSheet.vue`, `docs/spec.md` and the docs — no more linking to the
  new-issue form.
- **16f Docs pass**: spec, changelog, progress, roadmap, architecture and
  AGENTS describe revision 16; `README.md` rewritten (professional structure,
  referencing `docs/` instead of restating the spec).
- Tests: `src/ui/drag.test.js` (9 tests: drag axis slop, 1:1 follow, clamp to
  one width, first-card and list-end walls at any distance, release naming),
  `src/ui/swipe.test.js` trimmed to threshold + width gate,
  `reader-forms.test.js` +5 (note/error_usage passthrough, sentence notes).
- Browser check: the motion assertions were rewritten for the new rule
  (`settleVerdict`/`checkSettle`: held-follows-finger, settle continues from
  the finger's position, one monotonic move to rest, nothing after; walls at
  0px), plus Lucide glyph checks on all five screens, the note/error walk
  (note above the sentences in `rgb(180, 83, 9)`, double strikethrough in the
  ink colour, error forms without sentences), the enlarged emoji and the
  issue-list link on both About sheets.
- Verified: `npm test` 25 files / 241 tests (0 failures); `npm run build` ok
  (`output/dict/` = 50, `output/index.html`); `node scripts/browser-check.mjs`
  443 checks passing. `vol/` untouched (`git status vol/` clean). Not
  verified: real iOS/Android devices (repo-wide limitation), the visual result
  of the double strikethrough under ruby on a real phone.

### Revision 17 — card neighbours render, 24px gap, full-bleed paging

The user reported two follow-ups on the revision-16 finger-tracking drag
(quoted): 「練習的卡片跟手但是滑動沒有出現其他的卡片」 and 「卡片拖動到左邊的
時候，可以看到有column的padding 拖動的時候很醜；字典是否也可以這樣做？」.

- **17a The paging window now paints** (`CardView.vue`): the card run mounted
  nine slots and the row translated with the finger, but the `.card-window`
  had `height: 100%` against a content-sized stage while every slot was
  absolutely positioned — Chromium resolved that height to **0px**, so the
  clip discarded the current card and its neighbours at the same time. A real
  minimum height (340px, the card height) gives the faces a paint area; the
  full-bleed stage now owns the horizontal clip. The `.card-slot` faces became
  hit-testable and the raised `z-index` on the current slot was removed so a
  revealed neighbour really paints in the uncovered edge (verified by
  `elementFromPoint`, not just `visibility`).
- **17b A 24px inter-item gap** (`src/ui/window.js` `PAGING_GAP`, `windowGap`,
  `src/study/window-views.js`, both views): each item keeps the full width of
  the container and the seam is added outside it — `translateX(calc(offset% +
  gap px))`, a fixed 24px rather than a viewport-scaled percentage. The settle
  pitch and its browser assertions use one item width + 24px, so a turn
  finishes without closing the gap onto the outgoing item. The dictionary and
  翻卡學習 share the same 24px.
- **17c Full-bleed while paging** (`--page-gutter` on `.column`,
  `CardView.vue`, `ReaderView.vue`): at rest the surface keeps the column's
  side padding exactly as before. While a drag is held or a settle runs, the
  stage/body reaches the column's true edge with negative margins and the
  paging window inside keeps the content width, so the card or word slides to
  the real edge without a gutter band — on the phone that is the viewport
  edge. The dictionary's neighbours also become hit-testable while paging
  (they are real pages during the motion, like the card faces).
- Spec: the paging-window and motion sections now state the 24px seam and the
  full-bleed clip behaviour before the code (AGENTS rule: spec first).
- Tests: `src/ui/window.test.js` +1 and `src/study/window-views.test.js`
  geometry updated for the fixed gap; 242 unit tests total.
- Browser check: `dragNeighbour` now proves the exposed region hits the
  neighbour's own face during a held touch drag (the earlier probe only read
  the row transform), asserts the 24px seam and that the clip spans the
  viewport, and the settle trace reads the paging row's own width. 456 checks
  passing.
- Verified: `npm test` 25 files / 242 tests (0 failures); `npm run build` ok
  (`output/dict/` = 50, `output/index.html`); `node scripts/browser-check.mjs`
  456 checks passing. `vol/` untouched. Not verified: real iOS/Android devices
  (repo-wide limitation) and the visual seam on a real phone GPU.

### Follow-up pass A — UI: error-word skipping, card tags and quiz feedback

Two completed UI goals landed between revision 17's paging-window fix and the
later dropdown/settings revisions. They are recorded here as follow-up passes A and B, between
revisions 17 and 18, so the changelog covers the working tree that
revision 23 verifies.

The first goal was a four-part UI pass: 「改進全域、字典、翻卡學習與測驗的 UI，並在
三種模式加入可跳過不成立用法（error_usage）的「跳過錯誤的單詞」設定，同時更新 spec
與測試。」

- **Icons and page thumb**: both dropdowns use Lucide `ChevronDown`; the
  reader/card footer controls use `ChevronLeft` / `ChevronRight` instead of
  text glyphs. The desktop page thumb first moved inside the framed column.
  `ReaderView.vue` lost the extra `- 8px` window inset that could show a seam
  while paging. Revision 20 later refined the thumb's exact 8px/32px geometry.
- **跳過錯誤的單詞**: `src/dict/settings.js` gained one persisted boolean per
  mode. `orderedFormEntries()` hides `error_usage` reader blocks and
  `buildItems()` filters flagged card/quiz targets. For a live quiz,
  `study.start` builds the full queue and `settings.patch` calls the pure
  `reconcileQuizQueue()`: answered items stay, skipped error items leave the
  unanswered portion (the current item included) or return at its tail, and an
  empty remainder finishes the run. `session.quizSkipped` holds the split.
- **Cards and quiz**: `backTags()` now returns form, class, 第N課 and, for a
  flagged target, 錯誤單詞. The quiz title is `測驗（n/total）`, a wrong answer
  shakes and reddens the input instead of showing the 回答錯誤 toast, and the
  completion percentage counts only resolved items.
- **Spec and tests**: `docs/spec.md` gained all of these clauses before code;
  tests cover settings validation, item filtering, reader form order, card
  tags, queue reconciliation and window data.
- Verified at the time: `npm test` 26 files / 261 tests; `npm run build` ok
  (`output/dict/` = 50, `output/index.html`); `node scripts/browser-check.mjs`
  469 checks passing. `vol/` untouched.

### Follow-up pass B — dictionary display-form filter and corrections

The next goal restored the 預設顯示形式 dropdown after the first pass and
added 選擇顯示的類型, whose 15 chips hide unlearned forms from the reader. It
also changed `error_usage` words from a double strike to colour-only, corrected
the live quiz's displayed total when skipping removes the current item, and
changed the quiz title from 練習 to 測驗.

- **Data and view**: `displayForms` is a canonicalized `forms` list in the
  dictionary settings; `orderedFormEntries()` filters by it while keeping the
  default form first (or promoting the first drawn form). `RubyWord.vue` gained
  the `--error` colour treatment whose reading stays unstruck. The quiz queue
  reconciliation preserves the answered prefix and produces a correct
  `n/total` title, with no `n/0` case. The desktop thumb first moved to the
  24px content gutter; revision 20 superseded that placement.
- **Spec and tests**: the Dictionary settings, Quiz and Look-and-motion
  clauses were updated, with settings/reader/window tests and browser checks
  for the dropdown, chip filtering, error colour, mid-run skip and title.
- Verified at the time: `npm test` 26 files / 269 tests; `npm run build` ok;
  `node scripts/browser-check.mjs` 471 checks passing. `vol/` untouched.
- **Later refinement**: revision 19 restored the double strike alongside the
  error colour; revisions 21–23 locked the default chip, aligned the chips and
  made 全選／取消全選 stateful. Those final rules, not this intermediate pass,
  are authoritative in `docs/spec.md`.

### Revision 18 — dropdown option rows keep their hairline

The user reviewed the built site: "在單詞卡練習中，點擊設置中的"預設顯示形式" 然後點擊
下拉選項，那個水平分割綫不太對勁" — the horizontal separator under a row of the form
dropdown looked wrong once the pointer was on the row.

- **Cause** (`SettingsView.vue`, `PickerView.vue` `.form-option`): the option rows
  carry the panel's separator as their own `border-bottom: 1px solid var(--line)`
  and set a hover fill. A `background` shorthand paints with
  `background-clip: border-box`, so the semi-transparent hairline composited on
  top of the row's own tint: over white it measured `rgb(228, 228, 231)`, under
  the hovered row `rgb(217, 214, 209)` — one divider in the list visibly darker
  and warmer than the other fourteen, exactly under the pointer. Pressing was
  worse: the global `button:active:not(:disabled) { transform: scale(0.97) }`
  applied to the row too, so the hairline shortened from `17..373` to
  `22.3..367.7` and lifted 0.6px off the panel's border for the length of the
  press.
- **Fix**: `background-clip: padding-box` on the row, so the hover/press tint
  stops above the hairline and the line composites over the panel's own white
  in every state; the `:hover` fill switched from the `background` shorthand to
  `background-color` because the shorthand resets `background-clip` back to
  `border-box`. The rows also drop the press scale (`transform: none`, the tint
  is the whole press feedback): a listed row is a row of a panel, and scaling it
  drags its separator off the panel's edge. Both dropdowns (從 in the picker,
  預設顯示形式 in the reader settings) share the fix.
- Spec: the Look and motion bullet about a pressed button now names the dropdown
  rows as the exception, with the reason (spec before code).
- Browser check: two new assertions in the walk-through — the option's computed
  `background-clip` is `padding-box`, and an option held down keeps its width
  and still spans the list's inner edges (`rest=356 held=356 x=17 list=17..373`).
- Verified: pixels re-measured in the built site at `deviceScaleFactor: 3` —
  the divider under a hovered/pressed option reads `rgb(228, 228, 231)` at
  x = 40/120/200/300/360, identical to the untouched dividers, and the pressed
  row's rect stays `17..373 × 40px`; the picker's list holds the same
  (`x=55 width=318`, list inner `55..373`). `npm test` 26 files / 269 tests (0
  failures); `npm run build` ok; `node scripts/browser-check.mjs` 473 checks
  passing. `vol/` untouched.

### Revision 19 — drawn separators in settings, double strike on error words

The user asked for two visual changes (quoted): 「設定中所有的 border-bottom 都要刪除。
製作一個水平綫的 .class 來替換掉 border-bottom。」 and 「把所有錯誤的單詞加入雙刪除綫，
請不要修改現在的顔色。」

- **19a Separators are drawn lines, not row borders** (`src/styles/app.css`,
  `src/views/SettingsView.vue`): a global `.hrule` class draws a 1px
  horizontal rule in `var(--line)` — `display: block`, `height: 1px`,
  `flex: 0 0 1px`, no border of its own, rendered as an `aria-hidden` element
  between entries. `border-bottom` is gone from settings `.row`; the
  dropdown's `.form-option` loses its `border-bottom`, its `:last-child`
  override and the `background-clip: padding-box` workaround, because the
  divider no longer belongs to the row. The template inserts the rule between
  rows (one per row boundary, none above a mode's first row and none after the
  last row) and between the form-list options (one after every option but the
  final one), so no `:last-child` rule is needed to drop a closing line. A
  press on an option can no longer shorten a divider and a hover tint can no
  longer darken one: the line is its own element, out of reach of both.
- **19b Error words are struck through twice again** (`src/components/RubyWord.vue`):
  an `error_usage` word keeps its error colour and now also carries
  `text-decoration-line: line-through` with `text-decoration-style: double`
  on its base boxes — `rb` and the plain kana spans. The decoration sits on
  the base boxes because a flex item does not inherit its container's
  decoration (a rule on `.ruby-word` painted nothing, and a rule on `ruby`
  struck the reading too). `rt` is left unstruck, and the decoration colour
  stays `currentColor`, so the line is the same error colour as the word.
- Spec: the reader clause about `error_usage` (colour only, no strike) and the
  Look-and-motion clause about a dropdown row's hairline were rewritten
  before the code — the divider is now a drawn element, and the error word
  reads colour + double strike.
- Browser check (`scripts/browser-check.mjs`): the settings section now
  asserts no row or option carries `border-bottom`, that every separator is a
  1px `rgba(36, 33, 58, 0.12)` `aria-hidden` element with no border, that the
  rule count equals rows plus options minus one and the screen ends on a row,
  and that a pressed option row keeps its width and position. The error-word
  assertions went from "red instead of struck" to per-word checks over every
  error word met while paging: error colour kept, every base box
  `line-through` + `double`, decoration colour `rgb(220, 38, 38)`, and — on a
  word with a reading — `rt` unstruck and still `rgb(220, 38, 38)`. 第2課
  joined the note/error sweep so a kanji error word is met, and the section
  turns the dictionary's readings back on (the walk had switched them off
  earlier) so the reading rule has an `rt` to measure.
- Paint evidence (not asserted in the walk): a screenshot probe on the built
  site, with the decoration colour overridden to blue so the line is
  distinguishable from the red glyphs, found exactly two 3px bands at rows
  57–59 and 61–63 of the word box — both inside the kanji base band (39–74)
  and none in the reading band (22–39) — with `rb`/kana reporting
  `line-through`/`double`/`rgb(220, 38, 38)` and `rt` reporting `none`.
- Settings geometry re-measured in the browser on all three modes: dictionary
  4 rows / 3 rules closed and 4 rows / 15 options / 18 rules with the list
  open, cards 3 / 2, quiz 4 / 3; every rule 1px in the divider colour.
- Verified: `npm test` 26 files / 269 tests (0 failures); `npm run build` ok
  (`output/index.html`, `output/dict/` = 50); `node scripts/browser-check.mjs`
  479 checks passing. `vol/` untouched.

### Revision 20 — page thumb inside the frame, drawn thumbs in the dropdown lists

Two requests (quoted): 「滑動條的位置在電腦的顯示怪怪，是否可以貼近box最右側的邊緣？ 另外修改下拉box的滑動條樣式。」, then — after the first placement — 「page-scrollbar 是否可以放進去column内？因爲在電腦版會闖過外面column然後很醜」. The second message refined the desktop placement: the thumb belongs *inside* the box, not on its edge.

- **20a Page thumb placement** (`src/ui/scrollbar.js`, `src/components/PageScrollBar.vue`):
  the 24px frame inset is gone. The framed desktop layout now draws the thumb
  inside the column — 8px in from the box's right edge — and its track stops
  32px short of the viewport's top and bottom, which is more than the column's
  28px corner radius, so the bar never rides the rounded corner and never reads
  as crossing the frame. 8px also keeps it outside the 24px content gutter, so
  it cannot cross a footer button (the first complaint: the 24px-inset thumb sat
  on the content edge and cut through 上一個 / 下一個). The full-bleed phone
  layout is untouched: 3px from the window edge, 16px track inset. `rightInset`,
  `isFramed` and the new `trackInset` stay pure and unit tested.
- **20b Dropdown lists draw their own thumb** (`src/ui/scrollbar.js`,
  `src/ui/element-thumb.js`, `src/components/ScrollThumb.vue`,
  `SettingsView.vue`, `PickerView.vue`): both lists (從 in the picker,
  預設顯示形式 in the settings) hide the native bar (`scrollbar-width: none`
  plus `::-webkit-scrollbar { display: none }`) and draw the same 4px rounded
  bar the page draws, 4px inside the panel's right edge and 4px inside its top
  and bottom so it stays clear of the panel's 12px corners. `listThumbMetrics`
  is pure and unit tested (fits → nothing drawn, share of the list, minimum
  thumb, end position, overscroll clamp); `useElementThumb` wires scroll,
  rAF and ResizeObserver and runs the same 1s fade; `ScrollThumb.vue` only
  renders. The list is wrapped in `.form-list-frame` (the panel's margin moved
  to the frame) so the thumb can sit absolutely inside it without scrolling
  with the content.
- Spec: the page-scrollbar clause and the dropdown clause were rewritten
  before the code (spec first), including the corner-radius reasoning.
- Browser check: the wide-window assertion now proves the thumb is 8px inside
  the box with its track starting 32px down and inside the column, plus a new
  assertion that it never crosses a footer control; the picker list's native
  bar assertion became "native bar hidden + the drawn 4px thumb (4px insets,
  fade, reduced motion)"; the settings list got its own assertions (thumb
  present, native bar hidden, hidden until the list moves). The picker's row
  dividers stay asserted from revision 19.
- Verified: `npm test` 26 files / 280 tests (0 failures); `npm run build` ok
  (`output/index.html`, `output/dict/` = 50); `node scripts/browser-check.mjs`
  489 checks passing. Browser probes: thumb gap to the column edge 8px at
  700/900/1200 widths (3px at 390), 32px track start at scroll 0, inside the
  column, no control crossing; list thumb 4px wide, 4px insets, fade after
  1.3s, `transition: 0s` with the thumb still shown under reduced motion.
  `vol/` untouched.

### Revision 21 — no rule above the form list, the 預設顯示形式 chip is locked

Two requests landed after revision 20. First the user edited the source itself:
the separator above the 預設顯示形式 dropdown was commented out with the note
「不要加綫，很醜！」 — a line between the row and its own list reads as an extra
divider. Second:「字典中，如果選擇 "預設顯示形式" 是 masu 形，"選擇顯示的類型" 就必須是要
選擇。使用禁止按鈕，并且tooltips 提示 "預設顯示形式" 默認需要顯示這個之類的提示。」

- **21a No rule above the form list** (`SettingsView.vue`): the list opens
  directly under the 預設顯示形式 row. The `hrule` above it stays commented out
  (the user's own note is kept in place), the separators between the list's
  options remain, and the spec now says the list carries no rule of its own.
- **21b The default form's chip is a disabled button** (`SettingsView.vue`,
  `src/dict/settings.js`): the chip of the current 預設顯示形式 is disabled,
  keeps its selected look (`chip--locked`), and explains itself in a tooltip
  reading `這是預設顯示形式，必須顯示，不能取消` (the picker's `.chip-tip`
  pattern, shown on hover of the chip's wrapper). `toggleDisplayForm` returns
  early for that form, so the rule also holds if a click event arrives. The
  data layer keeps the invariant: `applyPatch` re-adds the default form when a
  patch removes it or picks a new default outside the selection, and
  `normalizeSettings` repairs a stored selection that misses it. Choosing a
  different 預設顯示形式 therefore adds that form and frees the old chip.
- Spec: the 選擇顯示的類型 clause gained the locked-chip rule and its tooltip
  text, and the reader clause now states that the 預設顯示形式 is always drawn
  (its block is always first), which replaces the old "if the 預設顯示形式 form
  is hidden" fallback wording.
- Browser check: four new assertions — the 預設顯示形式 chip is a disabled
  button that is still pressed, no other chip is disabled, the tooltip carries
  the spec text through `aria-describedby` and stays hidden until the wrapper
  is hovered (then opacity 1), and the lock follows a new default (て形 locked,
  the freed ます形 chip toggles off and on again). The 選擇顯示的類型 show/hide
  walk now uses 字典形 instead of て形, because て形 becomes the locked default.
- Verified: `npm test` 26 files / 284 tests (0 failures); `npm run build` ok
  (`output/index.html`, `output/dict/` = 50); `node scripts/browser-check.mjs`
  497 checks passing (the count moves by one with the seeded quiz item). `vol/` untouched.

### Revision 22 — dictionary settings chips aligned with the quiz button group

The user said:「字典中的設置形式的按鈕非常丑，請你和“挑戰”功能的按鈕組進行對其」.
The product has no 挑戰 mode; the reference is the quiz/測驗 settings'
錯 X 題就顯示答案 group, whose five buttons share one equal-width, flush row.
The dictionary's 選擇顯示的類型 buttons had been shrinking to their labels
inside a 96px-minimum grid, leaving ragged edges between columns.

- **22a Equal-width chips** (`src/views/SettingsView.vue`): each `.chip` now
  fills its `.chip-wrap` cell (`width: 100%`, `min-width: 0`), the wrapper gets
  `min-width: 0`, and the grid's minimum track rises to 112px so even
  ませんでした形 fits without overflow. The grid still wraps (`auto-fill`), so
  a short final row keeps the same cell width instead of stretching its
  buttons. The locked 預設顯示形式 chip, its tooltip, all 15 chips, the 36px
  height, 10px radius and selected colours stay unchanged.
- **Spec**: the 選擇顯示的類型 clause now says the chips fill equal-width cells
  edge to edge and align like the quiz settings' button group, with no label
  shrinking its button or overflowing it.
- **Browser check** (`scripts/browser-check.mjs`): four new assertions cover
  the quiz reference row (five equal-width, flush buttons), the dictionary's
  15 equal-width chips filling their cells, full wrapping rows flush with the
  group edges, and no label overflowing its button.
- Verified: `npm test` 26 files / 284 tests (0 failures); `npm run build` ok
  (`output/index.html`, `output/dict/` = 50); `node scripts/browser-check.mjs`
  501 checks passing (the count moves by one with the seeded quiz item). `vol/` untouched.

### Revision 23 — select-all state, locked-chip look, dropdown thumb hints

The user asked to continue 「優化UI」 with three concrete changes:「在設定的
"選擇顯示的類型" 全選的按鈕，按一下要變成取消全選，另外禁止的按鈕要和第一課禁止的
按鈕一樣」 and 「點擊下拉框的時候，下拉框的滑動條要顯示，然後几秒後再消失，鼠標移動
進去也要顯示，因爲這樣可以告訴人原來下面還有内容」. The choices were confirmed
before implementation: the label follows the selection state; the locked chip
keeps its pressed state and tooltip while adopting the 第1課 disabled look;
and **both** dropdown lists show the thumb for about two seconds on open and
after pointer or scroll activity. The broader 優化UI backlog stays pending.

- **23a State-based 全選／取消全選** (`src/dict/settings.js`,
  `src/views/SettingsView.vue`): the selection-label rule and the
  `nextSelectAllDisplayForms` transition are pure functions. 全選 selects all
  15 forms; 取消全選 leaves only `defaultForm` (the reader's opening block);
  manual toggles update the label. The view only dispatches `settings.patch`,
  so the state persists with the other localStorage settings. The
  `defaultForm ∈ displayForms` invariant and the reader's default-first order
  are unchanged.
- **23b Disabled-chip look** (`src/views/SettingsView.vue`): the locked
  `.chip--locked:disabled` uses the same transparent body, `var(--muted)`
  text, `var(--line)` border, 45% opacity, default cursor and no pointer
  events as `.chip--empty:disabled` in the picker. It overrides the filled
  `.chip--on` style but stays `aria-pressed="true"`; its wrapper continues to
  show `這是預設顯示形式，必須顯示，不能取消` on hover or focus.
- **23c Dropdown thumb hints** (`src/ui/scrollbar.js`,
  `src/ui/element-thumb.js`): `LIST_SCROLLBAR.fadeDelay` is 2000ms while the
  page thumb stays 1000ms. `useElementThumb` reveals on attach (the list's
  `v-if` mount), scroll, `pointerenter` and `pointermove`; each event restarts
  the two-second fade. A fitting list renders no thumb, and reduced motion
  still shows/leaves the thumb without a CSS transition.
- **Tests** (`src/dict/settings.test.js`, `src/commands/settings.test.js`,
  `src/ui/scrollbar.test.js`, `src/ui/element-thumb.test.js`,
  `scripts/browser-check.mjs`): pure transition/persistence tests and six
  fake-timer thumb tests; browser assertions on both dropdowns for immediate
  open reveal, ~2s fade, pointer reveal/reset, scroll reveal, fitting-list
  suppression, reduced motion, computed-style parity with the disabled 第1課
  chip, tooltip, 15 equal-width chips, select-all label/click/reload, and the
  unchanged ~1s page thumb.
- Verified: `npm test` 27 files / 296 tests (0 failures); `npm run build` ok
  (`output/index.html`, `output/dict/` = 50); `node scripts/browser-check.mjs`
  527 checks passing (the count moves by one with the seeded quiz item);
  `node scripts/write-sha256.mjs --check` ok. `vol/` untouched.


## 2026-11-11 (docs and repository sync)

The user asked to update all markdown and commit the repository. This pass
reconciles the docs with the working tree's final implementation: revisions
follow-up passes A/B are recorded above, 18–23 were already in the dated
log, and the
current verification remains 27 test files / 296 unit tests, a build with 50
dictionary files, and 527 browser checks.

- **Spec**: the dictionary reader clauses now distinguish drawn forms from all
  15 forms and state the first-drawn-block tag/fallback rule; `AGENTS.md` T5
  names the revision-16 finger-tracking gesture and the four dictionary
  settings rather than the superseded invisible drag and two-setting list.
- **Status**: `docs/progress.md`, `docs/roadmap.md`, `AGENTS.md` and
  `docs/architecture.md` agree on revisions 2–23 and passes A/B, the
  three pending backlog items, the settings invariant, live quiz queue
  reconciliation, wrong-answer feedback, and the final test/check counts.
  `docs/roadmap.md` now orders boards 19→23 and adds boards for passes A/B.
- **Overview and serving**: `README.md` has the 296-test badge and counts, the
  display-form filter, error-skipping rules, new card/quiz feedback, and both
  drawn scroll thumbs. `docs/serving.md` notes that it was rechecked against
  the current build; its secure-origin, IndexedDB and Pages-subpath rules are
  unchanged.
- **Architecture**: the file map includes `src/ui/element-thumb.js` and
  `ScrollThumb.vue`; the session, settings, reader, quiz and testing sections
  describe the new pure rules. Current counts are 27 files / 296 tests and 527
  browser checks, replacing the stale 25 / 242 / 456 figures.
- **Historical snapshots**: `docs/audit/*.md` are dated 2026-11-10 dictionary
  audits and intentionally remain unchanged; `README.md` now labels them as
  historical, not current-state documents.
- Verified: `node scripts/write-sha256.mjs --check` (manifest ok: 50 lessons);
  `npm test` 27 files / 296 tests (0 failures); `npm run build` ok
  (`output/index.html`, `output/dict/` = 50); `node scripts/browser-check.mjs`
  527 checks passing; `git diff --check` clean and `git status --short -- vol`
  empty. Not verified: a real GitHub Pages deployment, real iOS/Android
  devices, Safari/Firefox, or manual visual inspection.

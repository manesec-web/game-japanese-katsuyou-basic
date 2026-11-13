# Progress

Last updated: 2026-11-14 (revision 34: locked 到 chips, the 翻卡練習 rename and
the card class pill that now arrives with the card).

**Status: complete.** T1–T8 are done and revisions 2–34 have landed and been
verified, including follow-up UI passes A/B. The build is live at
`https://manesec-web.github.io/game-japanese-katsuyou-basic/` (verified
2026-11-14: HTTP 200, and `dict/vol.bin` answers `application/octet-stream`).
Backlog B1 (朗讀功能) and B3 (優化UI) remain `pending`; B2 (優化下載文件) is
done as revisions 32–33.

## Revision 34 — locked 到 chips, 翻卡練習, immediate class pill

- **到 follows 從.** The chip that equals the current 從 is now a disabled
  button with the dictionary's locked-chip look and the tooltip
  `這和「從」的形式相同，不能選為「到」` on hover, up to 320px wide (one line)
  and clamped to the viewport by the pure `src/ui/tooltip.js`, so a right-hand
  chip cannot widen the page. It is never selected,
  全選 skips it, and changing 從 moves the lock; the picker renders two pure
  helpers (`targetChips`, `toggleTarget`), so no rule lives in the `.vue`.
- **Rename.** Home button, spec, README and all current docs say 翻卡練習. The
  quoted user request in the changelog keeps its original wording.
- **Card class pill.** `CardView.vue` no longer renders tag rows only on the
  current slot, so the card sliding in already carries its own class pill while
  the finger holds the drag; it no longer pops in at release.
- Verification: `npm test` 35 files / **370 tests**; `npm run build`;
  `node scripts/browser-check.mjs` **597 checks**, 0 failures (the seeded quiz
  moves the count by one). `vol/` untouched.

## Revision 33 — the loading bar shows the download

- Requested:「另外，可以做到下載的進度條嗎？」The bar used to be verified
  lessons / 50, so the 550 KB archive download looked like a freeze.
- `src/ui/boot-progress.js` (pure, 8 tests) computes the percentage: cache-check
  progress, then the streaming download's bytes against `Content-Length` from
  the percentage the cache check reached, then a hold at 100% while the
  extracted entries are verified. No `Content-Length` holds the bar; a retry
  restarts at the already-verified percentage; the bar never moves backwards.
- `app.boot` streams `dict/vol.bin` with `response.body.getReader()` and
  `session.boot.download = { base, loaded, total, done }` carries the phase;
  `LoadingView.vue` only renders `bootPercent(boot)`, so no rule lives in a `.vue`.
- Verification: `npm test` 34 files / **360 tests**; `npm run build`; the
  browser suite is **584 checks**, 0 failures, including a boot throttled to
  200 KB/s on which the recorded bar widths rise through ≥3 intermediate values
  spread over ≥700 ms (verification alone fills the bar in one ~100 ms burst,
  so that spread can only come from the download).
- The archive is published as `dict/vol.bin` (a ZIP without the `.zip` suffix,
  `application/octet-stream`), because 「一些插件會抓取然後劫持之後彈出下載框」.
  Bytes, ZIP format, manifest, per-entry hashing and the boot rule are unchanged.

## Revision 32 — one verified dictionary archive

- First load now makes **one** request for 4.9 MB of dictionary data instead of
  50: the build packs `vol/` into `dict/vol.bin`, a level-9 ZIP of 549 KB
  (11.5% of raw, measured at 4,899,916 bytes).
- The manifest did not change: still 50 per-lesson SHA-256 records. Boot hashes
  each extracted entry against its own record, so `boot.checked / boot.total`
  still means finished lessons / 50 and the loading screen is unchanged.
- `scripts/zip.mjs` writes a deterministic archive (fixed timestamps), so the
  same input yields byte-identical output; `scripts/vol-archive.mjs` verifies
  `vol/` before packing and throws on a mismatch, a missing source or an empty
  manifest, which fails `npm run build`. `scripts/write-vol-archive.mjs`
  (`--check`, `--out`) is the manual/CI entry point.
- `output/dict/` no longer holds `lesson_N.json`; the Vite plugin writes only
  `vol.bin` and serves the same archive in dev (rebuilding when `vol/` or the
  manifest changes). `dict/lesson_N.json` returns no dictionary content any more.
- `src/dict/archive.js` wraps `unzipit` (`useWorkers: false`) and reads entries
  lazily; `src/dict/boot.js` is two-phase: hash the cache first, then download
  the archive once, verify each collected entry and store only matches. A failed
  download, unreadable archive, absent entry or mismatch is retried with a
  second download; whatever still fails stops boot naming the lesson and those
  bytes are never written. No per-lesson fallback file remains by decision.
- `scripts/browser-check.mjs` follows the new URL and adds checks for one archive
  request per fresh boot, zero per-lesson requests, a binary
  `application/octet-stream` response, the
  `PK\x03\x04` header with a 50-entry end record, `output/dict` containing only
  the archive, no dictionary content at `dict/lesson_1.json`, the two-abort
  failure path, and the single download in a private window. The loading
  progress check moved to a document-start sampler, because a single 550 KB
  request can finish the whole boot before an after-the-fact poll runs.
- Verification: `npm test` 33 files / **349 tests**; `npm run build`
  (`output/index.html` + `output/dict/vol.bin` 549 KB); `node
  scripts/write-sha256.mjs --check` ok; `node scripts/write-vol-archive.mjs
  --check` ok; `node scripts/browser-check.mjs` **580 checks**, 0 failures.
  `vol/` bytes untouched; `unzipit@2` added as a runtime dependency.

## Revision 31 — per-form Chinese glosses (data only)

- `vol/lesson_1.json` … `lesson_50.json`: 5,420 form `chinese` values rewritten
  and one misleading `note` (L23#9) normalized. Only those two fields changed;
  `vol`, `group`, `japanese`, `sentence` (Japanese, Chinese, notes),
  `error_usage`, key order, lesson structure and canonical formatting are
  unchanged (verified against the original bytes before the temporary
  baseline was removed).
- 191 `error_usage` forms now carry the single marker
  `（非自然日語；僅供轉詞練習，無自然中文譯義）`. The 5,599 usable forms carry
  their own affirmative/negative/tense/て/可能/意向/命令/條件/受身/使役 meaning;
  polite and plain pairs are labelled `（禮貌體）` / `（普通體）`.
- Data-driven exceptions: 迷惑受身, 尊敬語, 讓步構文, 文語祈願, 自發用法,
  stative/cognitive verbs (見える, 聞こえる, 要る, 足りる, できる, 出来る …),
  three already-inflected Chinese base glosses, and form-specific 「日常少用」
  notes. 44 verb paradigms and 10 semantic-denial notes were hand-reviewed.
- Known finding: the goal contract cited 89 error forms / 17,103 sentences
  from a stale audit; current `vol/` has 191 / 16,797. Example sentences were
  deliberately left untouched. The temporary per-batch doubt list was removed
  with the rest of the rewrite artifacts.
- Verification: the temporary validator passed on all 50 lessons / 386 verbs /
  5,790 forms (5,599 usable, 191 error markers, 16,797 sentences, 0
  immutable-field changes) before it was removed. Manifest regenerated with
  `node scripts/write-sha256.mjs`; `npm test` (30 files / 331 tests),
  `npm run build` and `node scripts/browser-check.mjs` (574 checks) pass.
- `docs/spec.md` Data now specifies per-form glosses; `AGENTS.md` and
  `docs/architecture.md` record the one-time `vol/` exception. No `.vue`,
  command, engine or settings code changed.

The following revision summaries are historical. Revision 14 replaced the
paging follow/spring-back
(“跟手拖曳、短拖回彈、第一張卡阻力”) with an invisible drag and a direct swap
plus one short slide-in, and fixed the post-settle flash (“歸位後閃一下、再動
一次”). Revision 15 mounts a paging window around the current item — 9 cards in
翻卡練習, 5 words in the dictionary — keeps the current item in the 3rd slot and
shifts the window by dropping one end and adding the other. Revision 16
supersedes revision 14's motion with the finger-tracking drag the user asked
for (“按住無法實現跟手的拖動”): the strip follows the finger 1:1 while held and
finishes the page on release as one short settle from where the finger left
it; the walls (first card, first/last word) stay completely still. The same
revision swapped the `←`/`⚙` glyphs for Lucide icons, enlarged the completion
emoji (2rem → 4rem), centred the word/gloss/tag row in the dictionary block,
added the note layer (form notes above 例句, sentence notes under the Chinese
line, both in the `--note` colour), pointed 提交ISSUE at `/issues/`, and rewrote
`README.md`. Revision 16 also gave `error_usage` forms a double strikethrough;
follow-up pass B temporarily changed that to colour-only, and revision 19 restored
the double strike in the final rendering. Revision 17 fixed the card paging
window's zero-height clip (the current card
followed the finger but no neighbour appeared), gave both screens a 24px gap
between adjacent pages, and made the paging surface span the column's full
width while dragging so the item reaches the true edge instead of leaving a
side-padding gutter. Revision 18 kept the hairline under a dropdown option row
constant: the hover and press tint no longer paints under it and the row no
longer scales on press, so the separator stops darkening and shortening while
the pointer is on it ("那個水平分割綫不太對勁"). Revision 19 then removed every
`border-bottom` from the settings screen in favour of a global `.hrule` class
that draws each separator as its own 1px element, and put a double strike back
on the dictionary's `error_usage` words while keeping their existing error
colour (no colour value changed in that revision).

Two follow-up UI goals between revisions 17 and 18, recorded as passes
A/B, added the three 跳過錯誤的單詞 switches (with live quiz
queue reconciliation), the 選擇顯示的類型 reader filter, 第N課 / 錯誤單詞 card
tags, the 測驗（n/total） title, shake/red wrong-answer feedback instead of a
回答錯誤 toast, the ChevronDown and paging-arrow icons, and the first framed
desktop page-thumb placement; their intermediate visual choices were later
refined by revisions 19–23. Revision 20 moved the page's drawn thumb inside a
framed desktop column (8px in from the box's right edge with a 32px
track that clears the 28px corner radius, so it no longer reads as crossing
the frame or cutting through the footer buttons) while the phone layout keeps its 3px/16px placement, and replaced the
native scrollbars of the two dropdown lists with the same drawn 4px rounded,
fading thumb the page uses. Revision 21 keeps the 預設顯示形式 list opening
directly under its row with no rule in between (the user removed that line with
「不要加綫，很醜！」) and turns the 預設顯示形式 chip of 選擇顯示的類型 into a
disabled button with the tooltip 「這是預設顯示形式，必須顯示，不能取消」, backed by
a data-layer invariant so the default form can never be dropped from the
selection. Revision 22 aligns the dictionary's 15 選擇顯示的類型 chips with the
quiz settings' 錯 X 題就顯示答案 button group: each chip fills an equal-width
cell, so the wrapping rows have flush edges and no ragged gaps. Revision 23
makes 選擇顯示的類型's 全選 toggle to 取消全選 according to the selection state
(clearing leaves only the locked default form), gives that locked chip the same
transparent, muted, 45%-opacity disabled look as 第1課 while keeping it pressed
and its tooltip, and shows both dropdown list thumbs immediately on open or
pointer activity for about two seconds before they fade. The broader 優化UI
backlog remains pending for further, unspecified UI work. Revision 26 then made
the page and dropdown thumbs draggable by mouse (with pointer proximity revealing
the page thumb first), removed the separate no-lesson warning and moved that
state onto a red-bordered transparent 開始 button (labelled
`請至少選擇一個轉型才可以開始` when 到 is empty), and made the held card/reader
drag paint synchronously in the pointer event rather than waiting for Vue.
Revision 27 then renamed the site title from `轉型練習` to `動詞轉型練習` in
`SiteHead.vue` and the document title, and updated the current-behaviour docs
(the spec's loading/home head, the T3 line in `AGENTS.md`, `README.md`) while
leaving the historical revision rows at their original wording. Revision 29
moved the unflipped card's tag above its word, and revision 30 added the
dictionary's 單詞目錄: a 目錄 icon left of the settings gear opens a screen of
its own that lists the run's frozen words grouped by 第N課, marks the current
word, jumps the reader to a pressed row at the top of the page, and returns to
the unchanged word on back.

## Current state

- Vue 3.5 + Vite 7.3 + Vitest 3 static app. Verified with Node v26.4.0 and
  npm 11.18.0; Vite 7 requires Node `^20.19.0` or `>=22.12.0`.
- `npm test`: 35 files, **370 tests passing**. `pretest` verifies the 50-lesson
  SHA-256 manifest first.
- `npm run build`: `output/index.html`, `output/assets/` (one JS + one CSS
  bundle plus the four hashed logo icons — `favicon*.ico`, `favicon-32*.png`,
  `favicon-192*.png`, `apple-touch-icon*.png`) and `output/dict/vol.bin` with
  **50** entries (549 KB; no per-lesson JSON, a ZIP served as
  `application/octet-stream`). `output/` is gitignored.
- `node scripts/browser-check.mjs`: **597 checks passing on the revision-34
  final run** (headless Chromium, 390×844 with 550/551/800/900 width probes,
  plus a touch context for the zoom lock, thumb-drag/proximity assertions,
  frame-by-frame motion checks, and 8 new checks that the reader renders each
  form's own Chinese gloss). The count moves with the seeded quiz item, which
  decides how many kana-key assertions run.
- `node scripts/motion-probe.mjs`: prints the frame-by-frame position trace for
  the paging slide and the flip. Used to measure the motion before and after a
  change; not part of the pass/fail gate.
- `node scripts/strike-probe.mjs`: the one-off screenshot probe that measured
  where the double strike is painted and confirmed the reading is unstruck.
  It is retained as a development diagnostic, not part of the pass/fail gate.
- Git: branch `main`, tracking `github/main`
  (`git@github.com:manesec-web/game-japanese-katsuyou-basic.git`); the working
  tree matches the remote tip. History starts at commit `933c30b` (`init`).
  The Pages site is live; it answered 404 only before the first deploy.
- Dictionary cache is IndexedDB (`katsuyou-dict` / `lessons`, one record per
  lesson file); settings are in `localStorage` under `katsuyou-settings`.

## Verification as of this refresh

```bash
npm test                                # 35 files, 370 tests passed
npm run build                           # manifest ok; output/index.html + output/dict/vol.bin (50 entries)
ls output/dict                          # vol.bin
node scripts/browser-check.mjs          # browser check passed (597 checks)
node scripts/motion-probe.mjs           # frame-by-frame motion traces (informational)
node scripts/write-sha256.mjs --check   # manifest ok: 50 lessons
node scripts/write-vol-archive.mjs --check  # checked 50 lessons: 4.65 MB -> 549 KB (11.5%)
```

## History in one line each

Full detail, including quoted user requests and before/after measurements, is
in [`docs/changelog.md`](changelog.md). Task acceptance evidence is in
[`docs/roadmap.md`](roadmap.md).

- **T1**: Vite + Vue 3 skeleton, `dispatch`, empty session, Vitest, build into
  `output/`.
- **T2**: SHA-256 manifest script plus `app.boot` (verify → download → store;
  double mismatch stops with `boot.error`).
- **T3**: loading progress, retry, home entries, About sheet.
- **T4**: shared picker with per-mode lesson selection, empty lessons
  unselectable, 全選 rule, 從/到 form controls.
- **T5**: dictionary reader with 15 form blocks, ruby, purple sentence
  highlight, flat horizontal paging.
- **T6**: flashcards (verb × target form), 3D flip, swipe paging, 完成.
- **T7**: quiz keyboard generator, normalization/grading, reveal after N misses
  (default 3), auto-submit.
- **T8**: motion and `prefers-reduced-motion`, final verification.
- **R1–R7** (revision 2): all 15 forms in the reader, renamed reader controls,
  3D card flip, 到 header row, full-bleed layout.
- **U1–U9** (revision 3): 550px breakpoint, masu-first defaults, one-shot
  shuffle, pinned pager, card enter animation, reveal overlay, completion
  screens.
- **V1–V6** (revision 4): richer About sheet, uniform reader blocks, transparent
  fade footers, animated card buttons, empty-到 start hint.
- **Revision 5**: home copy (`大家の日本語` / `轉型練習` / `涵蓋初級 1 – 50 課的單詞`),
  36px control geometry, sticky top bars, 例句 highlight, parallel paging,
  completion emoji bands and confetti.
- **Revision 6**: exactly one emoji above 恭喜，你已經做完了練習。, 60px 返回主頁, flat
  paging, and `overflow-x: clip` to remove the horizontal scrollbar during card
  practice.
- **Revision 7**: dictionary cache moved from OPFS to IndexedDB (private
  windows can open a database but cannot expose an origin-private directory).
- **Revision 8**: paging away from a flipped card no longer plays the 3D turn
  or fades; leave and enter are flat `translateX` phases.
- **Revision 9**: the card answer always names the asked form and then the verb
  class, regardless of the class switch.
- **Revision 10**: `base` pinned to `/game-japanese-katsuyou-basic/` for a
  GitHub Pages project site; dev/preview/harness/docs all follow the subpath.
- **Revision 12**: the page draws its own 4px scrollbar (native bar hidden,
  inner dropdowns keep theirs, shown on scroll and gone about a second after
  it stops); the picker's 從 label is centred on the 36px form control instead
  of being nudged down with padding; and a right-to-left swipe on the last
  card finishes the run, exactly like 完成.
- **Revision 11**: mobile Chrome comfort. The viewport pins the scale
  (`maximum-scale=1, user-scalable=no`) and `html`/`body` add
  `touch-action: manipulation`, so neither a double tap nor a pinch zooms. Paging
  and card turns now end their phases on `transitionend`/`animationend` instead
  of guessed timers, the exit accelerates and the entry decelerates (exit/entry
  speed within 1.02x of each other, was 9.2x), the spring-back is 140ms, and the
  flip is a single 240ms turn at `perspective: 1600px`.

- **Revision 24**: normal vertical reading and dropdown scrolling stay enabled,
  while root `overscroll-behavior-y: none`, dropdown containment and a
  non-passive iOS `touchmove` boundary guard suppress Android pull-to-refresh
  and root rubber-banding. The guard only cancels predicted one-finger
  vertical edge crossings, leaves horizontal paging and multi-touch alone,
  and settles a crossing at the exact boundary. It is not a fixed-body or
  document-wide scroll lock. Verified by 13 unit tests and five additional
  touch-capable Chromium checks (28 files / 309 tests, 533 browser checks);
  actual iOS Safari rubber-banding and Android hardware still need real-device
  verification. Chromium's compositor-owned, non-cancelable root moves are
  documented in the spec/architecture/changelog rather than presented as an
  iOS simulation. Pre-existing external `vol/` and generated-manifest changes
  seen during the final diff were not edited or reverted by this revision.

- **Revision 25**: `body`, `#app` and the framed/mobile `.column` now size short
  screens with `min-height: 100dvh` (framed column `calc(100dvh - 40px)`),
  keeping `vh` as the fallback, so short screens such as 翻卡練習 and settings no
  longer overflow when an iOS browser toolbar makes the static `vh` taller than
  the visible area. Home and loading already used `dvh`. A new browser check
  asserts a fresh card run has no vertical overflow (533 checks on the final
  run); a collapsing-toolbar test is not reproducible in headless Chromium, so
  the actual iPhone 18 Pro behavior is a real-device acceptance check.

- **Revision 26**: the page and the two dropdown thumbs become draggable with a
  mouse (pointer proximity reveals the page thumb first; the grab starts from
  the thumb's current offset and never jumps), while touch keeps ordinary
  scrolling and a passive hint. The separate `請至少選擇一門課程才可以開始`
  line is removed in all three modes and the disabled 開始 button carries the
  invalid state as red text + a red 1px border on a transparent background
  (its label becomes `請至少選擇一個轉型才可以開始` when 到 is empty),
  returning to the purple primary style once the choices are valid. The held
  card/reader drag now paints synchronously in the pointer event instead of a
  Vue render per move, answering the perceived delay: the 8px direction slop
  was the only intended still period. 28 files / 317 tests, 546 browser checks.

- **Revision 27** (requested 2026-11-12: 「標題從“轉型練習” 改成“動詞轉型練習”
  并且更新文檔」): the site's subtitle and the page title now read
  `動詞轉型練習`; `src/components/SiteHead.vue` is shared by the loading and home
  screens, so both heads follow in one edit. The loading-subtitle assertion in
  `scripts/browser-check.mjs` expects the new wording. Width probes at
  320/375/390/480/800px report a centred subtitle with no clipping and no
  horizontal overflow, so the fifth character needs no layout change. Spec/AGENTS/
  README were resynced; changelog revision 5, roadmap 13b and this file's
  revision-5 bullet keep `轉型練習` because they record what shipped then.
  Verified: `npm test` 28 files / 317 tests (no JS change), `npm run build` ok
  with `output/index.html` carrying the new `<title>` and 50 files in
  `output/dict/`, and `PORT=5299 node scripts/browser-check.mjs` 549 checks
  passing. No `vol/*.json` was touched.

- **Revision 28** (requested 2026-11-12: 「網頁標題改成“大家の動詞轉型練習”
  然後使用這個 docs/logo/logo.jpg 作爲網頁的logo，你可以轉換其他的格式放入該
  文件夾」 + 「涵蓋初級 1 – 50 課的單詞 改成 涵蓋初級 1 – 50 課的動詞」): the
  browser-tab title is now `大家の動詞轉型練習`, and the tab carries the logo
  from `docs/logo/logo.jpg`, converted inside that folder to `favicon.ico`
  (16/32/48px), `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`
  (180px) and `logo-512.png`. `index.html` links them with relative hrefs, so
  Vite hashes each file into `output/assets/` and prefixes the Pages base —
  no root-absolute `/favicon.ico`, no third-party icon host, no `public/`.
  The loading/home lede reads `涵蓋初級 1 – 50 課的動詞`; the on-screen head
  keeps its three lines and draws no image, and the logo appears in the tab,
  bookmarks and the iOS home-screen icon only. The harness gained six checks
  (document title, declared icons, subpath URLs, served favicons and touch
  icon). Verified: `npm test` 28 files / 317 tests; `npm run build` ok
  (`output/assets/` = 4 hashed icons, `output/dict/` = 50); `PORT=5299 node
  scripts/browser-check.mjs` 550 checks passing, 0 failures. No `vol/*.json`
  was touched.

- **Revision 29** (requested 2026-11-12: the unflipped card's tag should sit
  above the word, like the answer): `CardView.vue` reorders the face so it
  reads tag → word → `變成…` prompt, matching where the answer places its
  tags. The pill, its wording and the prompt are unchanged. The spec's Cards
  face clause and a new browser position assertion follow; the run still
  passes 28 files / 317 tests and 550 browser checks with 0 failures.

- **Revision 30** (requested 2026-11-13: 「我想在這個設置按鈕旁邊加入一個單詞的
  目錄，點一下會顯示選擇課文的所有單詞，這樣方便用戶跳轉」): a new `toc`
  screen behind a 目錄 icon left of the reader's settings gear. It lists only
  the run's frozen words (`session.items`), grouped by `第N課`, each row
  showing the word and its lesson tag, with the current word tinted and marked
  `aria-current`. A press runs `dict.goto` — an integer inside the list or an
  `invalid-index` error — and the reader opens on that word at the top of the
  page; back returns to the unchanged word. `src/study/toc.js` holds the
  grouping as a pure function, `src/commands/nav.js` allows the screen only
  from the reader. The reader also scrolls to the top on mount, because a jump
  changes `index` before the reader exists. Verified: `npm test` 30 files /
  331 tests; manifest ok (50); `npm run build` ok with 50 dict files;
  `node scripts/browser-check.mjs` 565 checks passing, 0 failures (16 of them
  cover the new screen). No `vol/*.json` was touched.

- **Revision 13**: the loading screen carries the site head
  (`大家の日本語` / `轉型練習` / `涵蓋初級 1 – 50 課的單詞`) and the credit line
  `Build with ❤ by Mane` (which opens the About sheet) but not the bug line;
  the first card in 翻卡練習 resists a right-hand drag (a third of the finger,
  capped at 40px, then a 140ms spring-back) instead of sitting still; and the
  roadmap gained a backlog (朗讀功能, 優化下載文件, 優化UI).
- **Revision 14** (requested 2026-11-10: the paging bounce made the user ill —
  “看到頭會很痛”): swipe paging is kept but the drag is invisible — no
  follow, no spring-back, and the revision-13 first-card resistance is gone
  (the first card is completely still). A swipe past 72px swaps at once and
  the incoming item plays one ~190ms slide-in from the edge; a shorter drag
  does nothing at all. The post-settle flash (“歸位後閃一下、再動一次”) is
  fixed at its suspects: no leave phase, the slide ends on the resting state,
  `will-change` is never torn down at the settle frame, and the scroll reset
  runs before the swap. `docs/spec.md` was revised before the code.
- **Revision 15**: the paging window — 9 cards in 翻卡練習 and 5 words in the
  dictionary keep their neighbours mounted with the current item in the 3rd
  slot; a turn is one front delete plus one back append, and only the current
  item is ever visible.
- **Revision 16** (requested 2026-11-11: “單詞和字典的動畫不跟手，按住無法實現
  跟手的拖動”): the drag is back under the finger — the strip of items follows
  the hand 1:1 while held and on release finishes the page as one short settle
  from where the finger left it (superseding revision 14's invisible drag; the
  first-card and list-end walls stay completely still). Same revision: Lucide
  icons instead of the `←`/`⚙` glyphs, the completion emoji enlarged to 4rem,
  the dictionary block's word/gloss/tags centred, the note layer (form note
  above 例句, sentence notes under the Chinese line, `--note` colour) and the
  double strikethrough on `error_usage` words, 提交ISSUE → `/issues/`, and a
  rewritten `README.md`.
- **Follow-up pass A** (2026-11-11, four-part UI pass): Lucide
  `ChevronDown` / paging arrows, the first framed desktop page thumb, the three
  跳過錯誤的單詞 switches with live quiz queue reconciliation, 第N課 / 錯誤單詞
  card tags, 測驗（n/total）, wrong-answer shake/red feedback, and a completion
  tally over resolved items. `src/study/items.js` gained the pure queue helper;
  `session.quizSkipped` holds the deferred error items. Final pass: 26 files /
  261 tests and 469 browser checks.
- **Follow-up pass B** (2026-11-11, restore the default-form dropdown and
  add a display-form filter): 預設顯示形式 stays a dropdown, 選擇顯示的類型 adds
  15 persisted chips that hide reader forms, `error_usage` words temporarily
  become colour-only, the quiz skip keeps `n/total` correct with no `n/0` case,
  and the quiz title becomes 測驗. Final pass: 26 files / 269 tests and 471
  browser checks. Revision 19 later restored the double strike; revisions
  21–23 finalized the form-chip controls.
- **Revision 18** (requested 2026-11-11:「那個水平分割綫不太對勁」): both
  dropdown option rows keep a constant hairline under hover and press — the
  tint is clipped to the padding box and the row no longer scales — so the
  divider neither darkens nor shortens. Final pass: 26 files / 269 tests and
  473 browser checks.
- **Revision 19** (requested 2026-11-11: “設定中所有的 border-bottom 都要刪除。
  製作一個水平綫的 .class 來替換掉 border-bottom” and “把所有錯誤的單詞加入雙刪除
  綫，請不要修改現在的顔色”): settings rows and dropdown options no longer
  carry a `border-bottom`; a global `.hrule` class draws each separator as a
  1px `aria-hidden` element in the `--line` colour, so a hover or press tint
  cannot paint over the line and a pressed row cannot shorten it. The
  dictionary's `error_usage` words keep their error colour and gain a double
  `line-through` on the base text (`rb` plus the kana spans), with the reading
  left unstruck and the strike drawn in the same error colour.
- **Revision 20** (requested 2026-11-11: “滑動條的位置在電腦的顯示怪怪，是否可以貼近
  box最右側的邊緣？ 另外修改下拉box的滑動條樣式。”, refined by “page-scrollbar
  是否可以放進去column内？因爲在電腦版會闖過外面column然後很醜”): the page thumb
  is drawn inside a framed column — 8px in from the box's right edge, with the
  track starting 32px from the top and bottom so the 28px corner radius never
  crosses it, and clear of the 24px content gutter so it cannot cut through a
  footer button; the full-bleed phone layout keeps its 3px/16px placement. Both
  dropdown lists hide the native bar and draw the page's own 4px rounded thumb
  (`src/ui/element-thumb.js` + `src/components/ScrollThumb.vue`), revealed
  while the list moves and faded a second later.
- **Revision 21** (requested 2026-11-11: the user's own note in `SettingsView.vue`
  「不要加綫，很醜！」 removed the separator above the 預設顯示形式 list; then
  「字典中，如果選擇 "預設顯示形式" 是 masu 形，"選擇顯示的類型" 就必須是要選擇。使用禁止按鈕，
  并且tooltips 提示 "預設顯示形式" 默認需要顯示這個之類的提示。」): the list opens
  straight under its row, and the current 預設顯示形式's chip in 選擇顯示的類型 is
  a disabled button with the tooltip 「這是預設顯示形式，必須顯示，不能取消」. The data
  layer re-adds the default form after any patch or restore that would drop it.
- **Revision 22** (requested 2026-11-11:「字典中的設置形式的按鈕非常丑，請你和
  “挑戰”功能的按鈕組進行對其」): the 選擇顯示的類型 chips now fill equal-width
  grid cells, like the quiz/測驗 settings' 錯 X 題就顯示答案 buttons, so their
  wrapping rows are flush and no chip shrinks to its label. The locked default
  chip and its tooltip are unchanged.
- **Revision 23** (requested 2026-11-11:「繼續優化UI」 with three concrete
  changes): 選擇顯示的類型's control follows the selection: 全選 selects 15 forms
  and reads 取消全選, which leaves only the current 預設顯示形式 and returns to
  全選; manual toggles update the label and the choice persists. The locked
  default chip keeps `aria-pressed="true"` and its tooltip but takes the picker's
  第1課 disabled look (transparent, muted text, divider border, opacity 0.45,
  no hover accent/pointer events). Both the settings and picker dropdowns show
  their drawn thumb on open, after scroll, and on pointer enter/move; each event
  restarts a two-second fade. A fitting list draws nothing, reduced motion keeps
  the appear/leave behavior without a transition, and the page thumb's separate
  one-second rule is unchanged. Backlog B3 remains pending for further UI work.

## Known limitations and unverified paths

- Real iOS/Android devices and Safari/Firefox were not tested; only Chromium.
  The revision-14 flash fix is verified by frame-by-frame traces (nothing moves
  after the settle) in headless Chromium; the visual “flash” itself was a
  mobile-GPU raster artifact and needs a real phone to confirm gone.
- **Double-tap zoom was not reproduced.** Chrome's double tap zoom is Android-only
  and never fires in headless Chromium: two quick taps leave `visualViewport.scale`
  at 1 even on a page with no zoom restrictions. Pinch *is* reproducible there
  (scale 1 → 5), and it is the automated evidence; the double tap is covered by
  the viewport meta and `touch-action: manipulation`, which the harness asserts
  directly. Confirmation on a real phone is still owed by the user.
- **The page is deliberately fixed-scale.** Pinch zoom is disabled by the
  viewport meta at the user's request, so the site cannot be magnified except
  through the browser's own accessibility override. That is a product decision,
  not an oversight.
- A real system IME was not exercised; composition handling is covered by pure
  `typingEdits` tests.
- GitHub Pages subpath deployment: `base` is pinned to
  `/game-japanese-katsuyou-basic/`, `npm run dev` redirects `/` to that subpath,
  `vite preview` serves it there, and `scripts/browser-check.mjs` starts at
  `/game-japanese-katsuyou-basic/` and asserts `document.baseURI` ends with it.
  A real `github.io` origin was still not exercised locally.
- Visual appearance was judged from computed styles and geometry, not from
  viewing screenshots (the agent cannot view images). The revision-28 logo was
  therefore checked by file type, dimensions, URL and HTTP response only; how
  the artwork reads at 16px in a real tab, and the iOS home-screen icon, were
  not inspected on a device.
- Plain-HTTP LAN origins: IndexedDB works but `crypto.subtle` does not, so boot
  stops on lesson 1 with `archive 2 cannot hash lesson_1.json`. Fixing that would
  require shipping a non-WebCrypto SHA-256 implementation, which is a new
  product rule and was deliberately not added. See `docs/serving.md`.

## Why serving the repository root fails

`index.html` at the repository root is the Vite entry: it loads `/src/main.js`,
which the browser cannot compile, and `/dict/vol.bin` does not exist there. The
archive is built into `output/dict/` only by the build. Use
`npm run dev`, `npm run preview`, or mount `output/` at
`game-japanese-katsuyou-basic/` behind any static file server.

The loading screen stops at `載入失敗（lesson 1）` when the first lesson cannot
be verified. Since the boot order is fixed, lesson 1 reports every early
failure. The loading screen prints the underlying reason under the lesson
number. Current causes:

| Cause | Detail shown |
|---|---|
| Serving the repo root | `dict/vol.bin` returns 404 |
| Stale/partial build | `output/dict/vol.bin` missing |
| Non-secure origin (`http://LAN-IP`, `file://`) | `archive 2 cannot hash lesson_1.json: Cannot read properties of undefined (reading 'digest')` because `crypto.subtle` is absent |
| Storage blocked/disabled | `IndexedDB is unavailable on this origin; storage is blocked or disabled` |
| Two downloads mismatch | stops and names the lesson; retry after clearing site data |

Troubleshooting steps: [`docs/serving.md`](serving.md).

## Spec-silent decisions (still worth confirming)

- Copy added where the spec is silent: `載入失敗（lesson N）`, `重試`, settings
  title `設定`, `檢查`, `答案`, the diagnostic detail line, and the
  該課沒有動詞 hint.
- Reading defaults for cards and quiz are **on** (the spec states the
  dictionary default explicitly and leaves the other two implicit).
- Download retries are two archive downloads for any failed entry; the archive is only fetched when at least one lesson is missing or corrupt.
- The loading bar holds at 100% while extracted entries are verified instead of showing a second phase; verification after the download is a ~100 ms step, and a second bar would invent copy the loading screen does not have.
- The 從 chip under 到 carries the tooltip text `這和「從」的形式相同，不能選為「到」`, and the tooltip wrapper (not the chip) owns the hover because the disabled chip ignores the pointer — the same pattern as the dictionary's 預設顯示形式 chip.
- Cards in the mounted window all paint their own tags, including the ones peeking in during a drag; the window's neighbours already carried per-slot tag data, so the visible change is only that the pill no longer waits for the release.
- The archive is not itself hashed; the 50 per-lesson hashes are the integrity gate, so a corrupt archive fails entry verification rather than blocking every lesson at once.
- Quiz keyboard fillers come from a unique kana pool; reading characters never
  duplicate.
- `nav.go` accepts an optional `mode` so home can open a picker in one command.
- Verb-less lessons still come from the archive and hash on boot (lessons 1, 3,
  8, 12), so `boot.checked` always reaches 50.
- The About sheet's copy is aligned to `docs/spec.md` (`提交ISSUE` →
  `/issues/`, thanks line `どうもありがとうございます。`).

Nothing else is known to deviate from `docs/spec.md`. If a different rule is
wanted, amend the spec first, then code and the browser suite.

## Revision 10 — Pages subpath base

`base` is pinned to `/game-japanese-katsuyou-basic/`, matching the repository
name, so the build is a GitHub Pages project site rather than a root-mounted
app. Supporting changes: the dev dictionary middleware strips the prefix before
matching (it accepts both forms), `scripts/browser-check.mjs` starts at
`http://localhost:PORT/game-japanese-katsuyou-basic/` and asserts
`document.baseURI` ends with the subpath, and the docs (serving, architecture,
README, AGENTS) now describe the subpath URLs, the `output/`-must-be-mounted-
at-the-subpath rule, and that `file://` no longer opens the build.

Evidence: `npm test` 191 tests / 20 files; `npm run build` → `output/index.html`
(0.55 kB, both asset refs prefixed `/game-japanese-katsuyou-basic/assets/…`) and
50 dict files; dev probe on :5330 → `/` 302 to the subpath, subpath index 200,
`dict/lesson_1.json` 200 JSON 38 bytes, `lesson_99.json` 404; `node
scripts/browser-check.mjs --screenshots` 260 checks, 0 FAIL, including "the
site is served under the Pages subpath".

Deliberately not done: no `.github/workflows` Pages deploy (user chose manual
publishing), and no repository rename handling beyond the single constant
(`base` in `vite.config.js` + `SITE_BASE` in the browser check).

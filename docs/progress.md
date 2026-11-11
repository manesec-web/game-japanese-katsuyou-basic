# Progress

Last updated: 2026-11-11 (revision 24, mobile overscroll suppression).

**Status: complete.** T1–T8 are done and revisions 2–24 have landed and been
verified, including follow-up UI passes A/B. The site is not published yet;
the remaining product step is to deploy `output/` to GitHub Pages. Backlog
B1–B3 remain `pending`; B3 is open for further, unspecified UI work.

The following revision summaries are historical. Revision 14 replaced the
paging follow/spring-back
(“跟手拖曳、短拖回彈、第一張卡阻力”) with an invisible drag and a direct swap
plus one short slide-in, and fixed the post-settle flash (“歸位後閃一下、再動
一次”). Revision 15 mounts a paging window around the current item — 9 cards in
翻卡學習, 5 words in the dictionary — keeps the current item in the 3rd slot and
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
backlog remains pending for further, unspecified UI work.

## Current state

- Vue 3.5 + Vite 7.3 + Vitest 3 static app. Verified with Node v26.4.0 and
  npm 11.18.0; Vite 7 requires Node `^20.19.0` or `>=22.12.0`.
- `npm test`: 28 files, **309 tests passing**. `pretest` verifies the 50-lesson
  SHA-256 manifest first.
- `npm run build`: `output/index.html`, `output/assets/` (one JS + one CSS
  bundle) and `output/dict/` with exactly **50** lesson files. `output/` is
  gitignored.
- `node scripts/browser-check.mjs`: **532 checks passing on the final run**
  (headless Chromium, 390×844 with 550/551/800/900 width probes, plus a touch
  context for the zoom lock and frame-by-frame motion assertions). The count
  can move by one because the seeded quiz item decides how many kana-key
  assertions run.
- `node scripts/motion-probe.mjs`: prints the frame-by-frame position trace for
  the paging slide and the flip. Used to measure the motion before and after a
  change; not part of the pass/fail gate.
- `node scripts/strike-probe.mjs`: the one-off screenshot probe that measured
  where the double strike is painted and confirmed the reading is unstruck.
  It is retained as a development diagnostic, not part of the pass/fail gate.
- Git: branch `main`, tracking `github/main`; history starts at commit
  `933c30b` (`init`). The GitHub Pages URL returned 404 when this document
  was refreshed, so the site has not been published yet.
- Dictionary cache is IndexedDB (`katsuyou-dict` / `lessons`, one record per
  lesson file); settings are in `localStorage` under `katsuyou-settings`.

## Verification as of this refresh

```bash
npm test                                # 28 files, 309 tests passed
npm run build                           # manifest ok: 50 lessons; output/index.html + 50 dict files
ls output/dict | wc -l                  # 50
node scripts/browser-check.mjs          # browser check passed (532 checks)
node scripts/motion-probe.mjs           # frame-by-frame motion traces (informational)
node scripts/write-sha256.mjs --check   # manifest ok: 50 lessons
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
  touch-capable Chromium checks (28 files / 309 tests, 532 browser checks);
  actual iOS Safari rubber-banding and Android hardware still need real-device
  verification. Chromium's compositor-owned, non-cancelable root moves are
  documented in the spec/architecture/changelog rather than presented as an
  iOS simulation. Pre-existing external `vol/` and generated-manifest changes
  seen during the final diff were not edited or reverted by this revision.

- **Revision 13**: the loading screen carries the site head
  (`大家の日本語` / `轉型練習` / `涵蓋初級 1 – 50 課的單詞`) and the credit line
  `Build with ❤ by Mane` (which opens the About sheet) but not the bug line;
  the first card in 翻卡學習 resists a right-hand drag (a third of the finger,
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
- **Revision 15**: the paging window — 9 cards in 翻卡學習 and 5 words in the
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
  viewing screenshots (the agent cannot view images).
- Plain-HTTP LAN origins: IndexedDB works but `crypto.subtle` does not, so boot
  stops on lesson 1 with `download 2 could not be hashed`. Fixing that would
  require shipping a non-WebCrypto SHA-256 implementation, which is a new
  product rule and was deliberately not added. See `docs/serving.md`.

## Why serving the repository root fails

`index.html` at the repository root is the Vite entry: it loads `/src/main.js`,
which the browser cannot compile, and `/dict/lesson_1.json` does not exist
there. The dictionary is copied into `output/dict/` only by the build. Use
`npm run dev`, `npm run preview`, or mount `output/` at
`game-japanese-katsuyou-basic/` behind any static file server.

The loading screen stops at `載入失敗（lesson 1）` when the first lesson cannot
be verified. Since the boot order is fixed, lesson 1 reports every early
failure. The loading screen prints the underlying reason under the lesson
number. Current causes:

| Cause | Detail shown |
|---|---|
| Serving the repo root | `dict/lesson_1.json` returns 404 |
| Stale/partial build | missing files under `output/dict/` |
| Non-secure origin (`http://LAN-IP`, `file://`) | `download 2 could not be hashed: Cannot read properties of undefined (reading 'digest')` because `crypto.subtle` is absent |
| Storage blocked/disabled | `IndexedDB is unavailable on this origin; storage is blocked or disabled` |
| Two downloads mismatch | stops and names the lesson; retry after clearing site data |

Troubleshooting steps: [`docs/serving.md`](serving.md).

## Spec-silent decisions (still worth confirming)

- Copy added where the spec is silent: `載入失敗（lesson N）`, `重試`, settings
  title `設定`, `檢查`, `答案`, the diagnostic detail line, and the
  該課沒有動詞 hint.
- Reading defaults for cards and quiz are **on** (the spec states the
  dictionary default explicitly and leaves the other two implicit).
- Download retries are two attempts for both a missing and a corrupt copy.
- Quiz keyboard fillers come from a unique kana pool; reading characters never
  duplicate.
- `nav.go` accepts an optional `mode` so home can open a picker in one command.
- Verb-less lessons still download and hash on boot (lessons 1, 3, 8, 12), so
  `boot.checked` always reaches 50.
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

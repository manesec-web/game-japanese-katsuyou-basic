# Roadmap

This project builds a static, phone-first site for drilling Japanese verb
conjugation. The source is Vue 3 + Vite; the built site in `output/` is
published to GitHub Pages. Behaviour is specified in `docs/spec.md`; the task
breakdown lives in `AGENTS.md`.

## Ground rules (do not drift from these)

- One task at a time, in order. Finish the acceptance checks before starting
  the next task.
- `.vue` files are thin: template and styles only. Behaviour lives in `.js`.
- Every user-visible action is a command with `id`, `params`, `enabled`, `run`.
  Screens and tests both go through `dispatch`.
- Commands never throw. They return `{ ok: true, result }` or
  `{ ok: false, error }`.
- `vol/*.json` is read-only dictionary input. Do not edit it. **One-time
  exception (revision 31):** a user-authorized native-teacher pass rewrote
  only `form.chinese` and one misleading `note`; see `AGENTS.md` and
  `docs/spec.md` Data. No future edit is authorized by it.
- No MCP, no backend, no LLM calls from the page.
- Do not copy the wireframe's blue boxes; follow the spec's look section.
- Text outside the green phone frame in the wireframes is annotation, not UI.

## Task board

Status values: `pending`, `in progress`, `done`, `blocked`.

| # | Task | Status | Acceptance evidence |
|---|------|--------|---------------------|
| 0 | Docs baseline (README, architecture, progress, changelog) | done | English docs present and kept current |
| T1 | Engine skeleton: Vite + Vue 3, `dispatch`, empty session, Vitest, build to `output/` | done | `npm test` passes (unknown command → `ok: false`); `npm run build` writes `output/`; `output/` gitignored; no logic in `.vue` |
| T2 | SHA-256 manifest script + `app.boot` (IndexedDB check/download/verify) | done | `--check` fails on tampered manifest, passes after restore; tests for missing file, match, one mismatch retry, double mismatch stop, empty-verb lessons |
| T3 | Loading screen, boot wiring, home screen, About sheet with GitHub link | done | Progress bar bound to `boot.checked / boot.total`; retry on failure; three mode entries; link opens in a new tab |
| T4 | Lesson picker: shared selection per mode, empty lessons disabled, `全選`, 從/到 form controls | done | Tests: lesson 1 not selectable; select-all skips empty lessons; 從 removed from 到; 開始 disabled without lessons/targets |
| T5 | Dictionary reader: swipe navigation, settings (default form, furigana), persistence | done | Tests: index clamps at both ends; browser check of swipe and reload persistence |
| T6 | Flashcards: face/back, tap to flip, swipe navigation, verb × target-form ordering | done | Tests: one card per (verb, target form); navigation resets to face; browser check |
| T7 | Quiz: keyboard generator, grading function, auto-submit, reveal-then-advance | done | Tests: all reading kana present as keys; seed changes distractor order; grading rules; auto-submit. Browser: correct answer, three misses, manual advance |
| T8 | Polish: motion, `prefers-reduced-motion`, final verification | done | `npm test`, `npm run build`, 50 files in `output/dict/`, `output/index.html` present |

## Order of work

1. Docs baseline.
2. T1 engine skeleton.
3. T2 hashing and boot.
4. T3 loading + home.
5. T4 picker.
6. T5 dictionary.
7. T6 cards.
8. T7 quiz.
9. T8 polish and verification.

All T-entries are `done`. The remaining product step is to publish `output/` as
the GitHub Pages site root; deployment notes are in `docs/development.md` and serving
caveats in `docs/serving.md`. Backlog B1–B3 still need a spec entry before any
new feature work (B3 remains open for further, unspecified UI work).

## Revision boards

Each revision started from a user review. Every task records its evidence in
`docs/changelog.md` (measurements, quoted requests, test counts).

### Revision 2 — UX changes (R1–R7)

| # | Change | Status |
|---|--------|--------|
| R1 | Spec + docs amended for all five changes | done |
| R2 | Reader lists all 15 forms (name, word, reading, gloss, 3 sentences each); duplicate 字典形 block removed; default form first and scrolled into view | done |
| R3 | Reader controls renamed 上一個 / 下一個 (cards stay 上一張 / 下一張) | done |
| R4 | Flashcard 3D page-turn (`rotateY` ~300ms), instant under reduced motion | done |
| R5 | 到 header row: 到 left, 全選 right, above the chip grid | done |
| R6 | Column full-bleed on narrow viewports (later refined to ≤550px in revision 3) | done |
| R7 | Final verification and docs reconciliation | done |

### Revision 3 — UI optimisation (U1–U9)

| # | Change | Status |
|---|--------|--------|
| U1 | ≤550px full-bleed with the background removed | done |
| U2 | 從/到 button sizing, empty-lesson hint 該課沒有動詞, 全選/取消全選 | done |
| U3 | masu-first defaults (從 and 預設顯示形式) | done |
| U4 | Shuffle card/quiz list once at 開始 | done |
| U5 | Reader default-form first, pinned pager, no desktop gesture | done |
| U6 | Card enter animation follows the swipe direction | done |
| U7 | 錯 X 題設定, countdown copy, answer panel covering the keyboard | done |
| U8 | Completion screens (quiz stats, card congrats, dict excluded) | done |
| U9 | Spec sync + full verification | done |

### Revision 4 — second UI pass (V1–V6)

| # | Change | Status |
|---|--------|--------|
| V1 | Home three-line head, second footer line, richer About sheet | done |
| V2 | Uniform reader blocks, `〜形` heading everywhere, pills only on the first block | done |
| V3 | Pinned footers: no underline, taller transparent fade above the buttons | done |
| V4 | Card buttons animate the page turn; answer always tagged with the asked form | done |
| V5 | 開始 hint when 到 is empty | done |
| V6 | Spec sync + verification | done |

### Revisions 5–10 — polish, motion, storage and deployment base

| # | Change | Status |
|---|--------|--------|
| 5 | Home copy, 36px control geometry, sticky top bars, purple 例句 highlight, parallel paging, completion emoji bands and confetti | done |
| 6 | Exactly one emoji above 恭喜…, 60px 返回主頁, flat paging, no horizontal scrollbar during card practice | done |
| 7 | Dictionary cache moved from OPFS to IndexedDB (works in private windows) | done |
| 8 | Paging from a flipped card: no 3D turn and no fade while travelling | done |
| 9 | Card answer always names the asked form and then the verb class | done |
| 10 | Base pinned to `/game-japanese-katsuyou-basic/` so the build deploys as a Pages project site; dev server, preview, dictionary fetch, browser harness and docs follow the subpath | done |
| 12 | Page draws its own 4px scrollbar (native hidden, inner dropdowns keep theirs, fades in on scroll and out after ~1s), the picker 從 label centres on the 36px form control, and a right-to-left swipe on the last card finishes the card run | done |
| 11 | Mobile Chrome comfort: fixed scale (no double-tap or pinch zoom), paging/card phases driven by DOM events instead of guessed timers, accelerating exit + decelerating entry (seam pace 9.2x → 1.0x), 140ms spring-back, single 240ms flip at `perspective: 1600px` | done |

### Revision 13 — first-card wall, loading head, backlog (requested 2026-11-11)

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 13a | The first card in 翻卡練習 resists a right-hand drag: a third of the finger travel, capped at 40px, springing back in ~140ms without changing the card; the dictionary reader and the last-card finish are untouched | done | 5 new pure tests in `src/ui/swipe.test.js`; browser check sees 20px at a 60px drag, 40px at a 180px drag, both at rest afterwards, 0px under reduced motion; `npm test` 21 files / 209 tests |
| 13b | The loading screen carries the site head (`大家の日本語` / `轉型練習` / `涵蓋初級 1 – 50 課的單詞`) and the `Build with ❤ by Mane` credit, which opens the shared About sheet; the bug line stays home-only; head and credit survive the failure screen | done | `SiteHead.vue`, `BuildFooter.vue`, `AboutSheet.vue` reused by home and loading; browser check asserts the four loading labels, "no bug line", survival on `載入失敗（lesson N）`, and the sheet opening/closing |
| 13c | Spec, changelog, progress, architecture, README, AGENTS and roadmap synced; the three requested future items recorded as backlog | done | `docs/spec.md` loading + card text; `docs/changelog.md` dated entry quoting the request; counts 209 tests / 379 checks everywhere |

### Revision 14 — paging without follow or bounce (requested 2026-11-10)

The user reported that the paging gesture hurt to watch on a phone: swiping the
word left, the next word slid in, settled, then flashed and settled again
("歸位完成之後就閃一下，然後在歸位"), and the follow/spring-back read as a strong
bounce that desktop never showed. The chosen fix: keep the swipe, remove every
follow and bounce visual, swap directly with one short slide-in. The spec was
revised before any code (it supersedes the 140ms spring-back from revision 11
and the first-card resistance from revision 13a).

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 14a | Spec revision: invisible drag, direct swap + one ~190ms slide-in past the 72px threshold, sub-threshold drags inert, no flash or second settle once the item rests, first-card backward drag completely still | done | `docs/spec.md` rewritten paging/motion clauses; this board; changelog entry |
| 14b | 字典 paging rebuilt in `ReaderView.vue` (no drag-follow, no leave phase, one slide-in; settle-flash fixed at its source: will-change teardown / scroll reset timing) | done | `checkSlide('dictionary page turn')` — no follow, one monotonic slide, `nothing moves after the settle`; `a 55px drag never moves the page`; first/last word walls stay put |
| 14c | 翻卡 paging rebuilt in `CardView.vue` (same motion; first card completely still; tap-flip and last-card finish unchanged) | done | `checkSlide('card turn')`; `the first card does not follow the drag` (60px and 180px both at 0px); tap-flip 3D checks and `swiping off the last card finishes the run` still pass |
| 14d | Tests and `scripts/browser-check.mjs` motion assertions updated to the new rule | done | `swipe.js` trimmed to threshold/direction resolution; `swipe.test.js` rewritten (first-card wall names no direction at any distance); `slideVerdict`/`checkSlide` replace the seam/pace assertions; dead `traceVerdict`/`checkTurn`/`checkSettle` removed |
| 14e | Verification: `npm test`, `npm run build`, browser walk-through at phone width | done | `npm test` 21 files / 205 tests; `npm run build` ok (`output/dict/` = 50, `output/index.html`); `node scripts/browser-check.mjs` 382 checks passing (390×844 + 550/551/800/900 probes + reduced-motion paths) |

### Backlog — requested next work

Requested by the user on 2026-11-11. B1 still needs a spec entry before
start; B2 was specified and delivered as revision 32. Follow-up passes A/B and revision 23 specified and delivered concrete
優化UI complaints, but the broader B3 backlog stays `pending` for any further,
unspecified UI work; it is not a blanket claim that every possible UI
improvement is done.

| # | Change | Status | What the spec has to settle first |
|---|--------|--------|----------------------------------|
| B1 | 朗讀功能 | pending | Which text is spoken (the form alone, `vol`, `japanese`, or a `sentence`), which engine (the browser's own `SpeechSynthesis`, since the site still allows no backend and no model call), and where the control sits on reader, card and quiz |
| B2 | 優化下載文件 | done (revision 32) | Settled: the 50 per-lesson files become one verified ZIP bundle; the per-lesson manifest, per-entry hashing, `app.boot` retry rule and `boot.checked / boot.total` all stay as they were |
| B3 | 優化UI | pending | Further screens and complaints beyond revisions 2–31 (including follow-up passes A/B, the 單詞目錄 screen of revision 30, and the revision-31 dictionary data pass); every new change is written into the spec's Look and motion section before code and the browser suite follow |

### Revision 15 — the paging window (requested 2026-11-10)

The phone paging rebuilt the whole page at the swap: the dictionary page is
fifteen form blocks, and 翻卡練習 rebuilt its card. The request: render several
items at once, keep the screen on the 3rd one, and make a swipe only delete the
item at one end and add one at the other. The window is deliberately invisible —
the spec keeps revision 14's motion, so nothing about what the user sees changes,
only how many items are already laid out when the swap happens.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 15a | Spec revision: "The paging window" — 9 cards in 翻卡練習, 5 words in the reader, current item in the 3rd slot, front-delete/back-append, ends render nothing, window invisible | done | `docs/spec.md` new section + `Look and motion` bullet; `Dictionary reader` and `Cards` cross-reference it |
| 15b | Pure window logic in `src/ui/window.js` (sizes, `CURRENT_SLOT`, `windowSlots`, `windowOffset`, `slotKey`, `shiftWindow`) | done | `src/ui/window.test.js` 13 tests: 3rd-slot invariant over every index/length, front-delete/back-append both directions, derived-shape equality, ends and unknown directions refused, `card.next/prev` + `dict.next/prev` ids and params unchanged |
| 15c | Per-slot data in `src/study/window-views.js` so the views stay thin | done | `src/study/window-views.test.js` 10 tests: one current slot, offsets 0/±100, every slot holds its own word/hand/gloss rather than a copy of the current one, tags per card, one new key per turn |
| 15d | 字典 and 翻卡 rebuilt on the window: the row is kept in state and shifted by `usePagingWindow` (one front delete, one back append per turn), no row translate, item-keyed slots, only the current item visible | done | browser check: 5 pages / 9 slots mounted, one current at x=0 and full width, 0 neighbours inside, neighbours hidden, per-slot words distinct |
| 15e | 前刪後補 proven at DOM level, not just in unit tests | done | 第4課 (6 words) and 第6課 (11 verbs) walk-throughs: the window slides one slot per turn, the front node leaves, exactly one node arrives at the back, survivors keep their identity marker |
| 15f | Verification and docs | done | `npm test` 24 files / 234 tests; `npm run build` ok (`output/dict/` = 50, `output/index.html`); `node scripts/browser-check.mjs` 411 checks passing; spec, changelog, progress, architecture, README, roadmap and AGENTS synced |

### Revision 16 — finger-tracking drag, Lucide, notes, docs pass (requested 2026-11-11)

The user review named seven items (quoted in `docs/changelog.md`), headed by
“單詞和字典的動畫不跟手，按住無法實現跟手的拖動（*重要”. Questionnaire answers:
dictionary **and** 翻卡 get the finger-tracking drag, the icon library is
Lucide (npm, inline SVG), and both note kinds are shown. This supersedes
revision 14's invisible drag and slide-in.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 16a | Finger-tracking drag in 字典 + 翻卡: strip follows the finger 1:1 while held (clamped to one item width), release past 72px finishes the page as one ~190ms settle from where the finger left it, sub-threshold releases settle back, walls (first card, first/last word) stay completely still at any distance; first-card rule, last-card finish and reduced motion unchanged | done | `src/ui/drag.test.js` 9 tests (axis slop, 1:1 follow, clamp, walls, release naming); browser check `settleVerdict` traces: held≈dx, settle continues from `width − 120`, one monotonic move to rest, `nothing moves after the settle`, walls at 0px; `docs/spec.md` paging clauses rewritten first |
| 16b | `←` / `⚙` glyphs replaced by Lucide (`ArrowLeft`, `Settings`) in all five views, inlined at build time | done | `lucide-vue-next` in the bundle (no CDN); browser check `iconGlyphs` on picker/dictionary/settings/cards/quiz: one `svg.lucide` per icon button, no text glyph left |
| 16c | Completion emoji enlarged (2rem → 4rem) | done | browser check `the completion emoji is drawn large` ≥ 56px on card and quiz completion |
| 16d | Dictionary block: word / gloss / tags centred; form `note` above 例句 and sentence notes under the Chinese line, both in the `--note` colour and left-aligned; `error_usage` words get a double strikethrough with no colour change and no 例句 block | done | `reader-forms.test.js` +5 (note/error_usage passthrough); browser check: centring, note above sentences in `rgb(180, 83, 9)`, `line-through` + `double` in the ink colour, error forms without sentences; `vol/` untouched |
| 16e | 提交ISSUE links to `.../issues/` (the issue list), no longer to the new-issue form | done | browser check on both About sheets; `grep` finds no new-issue-form URL in docs/src/scripts |
| 16f | Docs pass (spec, changelog, progress, roadmap, architecture, AGENTS) and `README.md` rewritten to reference `docs/` | done | this board; `docs/changelog.md` 2026-11-11 entry; counts synced at 241 tests / 443 checks |

### Revision 17 — card neighbours render, 24px gap, full-bleed paging

The user reported the card follow without neighbours (「練習的卡片跟手但是滑動沒有出現
其他的卡片」) and the side-padding gutter during a drag (「卡片拖動到左邊的時候，可以
看到有column的padding 拖動的時候很醜；字典是否也可以這樣做？」).

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 17a | Card paging window paints its neighbours: real minimum height replaces the zero-height `height:100%`, slot faces hit-testable, no raised current slot | done | touch probe hits the neighbour's own face during a held drag (`elementFromPoint`), not just a visible transform; the zero-height clip is documented in `docs/changelog.md` |
| 17b | 24px inter-item gap on both screens, outside the item (fixed px, not a viewport %) | done | `src/ui/window.test.js` +1 and `window-views.test.js` geometry; browser check `dragNeighbour.gap === 24` both directions; settle pitch reads the row width |
| 17c | Full-bleed paging surface while dragging: `--page-gutter` on the column, negative margins on the stage/body, content-width window inside | done | browser check `clipFillsViewport` during the held drag on card and dictionary; at-rest geometry unchanged (`currentLeft === 0`, content fills the window) |

### Follow-up pass A — UI: error-word skipping, card tags and quiz feedback (2026-11-11)

A follow-up UI goal added the per-mode 跳過錯誤的單詞 switch and several
small visual corrections. Its spec clauses were written before the code; the
final behaviour is in `docs/spec.md` and the final verification is revision 23.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| A1 | ChevronDown in both dropdowns, ChevronLeft/Right in the reader and card footers, and the first framed desktop page-thumb placement; the reader strip loses its extra `- 8px` inset so the paging seam does not flash | done | browser checks for Lucide glyphs, gap-accurate paging and framed thumb placement; `src/ui/scrollbar.js` geometry tests |
| A2 | 跳過錯誤的單詞 in dictionary, card and quiz settings; `orderedFormEntries()` hides flagged forms, `buildItems()` filters flagged card/quiz pairs, and a live quiz keeps answered items while moving skipped items out of or back to the tail | done | `reader-forms.test.js`, `items.test.js` and `src/commands/settings.test.js`; browser checks in all three modes and for mid-run toggling |
| A3 | Card answer tags become form, class, 第N課 and (for error items) 錯誤單詞; quiz title becomes 測驗（n/total）; wrong answers shake and redden the input instead of showing 回答錯誤; completion counts only resolved items | done | `card-tags.test.js`, `window-views.test.js`; browser checks for tags, title, shake/red, no wrong-answer toast and score tallies |
| A4 | Spec, tests and build/browser verification for the pass | done | `npm test` 26 files / 261 tests; `npm run build` with 50 dict files and `output/index.html`; `node scripts/browser-check.mjs` 469 checks passing; `docs/spec.md` updated |

### Follow-up pass B — dictionary display-form filter and corrections (2026-11-11)

The next goal restored 預設顯示形式 as a dropdown and added 選擇顯示的類型. It
also changed error words to colour-only after revision 17a, before revision 19
restored the double strike. Its other corrections survive in the final spec.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| B1a | Dictionary settings keep a 15-form 預設顯示形式 dropdown and gain a 15-chip 選擇顯示的類型 filter; deselected forms are omitted from the reader and the selection persists | done | `src/dict/settings.js` validation and reader-filter tests; browser checks for the dropdown, chips, filtering and reload persistence |
| B1b | `error_usage` words use the dedicated `--error` colour; quiz skip keeps the displayed total correct when the current item is removed, with no `n/0` title; the quiz title reads 測驗 rather than 練習 | done | browser checks for error colour, mid-run skip, corrected total and quiz title |
| B1c | Spec and verification for the pass | done | `npm test` 26 files / 269 tests; `npm run build` ok; `node scripts/browser-check.mjs` 471 checks passing; later revisions 19–23 refine the error-word decoration and display-form controls |

### Revision 19 — drawn separators in settings, double strike on error words (requested 2026-11-11)

The user asked for two visual changes: “設定中所有的 border-bottom 都要刪除。製作一個
水平綫的 .class 來替換掉 border-bottom” and “把所有錯誤的單詞加入雙刪除綫，請不要修改
現在的顔色”. Answered design questions: the horizontal-line class is global in
`src/styles/app.css` and replaces the settings separators only (the picker keeps
its own), and the double strike applies to the dictionary reader's word only
(not the card back or the quiz result rows).

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 19a | Global `.hrule` class draws each settings separator as its own 1px element; `border-bottom` removed from `.row` and `.form-option`, along with the `:last-child` override and the `background-clip` workaround; the template inserts the rule between entries | done | browser probe on all three modes (dictionary 4 rows/3 rules closed, 4/15/18 open; cards 3/2; quiz 4/3): every rule 1px `rgba(36,33,58,0.12)`, `aria-hidden`, no border of its own, no row or option with a bottom border; browser check asserts the same plus a pressed option keeps its width and position |
| 19b | `error_usage` words keep the error colour and gain a double `line-through` on `rb` plus the plain kana spans; `rt` stays unstruck; decoration colour stays `currentColor` | done | computed styles on the built site: `rb`/kana `line-through`/`double`/`rgb(220,38,38)`, `rt` `none`; screenshot probe (blue decoration override) found two 3px bands at 57–59 and 61–63 inside the base band 39–74 and none in the reading band 22–39; browser check asserts every error word met while paging |
| 19c | Spec, changelog, progress, architecture, roadmap and AGENTS resynced | done | `docs/spec.md` reader clause and Look-and-motion separator clause rewritten before the code; changelog revision 19; `grep` finds no "keeps no strike" / "instead of being struck through" left; `npm test` 26 files / 269 tests, `npm run build` ok (50 dict files), `node scripts/browser-check.mjs` 479 checks passing |

### Revision 20 — page thumb inside the frame, drawn thumbs in the dropdown lists (requested 2026-11-11)

The user reported the desktop placement (「滑動條的位置在電腦的顯示怪怪，是否可以貼近box最右側的邊緣？
另外修改下拉box的滑動條樣式。」) and refined it after the first pass (「page-scrollbar
是否可以放進去column内？因爲在電腦版會闖過外面column然後很醜」): the thumb belongs inside
the box. Answered: the desktop thumb sits inside the column (not on its edge), and
the dropdown lists use the same drawn thumb as the page, hidden native bars.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 20a | Page thumb placement: framed desktop draws it 8px inside the column's right edge with a 32px track inset (> the 28px corner radius), clear of the 24px content gutter so it cannot cross a footer button; full-bleed phone layout unchanged (3px / 16px) | done | `src/ui/scrollbar.test.js` (+4: framed inset, `isFramed` ×3, `trackInset` ×2); browser probe: gap 8px at 700/900/1200 and 3px at 390, track start 32px at scroll 0, inside the column, no footer control crossed; browser check asserts the same |
| 20b | 兩個下拉清單 hide the native bar and draw the page's 4px rounded, fading thumb (`listThumbMetrics`, `useElementThumb`, `ScrollThumb.vue`, `.form-list-frame`) | done | `scrollbar.test.js` +6 (fits → nothing, track inset, share, ends, minimum, clamp); probe: `scrollbar-width: none`, thumb 4px with 4px insets, reveals on scroll, fades after 1.3s, reduced motion keeps it at `transition: 0s`; browser check covers both lists |
| 20c | Spec, changelog, progress, roadmap, architecture, AGENTS resynced | done | spec clauses for the page bar and the two lists rewritten before the code; `grep` finds no "keep the native bar" / 24px-inset prose left; `npm test` 26 files / 280 tests, `npm run build` ok (50 dict files), `node scripts/browser-check.mjs` 489 checks passing |

### Revision 21 — no rule above the form list, locked 預設顯示形式 chip (requested 2026-11-11)

The user removed the separator above the 預設顯示形式 list in the source itself
(`<!-- 不要加綫，很醜！ -->`), then asked:「字典中，如果選擇 "預設顯示形式" 是 masu 形，
"選擇顯示的類型" 就必須是要選擇。使用禁止按鈕，并且tooltips 提示 "預設顯示形式" 默認需要顯示這個
之類的提示。」

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 21a | The 預設顯示形式 list opens directly under its row: no `hrule` between the row and the panel (the user's own edit, kept), the separators between options unchanged | done | browser check: `ruleAboveList === false` plus the rule count `rows - 1 + options - 1`; spec clause names the panelless gap |
| 21b | The current 預設顯示形式's chip in 選擇顯示的類型 is a disabled button (`chip--locked`) with the tooltip `這是預設顯示形式，必須顯示，不能取消`; `toggleDisplayForm` guards it and `applyPatch`/`normalizeSettings` keep `defaultForm ∈ displayForms` | done | `settings.test.js` +4 (patch adds a new default, restores a removed one, clears to the default only, repairs a stored selection); browser check: chip disabled and still pressed, no other chip disabled, tip text via `aria-describedby` hidden until hover, lock follows a new default and the freed chip toggles |
| 21c | Spec, changelog, progress, roadmap, architecture, AGENTS resynced | done | spec 選擇顯示的類型 + reader clauses rewritten first; `npm test` 26 files / 284 tests, `npm run build` ok (50 dict files), `node scripts/browser-check.mjs` 497 checks passing |

### Revision 22 — dictionary settings chips aligned with the quiz button group

The user reported 「字典中的設置形式的按鈕非常丑，請你和“挑戰”功能的按鈕組進行對其」.
There is no feature named 挑戰 in the product; the reference is the quiz/測驗
settings' 錯 X 題就顯示答案 button group, whose buttons are equal-width and
flush with the row. The dictionary's 選擇顯示的類型 chips previously shrank to
their labels inside equal grid cells and left ragged gaps.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 22a | `SettingsView.vue`: the 15 dictionary chips fill their grid cells (`width: 100%`, `min-width: 0`), a 112px minimum track clears the longest form name, and the tooltip wrapper cannot widen a track | done | browser check: equal widths, each chip flush with its wrapper, labels do not overflow, and full rows flush with the group's left/right edges |
| 22b | Spec, architecture, changelog, progress, roadmap, AGENTS resynced | done | spec 選擇顯示的類型 clause records the equal-cell alignment; `npm test` 26 files / 284 tests, `npm run build` ok (50 dict files), `node scripts/browser-check.mjs` 501 checks passing |

### Revision 23 — select-all state, locked-chip look, dropdown thumb hints (requested 2026-11-11)

The user asked to continue 「優化UI」 with three concrete changes:「在設定的
"選擇顯示的類型" 全選的按鈕，按一下要變成取消全選，另外禁止的按鈕要和第一課禁止的
按鈕一樣」 and 「點擊下拉框的時候，下拉框的滑動條要顯示，然後几秒後再消失，鼠標移動
進去也要顯示，因爲這樣可以告訴人原來下面還有内容」. The decisions below were
confirmed before implementation. This is a narrow revision of those controls;
backlog B3 (優化UI) remains `pending` because it covers further, unspecified UI work.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 23a | Spec first: state-based 全選／取消全選 in Dictionary settings; locked chip looks exactly like the disabled 第1課 chip while remaining selected and showing its tooltip; both dropdown thumbs reveal on open, fade after about 2s, and reveal again on pointer enter/move | done | `docs/spec.md` Dictionary settings + Look and motion clauses rewritten and re-read before code; 27 files / 296 unit tests, 50 dict files, 527 browser checks; backlog B3 remains `pending` |
| 23b | 選擇顯示的類型: 全選 selects all 15 and becomes 取消全選; 取消全選 leaves only `defaultForm` and returns to 全選; individual toggles also update the label; settings stay valid and persist | done | `settings.test.js` +4 and `src/commands/settings.test.js` +1; browser checks cover label, click, manual toggle, localStorage persistence, reload, one default-form reader block; 296/296 unit tests pass |
| 23c | The locked 預設顯示形式 chip adopts the disabled 第1課 look (transparent, muted text, divider border, 45% opacity, no hover accent, no pointer events) while keeping `disabled`, `aria-pressed="true"`, its tooltip and wrapper hover | done | browser computed-style comparison against real `.chip--empty:disabled` at rest and on hover; 15 equal-width chip, pressed-state, tooltip, wrapper-hover, reader-block checks pass |
| 23d | Both dropdown lists reveal a scroll thumb immediately when an overflowing list opens; scroll and pointer enter/move restart an about-2s fade; a fitting list draws nothing; reduced motion keeps appear/leave without transition | done | `src/ui/element-thumb.test.js` +6 fake-timer tests and +1 timing test in `scrollbar.test.js`; browser checks on both lists for open, ~2s fade, pointer reveal/reset, scroll, fitting list, reduced motion; page thumb's separate ~1s checks pass |
| 23e | Documentation and final verification | done | `docs/changelog.md`, `docs/progress.md`, `docs/architecture.md`, `docs/roadmap.md` and `AGENTS.md` updated; manifest check, 296 tests, build (50 dict files + `output/index.html`), 527 browser checks pass; `vol/` unchanged and `output/` remains gitignored |

### Revision 24 — mobile overscroll suppression

The user asked to try disabling Android/iPhone scroll behavior, especially the
iOS rubber-band effect. The chosen scope keeps all required vertical reading
and dropdown scrolling while suppressing root overscroll and pull-to-refresh;
it is not a whole-page scroll lock. The spec's Look and motion section was
amended before code.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 24a | Root `overscroll-behavior-y: none`; both form dropdowns contain overscroll but remain scrollable; existing `manipulation`/`pan-y` and drawn thumbs stay | done | `src/styles/app.css`, `PickerView.vue`, `SettingsView.vue`; browser computed-style and real-touch list checks |
| 24b | `src/ui/scroll-guard.js`: non-passive iOS `touchmove` guard for predicted one-finger vertical boundary crossings, exact-edge settling, no body lock, no global cancellation; main.js attaches/detaches cleanly | done | `src/ui/scroll-guard.test.js` covers page/list boundaries, normal scrolling, horizontal gestures, multi-touch, non-cancelable events, lifecycle and short pages |
| 24c | Tests, browser regression and docs | done | 28 files / 309 unit tests; build with 50 dictionary files; 533 browser checks including five touch/overscroll checks; iOS rubber-band behavior still needs real-device verification |

### Revision 25 — short screens fit the dynamic viewport

The user reported that on iPhone 18 Pro, short screens such as settings and
翻卡練習 still scroll vertically even though their content fits. The outer shell
was sized to the static `100vh` while home/loading already used `100dvh`; iOS
measures `vh` against the large viewport, so a visible toolbar added a
browser-chrome-sized overflow to short screens. The spec's Look and motion
section was amended before code.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 25a | `body`, `#app` and the framed/mobile `.column` use `min-height: 100dvh` (framed `calc(100dvh - 40px)`) with `100vh` retained as the fallback; home/loading already agreed | done | `src/styles/app.css`; `npm run build` ok; no `vol/` edit |
| 25b | Browser regression: a fresh 翻卡練習 run must not produce a vertical overflow, and `body`/`#app` min-heights resolve to the viewport | done | `scripts/browser-check.mjs` new card short-page check; 533 checks passing |

The view stays thin: selection and reveal rules live in `.js`, and user-visible
actions go through `dispatch`. No backend, MCP or model call is added, and
`vol/` is read-only apart from the one-time revision-31 `chinese`/`note`
exception recorded above. If a behavior below is not specified, stop and ask
instead of inventing a rule.

### Revision 26 — draggable scrollbars, no-lesson start state, snappier card drag

Requested 2026-11-12. The drawn scrollbar could not be grabbed with a mouse, a
wheel-less pointer needed the bar to appear on approach, the user asked whether
the 翻卡練習 drag felt delayed, and the `請至少選擇一門課程才可以開始` line was
to be removed with the disabled 開始 button turned red-outlined and transparent
(and labelled `請至少選擇一個轉型才可以開始` when 到 is empty).

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 26a | Page thumb: proximity reveal, no-jump mouse drag with pointer capture, hidden-thumb pointer transparency, touch stays passive | done | `src/ui/page-scrollbar.js`, `src/ui/scrollbar.js`, `src/components/PageScrollBar.vue`; scrollbar unit tests + browser drag/proximity/coarse-pointer checks |
| 26b | Dropdown thumbs drag the same way (offset minus inset, capture, no jump) | done | `src/ui/element-thumb.js`, `src/components/ScrollThumb.vue`; element-thumb tests + browser drag checks |
| 26c | Held card/reader offset painted synchronously in the pointer event | done | `src/ui/drag.js` `paintRowOffset`; `src/views/CardView.vue`/`ReaderView.vue`; browser same-task transform check |
| 26d | Remove no-lesson warning; red-bordered transparent disabled 開始 (labelled `請至少選擇一個轉型才可以開始` when 到 is empty) until valid | done | `src/dict/settings.js`, `src/views/PickerView.vue`; settings tests + browser red/primary checks |

### Revision 27 — site title becomes 動詞轉型練習 (requested 2026-11-12)

The user asked to rename the title: 「標題從“轉型練習” 改成“動詞轉型練習” 并且更新
文檔」. The head keeps its three-line structure and type scale; only the words
change, and the historical revision rows above keep their original wording.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 27a | `SiteHead.vue` subtitle and `index.html` document title read `動詞轉型練習`; loading and home both inherit it | done | no bare `轉型練習` left in `src/`, `scripts/`, `index.html`; 320–800px width probes show a centred line with no clipping and no horizontal overflow |
| 27b | Browser harness expects the new subtitle | done | `PORT=5299 node scripts/browser-check.mjs` — 549 checks passing, `loading shows the subtitle` included |
| 27c | Current-behaviour docs synced (spec loading/home head, `AGENTS.md` T3, `README.md` title); historical entries untouched | done | `docs/spec.md`, `AGENTS.md`, `README.md`; changelog revision 5 / roadmap 13b / progress revision 5 keep the old wording |
| 27d | Verification | done | `npm test` 28 files / 317 tests; `npm run build` ok (`output/index.html` + 50 dict files) |

### Revision 28 — tab title and site logo (requested 2026-11-12)

The user asked for the page title to read `大家の動詞轉型練習` and for
`docs/logo/logo.jpg` to be the site's logo, allowing other formats to be
written into that folder. This touches the document head and one line of the
shared head only: no command, session field, dictionary byte, layout rule or
icon-library entry moves, so the unit suite stays unchanged.

| # | Change | Status | Acceptance evidence |
|---|---|---|---|
| 28a | `index.html` document title reads `大家の動詞轉型練習` | done | `output/index.html` carries the new `<title>`; browser check `the document title is 大家の動詞轉型練習` |
| 28b | Logo converted inside `docs/logo/` — `favicon.ico` (16/32/48px), `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png` (180px), `logo-512.png` — and the first four declared in `index.html` with relative hrefs | done | Vite emits hashed copies under `output/assets/` with the `/game-japanese-katsuyou-basic/` prefix; browser checks assert every icon URL lives under the subpath and each answers 200 with an `image/*` content type |
| 28c | Loading and home lede reads `涵蓋初級 1 – 50 課的動詞` | done | `src/components/SiteHead.vue`, the spec's loading/home clauses and the `AGENTS.md` T3 line; browser check `loading shows the description` |
| 28d | On-screen head otherwise untouched: still three lines, still no image | done | `SiteHead.vue` markup unchanged apart from the lede string; `docs/spec.md` Build section states the logo is the tab mark only |
| 28e | Verification | done | `npm test` 28 files / 317 tests; `npm run build` ok (`output/assets/` holds the four hashed icons, `output/dict/` = 50); `PORT=5299 node scripts/browser-check.mjs` 550 checks passing, 0 failures |

### Revision 29 — card face tag above the word (requested 2026-11-12)

The user asked that the unflipped card's tag sit above the word, in the same
position the answer's tags occupy. Only the face's vertical order moves; the
pill, its wording and the 變成 prompt stay the same.

| # | Change | Status | Acceptance evidence |
|---|---|---|---|
| 29a | `CardView.vue` renders the face `.tags` before `.word` (tag → word → 變成 prompt) | done | browser check `the face tag sits above the word like the answer` |
| 29b | Spec + harness updated | done | `docs/spec.md` Cards face clause; `scripts/browser-check.mjs` position assertion; `npm test` 28 files / 317 tests; build ok; 550 browser checks, 0 failures |

### Revision 30 — 單詞目錄 beside the reader's settings gear (requested 2026-11-13)

The user asked for a word index next to the dictionary reader's settings gear,
listing the words of the chosen lessons so they can jump to one. Confirmed
before code: its own screen with a back button, rows of word + 第N課 tag grouped
by lesson, and the run's frozen list as the source.

| # | Change | Status | Acceptance evidence |
|---|---|---|---|
| 30a | Spec first: `toc` on the state-machine line, the reader bar gains 目錄, a full 單詞目錄 section, Lucide `List` in the icon list | done | `docs/spec.md` screens / Dictionary reader / 單詞目錄 / Look and motion clauses, re-read against the three confirmed answers before code |
| 30b | `tocGroups` pure helper + 6 tests | done | `src/study/toc.js`, `src/study/toc.test.js` |
| 30c | `dict.goto` jumps by index (`invalid-index` outside the list) and `nav.go` reaches `toc` only from the reader; `SCREENS` lists `toc` | done | `src/commands/dict.js`, `src/commands/nav.js`, `src/engine/session.js`; `src/commands/dict.test.js` 10 tests, `src/commands/nav.test.js` 4 tests |
| 30d | `TocView.vue`, the reader's 目錄 button and the `toc` route, styled per spec (44px outlined rows, 8px spacing, lesson headings, current mark) | done | `src/views/TocView.vue`, `src/views/ReaderView.vue`, `src/App.vue`; 386-word probe: 46 groups, current row visible, `scrollY 0` after a jump, sticky bar at 0 |
| 30e | 16 new browser checks for the list | done | open/title/no gear/sticky bar, grouping, row words + tags, single current mark, 44px + 8px + no divider, back, jump, list marks the current word, first row returns |
| 30f | Verification | done | `npm test` 30 files / 331 tests; manifest ok (50); `npm run build` ok with 50 dict files; `node scripts/browser-check.mjs` 565/566 checks passing, 0 failures |

### Revision 31 — per-form Chinese glosses (requested 2026-11-13)

Requested: 「你是日本母語的老師，請你修改每一個單詞下面的中文…每一個動詞都有他的意思，但是變形后意思就不一樣了。」Confirmed with the user: a natural full translation per form, all 50 lessons, only `form.chinese` plus beginner-misleading `note`; example sentences and Japanese untouched; manifest, spec and docs regenerated.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 31a | Spec first | done | `docs/spec.md` Data defines per-form `chinese`, corrected `note`, the 191 error markers and unchanged sentences |
| 31b | Data pass, 5 batches | done | 5,420 `chinese` values + 1 `note` changed; 191 error markers; the temporary plan/validator passed on all 50 lessons with 0 immutable-field changes before being removed |
| 31c | Native-teacher edge cases | done | 44 hand-reviewed paradigms, adversative/honorific/concessive/optative/spontaneous classification, stative negatives, 3 already-inflected base glosses, rare-form suffixes |
| 31d | Docs + manifest | done | `README.md`, `AGENTS.md`, `docs/architecture.md`, `docs/progress.md`, `docs/serving.md`, `docs/changelog.md`, this board; `node scripts/write-sha256.mjs` re-run |
| 31e | Full verification | done | `node scripts/write-sha256.mjs --check` ok; `npm test` 30 files / 331 tests; `npm run build` ok with `output/index.html` + 50 dict JSON; `node scripts/browser-check.mjs` 574 checks, 0 failures (8 new per-form gloss checks); see `docs/progress.md` |
| 31f | Temporary artifacts removed | done | The rewrite plan, frozen baseline, doubt list and the two one-off scripts were deleted at the user's request; the resulting `vol/` data, spec, manifest and browser checks remain |

### Revision 32 — one verified dictionary archive (requested 2026-11-13)

The user proposed 「在編譯的時候，輸出一個 vol.bin 之類的放在公開目錄中。然後瀏覽器就可以使用
unzipit 來解壓這個文件，然後存進去IndexedDB中」 to cut the first-load download. Measured
first: the 50 lesson files are 4,899,916 bytes; a level-9 ZIP of the same bytes is about
550 KB (11.5%), so one request replaces 50. Confirmed before code: no per-lesson fallback
files stay, `unzipit` + ZIP (not a custom container), the archive lives at
`dict/vol.bin` beside the site, per-lesson manifest hashes are unchanged, and the build
verifies `vol/` before packing.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 32a | Spec first: "How the dictionary reaches the browser" rewritten — one archive, two-phase boot, per-entry hashing, retry once, unchanged progress meaning; "no per-lesson fallback" recorded | done | `docs/spec.md` rewritten and re-read before the code; `docs/architecture.md` Dictionary delivery follows |
| 32b | `scripts/zip.mjs` deterministic ZIP writer (fixed 1980-01-01 stamps, deflate 9, CRC-32, central directory, no zip64) + `scripts/vol-archive.mjs`, which verifies every lesson's SHA-256 against the manifest before packing and throws on a mismatch, a missing source or an empty manifest | done | `scripts/zip.test.js` 6 tests (unzipit round-trip, byte-identical output, CRC check value, compression ratio, empty archive) and `scripts/vol-archive.test.js` 6 tests (50 entries, reproducible sha256, tampered manifest, empty manifest, missing source) |
| 32c | `scripts/write-vol-archive.mjs` CLI (`--check`, `--out`) prints lessons, raw→zip sizes and the archive sha256 | done | `node scripts/write-vol-archive.mjs --check` → `checked 50 lessons: 4.65 MB -> 549 KB (11.5%)` |
| 32d | Vite plugin serves `dict/vol.bin` in dev (rebuilds when `vol/` or the manifest changes) and writes `output/dict/vol.bin` on build; the 50-file copy is gone | done | dev archive byte-identical to `output/dict/vol.bin`; `output/dict` holds only `vol.bin` |
| 32e | `src/dict/archive.js` wraps `unzipit` (`useWorkers: false`, lazy entry reads); `boot.js` finds missing/corrupt lessons first, then downloads once, verifies each entry, stores only matches, retries once, and stops naming the first lesson that failed twice | done | `src/dict/archive.test.js` 3 tests (real archive round-trip + manifest hashes, `has`/missing entry); `src/dict/boot.test.js` 14 tests (one download, cache reuse, corrupt copy repair, download retry, wrong bytes then good, two mismatches stop without writing, absent entry, unreadable archive, write failure, empty-verb lessons, progress callback, empty manifest, dispatch envelopes) |
| 32f | Browser harness follows the new URL: one archive request, no per-lesson request, zip content type, `PK\x03\x04` header + 50-entry end record, `output/dict` holds only the archive, failure path aborts the archive twice, private window counts one archive download, progress sampled from document start | done | `PORT=5299 node scripts/browser-check.mjs` 580 checks passing, 0 failures |
| 32g | Docs synced: spec, architecture, `AGENTS.md` (layout, `app.boot`, T2, T8), `README.md`, `docs/serving.md`, `docs/progress.md`, `docs/changelog.md`, this board; backlog B2 closed | done | `npm test` 33 files / 349 tests; `npm run build` (`output/dict/vol.bin`, `output/index.html`); manifest check ok; 580 browser checks |
| 32h | Renamed `vol.zip` → `vol.bin` and switched its Content-Type to `application/octet-stream`, because download-helper browser extensions sniff `.zip` URLs and hijack them with a save dialog (follow-up request); the bytes, the ZIP format, the manifest and the boot rule are unchanged | done | `ARCHIVE_NAME` / `ARCHIVE_FILE` hold `vol.bin`; dev + preview serve `application/octet-stream`; browser check asserts one binary request, the `PK\x03\x04` header and 50 entries, `output/dict` holding only `vol.bin`; `npm run build` writes `output/dict/vol.bin` |

### Revision 33 — the loading bar shows the download (requested 2026-11-13)

Follow-up request: 「另外，可以做到下載的進度條嗎？」 Before revision 32 the bar
was verified lessons / 50, and it could sit still for the whole 550 KB download.
The bar now shows the slow step it is actually waiting for, without ever moving
backwards and without new visible copy.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 33a | Spec first: the loading bar rule — cache-check progress, then streaming bytes against `Content-Length` starting from the cache-check percentage, then a hold at 100% while extracted entries are verified; no `Content-Length` holds the bar; a retry restarts at the already-verified percentage | done | `docs/spec.md` How the dictionary reaches the browser, re-read before code |
| 33b | `app.boot` streams `dict/vol.bin` (`response.body.getReader()`, chunks joined once), reporting `(loaded, total)`; `session.boot.download = { base, loaded, total, done }` carries the phase; each attempt recomputes `base` from verified lessons and resets the counters | done | `src/commands/boot.js`, `src/dict/boot.js`, `src/engine/session.js`; `src/dict/boot.test.js` +2 (byte reports and the 20-lesson base), callback count still one per verified lesson |
| 33c | `src/ui/boot-progress.js` computes the percentage as a pure function; `LoadingView.vue` only renders it | done | `src/ui/boot-progress.test.js` 8 tests: idle, verified-only, 1/50 rounding, byte fraction, base offset, unknown length, done hold, retry reset, clamping |
| 33d | Browser harness: the bar is sampled from document start (width + timestamp), must start at 0, reach 100 and never move backwards; a throttled boot (CDP `Network.emulateNetworkConditions`, 200 KB/s) must show ≥3 intermediate widths spread over ≥700 ms, which verification alone cannot produce | done | `PORT=5299 node scripts/browser-check.mjs` **584 checks passing**, 0 failures |
| 33e | Docs synced | done | spec, `docs/architecture.md` (boot-progress + bar rule), `docs/development.md`, `docs/progress.md`, `docs/changelog.md`, this board; 34 files / 360 unit tests |

### Revision 34 — locked 到 chips, 翻卡練習, immediate class pill (requested 2026-11-13)

A four-part UI request: (1) in the card and quiz picker, the chip under 到 that
equals 從 must be disabled with a tooltip, using the dictionary settings'
locked-chip logic; (2) the mode is renamed 翻卡學習 → 翻卡練習 everywhere;
(3) with 一開始顯示幾類動詞 on, the incoming card's class pill only appeared at
release, so fix it to be drawn while the card slides in; (4) sync every
markdown file. The spec was amended before the code.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 34a | Spec first: 到's own-form chip is disabled, unselected, skipped by 全選 and explains itself with the tooltip `這和「從」的形式相同，不能選為「到」`; every mounted card paints its own tags so the incoming card's class pill exists before release; 翻卡學習 → 翻卡練習 in the spec | done | `docs/spec.md` Picker and Cards sections + the mode name; re-read before code |
| 34b | `targetChips(from, to)` + `toggleTarget(to, id, from)` in `src/dict/settings.js`; `PickerView.vue` renders the flags, the disabled 第1課 look and the wrapping tooltip (narrow enough not to widen the page) | done | `src/dict/settings.test.js` +4 (locked flag, lock follows a new 從, 全選 skips the lock, `toggleTarget` refuses to add 從 but can remove a stale one) |
| 34c | CardView drops the `entry.current &&` guard on both tag blocks, so the window paints each card's own face and answer pills | done | `PORT=5299 node scripts/browser-check.mjs`: the exposed next card carries its own `.tag--group` while the drag is still held, and the hold-on-release bug is gone |
| 34d | Mode copy renamed in the home button, comments, probes and current docs; quoted user requests in `docs/changelog.md` keep their original wording (revision-27 precedent) | done | `grep 翻卡學習` finds only the quoted request, the rename records and `docs/audit/` snapshots; `scripts/motion-probe.mjs` and `src/ui/window.js` updated with the code |
| 34e | The lock tooltip widens to 320px (`width: max-content`, otherwise an absolute span wraps inside the chip's ~96px cell) and its hover position is clamped to the viewport by `src/ui/tooltip.js` | done | `src/ui/tooltip.test.js` 6 tests (centred fits, right/left clamp, margin, oversized, junk); browser check: 223px wide, 24px tall (one line), and a 使役形 lock in the last column stays inside the viewport with no sideways scroll |
| 34f | Verification and docs sync | done | `npm test` 35 files / 370 tests; `npm run build` (`output/dict/vol.bin`, `output/index.html`); `node scripts/browser-check.mjs` 597 checks, 0 failures; spec, architecture, AGENTS, README, development, serving, progress, changelog and this board updated; `vol/` untouched |

## Current status

- Revisions 2–31 and follow-up passes A/B are `done`; the
  implementation was developed and verified over several incremental passes.
  Revision 31 is a data-only change: no `.vue`, command, engine or settings
  file was touched. The latest verification is recorded in `docs/progress.md`.
- Backlog B2 (優化下載文件) is `done` as revisions 32–33 (single verified
  archive, `.bin` naming, download progress bar). Revision 34 delivers concrete
  優化UI items, but B3 stays `pending` for any further, unspecified UI work.
  B1 (朗讀功能) still needs a spec entry before code. Revisions 2–34 cover
  specific, specified requests. The revision-31 documentation sync also updated `README.md`,
  `docs/serving.md`, `docs/architecture.md`, `AGENTS.md`, `docs/spec.md`,
  `docs/progress.md` and `docs/changelog.md`; `docs/audit/*.md` remain
  historical snapshots.
- Revisions 23–27 have their spec and implementation in place, and the status
  documents have been resynced. Revisions 24–25's iOS rubber-band and
  dynamic-viewport behavior still needs real hardware verification; other than
  that and the spec-silent choices listed in `docs/progress.md`,
  revisions 2–31 have no known deviation from `docs/spec.md`.
- The GitHub Pages site is not live yet (the project URL returned 404 when
  checked); the repository history starts at commit `933c30b`.

## How to resume a future session

1. Read `AGENTS.md` — it is the execution plan and acceptance checklist.
2. Read `docs/progress.md` — it names the latest verification and the known
   limitations.
3. Read `docs/architecture.md` — it explains the engine contract and file map.
4. Read `docs/changelog.md` — recent changes and decisions.
5. Open the matching section of `docs/spec.md` before touching that feature.
6. Update `docs/progress.md`, `docs/roadmap.md` and `docs/changelog.md` when a
   task lands.
7. Check `docs/development.md` and `docs/serving.md` when verification counts or serving
   assumptions change; `docs/audit/*.md` are historical snapshots. `README.md`
   speaks to learners — keep it free of developer detail.

## Verification commands

```bash
npm test                                # Vitest unit tests (35 files / 370)
npm run build                           # static build into output/ (dict/vol.bin)
node scripts/write-sha256.mjs --check   # manifest consistency
node scripts/write-vol-archive.mjs --check  # archive builds from verified vol/
node scripts/browser-check.mjs          # headless Chromium walk-through (597 checks)
node scripts/motion-probe.mjs           # frame-by-frame motion traces (informational)
```

`browser-check.mjs` starts `vite preview` on port 5199 (override with `PORT`),
needs a Chromium binary (`CHROMIUM_PATH` if not at the default cache path),
and accepts `--screenshots` with `SHOT_DIR` for image captures.
`motion-probe.mjs` starts its own preview on port 5201 (`PORT` overrides) and
needs the same binaries; it only prints traces and never fails the build.

Serving and troubleshooting: see `docs/serving.md` (Python server, secure
context, and why boot can stop at 載入失敗（lesson 1）).

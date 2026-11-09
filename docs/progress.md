# Progress

Last updated: 2026-11-09. **T1–T8 complete, plus revisions 7 (IndexedDB cache), 8 (card
paging fix) and 9 (answer-side verb class); revisions 2 (R1–R7), 3 (U1–U9), 4 (V1–V6)
and 6 implemented and verified.**

## Current state

- Vue 3.5 + Vite 7 + Vitest 3 static app. Node v26.4.0, npm 11.18.0.
- `npm test`: 20 files, **191 tests passing** (`pretest` verifies the 50-lesson
  SHA-256 manifest).
- `npm run build`: `output/index.html`, `output/assets/`, `output/dict/` with
  exactly **50** lesson files; `output/` gitignored.
- Browser suite (`node scripts/browser-check.mjs`, vite preview + headless
  Chromium, 390×844 plus 550/551/800/900 width probes): **260 checks passing**,
  covering loading (normal, failure, retry), home, picker (three modes),
  reader, settings (all three), cards, quiz, completion screens, reduced
  motion (reader **and** cards), chip labels, 48px controls, the 550px
  breakpoint, and the desktop no-gesture rule.
- Repository still has no commits (files staged); nothing was committed.

## Auditor findings and fixes

1. **Picker chip labels** were bare `1…50`. Fixed to the spec copy
   `第1課…第50課`; the browser suite now asserts the first and last labels
   (so this cannot silently regress).
2. **Card swipe under reduced motion** did nothing: `CardView.onUp()` resolved
   the swipe from `offset`, which stays 0 when drag-follow is skipped. It now
   resolves from the tracked drag distance, matching the reader. The browser
   suite now tests a 120px card swipe under reduced motion on a 3-card list
   (lesson 5), not just the reader.
3. **Controls below 48px**: footer tap target raised from 44px to 48px;
   settings switch is now a 48px-tall control (26px knob inside). Both are
   asserted in the browser suite.
4. **Card "leaves" motion**: a successful card swipe now follows through,
   leaves (180ms), then the next card slides in (200ms); reduced motion still
   swaps instantly.
5. **Documentation** of these deviations and the serving caveats now exists
   (`docs/changelog.md`, `docs/serving.md`, this file).

## Why a Python server showed `載入失敗（lesson 1）`

Verified in Chromium:

| Served directory | URL | Result |
|---|---|---|
| repo root | `http://localhost:5301/` | blank page: Python serves `src/main.js`/`.vue` raw, `import 'vue'` fails, and `/dict/lesson_1.json` is 404 |
| repo root | `http://localhost:5301/output/` | works (relative assets + dict) |
| `output/` | `http://localhost:5302/` | works, reaches home |
| `output/` | `http://127.0.0.1:5302/` | works |
| `output/` via non-localhost HTTP (simulated `insecure.test`) | `http://insecure.test:5302/` | `載入失敗（lesson 1）`: `isSecureContext: false`, `navigator.storage.getDirectory` missing → OPFS unavailable |

So: use `npm run dev`, `npm run preview`, or `python3 -m http.server` **inside
`output/`**, and open `localhost`/`127.0.0.1` (or HTTPS). A LAN IP over plain
HTTP cannot use OPFS and stops on lesson 1. The loading screen now prints the
underlying reason under the lesson number, e.g.
`OPFS is unavailable on this origin; serve over http://localhost, http://127.0.0.1, or HTTPS`.
Details and troubleshooting: `docs/serving.md`.

## Done (task board)

Docs baseline; T1 skeleton; T2 hash + boot; T3 loading/home; T4 picker; T5
reader; T6 cards; T7 quiz; T8 motion + verification. Full acceptance list:
`docs/roadmap.md`.

## Commands actually run (final pass)

```bash
npm test                    # 13 files, 95 tests passed
npm run build               # output/index.html + 50 dict files
ls output/dict | wc -l      # 50
node scripts/browser-check.mjs          # 121 checks passed
node scripts/write-sha256.mjs --check   # manifest ok: 50 lessons
# python-server diagnosis (see table above), incl. simulated insecure origin
```

During development each task ran `npm test`, `npm run build`, and the browser
suite. Suite growth: 11 → 27 → 42 → 54 → 80 → 83 → 87 → 92 checks (v1), then
98 → 100 → 107 → 113 → 121 checks for revision 2 (all-forms reader, labels,
3D flip, 到 header, full-bleed).

## Screens tested vs not

Tested in headless Chromium: `loading` (normal/failure/retry), `home`,
`picker` (three modes), `reader` (15 form blocks, 45 sentence pairs, single
字典形 block, default highlight + scroll), `settings` (dict/card/quiz),
`card` (3D flip mid-animation, face reset, swipe leave/enter), `quiz`, plus
reload/OPFS restore, settings persistence, reduced motion (reader, cards,
instant flip), 到 header geometry, full-bleed at 390px vs framed at 800px,
footer sheet, and new-tab link.

Not tested: real iOS/Android Safari/Chrome (Chromium only), a real IME
(composition is covered by pure `typingEdits` tests), GitHub Pages subpath
deployment, and visual inspection (screenshots were saved but this agent cannot
view images; styling evidence is structural).

## Spec-silent decisions (confirm with the user if undesired)

- Copy added where the spec is silent: `載入失敗（lesson N）`, `重試`, settings
  title `設定`, reader controls `上一個` / `下一個` (cards keep `上一張` /
  `下一張`), `檢查`, `答案`, and the diagnostic detail line under the error.
- Reading defaults for cards and quiz are **on** (spec states the dictionary
  default only). `自動提交答案` defaults on (spec states this).
- A correct answer on the last item stays on that item (cleared, new keyboard);
  the spec defines no finish screen.
- Download retries unified to two attempts for both missing and corrupt copies.
- Keyboard fillers come from a unique kana pool; reading characters never
  duplicate.
- `nav.go` accepts an optional `mode` so home can enter a picker mode in one
  command.

## Revision 2 (current goal)

The user asked for five UX changes; choices were confirmed through the goal
questionnaire (all 15 forms fully expanded, reader-only label rename, 3D
card flip, 到 header with 全選 on the right, full-bleed at ≤480px, and
`docs/spec.md` amended). Task board: see `docs/roadmap.md`, section
"Revision 2". Status: R1–R7 done; revision 2 verified.

Implementation notes (all verified in the browser):
- `docs/spec.md` now describes all 15 form blocks (name, word, reading, gloss,
  3 sentence pairs each), the default form marked and scrolled into view, no
  separate 字典形 section, reader controls `上一個`/`下一個`, the 到 header row,
  the 300ms `rotateY` card flip (instant under reduced motion), and the
  ≤480px full-bleed column.
- Verification commands and counts are in "Commands actually run" below.

## Next step

Revision 2 is complete (R1–R7). Publish `output/` as the GitHub Pages site
root; local serving and the Python-server caveats are in `docs/serving.md`.
If the user wants different copy or thresholds (for example a different
full-bleed breakpoint), amend `docs/spec.md` first, then code and the browser
suite.

## Revision 3 (current goal)

The user asked for a UI optimisation pass (global, 學習, 翻卡學習, 測驗 lists).
Six ambiguities were resolved by questionnaire: reader keeps the other blocks
but hides their form-name tags (default first); ≤550px means "UI fills the
browser and the background is removed"; card/quiz lists shuffle once at
開始; 錯 X 題 defaults to 3 with 1–5; the dictionary gets no completion screen;
從 and 預設顯示形式 both start at ます形 (到 stays 字典形).
A late request also landed: above 550px the dictionary does not page by gesture
so text can be selected and copied.

Implementation notes (each verified in the suite):
- `app.css` breakpoint 480 → 550px; below it the gradient/grain is dropped and
  the column is the page. Above it the framed column and background stay.
- Picker: 到's chips are a wrapping grid of equal bordered buttons; verb-less
  lessons show a `該課沒有動詞` hint on hover/focus (and stay unpressable); the
  lesson-wide control switches between `全選` and `取消全選`.
- Reader: `src/study/reader-forms.js` orders the default form first and
  `ReaderView` omits the form-name tag on the other blocks; the pager footer is
  sticky at the bottom; gestures page only at ≤550px, and text selection is
  re-enabled above that. Dragging over sentences needed `user-select: none`
  inside that media query, otherwise the selection gesture cancelled the swipe.
- Cards: a shuffled list, direction-aware enter animation (swipe right → the
  next card enters from the left), and `完成` on the last card ending the run.
- Quiz: `錯 X 題就顯示答案` setting, `再答錯 X 題就顯示答案` countdown, and the
  revealed answer as an overlay that covers the keyboard; results tally and
  completion panel in `src/components/CompletePanel.vue`.

Spec-silent decisions introduced here (also recorded in `docs/spec.md`):
- The card run ends via `完成` on the last card (`study.finish`), not automatically.
- An item counts as wrong when its answer had to be revealed; the percentage
  is correct over resolved items.
- `到`'s header keeps the label `全選` (it narrows to one form rather than
  clearing), unlike the lesson control which flips to `取消全選`.

## Revision 4 (current goal)

Home gains the title 日語動詞變形練習 and a second footer line
(`🥺 如果有 BUG 記得告訴我！`) that opens the same About sheet as
`Build with ❤ by Mane`; the sheet now carries the open-source note, a
`提交ISSUE` link to the repo's new-issue page (new tab), a
`mane@manesec.com` mailto and `🥺 どうもありがとうございます。`.

Dictionary blocks are uniform: the first block lost its tinted accent panel
(no background, border, radius or inset margins), every block names its own
form (`ます形`, `ない形`, …), and the 群組 / 第N課 pills appear only on the
first block (`src/study/reader-forms.js`, `isFirst`).

Cards: `下一張` / `上一張` now run the same leave-then-enter motion as a swipe
(`prevCard`, `nextOrFinish` → `moveCard`), and the answer side always carries
two tags — the asked form, then the verb class — independent of 一開始顯示幾類動詞
and 顯示平假名注音 (`src/study/card-tags.js`).

Picker: clearing every 到 chip shows `請至少選擇一個轉型才可以開始` above 開始 and
keeps it disabled (`startHint` in `src/dict/settings.js`); dictionary mode never
shows it.

Deviation from the first draft, at the user's request: the pinned footers are
**not** opaque. They keep the column colour fading to transparent with **no
underline**, and the fade band grew to 28px (footer 88–90px, buttons 52px) so
the transparency stops above the buttons and they are never washed out.
Measurement: `btnTop = 28 = paddingTop` on the reader, card and picker footers.

Verification: `npm test` 18 files / 151 tests; `npm run build` → `output/index.html`
plus 50 dict files; `node scripts/browser-check.mjs` 182 checks; a 390/550/1280
sweep over loading, home, picker, reader, settings, card and quiz with zero page
errors. Not covered: real Safari/mobile gestures, real IME, GitHub Pages subpath
deployment, and visual inspection of the PNG references (no image viewing).

## Revision 6 (current goal)

Completion screen: one random emoji above 恭喜，你已經做完了練習。 in both
modes (quiz draws it from the score band row, card from the bowing trio), and
返回主頁 is 60px in both. Reader paging is a flat horizontal slide with no fade
and no depth. The card stage clips horizontally while a card moves and
`html`/`body`/`#app`/`.app-shell` carry `overflow-x: clip`, so the horizontal
scrollbar that appeared during card practice is gone.

Commands run for it: `npm test` (181 tests, 19 files), `npm run build`, and
`node scripts/browser-check.mjs` (233 checks). A negative control with the clip
removed showed `scrollWidth` 562 on a 390px viewport, so the new scroll check
does detect the reported bug.

## Revision 7 (current goal)

The dictionary cache moved from OPFS to IndexedDB (`src/storage/idb.js`,
database `katsuyou-dict`, store `lessons`, one record per lesson file) because
OPFS is unusable in private windows. Adapter shape is unchanged, adapter tests
run against `fake-indexeddb`, and boot tests keep their Map fake.

Evidence: `npm test` 188 tests / 20 files; `npm run build` writes
`output/index.html` and 50 files in `output/dict/`; `node
scripts/browser-check.mjs` 240 checks, including "IndexedDB holds 50 lessons",
"reload … verifies stored lessons without downloading" for all three modes,
"private window boots into home", "private window stores 50 lessons in
IndexedDB", and "private window reload reuses IndexedDB".

Open follow-up (not fixed, needs a product decision): a plain-HTTP LAN origin
has IndexedDB but no `crypto.subtle`, so boot still fails on lesson 1 with
`download 2 could not be hashed`. Fixing that means shipping a non-WebCrypto
SHA-256 implementation, which is a new product rule.

## Revision 8 (current goal)

Card paging away from a flipped card. The outgoing card kept `card--flipped`
and the element faded out (`opacity: 0`, 180ms) while `.card-inner` was still
un-rotating, then the same node replayed an `opacity: 0 → 1` / `60px` enter
animation while the rotateY transition was mid-flight. That read as the answer
side dissolving and the new card spinning in from the wrong offset.

Fix (`src/views/CardView.vue` only): `card--no-turn` cuts the inner transition
for the whole leave+enter phase, the fade is dropped and both phases are
full-width flat `translateX`, and `moveCard` clears the enter phase so leave
and enter never run together.

Evidence: `npm test` 188 tests / 20 files; `npm run build` writes
`output/index.html` + 50 dict files; `node scripts/browser-check.mjs
--screenshots` 255–256 checks (the count moves by the quiz keyboard seed), all
passing. New checks: "a flipped card slides out on its own side", "the outgoing
card never turns while it travels", "the outgoing card travels flat", "the
outgoing card does not fade", "the next card arrives on its face", "the previous
card arrives on its face", "the settled card rests on its face", plus the
mirrored 上一張 set.

Not verified visually: the motion was judged from sampled computed styles
(390×844 headless), not by watching a recorded animation. If the 170ms-out
then 240ms-in still feels wrong on a real phone, the next step is the two-panel
slide track (outgoing and incoming cards on one track).

## Revision 9 (current goal)

The card answer side now always carries two pills: the asked form
(`字典形`), then the verb class (`2類動詞`). `backTags` takes the target form
data and appends the class, and reads no setting — the class shows on the
answer even with 一開始顯示幾類動詞 off, which the user asked for. The face
still hides its class pill when the switch is off. `docs/spec.md` records the
new rule.

Evidence: `npm test` 191 tests / 20 files (three more `card-tags` cases: the
order of the two pills, both pills with the switch off, every class label
including the unknown-value fallback); `npm run build` writes
`output/index.html` + 50 dict files; `node scripts/browser-check.mjs
--screenshots` 260 checks (was 255). New checks: "the answer keeps naming the
asked form", "the answer names the verb class with the switch off", "the answer
pills run form first, class second", "the two answer pills share one row",
plus "class switch off hides the front tag" narrowed to `.card-face`.

`docs/spec.md` change to confirm with the user if unwanted: the answer side is
now busier (two pills) than the earlier spec's single form tag.

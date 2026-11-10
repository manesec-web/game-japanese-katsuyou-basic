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
- `vol/*.json` is read-only dictionary input. Do not edit it.
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

All T-entries are `done`. The only remaining step is to publish `output/` as
the GitHub Pages site root; deployment notes are in `README.md` and serving
caveats in `docs/serving.md`.

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
| 13a | The first card in 翻卡學習 resists a right-hand drag: a third of the finger travel, capped at 40px, springing back in ~140ms without changing the card; the dictionary reader and the last-card finish are untouched | done | 5 new pure tests in `src/ui/swipe.test.js`; browser check sees 20px at a 60px drag, 40px at a 180px drag, both at rest afterwards, 0px under reduced motion; `npm test` 21 files / 209 tests |
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

Requested by the user on 2026-11-11. None of these has a spec entry yet, so
none can start until the matching section of `docs/spec.md` is written; they
are `pending`, not `in progress`.

| # | Change | Status | What the spec has to settle first |
|---|--------|--------|----------------------------------|
| B1 | 朗讀功能 | pending | Which text is spoken (the form alone, `vol`, `japanese`, or a `sentence`), which engine (the browser's own `SpeechSynthesis`, since the site still allows no backend and no model call), and where the control sits on reader, card and quiz |
| B2 | 優化下載文件 | pending | Whether the 50 per-lesson files stay (one file per lesson, hashed individually) or become one bundle; what that does to the SHA-256 manifest, `app.boot` and `boot.checked / boot.total` |
| B3 | 優化UI | pending | Which screens and which complaints; every change is written into the spec's Look and motion section before code and the browser suite follow |

### Revision 15 — the paging window (requested 2026-11-10)

The phone paging rebuilt the whole page at the swap: the dictionary page is
fifteen form blocks, and 翻卡學習 rebuilt its card. The request: render several
items at once, keep the screen on the 3rd one, and make a swipe only delete the
item at one end and add one at the other. The window is deliberately invisible —
the spec keeps revision 14's motion, so nothing about what the user sees changes,
only how many items are already laid out when the swap happens.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| 15a | Spec revision: "The paging window" — 9 cards in 翻卡學習, 5 words in the reader, current item in the 3rd slot, front-delete/back-append, ends render nothing, window invisible | done | `docs/spec.md` new section + `Look and motion` bullet; `Dictionary reader` and `Cards` cross-reference it |
| 15b | Pure window logic in `src/ui/window.js` (sizes, `CURRENT_SLOT`, `windowSlots`, `windowOffset`, `slotKey`, `shiftWindow`) | done | `src/ui/window.test.js` 13 tests: 3rd-slot invariant over every index/length, front-delete/back-append both directions, derived-shape equality, ends and unknown directions refused, `card.next/prev` + `dict.next/prev` ids and params unchanged |
| 15c | Per-slot data in `src/study/window-views.js` so the views stay thin | done | `src/study/window-views.test.js` 10 tests: one current slot, offsets 0/±100, every slot holds its own word/hand/gloss rather than a copy of the current one, tags per card, one new key per turn |
| 15d | 字典 and 翻卡 rebuilt on the window: the row is kept in state and shifted by `usePagingWindow` (one front delete, one back append per turn), no row translate, item-keyed slots, only the current item visible | done | browser check: 5 pages / 9 slots mounted, one current at x=0 and full width, 0 neighbours inside, neighbours hidden, per-slot words distinct |
| 15e | 前刪後補 proven at DOM level, not just in unit tests | done | 第4課 (6 words) and 第6課 (11 verbs) walk-throughs: the window slides one slot per turn, the front node leaves, exactly one node arrives at the back, survivors keep their identity marker |
| 15f | Verification and docs | done | `npm test` 24 files / 234 tests; `npm run build` ok (`output/dict/` = 50, `output/index.html`); `node scripts/browser-check.mjs` 411 checks passing; spec, changelog, progress, architecture, README, roadmap and AGENTS synced |

## Current status

- Everything above is `done`; latest verification was 24 test files / 234
  tests, a build with 50 dictionary files, and 411 browser checks (410–411,
  because the seeded quiz item decides how many kana-key assertions run).
- Backlog items B1–B3 are `pending` and have no spec entry yet.
- No known deviation from `docs/spec.md` other than the spec-silent choices
  listed in `docs/progress.md`.
- The GitHub Pages site is not live yet (the project URL returned 404 when
  checked); the repository history starts at commit `933c30b`.

## How to resume a future session

1. Read `docs/progress.md` — it names the latest verification and the known
   limitations.
2. Read `docs/architecture.md` — it explains the engine contract and file map.
3. Read `docs/changelog.md` — recent changes and decisions.
4. Open the matching section of `docs/spec.md` before touching that feature.
5. Update `docs/progress.md`, `docs/roadmap.md` and `docs/changelog.md` when a
   task lands.

## Verification commands

```bash
npm test                                # Vitest unit tests (24 files / 234)
npm run build                           # static build into output/ (50 dict files)
node scripts/write-sha256.mjs --check   # manifest consistency
node scripts/browser-check.mjs          # headless Chromium walk-through (411 checks)
node scripts/motion-probe.mjs           # frame-by-frame motion traces (informational)
```

`browser-check.mjs` starts `vite preview` on port 5199 (override with `PORT`),
needs a Chromium binary (`CHROMIUM_PATH` if not at the default cache path),
and accepts `--screenshots` with `SHOT_DIR` for image captures.
`motion-probe.mjs` starts its own preview on port 5201 (`PORT` overrides) and
needs the same binaries; it only prints traces and never fails the build.

Serving and troubleshooting: see `docs/serving.md` (Python server, secure
context, and why boot can stop at 載入失敗（lesson 1）).

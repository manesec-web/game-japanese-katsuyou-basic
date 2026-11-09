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

## Current status

- Everything above is `done`; latest verification was 20 test files / 191
  tests, a build with 50 dictionary files, and 260 browser checks.
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
npm test                                # Vitest unit tests (20 files / 191)
npm run build                           # static build into output/ (50 dict files)
node scripts/write-sha256.mjs --check   # manifest consistency
node scripts/browser-check.mjs          # headless Chromium walk-through
```

`browser-check.mjs` starts `vite preview` on port 5199 (override with `PORT`),
needs a Chromium binary (`CHROMIUM_PATH` if not at the default cache path),
and accepts `--screenshots` with `SHOT_DIR` for image captures.

Serving and troubleshooting: see `docs/serving.md` (Python server, secure
context, and why boot can stop at 載入失敗（lesson 1）).

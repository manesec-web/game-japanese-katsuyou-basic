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
| 0 | Docs baseline (this file, architecture, progress, changelog) | done | English docs present and kept current |
| T1 | Engine skeleton: Vite + Vue 3, `dispatch`, empty session, Vitest, build to `output/` | done | `npm test` passes (unknown command → `ok: false`); `npm run build` writes `output/`; `output/` gitignored; no logic in `.vue` |
| T2 | SHA-256 manifest script + `app.boot` (IndexedDB check/download/verify) | done | `--check` fails on tampered manifest, passes after restore; tests for missing file, match, one mismatch retry, double mismatch stop, empty-verb lessons |
| T3 | Loading screen, boot wiring, home screen, footer sheet with GitHub link | done | Progress bar bound to `boot.checked / boot.total`; retry on failure; three mode entries; link opens in a new tab |
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

All T-entries are `done`. The project is complete; the remaining step is to
publish `output/` as the GitHub Pages site root.

## How to resume a future session

1. Read `docs/progress.md` — it names the current task, the last commands run,
   and the next concrete step.
2. Read `docs/architecture.md` — it explains the engine contract and file map.
3. Read `docs/changelog.md` — recent changes and decisions.
4. Open the matching section of `docs/spec.md` before touching that feature.
5. Update the three documents above when the task lands.

## Verification commands

```bash
npm test                 # Vitest unit tests
npm run build            # static build into output/
node scripts/write-sha256.mjs --check   # manifest consistency (from T2 on)
node scripts/browser-check.mjs          # headless browser walk-through
```

Serving and troubleshooting: see `docs/serving.md` (Python server, secure
context, and why boot can stop at 載入失敗（lesson 1）).

## Revision 2 — UX changes (current goal)

Status values as above. Each task amends `docs/spec.md` first, then code,
tests, and the browser suite.

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| R1 | Spec + docs amended for all five changes | done | `docs/spec.md` reader/picker/cards/motion sections match the new behaviour; changelog and progress updated |
| R2 | Reader lists all 15 forms (name, word, reading, gloss, 3 sentences each); duplicate 字典形 block removed; default form highlighted and scrolled into view | done | Browser: 15 blocks, 45 sentence pairs, no duplicate 字典形 section, default highlighted |
| R3 | Reader controls renamed 上一個 / 下一個 (cards stay 上一張 / 下一張) | done | Browser asserts exact labels; clamp behaviour unchanged |
| R4 | Flashcard 3D page-turn (`rotateY` ~300ms), instant under reduced motion | done | Browser observes flip mid-animation and the resulting face/back; navigation still resets to face |
| R5 | 到 header row: 到 left, 全選 right, above the chip grid | done | Browser bounding boxes: 全選 above first chip, right-aligned; toggling rule unchanged |
| R6 | Column full-bleed at viewport ≤ 480px (no radius, shadow, side margins) | done | Browser computed styles at 390px and 800px |
| R7 | Final verification and docs reconciliation | done | `npm test`, `npm run build` (50 dict files), browser suite green, docs current |

## Revision 3 — UI optimisation (current goal)

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| U1 | ≤550px full-bleed with the background removed | done | Browser: 390/550 full-bleed, flat background; 551/800 framed with gradient |
| U2 | 從/到 button sizing + empty-lesson hint + 全選/取消全選 | done | Browser: chips 1px border and equal size, hint 該課沒有動詞 on hover, label flips; `src/dict/lessons.test.js` |
| U3 | masu-first defaults (從 and 預設顯示形式) | done | `settings.test.js`, `storage/settings.test.js` |
| U4 | Shuffle card/quiz list once at 開始 | done | `src/study/items.test.js` (set kept, seed changes order, seed stable) |
| U5 | Reader default-form first, hidden name tags, pinned pager, no desktop gesture | done | Browser: order/name-tag/pin checks, drag pages at 390 and does nothing at 900, text selectable |
| U6 | Card enter animation runs left to right on a right swipe | done | Browser probe: -60px → 0 on swipe right, +60px → 0 on swipe left, no animation under reduced motion |
| U7 | 錯 X 題設定, countdown copy, answer panel covering the keyboard | done | `src/dict/quiz.test.js` (X=1/3/5), `src/commands/quiz.test.js`, browser coverage + z-order check |
| U8 | Completion screens (quiz stats, card congrats, dict excluded) | done | `src/study/results.test.js`, browser: counts, 33% bar, miss rows, card 完成, dict stops at 2/2 |
| U9 | Spec sync + full verification | done | `docs/spec.md` sections updated; `npm test`, `npm run build`, `node scripts/browser-check.mjs` green |

## Revision 4 — second UI pass (current goal)

| # | Change | Status | Acceptance evidence |
|---|--------|--------|---------------------|
| V1 | Home title 日語動詞變形練習, second footer line, richer About sheet | done | Browser: h1 above entries, two footer triggers → one sheet, repo/issues-new/mailto hrefs, thanks line |
| V2 | Uniform reader blocks, `〜形` heading everywhere, pills only on the first block | done | Browser: 15 headings, 2 pills, transparent backgrounds, equal padding; `reader-forms.test.js` |
| V3 | Pinned footers: no underline, taller transparent fade above the buttons | done | Browser: gradient kept, border 0, fade band 28px ≥ button top, buttons 52px |
| V4 | Card buttons animate the page turn; answer always tagged with the asked form | done | Browser: leave/enter classes on button press; back tag 字典形 with both switches off; `card-tags.test.js` |
| V5 | 開始 hint when 到 is empty | done | Browser: hint above 開始 + disabled, recovers on pick, absent in 字典; `startHint` tests |
| V6 | Spec sync + verification | done | `docs/spec.md` updated; 151 tests, 50 dict files, 182 browser checks, 3-width sweep clean |

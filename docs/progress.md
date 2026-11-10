# Progress

Last updated: 2026-11-11.

**Status: complete.** T1–T8 are done and revisions 2–13 have landed and been
verified. The site is not published yet; the remaining step is to deploy
`output/` to GitHub Pages. Revision 13 added the loading-screen head and credit
line and the first-card resistance in 翻卡學習.

## Current state

- Vue 3.5 + Vite 7.3 + Vitest 3 static app. Verified with Node v26.4.0 and
  npm 11.18.0; Vite 7 requires Node `^20.19.0` or `>=22.12.0`.
- `npm test`: 21 files, **209 tests passing**. `pretest` verifies the 50-lesson
  SHA-256 manifest first.
- `npm run build`: `output/index.html`, `output/assets/` (one JS + one CSS
  bundle) and `output/dict/` with exactly **50** lesson files. `output/` is
  gitignored.
- `node scripts/browser-check.mjs`: **379 checks passing on the final run**
  (378–379; headless Chromium, 390×844 with 550/551/800/900 width probes, plus
  a touch context for the zoom lock and frame-by-frame motion assertions). The
  count can move by one because the seeded quiz item decides how many kana-key
  assertions run.
- `node scripts/motion-probe.mjs`: prints the frame-by-frame position trace for
  the paging turns, the spring-back and the flip. Used to measure the motion
  before and after a change; not part of the pass/fail gate.
- Git: branch `main`, tracking `github/main`; history starts at commit
  `933c30b` (`init`). The GitHub Pages URL returned 404 when this document
  was refreshed, so the site has not been published yet.
- Dictionary cache is IndexedDB (`katsuyou-dict` / `lessons`, one record per
  lesson file); settings are in `localStorage` under `katsuyou-settings`.

## Verification as of this refresh

```bash
npm test                                # 21 files, 209 tests passed
npm run build                           # manifest ok: 50 lessons; built in <1s
ls output/dict | wc -l                  # 50
node scripts/browser-check.mjs          # browser check passed (379 checks)
node scripts/motion-probe.mjs           # frame-by-frame motion traces (informational)
node scripts/write-sha256.mjs --check   # manifest ok: 50 lessons
```

## History in one line each

Full detail, including quoted user requests and before/after measurements, is
in [`docs/changelog.md`](docs/changelog.md). Task acceptance evidence is in
[`docs/roadmap.md`](docs/roadmap.md).

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

- **Revision 13**: the loading screen carries the site head
  (`大家の日本語` / `轉型練習` / `涵蓋初級 1 – 50 課的單詞`) and the credit line
  `Build with ❤ by Mane` (which opens the About sheet) but not the bug line;
  the first card in 翻卡學習 resists a right-hand drag (a third of the finger,
  capped at 40px, then a 140ms spring-back) instead of sitting still; and the
  roadmap gained a backlog (朗讀功能, 優化下載文件, 優化UI).

## Known limitations and unverified paths

- Real iOS/Android devices and Safari/Firefox were not tested; only Chromium.
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

Troubleshooting steps: [`docs/serving.md`](docs/serving.md).

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
  `/issues/new`, thanks line `どうもありがとうございます。`).

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

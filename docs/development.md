# Development

The technical half of the project: how to run it locally, what the commands do,
how the source is laid out, how the data is shaped, and how to build and deploy.
The plain-language product overview lives in [`README.md`](../README.md);
authoritative behavior lives in [`spec.md`](spec.md).

Last updated: 2026-11-13 (moved out of `README.md`, which was rewritten to
speak to learners instead of developers; content unchanged).

## Quick start

Requirements: Node.js **20.19+** or **22.12+** (the minimum for Vite 7).

```bash
git clone git@github.com:manesec-web/game-japanese-katsuyou-basic.git
cd game-japanese-katsuyou-basic
npm install
npm run dev        # http://localhost:5173/game-japanese-katsuyou-basic/
```

The dev server packs `vol/` into `vol.bin` on the fly and serves it at
`/game-japanese-katsuyou-basic/dict/vol.bin` (`base` is fixed to the GitHub
Pages subpath). `npm run dev` runs the manifest check first.

Build and preview locally:

```bash
npm run build      # writes output/
npm run preview    # previews the build (http://localhost:4173/game-japanese-katsuyou-basic/)
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts the Vite dev server (with the dictionary middleware) |
| `npm run build` | Builds the static site into `output/`, then verifies and packs `output/dict/vol.bin` |
| `npm run preview` | Serves `output/` with Vite |
| `npm test` | Runs the Vitest unit tests (35 files, 370 tests) |
| `npm run test:watch` | Watch mode |
| `node scripts/write-sha256.mjs` | Regenerates `src/data/dict-manifest.json` |
| `node scripts/write-sha256.mjs --check` | Verifies the manifest against the raw bytes of `vol/` (exits non-zero on mismatch) |
| `node scripts/write-vol-archive.mjs` | Verifies `vol/` and packs `output/dict/vol.bin` (`--check` verifies only, `--out` picks the target path) |
| `node scripts/browser-check.mjs` | End-to-end walk-through of the built site with headless Chromium (run `npm run build` first) |
| `node scripts/motion-probe.mjs` | Prints per-frame motion traces for paging / card flips (informational, no pass/fail) |
| `node scripts/strike-probe.mjs` | Measures where the double strikethrough on 錯誤單詞 is drawn (dev probe) |

`pretest` / `prebuild` / `predev` all run the manifest check first, so a hash
mismatch fails the build and the tests instead of shipping bad data.

Environment variables for `browser-check.mjs`: `PORT` (preview port, default
5199), `CHROMIUM_PATH` (Chromium binary), `SHOT_DIR` (screenshot directory),
`--screenshots` to enable screenshots. It starts and stops `vite preview` itself.

## Project structure

```text
vol/                        dictionary source: lesson_1.json … lesson_50.json (read-only;
                            revision 31 was a one-time authorized rewrite of each form's
                            chinese / note)
docs/                       spec, architecture, progress, changelog, serving, this file
docs/screenshot-draft/      early wireframes
docs/logo/                  site logo: logo.jpg and the favicon / touch icons derived from it
scripts/write-sha256.mjs    generates / checks the SHA-256 manifest
scripts/zip.mjs             deterministic deflate ZIP writer
scripts/vol-archive.mjs     verifies `vol/` and packs it into `vol.bin`
scripts/write-vol-archive.mjs  CLI for the archive build (--check / --out)
scripts/browser-check.mjs   end-to-end browser walk-through
scripts/motion-probe.mjs    per-frame motion measurement
src/engine/                 dispatch and session (framework-free, testable under Node)
src/commands/               one module per feature area, each exporting specs()
src/dict/                   form definitions, hashing, archive extraction, ruby alignment,
                            quiz keyboard and grading, settings rules
src/study/                  item lists, shuffle, example highlighting, note layer, results
src/storage/                IndexedDB dictionary cache, localStorage settings
src/ui/                     store adapter, boot, gestures (swipe/drag), motion, IME editing,
                            scrollbar logic
src/views/                  screens (templates and styles, no rules)
src/components/             shared components (site head, footer, About sheet, ruby word,
                            completion panel, page / list scrollbars)
src/styles/app.css          design tokens and layout
src/data/dict-manifest.json generated manifest (committed)
output/                     build output (not committed)
```

There is no `public/` directory: the Vite plugin packs `vol/` into
`output/dict/vol.bin` and serves the same archive in dev.

## Data model

Each verb object holds 15 keys (`dictionary-form`, `masu-form`, …
`causative-form`); each form carries `vol` (the word), `group` (verb class),
`chinese` (**its own conjugated meaning**), `japanese` (reading), `sentence`
(Japanese–Chinese example pair), `note` (usage note) and `error_usage`
(the wrong-usage marker). `chinese` is not one shared gloss across the 15
forms: for example `違う` is 「不同；不對；不是」, while `違いません` is
「沒有不同；相同（禮貌體）」 and `違って` is 「（因為）不同，而…；不同，接著…」.
`error_usage` forms are uniformly labelled
「（非自然日語；僅供轉詞練習，無自然中文譯義）」; `note` flags rare forms,
honorifics, 迷惑受身 and concessive constructions. The example sentences'
Japanese text and Chinese translations are preserved as-is. Full rules:
the Data section of [`spec.md`](spec.md).

Current data: 50 lessons, 46 with verbs (1, 3, 8, 12 are empty), 386 words,
5,790 forms (5,599 usable, 191 `error_usage`, 16,797 example pairs).

## Architecture highlights

- **Three layers**: `engine` (command registry and session, plain JS) →
  `commands` (behavior) → `views` (render and `dispatch` only). `.vue` files
  hold templates and styles; behavior lives in `.js`.
- **Every user-visible action is a command**: `{ id, params, enabled, run }`;
  the views and the tests go through the same
  `dispatch(session, id, params)`, which returns `{ ok: true, result }` or
  `{ ok: false, error }` and never throws an uncaught exception.
- **Dictionary delivery**: the build verifies `vol/*.json` and packs them into
  `output/dict/vol.bin` (a ZIP published without the `.zip` suffix and served
  as `application/octet-stream`, so download-helper extensions do not hijack
  it); the manifest ships with the site. The browser fetches the archive in
  one request, extracts entries with `unzipit`, computes SHA-256 with Web Crypto
  and stores only matches in IndexedDB. The loading bar shows the streaming
  download in proportion to `Content-Length`, then holds at 100% while the
  extracted entries are verified (`src/ui/boot-progress.js`, pure).
- **Testing strategy**: rules are pure functions tested with Vitest under
  Node; browser APIs are injected fakes; the IndexedDB adapter is tested with
  `fake-indexeddb`; the view layer is walked by `browser-check.mjs` on
  headless Chromium.

Command list, error codes, the session model, the file map and design
decisions: [`architecture.md`](architecture.md).

## Testing and verification

```bash
npm test                                # 35 files / 370 unit tests
npm run build                           # output/index.html + output/dict/vol.bin
node scripts/write-sha256.mjs --check   # manifest consistent
node scripts/write-vol-archive.mjs --check  # archive verifies (no file written)
node scripts/browser-check.mjs          # 597 end-to-end checks (390×844 primary; quiz
                                        # items are seed-driven, so the per-key checks
                                        # fluctuate by a few)
```

The end-to-end walk-through covers: the tab title and site icons (favicon.ico,
32/192px PNG, apple-touch-icon, all served from the Pages subpath with
`image/*`), loading (success / failure / retry), home, lesson picking in all
three modes, the dictionary reader (finger-tracking drag, form filter, notes
and double strikethrough, 單詞目錄 jumps), settings, cards (the first card's
boundary and the 錯誤單詞 tag), the quiz (wrong-answer shake, mid-run
skipping of wrong-usage words), the completion screen, reduced motion, the
550px breakpoint, the page and dropdown scrollbars (including mouse drag and
proximity reveal), IndexedDB cache reuse, zoom lock and the Lucide icons.

Not covered: real iOS / Android devices, real IMEs (composition is tested as
pure functions on synthetic events), GitHub Pages subpath deployment, and
human visual review. Known limitations: [`progress.md`](progress.md).

## Local serving notes

`crypto.subtle` only works on secure origins (`https://`,
`http://localhost`, `http://127.0.0.1`). Opening the site over
`http://192.168.x.x` or `file://` makes the dictionary hashing fail and the
loading screen stops at `載入失敗（lesson 1）`. Use `npm run dev`,
`npm run preview`, or mount `output/` under
`localhost/game-japanese-katsuyou-basic/`. Troubleshooting:
[`serving.md`](serving.md).

## Deployment

`npm run build` produces `output/` (`base: '/game-japanese-katsuyou-basic/'`,
matching the repo name). Publish the contents of that directory to GitHub
Pages (the repo's Pages branch or the site root); Pages adds the subpath, so
the URL is `https://<user>.github.io/game-japanese-katsuyou-basic/`.
`output/` is not committed. GitHub Actions or a `gh-pages` branch are both
fine; keep the Pages source setting consistent with whichever you choose.
GitHub Pages serves HTTPS, so SHA-256 hashing and IndexedDB both work.

## Browser support

Verified on Chromium (headless). The site relies on IndexedDB, Web Crypto,
`<ruby>`, CSS `sticky` and `prefers-reduced-motion`, all present in modern
Chrome / Edge / Safari / Firefox; Safari and Firefox have not been verified on
real devices yet.

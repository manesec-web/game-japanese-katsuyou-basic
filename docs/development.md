# Development

The technical half of the project: how to run it locally, what the commands do,
how the source is laid out, how the data is shaped, and how to build and deploy.
The plain-language product overview lives in [`README.md`](../README.md);
authoritative behavior lives in [`spec.md`](spec.md).

Last updated: 2026-11-15 (synced with revision 38: the 學習 grammar reference,
reader → 變形說明 link, all-form 單詞目錄 search and voice audio).

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
| `npm run dev` | Starts the Vite dev server (with the dictionary and audio middleware) |
| `npm run build` | Builds the static site into `output/`, packs `output/dict/vol.bin` and copies the 46 audio bins to `output/dict/resource/` |
| `npm run preview` | Serves `output/` with Vite |
| `npm test` | Runs the Vitest unit tests (49 files, 540 tests) |
| `npm run test:watch` | Watch mode |
| `node scripts/write-sha256.mjs` | Regenerates `src/data/dict-manifest.json` |
| `node scripts/write-sha256.mjs --check` | Verifies the dictionary manifest against the raw bytes of `vol/` (exits non-zero on mismatch) |
| `node scripts/write-audio-manifest.mjs --check` | Verifies the 46-bin audio manifest |
| `node scripts/generate-rule-content.mjs` | Regenerates the 210 變形說明 entries in `src/data/rule-content.js` |
| `node scripts/fetch-audio.mjs` | Downloads the 46 verified audio bins into gitignored `dict/resource/` from the `res-miles` release |
| `node scripts/write-vol-archive.mjs` | Verifies `vol/` and packs `output/dict/vol.bin` (`--check` verifies only, `--out` picks the target path) |
| `node scripts/browser-check.mjs` | End-to-end walk-through of the built site with headless Chromium (run `npm run build` first) |
| `node scripts/motion-probe.mjs` | Prints per-frame motion traces for paging / card flips (informational, no pass/fail) |
| `node scripts/strike-probe.mjs` | Measures where the double strikethrough on 錯誤單詞 is drawn (dev probe) |

`predev` / `pretest` run both manifest checks, so a hash mismatch fails the dev
server and the tests. `prebuild` runs those checks, then
`scripts/generate-rule-content.mjs` (so a stale explanation file cannot ship)
and `scripts/fetch-audio.mjs` (so `npm run build` needs network access to the
`res-miles` GitHub release).

Environment variables for `browser-check.mjs`: `PORT` (preview port, default
5199), `CHROMIUM_PATH` (Chromium binary), `SHOT_DIR` (screenshot directory),
`--screenshots` to enable screenshots. It starts and stops `vite preview` itself.

## Project structure

```text
vol/                        dictionary source: lesson_1.json … lesson_50.json (read-only;
                            revision 31 was a one-time authorized rewrite of each form's
                            chinese / note)
docs/                       spec, architecture, progress, changelog, serving, this file
docs/audit/                 historical dictionary-audit snapshots (not the spec)
docs/screenshot-draft/      early wireframes
docs/logo/                  site logo: logo.jpg and the favicon / touch icons derived from it
scripts/write-sha256.mjs    generates / checks the SHA-256 manifest
scripts/zip.mjs             deterministic deflate ZIP writer
scripts/vol-archive.mjs     verifies `vol/` and packs it into `vol.bin`
scripts/write-vol-archive.mjs  CLI for the archive build (--check / --out)
scripts/generate-rule-content.mjs  regenerates 210 pair explanations (prebuild)
scripts/fetch-audio.mjs     downloads the 46 same-origin audio bins (prebuild)
scripts/browser-check.mjs   end-to-end browser walk-through
scripts/motion-probe.mjs    per-frame motion measurement
src/engine/                 dispatch and session (framework-free, testable under Node)
src/commands/               one module per feature area, each exporting specs()
src/dict/                   form definitions, hashing, archive extraction, ruby alignment,
                            romaji, MD5/Opus audio, quiz keyboard and grading, settings rules
src/study/                  item lists, shuffle, example highlighting, note layer, results,
                            單詞目錄 form rows, 學習 pair lookup + 變形說明 tables + 例如 derivation
src/storage/                IndexedDB dictionary + audio caches, localStorage settings
src/ui/                     store adapter, boot, gestures (swipe/drag), motion, IME editing,
                            scrollbar logic
src/views/                  screens (templates and styles, no rules)
src/components/             shared components (site head, footer, About sheet, ruby word,
                            completion panel, page / list scrollbars)
src/styles/app.css          design tokens and layout
src/data/dict-manifest.json generated dictionary manifest (committed)
src/data/audio-manifest.json  46 audio-bin sha256s (committed)
src/data/rule-content.js    generated 210-entry 變形說明 data (committed)
dict/resource/              gitignored local copy of the 46 lessonX.bin files
output/                     build output (not committed): output/dict/ holds vol.bin
                            and resource/ with the 46 audio bins
```

There is no `public/` directory: the Vite dictionary plugin packs `vol/` into
`output/dict/vol.bin` and serves the same archive in dev; the audio plugin
serves and copies `dict/resource/*.bin`.

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
- **Picker rules**: `targetChips(from, to)` marks the 從 form's 到 chip as
  locked and `toggleTarget(to, id, from)` refuses to add it, so the picker
  renders a disabled chip with the dictionary's locked-chip look and a
  viewport-clamped tooltip (`src/ui/tooltip.js`); the `.vue` files carry no
  rule.
- **Audio delivery**: `prebuild` downloads 46 `lessonX.bin` archives from the
  `res-miles` release into gitignored `dict/resource/` (sha256 against the
  release `digest`), and the Vite plugin ships them same-origin in
  `output/dict/resource/`. `audio.play` verifies a bin once per session, stores
  it in the separate `katsuyou-audio` IndexedDB database and decompresses only
  the one `<md5-mid16>.opus` entry a word or sentence names.
- **學習 / 變形說明**: 210 ordered-pair explanations are generated at build
  time from `vol/` verbs and the pure 段 / 音便 tables
  (`src/study/rule-conjugation.js`, `src/study/rule-content-builder.js`);
  `src/study/rule.js` looks the pair up and `src/study/rule-demo.js` derives the
  interactive 例如 decomposition. `src/commands/rule.js` and
  `src/commands/reader-rule.js` own all the screen transitions; views only
  render. See `docs/spec.md` → 學習 for the copy and data shape.
- **單詞目錄 / 選字 search**: `src/dict/romaji.js` converts Hepburn to kana
  and `src/study/toc.js` paints the matched ranges red on one row per form.
- **Testing strategy**: rules are pure functions tested with Vitest under
  Node; browser APIs are injected fakes; the IndexedDB adapter is tested with
  `fake-indexeddb`; the view layer is walked by `browser-check.mjs` on
  headless Chromium.

Command list, error codes, the session model, the file map and design
decisions: [`architecture.md`](architecture.md).

## Testing and verification

```bash
npm test                                # 49 files / 540 unit tests
npm run build                           # output/index.html + output/dict/vol.bin
                                        # + output/dict/resource/ (46 bins)
node scripts/write-sha256.mjs --check   # dictionary manifest consistent
node scripts/write-audio-manifest.mjs --check  # audio manifest consistent
node scripts/write-vol-archive.mjs --check  # archive verifies (no file written)
node scripts/generate-rule-content.mjs  # 210 pair explanations regenerate
node scripts/browser-check.mjs          # 645–646 end-to-end checks (390×844 primary; quiz
                                        # items are seed-driven, so the per-key checks
                                        # fluctuate by a few)
```

The end-to-end walk-through covers: the tab title and site icons (favicon.ico,
32/192px PNG, apple-touch-icon, all served from the Pages subpath),
loading (success / failure / retry), home (four entries), lesson picking in all
three modes, the dictionary reader (finger-tracking drag, form filter, notes
and double strikethrough, 單詞目錄 all-form rows with romaji search and red
hits, tap-to-play word/sentence audio), the reader's 變形原理 link and scroll
restore, 學習 → 變形說明 → 選字 (210-pair tables, 段 / 音便 mappings, 例如
原理, 小提示), settings, cards (the first card's boundary and the 錯誤單詞 tag),
the quiz (wrong-answer shake, mid-run skipping of wrong-usage words), the
completion screen, reduced motion, the 550px breakpoint, the page and
dropdown scrollbars (including mouse drag and proximity reveal), IndexedDB
cache reuse, zoom lock and the Lucide icons.

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
matching the repo name). Its `prebuild` needs network access to the
`res-miles` GitHub release to fetch any missing audio bin; the bins are not
committed, so a fresh checkout must download them. Publish the contents of
that directory to GitHub Pages (the repo's Pages branch or the site root);
Pages adds the subpath, so the URL is
`https://<user>.github.io/game-japanese-katsuyou-basic/`.
`output/` and `dict/resource/` are not committed. GitHub Actions or a
`gh-pages` branch are both fine; keep the Pages source setting consistent
with whichever you choose. GitHub Pages serves HTTPS, so SHA-256 hashing and
IndexedDB both work.

## Browser support

Verified on Chromium (headless). The site relies on IndexedDB, Web Crypto,
`<ruby>`, CSS `sticky` and `prefers-reduced-motion`, all present in modern
Chrome / Edge / Safari / Firefox; Safari and Firefox have not been verified on
real devices yet.

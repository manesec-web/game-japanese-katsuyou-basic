# Development
Updated for revision 39 (dark theme). Setup only: [`spec.md`](spec.md) is the behavior authority; [`architecture.md`](architecture.md) has module wiring; [`serving.md`](serving.md) has serving troubleshooting; [`README.md`](../README.md) is the user-facing overview.

## Requirements and quick start
Node.js `^20.19.0` or `>=22.12.0` (Vite 7 minimum); verified here with v26.13.1 / npm 12.2.2. Stack: Vue 3.5, Vite 7.3, Vitest 3, unzipit, lucide-vue-next, playwright-core, fake-indexeddb. The browser check also needs a Chromium binary (`CHROMIUM_PATH`).

```bash
npm install
npm run dev        # http://localhost:5173/game-japanese-katsuyou-basic/
npm run preview    # http://localhost:4173/game-japanese-katsuyou-basic/ (after build)
npm test           # 53 files / 579 tests
npm run build      # writes output/; needs network for the audio release
```
Open the `/game-japanese-katsuyou-basic/` subpath, not the server root (`base` in `vite.config.js`). Dev packs `vol/` into `dict/vol.bin` on the fly and serves gitignored `dict/resource/*.bin`.

## npm scripts
| Script | Role |
|---|---|
| `predev` | `write-sha256.mjs --check` + `write-audio-manifest.mjs --check` |
| `dev` | Vite dev server (dictionary + audio middleware) |
| `prebuild` | both manifest checks, `generate-rule-content.mjs` (210 變形說明 entries into `src/data/rule-content.js`), `fetch-audio.mjs` (downloads/sha256-verifies 46 bins into `dict/resource/`, regenerates `src/data/audio-manifest.json`) |
| `build` | `vite build` → `output/` |
| `preview` | `vite preview` of `output/` |
| `pretest` | both manifest checks |
| `test` | `vitest run` |
| `test:watch` | `vitest` watch mode |

`npm run build` needs network access to the `res-miles` GitHub release because `prebuild` fetches any missing audio bin; regenerating the rule content in the same step means stale 變形說明 data cannot ship.

## Project structure
```text
vol/                 50 lesson JSON files; read-only source
docs/                spec, architecture, serving, progress, roadmap, changelog,
                     logo/, screenshot-draft/, audit/
scripts/             manifest writers/checkers, ZIP + vol.bin builders,
                     generate-rule-content, fetch-audio, browser-check, probes, tests
src/engine/          registry (dispatch), session, errors, settle
src/commands/        24 command ids, one module per area
src/dict/            forms, hashing, archive (unzipit), boot, library, quiz,
                     ruby, romaji, settings, md5/Opus audio helpers
src/storage/         idb (katsuyou-dict), audio-idb (katsuyou-audio),
                     localStorage settings.js + theme.js
src/study/           items, shuffle, reader forms, toc, rule*, 例如 derivation
src/ui/              store, bootstrap, boot-progress, theme.js (pure rules),
                     theme-root.js (DOM adapter), gestures, scrollbars, motion
src/main.js          mount, resolve start theme + watch OS, run bootstrap
src/views/           11 thin screens
src/components/      SiteHead, BuildFooter, AboutSheet, ThemeToggle.vue,
                     RubyWord, CompletePanel, scrollbar pieces
src/styles/app.css   tokenised light/dark palettes, layout, motion
src/data/            dict-manifest.json, audio-manifest.json, rule-content.js
index.html           title, theme-color meta, relative docs/logo/ icon links
vite.config.js       base /game-japanese-katsuyou-basic/, outDir output, plugins
dict/resource/       gitignored local cache of 46 audio bins
output/              gitignored build output
```
No `public/` directory: Vite plugins build `output/dict/vol.bin`, copy the audio bins and hash icons from `docs/logo/` into `output/assets/`. Theme modules: pure `src/ui/theme.js`, DOM adapter `src/ui/theme-root.js`, `src/storage/theme.js` (`katsuyou-theme`), command `src/commands/theme.js`, `src/components/ThemeToggle.vue`, start value + OS watch in `src/main.js`.

## Data model
Each verb has 15 form keys; each form carries `vol`, `group`, `chinese`, `japanese`, `sentence`, `note`, `error_usage`. `vol/` is read-only except revision 31's one-time authorized `chinese` / misleading-`note` pass (re-hashed afterwards). Counts: 50 lessons (1, 3, 8, 12 empty), 386 verbs, 5,790 forms (5,599 usable, 191 `error_usage`), 16,797 Japanese–Chinese sentence pairs. Field semantics: [`spec.md`](spec.md) → Data.

## Architecture highlights
- Three layers: framework-free engine/session → command specs → thin `.vue` views; behavior stays in `.js`.
- Every user action goes through `dispatch(session, id, params)` → `{ ok: true, result }` / `{ ok: false, error }`; 24 ids, 11 screens.
- Dictionary: one verified `dict/vol.bin` ZIP + SHA-256 manifest + `katsuyou-dict` IndexedDB; two-phase boot, one retry.
- Audio: 46 same-origin `dict/resource/lessonX.bin` bins fetched at build time (release assets lack CORS); one `<md5-mid16>.opus` entry per tap.
- 學習: 210 generated pairs, pure lookup + `deriveChange`; romaji/kana search in `src/dict/romaji.js` and `src/study/toc.js`.
- Testing: pure Vitest units + injected browser APIs + `scripts/browser-check.mjs`.

Full command/error list, session shape, file map and wiring: [`architecture.md`](architecture.md). Product behavior: `spec.md`.

## Testing and verification
```bash
npm test                                      # 53 files / 579 tests pass
node scripts/write-sha256.mjs --check          # dictionary manifest
node scripts/write-audio-manifest.mjs --check  # 46-bin audio manifest
node scripts/write-vol-archive.mjs --check    # verify vol.bin without writing
node scripts/generate-rule-content.mjs        # regenerate 210 entries
npm run build                                 # output/index.html, assets/, dict/
node scripts/browser-check.mjs                # 671 checks / 0 failures here (±1)
```
`npm test` covers engine/commands, hash/boot, settings, quiz, ruby, romaji, gesture/scrollbar rules, archive packing, `fake-indexeddb`, a real ZIP round-trip through `unzipit`, and regeneration of all 210 entries. `browser-check.mjs` starts `vite preview` itself and needs Chromium: `PORT` (default 5199), `CHROMIUM_PATH` (default `/home/mane/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`), `SHOT_DIR`, `--screenshots` (write screenshots). The count varies ±1 with the seeded quiz item. Verified build: `output/index.html`, 1 JS (~1.45 MB) + 1 CSS + 4 hashed logos in `output/assets/`, `output/dict/vol.bin` (50 entries, 561,815 bytes / ~549 KB, `application/octet-stream`), 46 bins in `output/dict/resource/`.
Not covered: real iOS/Android devices, real IMEs (composition only as pure synthetic events), Firefox/Safari, and human screenshot review. Known limitations: [`progress.md`](progress.md).

## Local serving and deployment
`crypto.subtle` (SHA-256) and IndexedDB need a secure origin; use `npm run dev` or `npm run preview` on localhost, or mount `output/` at the Pages subpath. A LAN IP or `file://` stops boot at `載入失敗（lesson 1）`: [`serving.md`](serving.md).
`base = '/game-japanese-katsuyou-basic/'` in `vite.config.js` (matching `SITE_BASE` in `scripts/browser-check.mjs`); publish the contents of `output/` to GitHub Pages, which adds the subpath and serves HTTPS. `output/` and `dict/resource/` are gitignored, so build first on a fresh checkout with network access. Live site: https://manesec-web.github.io/game-japanese-katsuyou-basic/ (verified 2026-11-14: HTTP 200; `vol.bin` answers `application/octet-stream`).

## Browser support
Verified on headless Chromium. The site uses IndexedDB, Web Crypto, `<ruby>`, CSS sticky positioning and `prefers-reduced-motion` — available in modern Chrome/Edge/Safari/Firefox, but only Chromium is exercised here.

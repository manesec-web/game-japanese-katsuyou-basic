# Architecture
Updated for revision 40 (Google Analytics). Wiring only: [`spec.md`](spec.md) is the behavior authority; dated revisions live in `changelog.md` / `roadmap.md`. The old per-revision implementation notes are replaced by that pointer.

## Shape of the app
One static Vue 3.5 SPA built with Vite 7 (Vitest 3). No router, backend, MCP or model calls. Runtime fetches same-origin `dict/vol.bin` once on boot and lazily fetches `dict/resource/lessonX.bin` per lesson when audio is requested; two third-party scripts are requested at start — the Google Tag Manager container and the GA4 measurement tag that reports the page views — see Analytics.
Three layers: `src/engine/` (framework-free command registry + plain session), `src/commands/` (one module per area exporting `specs()`), and `src/views/` + `src/components/` (thin Vue: render state, call `dispatch`, own no rules; `.vue` files hold templates and styles only). `src/ui/store.js` wraps the session in `reactive()` with `send(id, params)`; `src/main.js` mounts, resolves the start theme, starts analytics, then runs `bootstrap(store)`.
Scale: 11 screens, 3 modes, 15 forms, 24 command ids, 210 變形說明 pairs, 50 lessons, 386 verbs, 5,790 forms (5,599 usable, 191 `error_usage`), 16,797 example pairs; lessons 1, 3, 8, 12 have no verbs.

## Runtime wiring

`src/main.js` builds the library (injected IndexedDB store + committed
manifest), settings storage and theme storage, registers `allSpecs(...)` in the
singleton registry, then creates the reactive store. `src/ui/bootstrap.js`
awaits `app.boot`, loads the verified library and settings, and enters `home`;
retry dispatches `app.boot` again. `boot.running` prevents a concurrent boot.
The scroll guard is attached at mount and detached with the app on Vite HMR.
`src/main.js` also restores the saved settings before boot, loads the Google Tag
Manager container named there (`src/analytics/gtm.js`) once, and watches
`session.screen` to push one page view per screen.
`src/ui/theme-root.js` paints the document root from `session.theme.value` and
follows OS changes only while `source === 'system'`; a `theme.toggle` sets
`source: 'user'` and stops that watcher from changing the value. The OS theme
is already painted by CSS on the first frame, before this module executes.
Views never read the DOM for rules; gestures, scrollbars and motion have pure
rule modules with thin non-pure adapters (see Styling and motion). The two
IndexDB stores, the two localStorage adapters and the manifest are injected
dependencies, so unit tests can replace them without a browser. On failure
`bootstrap` leaves `boot.error` set and the loading view keeps the head, credit
line and retry control available. Chrome, Safari, iOS and Android runtime
variants are not exercised by the Node tests.

## Command contract
Descriptor `{ id, params, enabled?, run }`; `run` mutates the session in place; `app.boot` and `audio.play` are async. `dispatch(session, id, params)` returns `{ ok: true, result }` or `{ ok: false, error: { code, message, ...details } }` (a Promise of that envelope for async commands).
Unknown id → `unknown-command`; bad params → `invalid-params` / `missing-param`; `enabled === false` → `command-disabled` and `run` is not called; a thrown error → `command-failed`, unless it carries a string `code` and optional `details` (`CommandError`, `src/engine/errors.js`), which is preserved. Bad params, empty data and hash mismatches never throw an uncaught exception. Command-level codes: `boot-failed`, `library-missing`, `library-invalid`, `lesson-empty`, `invalid-settings`, `no-items`, `quiz-no-item`, `invalid-index`, `invalid-example`, `invalid-rule-link`, `audio-unavailable`.

All 24 ids grouped (parameter contracts: `spec.md`, `AGENTS.md`):

| Group | ids |
|---|---|
| Boot / navigation | `app.boot`, `nav.go` |
| Lessons / settings | `lessons.toggle`, `lessons.selectAll`, `settings.patch` |
| Study | `study.start`, `study.finish` |
| Reader | `dict.next`, `dict.prev`, `dict.goto` |
| Cards | `card.flip`, `card.next`, `card.prev` |
| Quiz | `quiz.input`, `quiz.submit`, `quiz.advance` |
| 學習 / 變形說明 | `rule.open`, `rule.setFrom`, `rule.setTo`, `rule.selectExample`, `rule.openFromReader`, `rule.rememberScroll` |
| Audio / theme | `audio.play`, `theme.toggle` |

Screens: `loading`, `home`, `picker`, `reader`, `toc`, `card`, `quiz`, `settings`, `learn`, `rule`, `example`. `picker` and `settings` vary by `session.mode` (`dict`, `card`, `quiz`); `learn` → `rule` → `example` is the grammar-reference chain. Transitions, copy, grading, gestures and completion rules: `spec.md`.

## Session
`createSession()` (`src/engine/session.js`) returns plain data: `screen`, `mode`, `lessons`, `settings`, `items`, `index`, `flipped`, `answer` (`input`, `wrong`, `revealed`, `verdict`), `results`, `finished`. Other slices:

- `boot`: `{ checked, total, done, error, running, download: { base, loaded, total, done } }`; `download` feeds the pure loading-bar rule in `src/ui/boot-progress.js`.
- `quizSkipped`: `error_usage` items held out of the live quiz queue.
- `audio`: `{ verified, states, hint }` — per-page-session sha256 checks, per-target visual states, transient failure hint.
- `rule`: `{ from, to, example, returnTo, ruleScrollTop, readerScrollTop, readerRestore }` — transient 變形說明 / 選字 / reader-link state, not persisted.
- `theme`: `{ value, source }`; `source` is `user` (stored choice) or `system` (OS preference).

Commands own transitions; nothing derived is stored twice. `src/dict/library.js` holds verified data in memory, injected into commands; the session keeps only the small lesson summary the picker renders.

Persistence is split: settings and lesson choices go to localStorage
(`game-japanese-katsuyou-basic-settings`) via `src/storage/settings.js`; the theme choice goes to
`game-japanese-katsuyou-basic-theme`; verified dictionary bytes and audio bins live in the two
IndexedDB databases. `session.items`, `session.audio.verified`, `session.rule`,
`session.quizSkipped`, the analytics container already loaded and the scroll
memories are deliberately page-local
run/screen state. `src/ui/bootstrap.js` restores settings after boot and loads
the verified library before `home`. Legacy `katsuyou-*` keys are migrated on
first read/open (see Storage migration).

## Storage migration

The storage keys were renamed from the earlier `katsuyou-*` names to the
`game-japanese-katsuyou-basic-*` names used throughout (all under Chrome's
64-ASCII-byte IndexedDB name cap). The adapters migrate once and keep the old
names exported as `LEGACY_*` constants.

| Old | New |
|---|---|
| `katsuyou-settings` | `game-japanese-katsuyou-basic-settings` (37) |
| `katsuyou-theme` | `game-japanese-katsuyou-basic-theme` (34) |
| `katsuyou-dict` (store `lessons`) | `game-japanese-katsuyou-basic-dict` (33) |
| `katsuyou-audio` (store `bins`) | `game-japanese-katsuyou-basic-audio` (34) |

localStorage (`src/storage/settings.js`, `src/storage/theme.js`): on `load()`, if
the new key is missing and the legacy key exists, the legacy value is copied to
the new key and the old key is removed; if both exist, the new value is kept and
the old key is dropped. `save()` writes only the new key, then tries to delete a
leftover legacy key (a failed delete does not fail the save). A thrown read or
write leaves the legacy key in place.

IndexedDB (`src/storage/idb.js`, `src/storage/audio-idb.js`): on first `open()`,
if a legacy database exists, every record in the same object store is copied into
the new database when the new store is empty; existing new data is kept. After a
successful copy — or when the new database already has data, or the legacy
database was empty — the legacy database is deleted. If the copy fails and the
new store is still empty while the legacy store had records, the old database is
left for a later retry. Test databases with custom names do not auto-migrate.

The Vite plugin names (`katsuyou-dictionary`, `katsuyou-audio-resource`) and the
fetch User-Agent strings (`katsuyou-audio-fetch`, `katsuyou-audio-manifest`) were
not renamed.

## File map
```text
docs/                 spec.md (authority), architecture/development/serving/progress/
                      roadmap/changelog.md, audit/, screenshot-draft/, logo/
vol/                  50 lesson JSON files; read-only dictionary source
scripts/              write-sha256 + write-audio-manifest (generate, --check),
                      zip, vol-archive, write-vol-archive, res-archive,
                      write-res-archive, fetch-audio, generate-rule-content,
                      check-conjugation, browser-check, motion-probe,
                      strike-probe; colocated Vitest tests
src/config/analytics.js  GTM_ID / GA4_ID (repo config; empty disables)
src/main.js           entry: store, settings/theme start, analytics, mount, bootstrap
src/App.vue           screen switch + shared shell
src/engine/           registry.js (dispatch), settle.js, errors.js, session.js
src/analytics/        page-view.js (pure ID/title/URL/payload rules), gtm.js adapter
src/commands/         index.js + specs for boot, nav, lessons, settings, study,
                      dict, card, quiz, rule, reader-rule, audio, theme
src/dict/             forms, hash, archive (unzipit), boot, lessons, library,
                      quiz, ruby, settings, romaji, md5, audio-name/-bin/-entry/-player
src/storage/          idb (game-japanese-katsuyou-basic-dict / lessons), audio-idb (game-japanese-katsuyou-basic-audio),
                      settings.js + theme.js localStorage adapters
src/study/            items, shuffle, reader-forms, highlight, card-tags, results,
                      toc, reader-audio, window-views, rule, rule-demo,
                      rule-conjugation, rule-content-builder
src/ui/               store, bootstrap, boot-progress, theme, theme-root,
                      scroll-guard, scrollbar, page-scrollbar, element-thumb,
                      swipe, drag, motion, window, paging-window, typing, tooltip
src/views/            11 thin screens (LearnView / RuleView / ExampleView included)
src/components/       SiteHead, BuildFooter, AboutSheet, ThemeToggle, RubyWord,
                      CompletePanel, PageScrollBar, ScrollThumb; Lucide icons
src/styles/app.css    design tokens (light + dark), layout, motion, breakpoints
src/data/             dict-manifest.json, audio-manifest.json, rule-content.js
dict/resource/        gitignored local cache of 46 lessonX.bin files
index.html            title, theme-color meta, relative logo icon links
vite.config.js        base, outDir "output", dictionary + audio plugins
output/               gitignored build output (index.html, assets/, dict/)
```

## Dictionary delivery
- **Manifest**: generated, committed `src/data/dict-manifest.json` with 50 lowercase-hex SHA-256 entries. `write-sha256.mjs --check` exits non-zero on a mismatch; `predev`, `pretest`, `prebuild` run it plus the audio check. `vol/` is read-only; revision 31 was a one-time authorized data-only exception (form-level `chinese` and misleading `note`, re-hashed afterwards) and no future edit is authorized.
- **Archive**: one deterministic deflate ZIP `dict/vol.bin` (fixed timestamps, no `.zip` suffix, served `application/octet-stream`), 50 entries, 561,815 bytes (~549 KB) from 4,762 KB raw. `scripts/vol-archive.mjs` verifies every lesson against the manifest before packing, so a tampered source or manifest fails `npm run build`; `write-vol-archive.mjs --check` verifies without writing. Vite middleware serves it in dev and writes `output/dict/vol.bin` on build; no per-lesson JSON is published.
- **Two-phase boot** (`src/dict/boot.js`): hash lessons already in IndexedDB `game-japanese-katsuyou-basic-dict` / `lessons` and collect missing/corrupt ones (including empty lessons 1, 3, 8, 12); `boot.checked` counts verified lessons, `boot.total` is 50. Then fetch `dict/vol.bin` once, read lazy entries with `unzipit`, verify and store only matches. A failed download, unreadable archive, absent entry or hash mismatch is retried with a second download; anything still unverified sets `boot.error` and leaves `boot.done` false.
- **Progress**: pure `src/ui/boot-progress.js` maps the cache-check share, streamed bytes against `Content-Length` and a verification hold to a bar that never moves backwards; a retry restarts at the already-verified percentage.

Live Pages site verified 2026-11-14: HTTP 200; `vol.bin` answers `application/octet-stream`. Loading-screen copy and retry: `spec.md`.

## Audio delivery
- **Build**: `prebuild` runs `scripts/fetch-audio.mjs`, downloading 46 `lessonX.bin` files from the `res-miles` GitHub release into gitignored `dict/resource/`, sha256-verifying each against the release asset `digest` and regenerating `src/data/audio-manifest.json`. Release assets have no CORS, so same-origin build-time delivery is required. A Vite plugin copies the bins to `output/dict/resource/` and serves them in dev.
- **Runtime**: `audio.play` lazily fetches `dict/resource/lessonX.bin`, sha256-verifies once per page session, caches it in `game-japanese-katsuyou-basic-audio` IndexedDB, decompresses the single `<md5-mid16>.opus` entry (`src/dict/md5.js`, `audio-name.js`) and plays it through a Blob URL and `<audio>`. Any failure shows 「該音頻暫時無法播放」. Modules: `audio-bin.js`, `audio-entry.js`, `audio-player.js`, `study/reader-audio.js`, `commands/audio.js`. Targets, hover/playback states and copy: `spec.md`.

## Analytics (revision 40)
| Layer | Responsibility |
|---|---|
| Config | `src/config/analytics.js`: `GTM_ID` / `GA4_ID` — the one file a developer edits; an empty string disables an ID |
| Pure rules | `src/analytics/page-view.js`: `GTM-`/`G-` validation + trim/uppercase, per-screen title, `#/<screen>` page location, `page_view` payload |
| Adapter | `src/analytics/gtm.js`: standard GTM snippet (dataLayer, `gtm.start`, one async `gtm.js` script) and gtag.js with `send_page_view: false`; pushes the dataLayer entry and the GA4 `page_view` per screen change |
| Settings | none — `game-japanese-katsuyou-basic-settings` has no analytics section; `src/storage/settings.js` drops a stale section from revision-40 storage on load |
| Entry | `src/main.js`: imports `GTM_ID` / `GA4_ID`, loads the container and the measurement tag once, watches `session.screen` |

The container's own page view is the landing view; the site reports `loading` and the first `home`
through it, then sends one GA4 `page_view` per later screen change. The browser URL is not changed —
the screen is named in `page_location` as `#/<screen>`. Payload fields, titles and screen ids:
`spec.md` → Analytics.

## Dark theme (revision 39)
| Layer | Responsibility |
|---|---|
| Pure rules | `src/ui/theme.js`: `THEMES`, `THEME_KEY` (`game-japanese-katsuyou-basic-theme`), `systemTheme`, `themeState`, `nextTheme` |
| DOM adapter | `src/ui/theme-root.js`: `applyTheme`, `watchSystemTheme` |
| Storage adapter | `src/storage/theme.js`: localStorage choice, non-fatal on failure |
| Command | `src/commands/theme.js`: `theme.toggle` flips, marks `source: 'user'`, stores |
| View | `src/components/ThemeToggle.vue`: home screen only |
| Entry | `src/main.js`: resolves start value, sets `session.theme`, applies root attribute, watches OS until a user choice |

Every colour is a token in `src/styles/app.css` (ink, column, accent, highlight, note, error, line, surfaces, tints, thumbs, overlay, tooltip, progress, gradient, grain, shadows). The light palette is unchanged; the dark palette appears under both `:root[data-theme='dark']` (stored choice) and `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` (OS theme on first paint, before the module runs). No `.vue` file writes a literal colour. `index.html` keeps the `theme-color` meta (`#1f1b3a`) and title `大家の動詞轉型練習`. Toggle copy, icon, `aria-pressed` and placement: `spec.md`.

## 學習 / 變形說明
- `src/data/rule-content.js`: 210 = 15 × 14 ordered pairs, generated by `scripts/generate-rule-content.mjs` (`prebuild`) from the pure tables in `src/study/rule-conjugation.js` (五段 / 一段 / 不規則, 段 and 音便 maps) and real `vol/` forms via `src/study/rule-content-builder.js`.
- Pure lookup and completeness: `src/study/rule.js`. Pure 例如 decomposition: `src/study/rule-demo.js` (`deriveChange` uses shared 語尾 / 段 tables, not a longest-prefix guess).
- Commands: `src/commands/rule.js` (學習目錄 → 變形說明 → 選字) and `src/commands/reader-rule.js` (變形原理 + scroll memory). 選字 search shares `src/dict/romaji.js` and `src/study/toc.js`. Views only render; all authored copy and 210 blocks: `spec.md` → 學習.

## Testing
- `npm test`: 53 files / 579 tests pass (Vitest 3); `pretest` runs both manifest `--check` scripts. Pure rules are tested under Node with injected browser APIs (fetch, IndexedDB).
- `src/storage/idb.test.js` uses real adapter + `fake-indexeddb`. `scripts/zip.test.js` and `src/dict/archive.test.js` prove real ZIP round-trip through `unzipit`; `scripts/vol-archive.test.js` proves a tampered manifest stops the build; `src/study/rule-conjugation.test.js` regenerates all 210 entries and compares them with shipped data.
- `node scripts/browser-check.mjs`: 671 checks / 0 failures here (±1 with the seeded quiz item). It starts `vite preview` and drives headless Chromium through loading/retry, home, three pickers, reader, 單詞目錄, settings, cards, quiz, completion, 學習 → 變形說明 → 選字, audio, IndexedDB reuse, the single archive request, reduced motion and the 550px breakpoint. Env: `PORT` (default 5199), `CHROMIUM_PATH` (default `/home/mane/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome`), `SHOT_DIR`, `--screenshots`.
- Not covered: real iOS/Android devices, real IMEs, Firefox/Safari, screenshot visual review. See `development.md` / `progress.md`.

## Build
`prebuild` order: `write-sha256.mjs --check` → `write-audio-manifest.mjs --check` → `generate-rule-content.mjs` (210 entries) → `fetch-audio.mjs` (network access to `res-miles` release) → `vite build`. Node `^20.19.0` or `>=22.12.0` (Vite 7); verified here with v26.13.1 / npm 12.2.2.
```text
output/index.html
output/assets/          1 JS (~1.45 MB), 1 CSS, 4 hashed logo icons
output/dict/vol.bin     50-entry ZIP, 561,815 bytes (~549 KB), application/octet-stream
output/dict/resource/   46 lessonX.bin audio bins
```
`base = '/game-japanese-katsuyou-basic/'` in `vite.config.js`, matching `SITE_BASE` in `scripts/browser-check.mjs`. No `public/` directory: icons come from `docs/logo/` (see `logo/README.md`). `output/` and `dict/resource/` are gitignored. Live site: https://manesec-web.github.io/game-japanese-katsuyou-basic/.

## Styling and motion
Motion/geometry rules are pure (`src/ui/swipe.js`, `drag.js`, `window.js`, `scrollbar.js`, `motion.js`, `tooltip.js`); DOM adapters are `page-scrollbar.js`, `element-thumb.js`, `paging-window.js`, `scroll-guard.js`; `scripts/motion-probe.mjs` traces frames. Column width, breakpoints, `prefers-reduced-motion` branch and all Look and motion rules: `spec.md`. Do not restate product behavior here.

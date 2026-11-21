# AGENTS.md — execution plan (revision 40, working tree)

**Product:** static Vue 3 site for Japanese verb conjugation; source in `src/`, build output `output/`, published via GitHub Pages at https://manesec-web.github.io/game-japanese-katsuyou-basic/ . **Behavior authority:** `docs/spec.md` — read its matching section before building a piece. If the spec does not cover a product behavior, stop and ask. Do not invent a rule. This file is the authoritative how-to-work contract.

## How to work

1. Do one task from the task list at a time. Finish its checks before the next task.
2. The view is thin: `.vue` files hold template and style only; behavior lives in `.js`. A Vue file calls commands and renders state.
3. Every user-visible action is a command with `id`, `params`, `enabled`, `run`. The view and the tests call the same `dispatch(session, id, params)`; when `enabled` is false, `dispatch` returns `error` and does not call `run`.
4. A command returns `{ ok: true, result }` or `{ ok: false, error }`. Bad params, empty data and a hash mismatch return `error`; this path must not throw an uncaught exception.
5. Leave the JSON in `vol/` unchanged — that directory is the dictionary source. **One-time authorized exception (revision 31):** only each form's `chinese` and misleading `note` were edited; `vol`, `group`, `japanese`, `sentence` (including its Chinese translations and notes), `error_usage`, key order, lesson structure and file formatting stayed byte-equivalent, verified against the original bytes before the temporary baseline and validator were removed. This exception does **not** authorize any future edit to `vol/`.
6. Do not add MCP, a backend, or a model call inside the site. The only third-party runtime scripts are the Google Tag Manager container and the GA4 measurement tag of revision 40 (`src/analytics/gtm.js`, IDs in `src/config/analytics.js`); do not add another without a spec entry.
7. Do not reproduce the blue boxes in the wireframes. Follow the information architecture in `docs/spec.md` and its Look and motion section for visual design.
8. Text outside the green phone frame is a note to the reader, not a UI control.
9. When you finish, say which commands you ran and which checks you could not run.

## History (delivered; not pending work)

T1–T8 are complete. Delivered revisions: **40** Google Analytics page views via repo-config IDs (`src/config/analytics.js`); **39** dark theme; **38** reader → 變形說明 link, scroll memory, table-based 例如 decomposition; **37 / 37b / 37c** 學習 mode, 學習目錄, 變形說明, 選字, 210 generated ordered-pair explanations from real `vol/` forms, 例如 and 小提示; **36** all-form 單詞目錄 with hiragana/romaji search and red highlights; **35** reader Opus audio; **34** locked/disabled 到 chips, 翻卡練習 rename, card pill during drag; **33** download-aware loading bar; **32** single `dict/vol.bin` archive; **31** form-level Chinese gloss data. Earlier revisions 2–30 (motion, paging window, settings, scroll thumbs, title/logo, 單詞目錄, etc.) are also delivered. Details live in `docs/changelog.md`, `docs/progress.md`, `docs/roadmap.md`; do not reopen tasks without a spec change. Backlog: B1 朗讀 (done rev 35), B2 優化下載文件 (done rev 32–33), **B3 優化UI pending — needs a `docs/spec.md` entry first**.

## Current feature: Google Analytics (revision 40)

The Analytics IDs are repo configuration, not user settings: `src/config/analytics.js` exports `GTM_ID` and `GA4_ID` (shipped `GTM-W7387LLQ` / `G-NFDK8SXY0M`), an empty string disables one, and the settings screens carry neither field. `src/analytics/gtm.js` loads the container with the standard snippet (dataLayer, `gtm.start`, one async `gtm.js` script) and loads gtag.js with `send_page_view: false` for the measurement ID; the browser URL never changes. Every screen change pushes `{ event: 'page_view', screen_name, page_title, page_location }` into the dataLayer and sends it through `gtag('event', 'page_view', …)`, except `loading` and the first `home`: the container's own landing page view covers those. `src/storage/settings.js` drops a stale `analytics` section from an old `katsuyou-settings` object and writes the cleaned object back. Screen ids, titles and `#/<screen>` page locations: `docs/spec.md` → Analytics. Pure rules: `src/analytics/page-view.js`. `src/main.js` reads the config and watches `session.screen`. Settings schema: `src/dict/settings.js` (no analytics section). No `.vue` involvement.

## Previous feature: dark theme (revision 39)

Only `home` has the round theme switch: 8px right of the 習 ending the head's `動詞轉型練習` line, vertically centred on that line, in `SiteHead.vue`'s `aside` slot on a `1fr auto 1fr` subtitle row; no `loading` switch and each run screen keeps its own bar. It draws `Moon` in light / `Sun` in dark, is labelled `切換為深色模式` / `切換為淺色模式`, reports `aria-pressed`, and runs `theme.toggle`. The site follows `prefers-color-scheme` until a press stores a choice under localStorage key `katsuyou-theme`; the CSS media query paints the OS theme on first paint (no light flash), then the stored choice wins. All colours are tokens in `src/styles/app.css`; no `.vue` file or component writes a literal colour. Pure rules: `src/ui/theme.js`. Adapters: `src/ui/theme-root.js` (DOM), `src/storage/theme.js` (storage), `src/commands/theme.js` (command); `src/main.js` resolves the start value and paints it.

## Layout (compact)

```text
vol/                      50 lesson_1..50.json; dictionary source, DO NOT EDIT
docs/spec.md              behavior authority; changelog/progress/roadmap; screenshot-draft/; logo/
scripts/                  write-sha256.mjs, write-audio-manifest.mjs (manifest --check),
                          zip.mjs, vol-archive.mjs, write-vol-archive.mjs,
                          generate-rule-content.mjs, fetch-audio.mjs, browser-check.mjs, *.test.js
src/main.js               boot → settings/theme/analytics → Vue mount
src/engine/               registry.js (dispatch), session.js (plain state/transitions)
src/commands/*.js         one specs() file per area
src/dict/                 hash, archive (unzipit), boot, library, quiz, ruby, forms, settings,
                          md5, audio-name, audio-bin, audio-entry, audio-player
src/study/                item lists, shuffle, highlight, results, toc, romaji, reader-audio,
                          rule.js, rule-demo.js, rule-conjugation.js, rule-content-builder.js
src/analytics/            page-view.js (pure rules), gtm.js (GTM + gtag.js adapters)
src/config/analytics.js    GTM_ID / GA4_ID — edit here to change Analytics IDs
src/data/                 dict-manifest.json, audio-manifest.json, rule-content.js (generated)
src/storage/              idb.js, audio-idb.js, settings.js, theme.js
src/ui/                   store.js, bootstrap.js, boot-progress.js, theme.js, theme-root.js, tooltip.js
src/views/ src/components/ src/styles/app.css
index.html                title 大家の動詞轉型練習 + relative logo icon links
vite.config.js            outDir output, base /game-japanese-katsuyou-basic/, dict + audio plugins
dict/resource/            46 lessonX.bin, gitignored local cache
output/                   build output, NOT committed; output/dict/vol.bin + output/dict/resource/
```
No `public/` directory. `vol/` is packed into `output/dict/vol.bin` and served in dev by a Vite plugin; logo icons come from `docs/logo/` via relative `link` tags. `prebuild` runs both manifest checks, `scripts/generate-rule-content.mjs` and `scripts/fetch-audio.mjs`, so a build needs release network access (GitHub release assets are not CORS-fetchable; the 46 bins are downloaded and sha256-verified at build time, then shipped same-origin).

## Commands (24 ids; all via `dispatch`)

| id | Effect |
|---|---|
| `app.boot` | Hash IndexedDB lessons against manifest; fetch `dict/vol.bin` once (one retry) and verify/store missing or corrupt entries; update `boot.checked` / `boot.total` (=50), set `boot.error` on failure |
| `nav.go` | `params.screen`, optional `params.mode`; returning to `reader` from `rule` also restores the saved reader scroll position |
| `lessons.toggle` / `lessons.selectAll` | Toggle one lesson (no-verb lesson → `error`); clear all when all selected, else select every lesson with verbs, per-mode |
| `study.start` | Build the run's item list and open its study screen |
| `dict.next` / `dict.prev` | Next/previous dictionary word, clamped at ends |
| `card.next` / `card.prev` | Next/previous card and turn the card face up |
| `dict.goto` | Open reader at `params.index` (integer inside the run; else `error`) |
| `card.flip` | Swap face and back |
| `study.finish` | End card run (完成 on last card), show completion panel |
| `quiz.input` | `op` `append` (with `text`) or `backspace` |
| `quiz.submit` | Grade per spec |
| `quiz.advance` | Continue after a revealed answer |
| `settings.patch` | Merge settings; unknown field rejects the whole patch |
| `audio.play` | `params.target`, `lesson`, `text`: lazily download + sha256-verify the lesson bin, decompress and play one Opus entry; bad params → `invalid-params`, any failure → `audio-unavailable` / 「該音頻暫時無法播放」 |
| `rule.open` | Open 變形說明 with `params.to`; 從 defaults ます形 (辭書形 when 到 is ます形); example resets |
| `rule.setFrom` / `rule.setTo` | Change 從 / 到; 到 never equals 從, so a collision moves 到 to the fallback |
| `rule.selectExample` | Pick example from 選字 by `lesson` + `index` (real verb or `error`) |
| `rule.openFromReader` | Reader's 變形原理: `params.to`, optional `scrollTop`; 從 = 預設顯示形式, 例如 = current verb |
| `rule.rememberScroll` | Record 變形說明 `scrollTop` before opening 選字 |
| `theme.toggle` | Flip theme, mark it a user choice, store under `katsuyou-theme` |

Screens: `loading`, `home`, `picker`, `reader`, `toc`, `card`, `quiz`, `settings`, `learn`, `rule`, `example`. `picker` and `settings` use `session.mode`: `dict` / `card` / `quiz`. Saved choices live under `localStorage` key `katsuyou-settings` (details in `docs/spec.md` → Saved settings); the theme choice uses `katsuyou-theme`.

## Tasks T1–T8 (acceptance checklist; all delivered)

- **T1 Engine skeleton:** `npm test` passes with an unknown-command → `ok: false` test; `npm run build` writes `output/`; `output/` gitignored; no business logic in `.vue`.
- **T2 Hash and boot:** `write-sha256.mjs --check` fails on damaged manifest and succeeds when restored (`prebuild`/`pretest` run it); fake archive fetch/store tests cover missing file, matching hash, first mismatch redownload, second mismatch stopping with `boot.error`; real adapter tests (`fake-indexeddb`, `unzipit` ZIP round-trip, tampered manifest blocks build); empty lessons 1/3/8/12 downloaded and checked too.
- **T3 Loading/home:** head 大家の日本語 / 動詞轉型練習 / 涵蓋初級 1 – 50 課的動詞, progress bar with `Loading ...`, footer `Build with ❤ by Mane` alone opening About; success → `home`, failure stops bar and offers retry via `app.boot`; home's four entries 學習 / 字典 / 翻卡練習 / 測驗 and new-tab GitHub link; column ≤480px centred, viewport-filling background. Browser: loading, all four entries, footer link.
- **T4 Picker:** per-mode lesson memory; no-verb lessons grey/inert (test: lesson 1 cannot be selected; `lessons.selectAll` skips empties); 開始 disabled until valid; 字典 has no 從/到, card/quiz have all 15 forms; target equal to source is a disabled chip with tooltip `這和「從」的形式相同，不能選為「到」`, skipped by 全選 and followed when 從 changes (test).
- **T5 Dictionary:** order lesson then `vols`; swipe right/`dict.next`, swipe left/`dict.prev`, 1:1 finger drag, settle once on release past threshold, spring back otherwise, walls still; first/last clamp (test: index stays inside list); settings 預設顯示形式 / 選擇顯示的類型 / 跳過錯誤的單詞 / 顯示平假名注音. Browser: swipe right loads next word; settings survive reload.
- **T6 Cards:** face = source form (class pill when 一開始顯示幾類動詞 on), back = target + Chinese gloss; tap `card.flip`; swipe right/left next/prev; changing cards returns to face (test); one card per (verb, target) in verb then canonical form order; browser: tap reveals, swipe right advances, first card completely still on backward drag, last-card 完成 unchanged.
- **T7 Quiz:** pure keyboard invariant — every hiragana character of the correct reading appears on a key and a different random seed changes distractor arrangement; pure grading tested; correct advances, wrong stays, third wrong reveals and waits for `quiz.advance` / 下一題; 自動提交答案 auto-submits an accepted answer, check button submits anytime. Browser: one correct answer, three misses with third waiting for 下一題.
- **T8 Finish:** under `prefers-reduced-motion: reduce` the background stays still and screen changes fade; `npm test` + `npm run build`; `output/dict/vol.bin` has 50 entries and `output/index.html` exists.

## Done

T1–T8 each have test output or a browser pass; `docs/spec.md` behaviors are on screen (including empty lessons, a failed hash, and a revealed answer that does not advance by itself); no MCP, no backend, no business logic inside `.vue` files.

## Verification (current, 2026-11-18)

- `npm test`: 53 files / 579 tests passing. `npx vite build` (build only, revision 40): succeeds — `output/index.html`, `output/dict/vol.bin` with 50 entries, 46 audio bins. Full `npm run build` adds the prebuild audio fetch, which can 403 outside release access.
- `node scripts/browser-check.mjs`: 671 checks / 0 failures (count varies ±1 with the seeded quiz item); needs Chromium via `CHROMIUM_PATH`.
- Runtime here: Node v26.13.1 / npm 12.2.2; Vite 7 requires `^20.19.0` or `>=22.12.0`.
- Live site verified 2026-11-14: HTTP 200, `dict/vol.bin` served `application/octet-stream`.
- `vol/` counts: 50 lessons; 386 verbs; 5,790 forms; 5,599 usable; 191 `error_usage`; 16,797 sentence pairs; empty lessons 1/3/8/12.

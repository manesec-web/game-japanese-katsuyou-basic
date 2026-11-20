# Progress

Last updated: 2026-11-18 (revision 40 — Google Analytics, working tree).

**Status: complete.** T1–T8 and revisions 2–40 are delivered, including passes
A/B. **Revision 40 is the latest/current revision.** Behavior:
[`docs/spec.md`](spec.md); plan/checklist: `AGENTS.md`; dated history:
[`docs/changelog.md`](changelog.md); task evidence: [`docs/roadmap.md`](roadmap.md).
The build is live at `https://manesec-web.github.io/game-japanese-katsuyou-basic/`
(verified 2026-11-14: HTTP 200, `dict/vol.bin` answers `application/octet-stream`).

## Current verification

| Command | Result |
|---|---|
| `npm test` | **53 files / 587 tests pass**; `pretest` checks both manifests |
| `npm run build` | succeeds; `prebuild` regenerates 210 rule-content entries and downloads/verifies 46 audio bins |
| `node scripts/browser-check.mjs` | **682 checks / 0 failures** here; ±1 with the seeded quiz item (revision 40 added 21 analytics checks) |
| `node scripts/write-sha256.mjs --check`, `node scripts/write-audio-manifest.mjs --check` | 50-lesson and 46-bin manifests consistent |

- Environment here: Node v26.13.1 / npm 12.2.2; Vue 3.5 / Vite 7.3 / Vitest 3. Vite 7 requires Node `^20.19.0` or `>=22.12.0`.
- Build layout: `output/index.html`; `output/assets/` = 1 JS + 1 CSS + 4 hashed logos; `output/dict/vol.bin` = 50 entries, 549 KB / 561,815 bytes from 4,762 KB raw, ZIP as `application/octet-stream`; `output/dict/resource/` = 46 audio bins.
- `output/` and `dict/resource/` are gitignored; Pages publishes the contents of `output/`.
- Data: 50 lessons, 386 verbs, 5,790 forms (5,599 usable, 191 `error_usage`), 16,797 sentence pairs, 15 forms, 210 ordered 變形說明 pairs; empty lessons 1, 3, 8, 12.
- `src/data/rule-content.js` is regenerated and byte-compared against real `vol/` forms by `src/study/rule-conjugation.test.js`.
- Browser harness needs Chromium (`CHROMIUM_PATH` when not in the default cache), starts `vite preview` on `PORT` (default 5199), and accepts `--screenshots` with `SHOT_DIR`.
- `scripts/motion-probe.mjs` and `scripts/strike-probe.mjs` are diagnostics, not pass/fail gates.
- Git/keys: branch `main` tracking `github/main`; IndexedDB `katsuyou-dict` (`lessons`) / `katsuyou-audio`; `localStorage` `katsuyou-settings` / `katsuyou-theme`; `session.rule`, `session.theme` and the loaded analytics container are transient.

## Revision 40 — Google Analytics (current)

- Two saved IDs in `katsuyou-settings` → `analytics`: `containerId` (`GTM-W7387LLQ`) loads the GTM container with the standard snippet; `measurementId` (`G-NFDK8SXY0M`, the GA4 destination inside that container) loads gtag.js with `send_page_view: false`.
- Every screen change pushes `{ event: 'page_view', screen_name, page_title, page_location }` into `window.dataLayer` and, past the landing pair (`loading`, first `home`, covered by the container's own page view), sends the same entry through `gtag('event', 'page_view', …)`, so Google Analytics receives one page view per screen; the browser URL is never changed (`page_location` names the screen as `#/<screen>`).
- Both IDs are edited through the `Google Analytics 容器 ID` / `GA4 量測 ID` fields at the foot of all three settings screens; Enter/blur commits through `settings.patch`, trimmed and uppercased, invalid values rejected with the stored ID shown again, changes apply on the next load.
- Runtime probe against the built site: GA collect for the landing view at load, then one `page_view` with the right fragment for the picker, reader and settings screens (no duplicates).
- Pure `src/analytics/page-view.js`; adapter `gtm.js`; settings schema/validation in `src/dict/settings.js`; `main.js` wiring. `.vue` only renders the fields.
- Verification: **53 files / 587 tests**, `npm run build`, **682 browser checks / 0 failures** (21 new analytics checks: GTM/gtag scripts, gtm.start first, landing + screen page views, `#/<screen>` locations, unchanged browser URL, both fields' defaults/commits/rejection/restore). `vol/` untouched.

## Revision 39 — dark theme (previous)

- Home-only 36px round switch, 8px right of the 習 in `動詞轉型練習`, vertically centred via `SiteHead.vue`'s `aside` slot on a `1fr auto 1fr` subtitle row.
- The subtitle keeps the head's centre; the button clears title/lede; loading and in-run screens draw none.
- `Moon` in light / `Sun` in dark; labels `切換為深色模式` / `切換為淺色模式`; `aria-pressed`; `theme.toggle`.
- OS `prefers-color-scheme` until a press stores `katsuyou-theme`; the stored choice then wins.
- A CSS media query paints the OS theme on the first paint, before the module runs, so dark phones see no light flash.
- `src/styles/app.css` is fully token-driven (light unchanged); dark ink column, warm near-white type, lighter accent, lifted surfaces, deeper gradient; no literal colours remain in `.vue`.
- Pure `src/ui/theme.js`; DOM adapter `theme-root.js`; storage adapter `storage/theme.js`; command `commands/theme.js`; `main.js` wiring; `session.theme = { value, source }`.
- Verification: 51 files / 554 tests, build, 660–661 checks / 0 failures including 15 new theme checks; dark contrast sweep over 12 screens found no pair under 3.2:1; `vol/` untouched.

## Revision history (one line per revision)

Full dated detail: [`docs/changelog.md`](changelog.md). Labels only, not current counts.

| Rev | Change |
|---|---|
| 2 | R1–R7: all 15 reader forms, control names, 3D flip, 到 header, full-bleed column |
| 3 | U1–U9: breakpoint, masu defaults, one-shot shuffle, pinned pager, reveal/completion |
| 4 | V1–V6: About sheet, uniform reader blocks, fade footers, animated card buttons |
| 5 | Home copy, 36px controls, sticky bars, highlight, paging, completion emoji/confetti |
| 6 | Single emoji, 60px 返回主頁, flat paging, no horizontal scrollbar |
| 7 | Dictionary cache OPFS → IndexedDB (private windows) |
| 8 | Paging away from a flipped card is flat, without a 3D turn |
| 9 | Card answer names both asked form and verb class |
| 10 | Pages subpath base `/game-japanese-katsuyou-basic/` across dev/preview/harness/docs |
| 11 | Fixed-scale viewport/zoom lock; event-driven paging phases; calmer flip |
| 12 | Drawn 4px page thumb, centred 從 label, last-card swipe finishes run |
| 13 | Loading head + credit, first-card resistance, backlog created |
| 14 | Invisible drag, direct swap + one slide-in; post-settle flash fixes |
| 15 | Paging window: 9 cards / 5 words, current item always 3rd |
| 16 | Finger-tracking drag supersedes rev 14; Lucide icons, note layer, issue link, README |
| 17 | Revision-16 window paint gap-accurate |
| A | Error-word skipping, card tags, quiz feedback, framed desktop page thumb |
| B | Dictionary display-form filter, locked default dropdown, quiz title/tally |
| 18 | Dropdown option hairlines constant under hover/press |
| 19 | `.hrule` separators replace settings `border-bottom`; double strike on error words |
| 20 | Page thumb inside framed column; drawn thumbs for dropdown lists |
| 21 | No rule above form list; locked 預設顯示形式 chip + tooltip and invariant |
| 22 | Equal-width 選擇顯示的類型 chips |
| 23 | Stateful 全選 / 取消全選, disabled-chip look, two-second thumb hints |
| 24 | Android/iOS overscroll guards without a body scroll lock |
| 25 | `100dvh` sizing for short screens, `vh` fallback |
| 26 | Draggable thumbs, invalid-start label, synchronous pointer-time drag paint |
| 27 | Site title → 動詞轉型練習 |
| 28 | Tab title `大家の動詞轉型練習`, logo icons, lede → 動詞 |
| 29 | Unflipped card tag moves above the word |
| 30 | 單詞目錄 screen: frozen run words grouped by 第N課 |
| 31 | Per-form Chinese glosses, data only — **one-time authorized `vol/` exception** |
| 32 | One verified `dict/vol.bin` archive replaces 50 per-lesson downloads |
| 33 | Loading bar shows archive download, never moves backwards |
| 34 | Locked 到 chips + tooltip, 翻卡練習 rename, card pill during drag |
| 35 | Tap-to-play Opus audio for reader words/sentences; 46 same-origin bins |
| 36 | 單詞目錄 all-form rows; hiragana/romaji search with red hit highlighting |
| 37 | 學習 home entry, 學習目錄 / 變形說明 / 選字, 210 pairs, interactive 例如 |
| 37b | 210 explanations regenerated from real `vol/` + conjugation tables; 小提示 |
| 37c | Shared section labels, `.hrule`, numbered 小提示, no duplicate notes |
| 38 | Reader → 變形說明 link, scroll restore, table-based `deriveChange` (incl. `＋ ぐ` fix) |
| 39 | Dark theme, home-only switch, token-only colours |
| 40 | Google Analytics page views + saved GTM container ID (current) |

Backlog: B1 朗讀功能 done as rev 35; B2 優化下載文件 done as rev 32–33;
**B3 優化UI remains pending** and needs a spec entry before new feature work
(concrete UI items were delivered in rev 34 and 36).

## Known limitations / unverified paths

- Real iOS/Android devices, Safari/Firefox, system IME, and human visual review of every screen: not exercised. Rubber-banding (24), dynamic viewport (25), zoom lock (11), mobile-GPU paging flash (14) especially need hardware.
- Fixed-scale is a deliberate product decision; Chromium reproduces pinch but not Android double-tap zoom. `docs/audit/*.md` are historical snapshots.
- Visual checks used computed styles/geometry, not viewed screenshots; the 16px favicon artwork was checked by type/dimensions/HTTP only.
- Plain-HTTP LAN origins lack `crypto.subtle`; boot stops on lesson 1 unless served from a secure origin.

## Why serving the repository root fails

Root `index.html` is the Vite entry (uncompiled `/src/main.js`) and has no `dict/vol.bin`; Pages needs `output/` mounted at the subpath. Boot also needs a secure origin for `crypto.subtle`/IndexedDB and the correct `vol.bin` MIME. Troubleshooting: [`docs/serving.md`](serving.md).

## Spec-silent decisions

- Copy not named in spec: `載入失敗（lesson N）`, `重試`, `設定`, `檢查`, `答案`, diagnostic detail, 該課沒有動詞, thanks line.
- Card/quiz reading defaults on; two archive downloads on failure; archive fetched only when a lesson is missing/corrupt; the archive itself is not hashed (its 50 entries are).
- Loading bar holds at 100% during entry verification; disabled-chip tooltips are owned by the wrapper; `nav.go` accepts an optional `mode`.
- Quiz fillers come from a unique kana pool; verb-less lessons still boot/hash so `boot.checked` reaches 50.

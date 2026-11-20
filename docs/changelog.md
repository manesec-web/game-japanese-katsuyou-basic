# Changelog

Condensed dated history of record, newest last. **Revision 40 (Google Analytics) is the latest/current revision**
(commit `852fdd6`, 2026-11-18; the source file filed it under 2026-11-15). Full pre-condensation detail, long
quotations and measurements are in git history; current behavior lives in `docs/spec.md`, the plan in
`AGENTS.md`, and current verification in `docs/progress.md`. Counts below are historical evidence for that
revision, not current state.

## 2026-11-09

**Docs baseline (task 0).** Added `docs/roadmap.md`, `docs/architecture.md`, `docs/progress.md`, this changelog
as the English hand-off set. No code yet.

**T1 engine skeleton.** Vite + Vue 3, `dispatch`, empty session, Vitest, `output/` build, dev middleware + 50
lesson copies. Unknown command → `ok: false`; `output/` gitignored; no logic in `.vue`.

**T2 hashing and boot.** `write-sha256.mjs`, `src/dict/hash.js`, `src/dict/boot.js`, IndexedDB adapter,
`app.boot`: raw-byte SHA-256 manifest; `--check` fails on tamper; missing/match/retry/double-mismatch tests;
verb-less lessons 1/3/8/12 still hashed.

**T3 loading/home.** Loading head, bar from `boot.checked / boot.total`, `Loading ...`, retry rerunning
`app.boot`, home entries, About sheet + GitHub link.

**T4 picker.** Per-mode selections, empty lessons disabled, 全選, 從/到. Lesson 1 unselectable; select-all skips
empty; 從 removed from 到; 開始 gated.

**T5 dictionary reader.** 15 forms, ruby, sentence highlight, paging, persisted settings. Index clamps; browser
swipe/reload.

**T6 flashcards.** Verb × target forms, 3D flip, swipes, 完成. Navigation resets face; first-card wall and
last-card finish verified.

**T7 quiz.** Pure keyboard generator, grading, auto-submit, reveal after N misses. All reading kana on keys;
seed changes distractors; three misses wait for 下一題.

**T8 motion.** Motion + `prefers-reduced-motion` (background still, screens fade); `npm test`, `npm run build`,
`output/index.html`, 50 dict files (rev 32 later packed them).

**Post-audit fixes.** Param validation, `quiz.input` normalization, empty-data errors, screen guards, form
fallback, hash-mismatch path: bad params/empty data/hash mismatch return `error` without uncaught exceptions.

**Rev 2 R1–R7.** All 15 reader forms, renamed controls, 3D flip, 到 header, full-bleed column; user-requested UX
pass, browser walk-through.

**Rev 3 U1–U9.** 550px breakpoint, masu defaults, one-shot shuffle, pinned pager, card enter, reveal overlay,
completion screens.

**Rev 4 V1–V6.** Richer About, uniform reader blocks, fade footers, animated card buttons, empty-到 hint.

**Rev 5.** Home copy, 36px geometry, sticky bars, 例句 highlight, parallel paging, emoji bands/confetti.
Historical wording: rev 27 later changed the title.

**Rev 6.** One emoji above 恭喜, 60px 返回主頁, flat paging, `overflow-x: clip` (no horizontal scrollbar in card
practice).

**Rev 7.** Dictionary cache OPFS → IndexedDB: private windows can open a DB but not expose an origin-private
directory.

**Rev 8.** Paging from a flipped card is flat `translateX`, no 3D turn/fade; frame-by-frame motion traces.

**Rev 9.** Answer always names asked form then verb class, independent of the class switch.

**Rev 10.** Pages subpath base `/game-japanese-katsuyou-basic/` in dev/preview/harness/docs; `/` redirects; no
deploy workflow (manual publishing).

**Rev 11.** Fixed-scale viewport + `touch-action: manipulation`, event-driven paging
(`transitionend`/`animationend`), 240ms flip. Android double-tap zoom not reproducible in headless Chromium;
pinch is.

**Rev 12.** Drawn 4px page thumb, centred 從, last-card swipe finishes the run.

**Rev 13.** Loading head + credit, first-card resistance (⅓ drag, 40px cap, 140ms spring-back), backlog B1/B2/B3
created. Partly superseded by 14, then 16.

**Docs refresh.** Spec/architecture/progress/roadmap/README resynced with rev 2–12; serving/deployment notes
updated for the subpath.

## 2026-11-10

**`vol/` linguistic review.** Entries reviewed, 15 conjugations kept, usage notes added. Early content work
before rev 31's one-time authorized exception.

**Rev 14.** User: 「看到頭會很痛」. Invisible drag, no follow/spring-back, swap past 72px + one ~190ms slide-in,
post-settle flash fixes. **Superseded by rev 16's finger-tracking drag**; walls stayed.

**Rev 15.** Paging window: 9 cards / 5 words mounted, current item 3rd; one end delete + one append per turn;
only current item visible.

**Dictionary data.** Entries corrected across 22 lessons in two audit rounds; hash manifest regenerated (also
noted in 11-11 docs sync).

## 2026-11-11

**Rev 16.** User: 「動畫不跟手」. Drag follows finger 1:1 and settles once from release, superseding rev 14's invisible
drag; Lucide icons, enlarged completion emoji, note layer (`note`/`error_usage`), `/issues/` link, README
rewrite.

**Rev 17.** Mounted paging-window neighbours paint with 24px gap; full-bleed paging accurate.

**Pass A.** 跳過錯誤的單詞 switches + live quiz queue reconciliation, 第N課/錯誤單詞 tags, 測驗（n/total）, shake/red feedback,
ChevronDown/arrows, first framed desktop thumb. Historical: 26 files / 261 tests, 469 checks.

**Pass B.** 預設顯示形式 stays a dropdown; 選擇顯示的類型 adds 15 persisted chips; quiz title/tally fixes; `error_usage`
temporarily colour-only. Historical: 26/269, 471 checks; rev 19 restored the double strike.

**Rev 18.** 「那個水平分割綫不太對勁」: dropdown rows keep constant hairline under hover/press (tint clipped, row not
scaled). Historical: 26/269, 473 checks.

**Rev 19.** Removed settings `border-bottom` for drawn `.hrule`; double strike on `error_usage` base text in its
unchanged colour. Strike probe confirmed reading unstruck.

**Rev 20.** Page thumb inside framed column (8px in, track clears 28px corners); both dropdown lists draw the
same fading thumb.

**Rev 21.** 「不要加綫，很醜！」: no rule above form list; locked default chip + tooltip 「這是預設顯示形式，必須顯示，不能取消」; settings
invariant re-adds the default.

**Rev 22.** 選擇顯示的類型 chips fill equal-width grid cells like the quiz button group; no ragged gaps.

**Rev 23.** Stateful 全選/取消全選, locked chip takes disabled 第1課 look, dropdown thumbs reveal ~2s on open/pointer
activity; B3 pending.

**Rev 24.** Root `overscroll-behavior-y: none`, dropdown containment, non-passive iOS `touchmove` edge guard;
normal/horizontal scrolling untouched. Historical: 13 unit + 5 touch checks (28/309, 533 checks); real
iOS/Android owed.

**Rev 25.** `min-height: 100dvh` for `body`, `#app`, columns (framed `calc(100dvh - 40px)`), `vh` fallback.
Short-screen overflow assertion (533 checks); collapsing toolbar needs hardware.

**Docs/repo sync.** Spec, architecture, README, serving, progress, roadmap, logo docs reconciled with rev 2–23;
`docs/audit/*.md` historical. Historical: 27/296, 527 checks.

## 2026-11-12

**Dictionary audit.** Entries corrected across 22 lessons in two rounds; only content + generated manifest
changed.

**Rev 26.** Mouse-draggable page/dropdown thumbs with proximity reveal/pointer capture; invalid-start line
removed (red-bordered transparent 開始, `請至少選擇一個轉型才可以開始` when 到 empty); drag painted in pointer handler.
Historical: 28/317, 546 checks.

**Rev 27.** Site subtitle + document title → 動詞轉型練習 via shared `SiteHead.vue`; docs resynced. Historical:
28/317, 549 checks; fits 320–800px.

**Rev 28.** Tab title `大家の動詞轉型練習`; `docs/logo/logo.jpg` → ICO/PNG icons linked relatively (Vite hashes 4 into
`output/assets/`); lede → 動詞. Historical: 28/317, 550 checks; on-screen head draws no image.

**Rev 29.** Unflipped card tag moves above the word, matching the answer; pill/prompt unchanged. Historical:
28/317, 550 checks.

## 2026-11-13

**Rev 30.** 單詞目錄 `toc` screen: frozen run words grouped 第N課, `aria-current`, `dict.goto` with `invalid-index`,
back keeps the word. Historical: 30/331, 565/566 checks; reader opens at top because index changes before the
view exists.

**Rev 31.** 「你是日本母語的老師…」: per-form Chinese glosses; **one-time authorized `vol/` exception** touching only
`chinese` + one `note`; manifest regenerated; temporary scripts removed. 5,420 glosses, 1 note, 191 error
markers, 16,797 sentence pairs, 0 immutable-field changes / 0 copied glosses over 50 lessons / 386 verbs / 5,790
forms; no UI/engine code changed. **Stale audit finding:** goal contract quoted 89 error forms / 17,103
sentences from `docs/audit/hy4-preview-2026-11-10.md`; current data is 191 / 16,797.

**Rev 32.** 「優化下載速度…vol.bin…unzipit」: 50 per-lesson downloads → one deterministic deflate ZIP `dict/vol.bin`
(`.bin` avoids download-helper hijacking); per-entry SHA-256, build refuses bad manifest, lazy `unzipit`, one
fetch retried once. `vol/` 4,899,916 bytes → ~549 KB; 50 entries; ZIP round-trip + tampered-manifest tests;
`boot.checked / boot.total` still 50.

**Rev 33.** Loading bar shows archive streaming from cache-check share to 100%, holds during entry verification,
never backwards, retry restarts at verified share. Pure `src/ui/boot-progress.js`; no new copy.

**Rev 34.** 到 chip equal to 從 disabled/locked with tooltip `這和「從」的形式相同，不能選為「到」` (skipped by 全選); 翻卡學習 → 翻卡練習;
card paints its own pill during drag. Pure `src/dict/settings.js`; browser check.

**README rewrite/docs split.** README learner-facing; `docs/development.md`, `docs/serving.md`,
`docs/logo/README.md` split; architecture/changelog refreshed.

## 2026-11-14

**Sticky search field.** Search button, sticky field, clear icon in the word list; later superseded by rev 36's
all-form list.

**Live-site check.** Deployment checked; the single current statement of the live URL /
`application/octet-stream` MIME is in `docs/progress.md`; this is a historical cross-reference.

**Status docs sync.** progress/roadmap/development/serving resynced with rev 32–34 and tooltip reveal;
historical counts only.

## 2026-11-15

**Rev 35.** Reader words/sentences tappable for Opus audio: lazy same-origin `lessonX.bin`, sha256 once/session,
one-entry decompress, hover/pulse/playback states, 「該音頻暫時無法播放」 on failure. `prebuild` fetches 46 release bins
into gitignored `dict/resource/`, verifies digests, regenerates `src/data/audio-manifest.json`; release assets
lack CORS, hence build-time delivery.

**Rev 36.** 單詞目錄 one row per form (run order then canonical form order) with `XX形` tags; search matches
word/kana/lesson, Latin queries via Hepburn romaji (macrons, long vowels, small つ, katakana→hiragana); red hits.
Pure `src/dict/romaji.js` + `src/study/toc.js`; ruby alignment maps reading hits back.

**Rev 37.** Fourth home entry 學習; 學習目錄 15 forms; 變形說明 從/到 dropdowns (defaults ます形/字典形, never equal), heading 從 X
到 Y 的變形如下, 210 generated ordered pairs (class blocks + 段/音便 rule + example table), interactive 例如, 小提示; screens
`learn`/`rule`/`example`; `rule.open`/`rule.setFrom`/`rule.setTo`/`rule.selectExample`. 15 × 14 = 210 entries in
`src/data/rule-content.js`, regenerated by `prebuild`; pure `src/study/rule.js` + `rule-demo.js`; `.vue` renders
only.

**Rev 37b.** All 210 explanations rebuilt from real `vol/` verbs via `src/study/rule-conjugation.js` (五段/一段/不規則
tables, 段/音便, special cases) + `rule-content-builder.js`; 第一類 mapping follows 從/到; 小提醒 for う→わ, 行く→行った／行って,
ある→ない, する→できる, を→が, 歸る-type, ら抜き, 濁音, 段 口訣; 例如 no blanks on pure add/delete/identical/irregular; 小提示 seven
items. `rule-conjugation.test.js` regenerates all 210 entries and compares byte-for-byte; every table cell
matches a real `vol` form.

**Rev 37c.** Shared section-label style for 變形設置/例如/小提示 with drawn `.hrule`; no notes in 例如; 例外 heading
simplified, repeated group-0 notes removed; 小提示 numbered `<ol>`.

**Rev 38.** Reader title → 字典; non-default forms get 變形原理 → `rule.openFromReader` (從 = 預設顯示形式, 到 = pressed form,
例如 = current verb); back/選字 restore scroll; `deriveChange` uses shared 語尾/段 tables. **Root cause of 「洗いますす / す →
し / ＋ した」:** longest-common-prefix split landed inside the suffix (`ます`/`ました` share only `ま`). Now `洗い + ます →
ました`; a whole shared 語尾 (ません → ませんでした) stays in the stem. A 59,850-pair sweep reconstructs both words with 0
mismatches; commands pure in `src/commands/reader-rule.js`.

**Rev 38 follow-up.** 「泳ぎます → 泳ぐ」 printed duplicated `＋ ぐ`; `deriveChange` splits `toChange` (changed row kana)
from `added` (new 語尾), result `base + toChange + added`; kana-only pairs draw no `＋` line. Unit/browser
regressions and the pair sweep stayed clean; historical final counts from that pass are labeled historical in
`docs/progress.md`.

**Docs sync.** All Markdown audited against the rev-38 site: spec, architecture, development, serving, logo,
AGENTS, README, progress, roadmap, changelog resynced; `docs/audit/*.md` historical. Historical counts from that
pass are in `docs/progress.md` history; no code/`vol/` change.

**Revision 39 — dark theme (previous, `852fdd6`; dated entry 2026-11-15, committed 2026-11-18).** Home-only 36px round switch 8px right of the 習 ending
`動詞轉型練習`, centred via `SiteHead.vue`'s `aside` slot and a `1fr auto 1fr` subtitle row; the subtitle keeps the
head's centre and the button clears title/lede (measured 320, 390, 768px, framed desktop). `Moon` in light /
`Sun` in dark; labels `切換為深色模式` / `切換為淺色模式`; `aria-pressed`; `theme.toggle`; loading and in-run screens draw
none. OS `prefers-color-scheme` applies until a press stores `katsuyou-theme`; the stored choice then wins. A
CSS media query paints the OS theme on the very first paint, before the module runs, so a dark phone sees no
light flash; only a press writes the key.

`src/styles/app.css` holds every colour as a token (light values unchanged); the dark palette appears under both
the stored-choice selector and the media fallback. All 24 literal colours in `src/views`/`src/components` became
tokens; `color: #fff` split into `--accent-ink`/`--tooltip-ink` so the tooltip would not be white-on-white. No
`.vue` file writes a literal colour. Rules are pure in `src/ui/theme.js`; `src/ui/theme-root.js` is the DOM
adapter, `src/storage/theme.js` the storage adapter, `src/commands/theme.js` the command, `src/main.js` the
wiring; `session.theme = { value, source }`. `.vue` files only render.

Final verification: **51 files / 554 tests** (11 theme rule + 3 command tests; both manifests checked), `npm run
build`, **660–661 browser checks / 0 failures** including 15 new theme checks (no switch on loading, unchanged
light palette, geometry/labels, toggle, reload persistence, in-run absence, dark OS default, no key for an
OS-only choice, pre-module media fallback, explicit light on dark OS). A dark contrast sweep over 12 screens
(home, 學習目錄, 變形說明, 選字, picker, reader, 設定, 單詞目錄, card, quiz, open dropdown, tooltip) found no text pair under
3.2:1. `vol/` and generated data untouched.

**Revision 40 — Google Analytics (latest/current, working tree; 2026-11-18).** Two saved IDs in the
`analytics` section of `katsuyou-settings`: `containerId`, the GTM container (`GTM-W7387LLQ`), and
`measurementId`, the GA4 destination inside it (`G-NFDK8SXY0M`). The container is loaded with the standard
snippet (dataLayer, `gtm.start`, one async `gtm.js` script); its own config tag sends the landing page view.
gtag.js is loaded with `send_page_view: false` for the measurement ID, because the container does not report
this site's screen changes (its enhanced-measurement page view follows browser history, which the site does
not change). Every screen change pushes `{ event: 'page_view', screen_name, page_title, page_location }`
into the dataLayer and, past the landing pair (`loading`, first `home`), sends it through
`gtag('event', 'page_view', …)`; the browser URL is never changed and `page_location` names the screen as
`#/<screen>`. The `Google Analytics 容器 ID` and `GA4 量測 ID` fields end every mode's settings screen
(commit on Enter/blur through `settings.patch`, trimmed/uppercased, invalid rejected and the stored ID
restored). Both IDs apply on the next load. `src/analytics/page-view.js` holds the pure rules (both ID
forms, per-screen title, `#/<screen>` location, payload); `src/analytics/gtm.js` is the DOM adapter;
`src/dict/settings.js` validates and persists both; `src/main.js` restores settings, loads both and watches
`session.screen`. The snippet lives in the adapter, not `index.html`, because the IDs are settings; there is
no `<noscript>` iframe (the site draws nothing without JavaScript).

A runtime probe against the built site observed the GA collect for the landing view at load, then exactly
one `page_view` containing the right `#/<screen>` fragment for the picker, reader and settings screens.
Verification: **53 files / 587 tests** (2 analytics files, both IDs' settings validation/persistence plus
command coverage), `npm run build`, **682 browser checks / 0 failures** (21 new analytics checks: both
scripts, gtm.start first, landing and screen page views, fragment locations, unchanged browser URL, both
fields' defaults/commits/rejection/restore). `vol/` untouched.

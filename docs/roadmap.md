# Roadmap

Updated for revision 40 (Google Analytics, working tree, 2026-11-18) — **revision 40 is the
latest/current revision**. Behavior: `docs/spec.md`; plan: `AGENTS.md`; history:
`docs/changelog.md`; current verification: `docs/progress.md`. Table counts are historical.

## Ground rules (do not drift from these)

- Read the matching `docs/spec.md` section first; if the spec is silent, stop and ask.
- One task at a time, in order; finish checks before starting the next.
- `.vue` files hold template/styles only; behavior lives in `.js`.
- Every user-visible action is a command (`id`, `params`, `enabled`, `run`); views and tests use `dispatch`.
- Commands return `{ ok: true, result }` or `{ ok: false, error }`; bad params, empty data, hash mismatches never throw.
- `vol/*.json` is read-only. **One-time exception (revision 31):** only `form.chinese` and one misleading `note` changed; no future edit is authorized.
- No MCP, no backend, no model/LLM call inside the site.
- Do not reproduce the wireframes' blue boxes; follow the spec's Look and motion section.
- Text outside the green phone frame is annotation, not a UI control.

## Task board (T1–T8: all done)

| # | Status | Acceptance evidence |
|---|---|---|
| 0 Docs baseline | done | English hand-off docs present and kept current |
| T1 Vite/Vue skeleton | done | Unknown command → `ok: false`; build writes `output/`; gitignored; no logic in `.vue` |
| T2 manifest + `app.boot` | done | `--check` fails on tamper/passes restored; missing/match/retry/double-mismatch; empty lessons 1/3/8/12; ZIP + IndexedDB round-trips |
| T3 loading/home/About | done | Progress from `boot.checked / boot.total`; retry; four home entries (學習 added rev 37); GitHub link in new tab |
| T4 picker | done | Lesson 1 unselectable; 全選 skips empty; 到 ≠ 從; 開始 gated; rev 34 disables the equal chip |
| T5 dictionary reader | done | Index clamps; browser swipe + reload persistence; rev 16 finger-tracking drag |
| T6 flashcards | done | One card per (verb, target); navigation resets face; first-card wall, last-card finish |
| T7 quiz | done | Every reading kana on a key; seed changes distractors; grading tests; three misses wait for 下一題 |
| T8 motion/verification | done | `npm test`, `npm run build`, `output/index.html`, `vol.bin` with 50 entries (originally 50 files before rev 32) |
Order: docs baseline → T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → revisions 2–40 → B3 only after a spec entry.

## Backlog

- B1 朗讀功能: **done** — rev 35, word/sentence Opus audio, 46 bins.
- B2 優化下載文件: **done** — rev 32–33, one archive + download progress.
- B3 優化UI: **pending** — needs a spec entry first; rev 34 (locked chips, rename, pill) and 36 (all-form 單詞目錄 + romaji search) delivered concrete items.

## Revision acceptance (all done)

| Rev | Change | Evidence |
|---|---|---|
| 2 | R1–R7 reader forms / flip / layout | spec + browser walk-through |
| 3 | U1–U9 defaults, pager, completion | spec + build |
| 4 | V1–V6 About, blocks, buttons | spec + build |
| 5 | Home copy, geometry, confetti | spec + browser checks |
| 6 | One emoji, flat paging | spec + browser checks |
| 7 | OPFS → IndexedDB | cache adapter tests |
| 8 | Flat paging off a flipped card | motion probe |
| 9 | Answer names form + class | card tests |
| 10 | Pages subpath base | `document.baseURI` assertion |
| 11 | Zoom lock, event-driven paging | viewport + motion checks |
| 12 | Drawn thumb, centred 從, last-card finish | browser checks |
| 13 | Loading head, first-card resistance, backlog | browser check + roadmap |
| 14 | Invisible drag, one slide-in | motion probe; superseded by 16 |
| 15 | 9-card / 5-word paging window | browser checks |
| 16 | Finger-tracking drag, Lucide, notes | motion probe + docs |
| 17 | Window paint/gap accuracy | browser checks |
| A | Error skipping, tags, quiz feedback | queue tests + browser checks |
| B | Display-form filter, dropdown, quiz title | settings tests + browser checks |
| 18 | Constant dropdown hairlines | computed-style checks |
| 19 | `.hrule` + double strike | settings + strike probe |
| 20 | Thumbs inside column / dropdown lists | geometry checks |
| 21 | Locked default chip invariant | settings tests |
| 22 | Equal-width chips | geometry checks |
| 23 | 全選 state, locked look, thumb hints | settings tests |
| 24 | Overscroll guards, no scroll lock | 13 unit + 5 touch checks |
| 25 | `100dvh` short screens | overflow assertion |
| 26 | Draggable thumbs, invalid start, drag paint | pointer checks |
| 27 | 動詞轉型練習 rename | width probes, title assertion |
| 28 | Tab title + 4 logo icons | asset/HTTP checks |
| 29 | Face tag above word | position assertion |
| 30 | 單詞目錄, `dict.goto` | 16 browser checks |
| 31 | Per-form glosses (`vol/` exception) | 5,420 glosses, 50-lesson validator |
| 32 | One `vol.bin` archive | 50 entries, ZIP round-trip |
| 33 | Download progress bar | pure `boot-progress` tests |
| 34 | Locked 到 chip + 翻卡練習 + pill | settings tests + browser check |
| 35 | Reader audio | audio manifests + browser playback |
| 36 | All-form 單詞目錄 + romaji search | `toc`/`romaji` tests + browser check |
| 37 | 學習, 210 pairs, 例如 | 210-entry regeneration test |
| 37b | Copy audit, 段/音便, 小提示 | byte comparison vs `vol/` |
| 37c | Style polish, `.hrule`, numbered list | browser check |
| 38 | Reader link, scroll memory, `deriveChange` | 59,850-pair sweep, regression tests |
| 39 | Dark theme | 51/554, build, 660–661 checks, contrast ≥3.2:1 |
| 40 | Google Analytics page views + saved GTM/GA4 IDs (current) | 53/587, build, 682 checks |

## How to resume a future session

1. Read `AGENTS.md`, `docs/progress.md`, then the feature's `docs/spec.md` (spec first for B3), `docs/architecture.md` and `docs/changelog.md`.
2. On landing, update `docs/progress.md`, `docs/roadmap.md`, `docs/changelog.md`; keep `README.md` learner-facing and `docs/audit/*.md` historical; recheck `docs/development.md` / `docs/serving.md` when commands change.

## Verification commands

```bash
npm test                                # 53 files / 587 tests; pretest checks both manifests
npm run build                           # prebuild: 210 rule entries + 46 verified bins
node scripts/write-sha256.mjs --check   # 50-lesson manifest; also write-audio-manifest.mjs --check (46 bins)
node scripts/generate-rule-content.mjs  # 210 ordered pairs
node scripts/browser-check.mjs          # 682 checks / 0 failures here (±1 by seeded quiz)
```
`browser-check.mjs`: `vite preview` on `PORT` (default 5199), Chromium via `CHROMIUM_PATH`, `--screenshots` with `SHOT_DIR`. `motion-probe.mjs` (`PORT` 5201) prints traces only. Node v26.13.1 / npm 12.2.2 here; Vite 7 needs `^20.19.0` or `>=22.12.0`.

# Execution plan

This file is for the next AI that enters the repo. Do the tasks in order. The product is a static site for learning Japanese verb conjugation: Vue source, build output in `output/`, published with GitHub Pages.

Current state: T1–T8 are complete, along with the follow-up revisions recorded
in `docs/roadmap.md` and `docs/changelog.md`. Revision 13 added the loading-screen
head and credit line and the first-card resistance in 翻卡學習; revision 14
superseded that resistance and the drag-follow/spring-back paging with an
invisible drag and a direct swap plus one short slide-in; revision 15 mounts a
paging window around the current item (9 cards in 翻卡學習, 5 words in the
dictionary reader) with the current item always in the 3rd slot, so a turn only
drops one end and adds the other; revision 16 supersedes revision 14's motion
with a finger-tracking drag (the strip follows the finger 1:1 while held and
settles the page once from where the finger left it; the walls stay still)
and also brought the Lucide top-bar icons, the enlarged completion emoji, the
dictionary note layer (`note` / `error_usage` rendering), the `/issues/` issue
link and the rewritten `README.md`. Revision 17 kept the paging window painting
and gap-accurate. Two follow-up UI passes, recorded as A and B in
`docs/roadmap.md` and `docs/changelog.md`, then added the per-mode
跳過錯誤的單詞 switch (including mid-run quiz queue reconciliation), the
dictionary's 選擇顯示的類型 form filter, the 第N課 / 錯誤單詞 card tags, the
測驗（n/total） title, wrong-answer shake/red feedback in place of a 回答錯誤
toast, ChevronDown and paging-arrow icons, and the framed desktop page thumb.
Revisions 18–19 kept dropdown option hairlines constant, removed every
`border-bottom` from the settings screen in favour of a global `.hrule` class
that draws each separator as its own 1px element, and put a double
strikethrough (colour unchanged) back on the dictionary's `error_usage` words.
Revision 20 draws the page's scroll thumb inside a framed desktop column (8px
in, with a track that clears the corner radius) while the two dropdown lists
swap their native bars for the same drawn, fading thumb; revision 21 then
removed the rule between the 預設顯示形式 row and its list and turned that form's
chip in 選擇顯示的類型 into a disabled button with an explanatory tooltip,
backed by a settings invariant. Revision 22 makes the 15 chips of 選擇顯示的類型
fill equal-width cells like the quiz settings' 錯 X 題就顯示答案 button group,
so the dictionary chip rows align instead of leaving ragged gaps. Revision 23
makes that group's 全選 control stateful (全選 / 取消全選, leaving only the
locked default on clear), gives the locked default chip the picker's disabled
第1課 look while keeping it pressed and its tooltip, and reveals both dropdown
list thumbs on open or pointer activity for about two seconds before they fade.
Revision 24 suppresses Android root overscroll/pull-to-refresh and adds an iOS
non-passive touch boundary guard for rubber-banding, while retaining normal
long-page and dropdown scrolling and horizontal paging; it does not lock the
body or cancel every touchmove. Actual iOS/Android rubber-band behavior still
needs real-device verification. Revision 25 sizes the outer shell (`body`,
`#app`, framed/mobile `.column`) with `min-height: 100dvh` (`calc(100dvh -
40px)` framed) so short screens such as settings and 翻卡學習 stop overflowing
when an iOS toolbar makes the static `vh` taller than the visible area; `vh`
stays as the fallback. Real-device verification remains for the dynamic
viewport. The broader 優化UI backlog remains pending for further, unspecified UI work.
The site builds into `output/` and has not been published to GitHub Pages yet.
Day-to-day status, verified commands and known limitations live in
`docs/progress.md`; `README.md` is the user-facing overview. The tasks below
stay as the original build plan and as the acceptance checklist — do not reopen
them without a spec change. Three future items sit in `docs/roadmap.md` as a
backlog (朗讀功能, 優化下載文件, 優化UI): B1 and B2 are unimplemented and need
a spec entry first; B3 is still open for further, unspecified UI work,
although the specific requests recorded in revisions 2–25 have been delivered.

Behavior lives in `docs/spec.md`. Read the matching section before you build that piece. If the spec does not cover a product behavior, stop and ask. Do not invent a rule.

## How to work

1. Do one task from the list below at a time. Finish its checks before the next task.
2. The view is thin. `.vue` files hold template and style. Behavior lives in `.js`. A Vue file calls commands and renders state.
3. Every user-visible action is a command: `id`, `params`, `enabled`, `run`. The view and the tests call the same `dispatch`.
4. A command returns `{ ok: true, result }` or `{ ok: false, error }`. Bad params, empty data, and a hash mismatch return `error`. This path does not throw an uncaught exception.
5. Leave the JSON in `vol/` unchanged. That directory is the dictionary source.
6. Do not add MCP, a backend, or a model call inside the site.
7. Do not reproduce the blue boxes in the wireframes. Follow the information architecture in `docs/spec.md`. Follow the Look and motion section there for the visual design.
8. Text outside the green phone frame is a note to the reader. It is not a UI control.
9. When you finish, say which commands you ran and which checks you could not run.

## Layout

After the build, the tree looks like this:

```text
vol/                          already present. lesson_1.json … lesson_50.json
docs/spec.md                  product spec
docs/screenshot-draft/        wireframes
scripts/write-sha256.mjs      reads vol/, writes the sha256 manifest
scripts/browser-check.mjs     end-to-end walk-through of the built site
src/main.js
src/engine/registry.js        command registry and dispatch
src/engine/session.js         plain session state and transitions
src/commands/*.js             one file per area, each exports specs()
src/dict/hash.js              sha256
src/dict/boot.js              per-lesson verify/download/cache rule
src/dict/library.js           verified dictionary in memory
src/dict/quiz.js              quiz keyboard and grading (pure)
src/dict/ruby.js              kanji / reading alignment
src/dict/forms.js             the 15 form ids and their on-screen names
src/dict/settings.js          settings defaults and validation
src/study/*.js                item lists, shuffle, highlight, results (pure)
src/data/dict-manifest.json   generated by write-sha256, commit it
src/storage/idb.js            IndexedDB dictionary cache (read/write/remove)
src/storage/settings.js       localStorage settings
src/ui/store.js               connects the session to Vue reactivity
src/ui/bootstrap.js           boot → library → settings → home
src/views/*.vue
src/components/*.vue
src/styles/app.css
index.html
vite.config.js                build.outDir = "output", base = "/game-japanese-katsuyou-basic/"
output/                       build output, do not commit
```

There is no `public/` directory; the dictionary is copied from `vol/` into
`output/dict/` by the Vite plugin.

`vite.config.js` serves `vol/lesson_*.json` as `/game-japanese-katsuyou-basic/dict/lesson_N.json` in dev and build, and copies those files into `output/dict/`. The source files stay in `vol/`.

## Commands

`dispatch(session, id, params)` in `src/engine/registry.js` runs every command. When `enabled` is false, `dispatch` returns `error` and does not call `run`.

| id | What it does |
|---|---|
| `app.boot` | Check IndexedDB against the manifest. Download a missing file. Hash a file that is already there. Update `boot.checked` and `boot.total` |
| `nav.go` | Change screen. `params.screen` |
| `lessons.toggle` | Toggle one lesson. A lesson with no verbs returns `error` |
| `lessons.selectAll` | Clear the verb lessons when they are all selected. Otherwise select every lesson that has verbs |
| `study.start` | Build the item list for the current mode and open the study screen |
| `dict.next` / `dict.prev` | Next or previous dictionary word. Stop at the ends |
| `card.next` / `card.prev` | Next or previous card, and turn the card face up |
| `card.flip` | Swap face and back |
| `study.finish` | End a card run (完成 on the last card) and show the completion panel |
| `quiz.input` | Append a character or delete one. `params.op` is `append` or `backspace`. `append` includes `text` |
| `quiz.submit` | Grade the answer. Rules are in the spec |
| `quiz.advance` | Move on after the answer has been revealed and the user presses next |
| `settings.patch` | Merge settings. An unknown field rejects the whole patch and leaves state unchanged |

Screen names are only `loading`, `home`, `picker`, `reader`, `card`, `quiz`, and `settings`. `picker` and `settings` use `session.mode` (`dict`, `card`, or `quiz`) to choose their content.

## Tasks

### T1 Engine skeleton

Create the Vite + Vue 3 project, the layout above, `dispatch`, an empty session, `npm test` (Vitest), and `npm run build`.

Checks:

- `npm test` passes. At least one test shows that an unknown command makes `dispatch` return `ok: false`.
- `npm run build` writes the static files into `output/`.
- `output/` is in `.gitignore`.
- Business logic is not inside `.vue` files.

### T2 Dictionary hash and boot

Implement `scripts/write-sha256.mjs` and `app.boot`.

The script reads the raw bytes of `vol/lesson_1.json` through `vol/lesson_50.json`, computes lowercase hex sha256, and writes `src/data/dict-manifest.json`. With `--check`, a mismatch exits non-zero. `prebuild` and `pretest` both run `--check`.

`app.boot` handles the 50 files one by one. A file missing from IndexedDB is fetched from same-origin `dict/lesson_N.json`, checked against the manifest, then stored. A file already in IndexedDB is hashed again. A mismatch downloads once more. A second mismatch sets `boot.error` to that lesson and leaves `boot.done` false. Each finished lesson increments `boot.checked`. `boot.total` is 50.

Checks:

- A damaged manifest makes `node scripts/write-sha256.mjs --check` fail. Restoring it makes the command succeed.
- Tests cover a missing file, a matching hash, a first mismatch that redownloads, and a second mismatch that stops with an error. Use a fake fetch and a fake store. Do not use a browser for these tests. `src/storage/idb.test.js` exercises the real adapter with `fake-indexeddb`.
- Lessons with an empty `vols` array (lessons 1, 3, 8, and 12) are downloaded and checked too.

### T3 Loading and home

The `loading` screen shows the site head (大家の日本語 / 轉型練習 / 涵蓋初級 1 – 50 課的單詞), a progress bar and the text `Loading ...`, and the footer line `Build with ❤ by Mane` alone (the `🥺 如果有 BUG 記得告訴我！` line stays on home); the credit opens the same About sheet. Progress is `boot.checked / boot.total`. Opening the site runs `app.boot`. Success goes to `home`. On failure the bar stops, the screen offers retry, and retry runs `app.boot` again; the head and the footer are still there.

`home` has three buttons: 字典, 翻卡學習, 測驗. Each opens `picker` in that mode. The footer line is `Build with ❤ by Mane`. Activating it shows a small sheet with a link to `https://github.com/manesec-web/game-japanese-katsuyou-basic`, opened in a new tab.

The column is at most 480px wide and centered. The background fills the viewport, as described in `docs/spec.md`.

Checks: the build still succeeds. In a browser, walk through loading, the three entries, and the footer link.

### T4 Lesson picker

The three modes share the picker UI and each remembers its own lesson selection. A lesson with no verbs is gray and does not respond to a press. The 全選 rule is in the spec. 開始 stays disabled while no lesson is selected.

Dictionary mode has no 從 / 到. Card and quiz mode do. The choices are the 15 forms in `docs/spec.md`.

Checks: tests show lesson 1 cannot be selected, `lessons.selectAll` skips empty lessons, and a target form equal to the source form is removed.

### T5 Dictionary

After `study.start` the screen is `reader`. Word order is lesson order, then the order inside that lesson's `vols`. A swipe right, or the next control, is `dict.next`. A swipe left, or the previous control, is `dict.prev`. A drag follows the finger 1:1 while held; a release past the threshold settles the page once from where the finger left it. A shorter drag settles back to rest. The first item does not move backward. The last item does not move forward. This is the revision-16 motion, which supersedes the invisible-drag text above; the authoritative rule is in `docs/spec.md`.

The settings screen has 預設顯示形式, 選擇顯示的類型, 跳過錯誤的單詞 and 顯示平假名注音.

Checks: a test shows the index stays inside the list. In a browser, a swipe right loads the next word, and settings are still there after reload.

### T6 Cards

The face shows the source form. The back shows the target form and the Chinese gloss. A tap is `card.flip`. A swipe right is `card.next`. A swipe left is `card.prev`. Changing cards returns to the face. With several target forms, each pair (verb, target form) is one card. Order is verb order, then the fixed form order.

While 一開始顯示幾類動詞 is on, the face shows the verb class.

Checks: a test shows that changing cards returns to the face. In a browser, a tap reveals the answer and a swipe right opens the next card. The first card is completely still on a backward (right-hand) drag and does not change the card; the reader's first word and the last-card finish are unchanged.

### T7 Quiz

A pure function builds the keyboard. The rule is in the spec. A test must lock this invariant: every hiragana character of the correct reading appears on a key, and a different random seed changes the distractor arrangement.

Grading is a pure function with tests. A correct answer advances. A wrong answer stays on the item. The third wrong answer reveals the answer and waits for `quiz.advance`.

While 自動提交答案 is on, input that equals an accepted answer calls `quiz.submit` immediately. The check button can submit at any time.

Checks: the unit tests above. In a browser, answer one item correctly from the on-screen keyboard, miss one item three times, and confirm that the third miss waits for 下一題.

### T8 Finish

Add the motion from the spec. Under `prefers-reduced-motion: reduce`, the background stays still and screen changes fade. Run `npm test` and `npm run build`. Confirm `output/dict/` contains 50 JSON files and `output/index.html` exists.

In the reply, list the commands you ran. Name any screen you did not open in a browser.

## Done

- T1 through T8 each have test output or a browser pass.
- The behaviors in `docs/spec.md` are on screen, including empty lessons, a failed hash, and a revealed answer that does not advance by itself.
- There is no MCP, no backend, and no business logic inside `.vue` files.

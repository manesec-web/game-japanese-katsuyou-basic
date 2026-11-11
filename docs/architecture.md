# Architecture

## Shape of the app

One static Vue 3 single-page app built with Vite. No router library, no
server, no network calls except fetching same-origin dictionary JSON.

Three layers:

1. **Engine** (`src/engine/`) — a plain-JavaScript command registry and the
   session state object. Framework-free and unit-testable under Node.
2. **Commands** (`src/commands/`) — one module per feature area. Each exports
   `specs()`, an array of command descriptors.
3. **Views** (`src/views/`, `src/components/`) — thin Vue components that read
   reactive session state and call `dispatch`. They own no rules.

A thin adapter, `src/ui/store.js`, wraps the session in Vue's `reactive()` and
exposes a `send(id, params)` that forwards to `dispatch`.

## Command contract

Every user-visible action is a command:

```js
{
  id: 'nav.go',                // unique string
  params: ['screen'],          // required parameter names
  enabled(session, params),    // optional; false -> dispatch returns error
  run(session, params),        // mutates session, returns result or undefined
}
```

`dispatch(session, id, params)` returns exactly one of:

```js
{ ok: true,  result: <value> }
{ ok: false, error: { code, message, ...details } }
```

An async `run` (only `app.boot` so far) returns a Promise of the same
envelope, so callers can always `await dispatch(...)` or use the sync result.

Error codes in use: dispatch-level `unknown-command`, `invalid-params`,
`missing-param`, `command-disabled`, `command-failed`; command-level
`boot-failed`, `library-missing`, `library-invalid`, `lesson-empty`,
`invalid-settings`, `no-items`, `quiz-no-item`. A command may throw
`CommandError` (or any Error carrying a string `code` and optional `details`);
dispatch converts it into that error shape instead of `command-failed`.

Rules:

- Unknown id → `ok: false`, code `unknown-command`.
- Missing required param → `ok: false`, code `missing-param`.
- `enabled === false` → `ok: false`, code `command-disabled`; `run` is not called.
- `run` throwing is caught and converted to `ok: false`, code `command-failed`.
  A command's own validation should return an error rather than throw.
- `run` may mutate the session in place; Vue reactivity is applied by `store.js`.

Command ids (complete list, from `AGENTS.md`):

| id | Purpose |
|---|---|
| `app.boot` | Check IndexedDB against manifest, download missing files, verify hashes |
| `nav.go` | Switch screen; `params.screen` |
| `lessons.toggle` | Toggle one lesson; error when the lesson has no verbs |
| `lessons.selectAll` | Select all verb-bearing lessons, or clear when all selected |
| `study.start` | Build the item list from mode + selected lessons, enter study |
| `dict.next` / `dict.prev` | Move within the dictionary item list, clamped |
| `card.next` / `card.prev` | Move within the card list, reset to face |
| `card.flip` | Toggle face/back |
| `quiz.input` | `append` text or `backspace` |
| `quiz.submit` | Grade the current answer |
| `quiz.advance` | Move on after a revealed answer |
| `settings.patch` | Merge settings; reject the whole patch on an unknown key |

Screen names, exactly: `loading`, `home`, `picker`, `reader`, `card`, `quiz`,
`settings`. `picker` and `settings` vary by `session.mode` (`dict`, `card`,
`quiz`). `nav.go` accepts an optional `mode` parameter (one of the three) so
entering a picker from home selects the mode in the same dispatch.

## Session

`src/engine/session.js` exports `createSession()`. The session is plain data:
current screen, mode, boot progress (`checked`, `total`, `done`, `error`), the
lesson lists, form selections, study item list and cursor, current answer
state, and settings. Commands own the transitions; views only display.

The session is the single source of truth. Nothing derived is stored twice
unless the spec says so.

## File map

```text
vol/                          dictionary source, lesson_1..50.json (read-only)
docs/spec.md                  product behaviour
docs/architecture.md          this file
docs/serving.md               local serving and boot-failure troubleshooting
docs/roadmap.md               task board and resume instructions
docs/progress.md              current state, commands run, next step
docs/changelog.md             dated change log
README.md                     user-facing overview, setup, test and deploy notes
scripts/write-sha256.mjs      hashes vol/*.json into src/data/dict-manifest.json
scripts/browser-check.mjs     headless Chromium walk-through of the built site
scripts/motion-probe.mjs      frame-by-frame motion traces (informational)
src/main.js                   app entry: creates store, boots, mounts Vue
src/App.vue                   screen switch + shared shell
src/engine/registry.js        command registry + dispatch
src/engine/settle.js          sync/async result envelope helper
src/engine/errors.js          CommandError (code/message/details)
src/engine/session.js         createSession(): plain state
src/commands/index.js         assembles all specs with injected dependencies
src/commands/*.js             one module per feature, each exports specs()
src/dict/forms.js             the 15 form ids and on-screen names, in order
src/dict/hash.js              SHA-256 (Web Crypto wrapper)
src/dict/boot.js              per-lesson verify/download/cache rule
src/dict/lessons.js           lesson summary + selection rules (全選)
src/dict/library.js           verified dictionary loaded into memory
src/dict/quiz.js              keyboard generation, grading, reveal rules (pure)
src/dict/ruby.js              kanji / reading alignment for <ruby>
src/dict/settings.js          defaults, validation, patches, start hints
src/data/dict-manifest.json   generated manifest, committed
src/storage/idb.js            IndexedDB dictionary cache (read/write/remove)
src/storage/settings.js       localStorage settings load/save
src/study/items.js            verb × form item lists (pure)
src/study/shuffle.js          seeded shuffle (pure)
src/study/reader-forms.js     reader block order, first-block flags and the
                              note/error_usage layer the blocks render
src/study/highlight.js        paint the studied form inside its sentences
src/study/card-tags.js        card face/back tag composition
src/study/results.js          run tally, score bands, completion emoji
src/ui/store.js               reactive session + send()
src/ui/bootstrap.js           boot → library → settings → home (also retry)
src/ui/scrollbar.js           page scrollbar geometry (pure)
src/ui/swipe.js               swipe threshold and the phone-width gate (pure)
src/ui/drag.js                finger-tracking drag: axis, held offset and
                              release naming, walls included (pure)
src/ui/motion.js              prefers-reduced-motion probe + slideRow (one
                              Web Animations settle of the paging row)
src/ui/window.js              paging window: 9/5 slots, current in the 3rd
src/ui/paging-window.js       keeps the window row and shifts it per turn
src/study/window-views.js     per-slot card/reader data for the window
src/ui/typing.js              IME-safe field edits (pure)
src/views/*.vue               screens (thin)
src/components/*.vue          shared UI pieces (thin: SiteHead, BuildFooter,
                              AboutSheet, RubyWord, CompletePanel, PageScrollBar)
                              — top-bar icons come from lucide-vue-next (npm),
                              inlined into the bundle at build time
src/styles/app.css            design tokens, layout, motion, breakpoints
index.html
vite.config.js                outDir "output", base "/game-japanese-katsuyou-basic/", dict serving/copy
output/                       build output, gitignored
```

## Dictionary delivery

Manifest shape (`src/data/dict-manifest.json`, generated, committed):

```json
{
  "algorithm": "sha256",
  "total": 50,
  "lessons": [
    { "lesson": 1, "file": "lesson_1.json", "sha256": "<lowercase hex>" }
  ]
}
```

`scripts/write-sha256.mjs` regenerates it; `--check` compares it with the
actual bytes and exits non-zero on any mismatch. The `pretest` and `prebuild`
scripts run the check.

Boot rule per lesson, in order: a stored IndexedDB record is used only when its
hash matches. A missing or corrupt copy is downloaded up to twice; the file
is written only after a download hashes correctly. If both downloads
mismatch, boot stops, records `session.boot.error = { lesson, file, message }`
and leaves `boot.done` false. `boot.checked` counts verified lessons only.

- Dev: Vite middleware serves `vol/lesson_N.json` at
  `/game-japanese-katsuyou-basic/dict/lesson_N.json`, accepting the URL with or
  without the base prefix.
- Build: a Vite plugin copies all 50 lesson files to `output/dict/`.
- Runtime: fetch `dict/lesson_N.json`, resolved against the page URL with
  `document.baseURI`, so it follows whatever `base` the build used
  (`/game-japanese-katsuyou-basic/` for GitHub Pages). Then verify SHA-256
  against the bundled manifest and store the bytes in the IndexedDB database
  `katsuyou-dict`, object store `lessons`, keyed by file name.

## Testing

- Vitest under Node for engine, commands, hashing, boot, settings, item
  lists, keyboard, grading, ruby, swipe/drag resolution, paging window, result
  tallies: 25 files, 242 tests.
- Browser APIs (IndexedDB, fetch) are injected so tests use fakes; the IDB
  adapter itself is tested with `fake-indexeddb`. No browser is needed for
  `npm test`.
- `scripts/browser-check.mjs` starts `vite preview` and drives headless
  Chromium at 390×844 (plus 550/551/800/900 width probes) through loading,
  home, all three pickers, reader, three settings screens, cards, quiz and
  completion, including IndexedDB reuse, the loading head and credit line, the
  first-card wall, reduced motion and the 550px breakpoint. It is a
  separate command, not part of `npm test`. The run is 456 checks on the final
  pass (the count can move by one: the seeded quiz item decides how many
  kana-key assertions run).

## Styling and motion

Tokens in `src/styles/app.css`: indigo→amber gradient background with a faint
grain, warm off-white `min(100%, 480px)` column with 28px radius and light
shadow, system CJK font stack (`Hiragino Sans`, `Noto Sans TC`, `Noto Sans JP`),
36px × 10px-radius controls (chips and settings rows), 44px+ quiz keys, 60px
home entries, 50px picker/reader/card footer controls and 60px 返回主頁, ~220ms
screen transitions, a 240ms `rotateY` card flip, a finger-tracking paging
drag — the strip of items follows the hand 1:1 while held (clamped to one
item width) and on release finishes the page as one ~190ms decelerating
settle from where the finger left it, or settles back when the release names
no turn; nothing moves once the item has settled — 1.6s answer toasts, and a
`prefers-reduced-motion: reduce` branch that freezes the gradient, keeps the
drag invisible while swipes change items directly, makes flips instant, and
fades between screens.
At ≤550px the column is full-bleed and the gradient is replaced by the column
colour.

## Final implementation notes

- `app.boot` is the only async command; `dispatch` returns a Promise of the
  usual envelope for it, so `bootstrap(store)` can `await` boot and then load
  the library and settings. `boot.running` prevents a second concurrent boot.
- The library lives in `src/dict/library.js` (module-level data passed to
  commands/stores as a dependency), not inside the reactive session. The
  session keeps only the small `lessons` summary the picker renders.
- Paging is one finger-tracking phase. While a drag is held, the paging
  row (`.reader-window` / `.card-window`) translates with the finger 1:1 via
  its own inline transform — `dragShift` in `src/ui/drag.js` clamps the travel
  to one item width and walls off directions with no item behind them. On
  release the command swaps the item at once and `slideRow` in
  `src/ui/motion.js` settles the whole row with one Web Animations move from
  where the finger left it (190ms, `--ease-slide`), so the window advance
  stays invisible and the settle is imperative — a press during a settle drops
  that move and starts the next one with no class to restart. A sub-threshold
  release settles the row back to rest without committing. A 600ms timer is
  only a safety net for a `finish` event that never arrives. `scripts/
  motion-probe.mjs` prints the frame-by-frame trace when a number needs
  re-measuring.
- The page scrollbar is drawn, not native: `src/ui/scrollbar.js` holds the
  geometry (pure and unit tested) and `src/components/PageScrollBar.vue` wires
  `scroll`/`resize`/`ResizeObserver` to it. `app.css` hides the browser bar on
  `html`/`body` only, and the two inner `.form-list` dropdowns set
  `scrollbar-width: auto` because `scrollbar-width` inherits.
- The viewport pins the scale (`maximum-scale=1, user-scalable=no`) and
  `html`/`body` set `touch-action: manipulation`, so a double tap and a pinch
  both leave the page at scale 1; the gesture surfaces override with `pan-y`.
- Gesture wiring stays in the views, but the rules are pure: swipe threshold
  and the phone-width gate in `src/ui/swipe.js`, drag axis / held offset /
  release naming (walls included) in `src/ui/drag.js`, answer
  normalization/grading and keyboard generation in `src/dict/quiz.js`, typing
  diffs in `src/ui/typing.js`, and ruby alignment in `src/dict/ruby.js`.
- Under `prefers-reduced-motion: reduce`, `src/ui/motion.js` tells the reader
  and card gestures to keep the drag invisible and change the item directly on
  release (a 72px swipe still changes the item), the stylesheet freezes the
  gradient, and screen changes keep a short fade.
- Settings and lesson selections persist under `katsuyou-settings`; every
  command that changes them saves immediately through the injected storage.
- The head and the credit line are components, not per-screen markup:
  `src/components/SiteHead.vue` (the three lines, on home and on loading) and
  `src/components/BuildFooter.vue` (the credit line, with the bug line only on
  home). `src/components/AboutSheet.vue` is the shared sheet, so both screens
  open the same panel. Each view keeps its own `sheetOpen` ref; there is no
  `about` command because the sheet was already view state.
- The first card's wall is stillness, not resistance: `dragShift` and
  `dragDirection` in `src/ui/drag.js` return no travel and no direction when
  `session.index === 0` and the drag goes right, so `CardView.vue` never moves
  the card at any distance — no follow, no settle back. The dictionary's first
  and last word are walled the same way.
- The dictionary's note layer is data-driven: `orderedFormEntries` in
  `src/study/reader-forms.js` carries each form's `note` and `errorUsage`, and
  `ReaderView.vue` renders the note above the 例句 block (and each sentence's
  own note under its Chinese line) in the `--note` colour, while an
  `error_usage` word gets a double strikethrough with its colour left alone
  and no 例句 block.

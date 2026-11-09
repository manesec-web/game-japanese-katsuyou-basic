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

Error codes in use: `unknown-command`, `invalid-params`, `missing-param`,
`command-disabled`, `command-failed`, `boot-failed`. A command may throw an
Error carrying a string `code` and optional `details`; dispatch converts it
into that error shape instead of `command-failed`.

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
docs/roadmap.md               task board and resume instructions
docs/progress.md              current state, commands run, next step
docs/changelog.md             dated change log
scripts/write-sha256.mjs      hashes vol/*.json into src/data/dict-manifest.json
src/main.js                   app entry: creates store, boots, mounts Vue
src/engine/registry.js        command registry + dispatch
src/engine/session.js         createSession() and pure state helpers
src/commands/*.js             one module per feature, each exports specs()
src/dict/forms.js             the 15 form ids and on-screen names, in order
src/dict/hash.js              SHA-256 (Web Crypto wrapper)
src/dict/keyboard.js          quiz keyboard generation (pure)
src/dict/ruby.js              kanji / reading alignment for <ruby>
src/data/dict-manifest.json   generated manifest, committed
src/storage/idb.js            IndexedDB dictionary cache (read/write/remove)
src/ui/store.js               reactive session + send()
src/views/*.vue               screens (thin)
src/components/*.vue         shared UI pieces (thin)
src/styles/app.css            design tokens and layout
index.html
vite.config.js                outDir "output", base "./", dict serving/copy
public/                       static assets; dictionary is not copied here
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

- Dev: Vite middleware serves `vol/lesson_N.json` at `/dict/lesson_N.json`.
- Build: a Vite plugin copies all 50 lesson files to `output/dict/`.
- Runtime: fetch `/dict/lesson_N.json` (relative, so subpath hosting works),
  verify SHA-256 against the bundled manifest, store the bytes in the
  IndexedDB database `katsuyou-dict`, object store `lessons`, keyed by file name.

## Testing

- Vitest under Node for engine, commands, hashing, keyboard, grading, ruby.
- Browser APIs (IndexedDB, fetch) are injected so tests use fakes; the
  adapter itself is tested with `fake-indexeddb`, and no browser runs
  in CI.
- UI checks are manual browser walk-throughs and are recorded in
  `docs/progress.md`.

## Styling and motion

Tokens in `src/styles/app.css`: indigo→amber gradient background, warm
off-white `min(100%, 480px)` column with large radius and light shadow, system
CJK font stack, 48px minimum button height, ~220ms screen transitions,
1.6s answer toasts, drag-follow / spring-back for swipes, and a
`prefers-reduced-motion: reduce` branch that freezes the gradient, switches
items directly, and fades between screens.

## Final implementation notes

- `app.boot` is the only async command; `dispatch` returns a Promise of the
  usual envelope for it, so `bootstrap(store)` can `await` boot and then load
  the library and settings. `boot.running` prevents a second concurrent boot.
- The library lives in `src/dict/library.js` (module-level data passed to
  commands/stores as a dependency), not inside the reactive session. The
  session keeps only the small `lessons` summary the picker renders.
- Gesture wiring stays in the views, but thresholds/spring-back resolution
  are pure (`src/ui/swipe.js`), answer normalization/grading and keyboard
  generation are pure (`src/dict/quiz.js`), typing diffs are pure
  (`src/ui/typing.js`), and ruby alignment is pure (`src/dict/ruby.js`).
- Under `prefers-reduced-motion: reduce`, `src/ui/motion.js` tells the reader
  and card gestures to skip drag-follow (a 72px swipe still changes the item),
  the stylesheet freezes the gradient, and screen changes keep a short fade.
- Settings and lesson selections persist under `katsuyou-settings`; every
  command that changes them saves immediately through the injected storage.

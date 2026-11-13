# Serving locally (and why a Python server can fail)

The site is a static build in `output/`. Nothing else in the repository is
served to the browser: `vol/` is build input, `src/` is Vite input. The
serving, secure-origin and Pages rules below were rechecked on 2026-11-11
against the revision-23 build (50 dictionary files, `output/index.html`); they
are unchanged by the later settings and UI work.

Revision 31 changed only the form-level Chinese `chinese` values and one
usage `note` inside `vol/lesson_*.json`; it did not change file names, the
50-file layout, the manifest algorithm, or the boot/hash rules. Because the
manifest hashes raw bytes, `node scripts/write-sha256.mjs` was re-run after
that data pass; a stale manifest still makes `pretest` / `prebuild` / `predev`
and the loading screen fail exactly as before.

## Correct ways to run it

```bash
npm run dev          # Vite dev server; serves the site and dict/lesson_N.json from vol/
npm run preview      # serves the built output/ (recommended for a check)
```

The site is built for GitHub Pages, so it lives under the project subpath
`/game-japanese-katsuyou-basic/` everywhere: `base` in `vite.config.js` is
`/game-japanese-katsuyou-basic/`. Opening `http://localhost:5173/` redirects to
`http://localhost:5173/game-japanese-katsuyou-basic/`, and `npm run preview`
serves `http://localhost:4173/game-japanese-katsuyou-basic/`. Opening
`output/index.html` straight from the filesystem (`file://`) no longer works:
the script and stylesheet are requested from `/game-japanese-katsuyou-basic/assets/`,
which no local file path can satisfy.

Python static server: the build directory has to be mounted **at the subpath**, because the built URLs are absolute:

```bash
npm run build
mkdir -p /tmp/katsuyou-site
cp -r output /tmp/katsuyou-site/game-japanese-katsuyou-basic
cd /tmp/katsuyou-site
python3 -m http.server 8000
# open http://localhost:8000/game-japanese-katsuyou-basic/
```

Serving `output/` itself at `http://localhost:8000/` shows a blank page: every
asset and dictionary request points under the subpath and 404s.

Do NOT run `python3 -m http.server` in the repository root:

- `index.html` there is the Vite template, which loads `/src/main.js`; Python
  serves the `.vue` files and bare `import 'vue'` statements raw, so the page
  stays blank with a module-specifier error.
- `dict/lesson_1.json` does not exist at the root (the dictionary lives in
  `vol/` and is copied into `output/dict/` only by the build). The browser asks
  for it under the subpath: `game-japanese-katsuyou-basic/dict/lesson_1.json`.

## Why it can stop at `載入失敗（lesson 1）`

Boot checks lesson 1 first, so a problem before any dictionary work shows up
there. The loading screen now prints the underlying reason under the lesson
number. The site head and the `Build with ❤ by Mane` credit line stay on screen
during that failure; only the progress area changes, so a screenshot of the
failure still shows the site name and the About sheet is still reachable. Common
causes:

1. **Wrong directory served.** `output/dict/lesson_1.json` must return 200 under
   the subpath. Check with
   `curl -I http://localhost:8000/game-japanese-katsuyou-basic/dict/lesson_1.json`.
2. **Stale or partial build.** Run `npm run build` again; confirm
   `output/dict/` has 50 files and `output/index.html` exists.
3. **Not a secure context.** IndexedDB itself opens on plain HTTP (a LAN IP
   works), but Web Crypto does not: `crypto.subtle` is `undefined` outside
   `https://`, `http://localhost`, and `http://127.0.0.1`. Boot hashes every
   file with SHA-256, so it still stops on the first lesson over
   `http://192.168.x.x:8000` or a `file://` URL, with the detail
   `download 2 could not be hashed: Cannot read properties of undefined
   (reading 'digest')`. Use localhost, a tunnel with HTTPS, or GitHub Pages.
4. **Storage blocked.** "Block all cookies", a browser that refuses IndexedDB,
   or a private window with an ephemeral quota can fail the same way. The detail
   line names the error (`IndexedDB is unavailable on this origin; storage is
   blocked or disabled` when the API is missing).
5. **Corrupt cached copy that also fails to download.** Boot hashes the
   stored file, downloads once more, and stops if two downloads mismatch.
   Clear site data for the origin (or delete the `katsuyou-dict` IndexedDB
   database) and retry.

## Check the build before blaming the server

```bash
npm run build
ls output/dict | wc -l                  # must be 50
test -f output/index.html && echo ok
curl -I http://localhost:8000/game-japanese-katsuyou-basic/dict/lesson_1.json   # must be 200
```

`node scripts/browser-check.mjs` runs the same build through headless
Chromium, including a boot from an empty IndexedDB, a reload that reuses the
cache, and a simulated storage-failure path. The current suite is 527 checks
(the count can move by one with the seeded quiz item); the separate
`strike-probe.mjs` paint probe is informational, not a serving gate. If the
browser suite passes, the build and the boot rule are sound and the problem is
the origin or the server.

## GitHub Pages

GitHub Pages serves over HTTPS, so `crypto.subtle` and IndexedDB are both
available. The base is pinned to `/game-japanese-katsuyou-basic/` to match the
repository name, so the repo publishes as a project site at
`https://<user>.github.io/game-japanese-katsuyou-basic/`. Build first (`output/`
is gitignored) and publish the contents of `output/` at the root of the Pages
branch or folder: Pages adds the subpath, the files do not contain it.
Renaming the repository means changing that one constant in `vite.config.js`
plus the matching `SITE_BASE` in `scripts/browser-check.mjs`.

The dictionary is fetched from `dict/lesson_N.json` resolved against the page
URL, so it follows the subpath without any extra setting.

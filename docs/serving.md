# Serving locally (and why a Python server can fail)

The site is a static build in `output/`. Nothing else in the repository is
served to the browser: `vol/` is build input, `src/` is Vite input.

## Correct ways to run it

```bash
npm run dev          # Vite dev server; serves /dict/lesson_N.json from vol/
npm run preview      # serves the built output/ (recommended for a check)
```

Python static server, serving **the build directory**:

```bash
npm run build
cd output
python3 -m http.server 8000
# open http://localhost:8000/
```

Do NOT run `python3 -m http.server` in the repository root:

- `index.html` there is the Vite template, which loads `/src/main.js`; Python
  serves the `.vue` files and bare `import 'vue'` statements raw, so the page
  stays blank with a module-specifier error.
- `dict/lesson_1.json` does not exist at the root (the dictionary lives in
  `vol/` and is copied into `output/dict/` only by the build).

## Why it can stop at `載入失敗（lesson 1）`

Boot checks lesson 1 first, so a problem before any dictionary work shows up
there. The loading screen now prints the underlying reason under the lesson
number. Common causes:

1. **Wrong directory served.** `output/dict/lesson_1.json` must return 200.
   Check with `curl -I http://localhost:8000/dict/lesson_1.json`.
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

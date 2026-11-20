# Serving locally
Updated for revision 39 (dark theme). Behavior rules: [`spec.md`](spec.md); wiring: [`architecture.md`](architecture.md); setup: [`development.md`](development.md).

## Correct ways to run
```bash
npm run dev       # http://localhost:5173/game-japanese-katsuyou-basic/
npm run preview   # http://localhost:4173/game-japanese-katsuyou-basic/ (after npm run build)
```
`vite.config.js` pins `base = '/game-japanese-katsuyou-basic/'`, so open the subpath, not the server root. Dev builds `dict/vol.bin` from `vol/`; preview serves `output/`. Both also serve the 46 `dict/resource/*.bin` audio bins.
A plain Python server works only if `output/` is mounted at that subpath:
```bash
npm run build
mkdir -p /tmp/katsuyou-site
cp -r output /tmp/katsuyou-site/game-japanese-katsuyou-basic
cd /tmp/katsuyou-site && python3 -m http.server 8000
# open http://localhost:8000/game-japanese-katsuyou-basic/
```
Serving `output/` at `/`, or `output/index.html` over `file://`, fails: built URLs for assets and `dict/vol.bin` are under the Pages subpath.

## Why the repository root fails
Do not run `python3 -m http.server` in the repository root:

- Root `index.html` is the Vite template (`/src/main.js`, bare `vue` imports); a static server leaves a blank page with a module-specifier error.
- `dict/vol.bin` does not exist there: it is generated from `vol/` into `output/dict/`. The browser requests `<base>dict/vol.bin`, a 50-entry ZIP named `.bin` and served `application/octet-stream` so download-helper extensions do not hijack it (`unzipit` reads bytes). No per-lesson JSON ships.
- `crypto.subtle` is undefined outside a secure origin (`https://`, `http://localhost`, `http://127.0.0.1`); boot hashes every lesson, so LAN-IP or `file://` origins fail. IndexedDB can also be blocked by storage settings.

## `載入失敗（lesson 1）` checklist
Boot checks lesson 1 first, so any pre-dictionary problem appears there; the loading screen prints the underlying reason under the lesson number and offers retry (`app.boot` again).

| Cause | Fix |
|---|---|
| Wrong directory / subpath | serve `output/` at `/game-japanese-katsuyou-basic/`; `curl -I http://localhost:8000/game-japanese-katsuyou-basic/dict/vol.bin` must be 200 |
| Stale or partial build | `npm run build`; confirm `output/index.html`, `output/dict/vol.bin` and 46 bins in `output/dict/resource/` |
| Insecure origin | localhost, HTTPS tunnel or GitHub Pages (Web Crypto required) |
| Blocked IndexedDB (`katsuyou-dict`) | unblock storage / clear site data |
| Corrupt cache still failing after two archive downloads | clear site data (or delete `katsuyou-dict`) and retry |
| Missing / corrupt audio bin | 「該音頻暫時無法播放」 on tap, not a boot failure; run `node scripts/fetch-audio.mjs` (or `npm run build`) with network access; clear `katsuyou-audio` if cached |

`prebuild` regenerates the 210 變形說明 entries and fetches the audio bins, so `npm run build` needs network access to the `res-miles` release; a stale manifest fails `predev` / `pretest` / `prebuild` and the archive build.

## Check the build before blaming the server
```bash
node scripts/write-sha256.mjs --check
node scripts/write-audio-manifest.mjs --check
npm run build
ls output/dict                 # vol.bin + resource/ (46 .bin files)
```
`node scripts/browser-check.mjs` runs `vite preview` + headless Chromium over loading (cold boot, cache reuse, simulated storage failure), all screens and audio: 682 checks / 0 failures here (±1 with the seeded quiz item); it also asserts one `vol.bin` request, binary Content-Type, a 50-entry ZIP and 46 audio bins. If it passes, suspect the origin or server, not the build. Env: `PORT` (default 5199), `CHROMIUM_PATH`, `SHOT_DIR`, `--screenshots`.

## GitHub Pages
Pages serves HTTPS, so Web Crypto and IndexedDB work. Publish the contents of `output/` (gitignored) at the root of the Pages branch/folder; Pages adds the subpath and `dict/vol.bin` is fetched relative to the page URL. Live site: https://manesec-web.github.io/game-japanese-katsuyou-basic/ (verified 2026-11-14: HTTP 200; `vol.bin` answers `application/octet-stream`). Renaming the repo means changing `base` in `vite.config.js` and `SITE_BASE` in `scripts/browser-check.mjs`.

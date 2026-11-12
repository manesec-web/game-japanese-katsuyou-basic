# docs/logo

`logo.jpg` is the source artwork for the site's browser-tab mark. The other files
here are derived from it and are what `index.html` links; they live in this
folder so the artwork and its conversions stay together. The page itself draws
no logo — the loading and home head stay three text lines.

Regenerate them with ImageMagick after replacing `logo.jpg`:

```bash
magick docs/logo/logo.jpg -filter Lanczos -resize 512x512 docs/logo/logo-512.png
magick docs/logo/logo.jpg -filter Lanczos -resize 192x192 docs/logo/favicon-192.png
magick docs/logo/logo.jpg -filter Lanczos -resize 32x32 docs/logo/favicon-32.png
magick docs/logo/logo.jpg -filter Lanczos -resize 180x180 -alpha off docs/logo/apple-touch-icon.png
magick docs/logo/favicon-32.png docs/logo/favicon-192.png \
  -define icon:auto-resize=48,32,16 docs/logo/favicon.ico
```

| File | Role |
|---|---|
| `logo.jpg` | Source artwork (1408×1408 JPEG), not served |
| `favicon.ico` | 16/32/48px multi-resolution tab icon |
| `favicon-32.png` | 32px PNG favicon |
| `favicon-192.png` | 192px PNG icon (Android / bookmark surfaces) |
| `apple-touch-icon.png` | 180px iOS home-screen icon, opaque (no alpha) |
| `logo-512.png` | 512px copy of the artwork, not linked from `index.html` |

`index.html` references the first four with relative hrefs (`./docs/logo/...`),
so Vite hashes each file into `output/assets/` and prefixes it with the Pages
base (`/game-japanese-katsuyou-basic/`). There is no `public/` directory and no
root-absolute `/favicon.ico`. `scripts/browser-check.mjs` asserts the document
title, that every icon URL lives under that subpath, and that each one answers
200 with an `image/*` content type.

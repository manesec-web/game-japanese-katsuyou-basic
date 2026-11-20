# docs/logo

`logo.jpg` is the source artwork for the browser-tab icons; the derived files
stay beside it. The on-screen head draws no logo. The icons are theme-independent:
light and dark themes use the same artwork.

Regenerate after replacing the source with ImageMagick:

```bash
magick docs/logo/logo.jpg -filter Lanczos -resize 512x512 docs/logo/logo-512.png
magick docs/logo/logo.jpg -filter Lanczos -resize 192x192 docs/logo/favicon-192.png
magick docs/logo/logo.jpg -filter Lanczos -resize 32x32 docs/logo/favicon-32.png
magick docs/logo/logo.jpg -filter Lanczos -resize 180x180 -alpha off docs/logo/apple-touch-icon.png
magick docs/logo/favicon-32.png docs/logo/favicon-192.png \
  -define icon:auto-resize=48,32,16 docs/logo/favicon.ico
```

| File | Dimensions / role |
|---|---|
| `logo.jpg` | 1408×1408 source JPEG, not served |
| `favicon.ico` | 16 / 32 / 48px multi-resolution ICO |
| `favicon-32.png` | 32px PNG favicon |
| `favicon-192.png` | 192px PNG icon |
| `apple-touch-icon.png` | 180px opaque iOS icon |
| `logo-512.png` | 512px copy of the artwork, not linked |

`index.html` links the first four files above (`favicon.ico`, `favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`) with relative `./docs/logo/...` hrefs; Vite hashes them into `output/assets/` under the Pages base, with no `public/` directory or root `/favicon.ico`. `scripts/browser-check.mjs` checks those four URLs and the document title.

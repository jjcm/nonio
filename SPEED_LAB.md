# Speed Lab — nonio main feed (Fable track)

Overnight speed lab on the nonio main feed. One fixture, one harness, one
hypothesis per iteration. Experimental branch only — **never merge**.

```
SEED_COMMIT=4dc103a4306564ed7bb6cddb48a9f14f078f6b16
```

- Fixture + reproduction steps: `speed-lab/SPEED_LAB.md` (10 image / 10 text / 1 video posts, slugs `sl-img-01..10`, `sl-txt-01..10`, `sl-vid-01`, fixed IDs 1001–1021, lab user `speedlab`).
- JSON log (graphable): `speed-lab/results.json`
- Harness: `speed-lab/harness/measure.mjs` (Playwright)

## Environment

Linux cloud VM (Ubuntu), Playwright Chromium headless-shell 151, MariaDB,
Go API (:4201) + image/video/avatar/html CDNs (:4203/:4204/:4202/:4205),
Node frontend dev server (`node index.js`, :4200). Route under test:
`http://localhost:4200/` — the main feed (tags route) showing all 21 fixture posts.

Per run: fresh browser, cold navigation → 2.5s settle → metrics, then reload in
the same page (warm) → metrics. Medians; cold/warm load = `loadEventEnd`,
FCP/LCP via PerformanceObserver. Extra column **feedPaint** = first post card
revealed with a decoded thumbnail, because feed cards animate in from
`opacity: 0`, which excludes their first paint from LCP candidacy — Chrome
attributes LCP to early text, so LCP alone under-reports feed content timing.
Slow 4G = CDP throttle, 150ms RTT / 1.6Mbps down / 750kbps up.

## Results (medians, ms)

### Unthrottled

| iter | change | cold | warm | FCP(c) | LCP(c) | feed(c) | feed(w) | n | verdict | tradeoff |
|------|--------|------|------|--------|--------|---------|---------|---|---------|----------|
| 0 | baseline | 118 | 104 | 124 | 140 | 138 | 114 | 7 | baseline | — |
| 1 | static-file ETag/304 + max-age=300 | 127 | 72 | 132 | 152 | 149 | 88 | 7 | kept | assets may be ≤5min stale for devs |

### Slow 4G

| iter | change | cold | warm | FCP(c) | LCP(c) | feed(c) | feed(w) | n | verdict | tradeoff |
|------|--------|------|------|--------|--------|---------|---------|---|---------|----------|
| 0 | baseline | 4606 | 4435 | 3968 | 4448 | 4448 | 4269 | 5 | baseline | — |
| 1 | static-file ETag/304 + max-age=300 | 4663 | 315 | 3996 | 4468 | 4460 | 506 | 5 | kept | assets may be ≤5min stale for devs |

## Iteration log

### Iteration 0 — baseline

Feed renders correctly (21 posts, thumbnails, screenshot-verified). Notable in
the numbers: on Slow 4G **warm ≈ cold** (4435 vs 4606) and the document
`transferSize` is identical cold vs warm — the dev server sends no caching
headers, so every warm load re-downloads every byte. That is the first lead.

### Iteration 1 — static asset caching headers (KEPT)

Hypothesis: warm loads re-download all 87 static assets (~680KB of JS/CSS/wasm)
because `soci-frontend/index.js` serves files with only Content-Type; adding
ETag/Last-Modified + 304 handling + bounded `Cache-Control: max-age=300` will
collapse warm load without touching cold.

Change: `soci-frontend` branch `speed-lab`, commit `1e9572f` (file handler
only; pug/document responses untouched, mp4 range path untouched). Not
`immutable` — filenames aren't content-hashed (speedupskill "immutable on
retunable derivatives" is a do-not).

Result: Slow 4G warm load 4435 → **315ms** (−93%), warm FCP 3968 → 328, warm
feedPaint 4269 → 506. Unthrottled warm 104 → 72ms. Cold within noise both ways
(+1%). Smoke: 21 posts render cold+warm, screenshot identical. **Keep.**
Tradeoff: dev-server assets can be up to 5 minutes stale after an edit
(shift-reload bypasses).

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
| 2 | defer non-feed components until after load | 106 | 70 | 112 | 112 | 133 | 86 | 7 | kept | later routes' components define shortly after load |
| 3 | defer markdown-wasm loader script | 94 | 66 | 116 | 124 | 116 | 82 | 7 | kept | markdown bodies render a tick later on slow pipes |
| 4 | modulepreload eager module subtree (29 links) | 96 | 70 | 100 | 116 | 122 | 92 | 7 | rejected | — (reverted) |
| 5 | gzip compressible dev-server responses | 106 | 67 | 120 | 120 | 136 | 87 | 7 | kept | ~10ms sync gzip CPU per cold load on localhost |

### Slow 4G

| iter | change | cold | warm | FCP(c) | LCP(c) | feed(c) | feed(w) | n | verdict | tradeoff |
|------|--------|------|------|--------|--------|---------|---------|---|---------|----------|
| 0 | baseline | 4606 | 4435 | 3968 | 4448 | 4448 | 4269 | 5 | baseline | — |
| 1 | static-file ETag/304 + max-age=300 | 4663 | 315 | 3996 | 4468 | 4460 | 506 | 5 | kept | assets may be ≤5min stale for devs |
| 2 | defer non-feed components until after load | 3041 | 313 | 2392 | 2856 | 2849 | 513 | 5 | kept | later routes' components define shortly after load |
| 3 | defer markdown-wasm loader script | 2869 | 313 | 2184 | 2668 | 2675 | 508 | 5 | kept | markdown bodies render a tick later on slow pipes |
| 4 | modulepreload eager module subtree (29 links) | 2919 | 321 | 2188 | 2720 | 2710 | 519 | 5 | rejected | — (reverted) |
| 5 | gzip compressible dev-server responses | 1767 | 206 | 1560 | 1980 | 1973 | 407 | 5 | kept | ~10ms sync gzip CPU per cold load on localhost |

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

### Iteration 2 — route-split the component registry (KEPT)

Hypothesis: cold Slow 4G is transfer-bound (~680KB / 87 requests) and
`soci-components.js` eagerly imports ~35 components the feed route never
renders (52KB threaded channel view, uploaders, comments, ledger, post detail,
video, modals — verified by enumerating custom elements in the feed DOM).
Deferring them until after `load` cuts cold load/FCP.

Change: `soci-frontend@649074b` — eager registry keeps only the feed/shell set;
the rest moved to `soci-components-deferred.js`, dynamically imported on
`window load`. Custom elements upgrade in place, so deep links to post/submit/
channel routes still work (definitions land right after load).

Result (vs iter 1): Slow 4G cold load 4663 → **3041ms** (−35%), cold FCP
3996 → **2392ms** (−40%), cold LCP 4468 → 2856, cold feedPaint 4460 → 2849.
Warm unchanged (313 vs 315). Unthrottled cold 127 → 106ms. Smoke: feed 21
posts; image post detail renders; video post plays (readyState 4, correct
mp4 URL); login modal opens. Pre-existing anonymous 401s unchanged. **Keep.**
Tradeoff: non-feed routes' components define a beat after load on slow pipes
(brief upgrade delay on deep links).

### Iteration 3 — defer markdown-wasm loader (KEPT)

Hypothesis: `markdown.js` is parser-blocking in `<head>` and starts the 56KB
`markdown.wasm` fetch mid-parse, contending with CSS/JS before first paint;
`defer` moves both off the pre-FCP path. Safe because `soci-markdown-view`
awaits `window.markdown.ready` at render time (render happens after the posts
API response, long after defer scripts execute).

Change: `soci-frontend@d6979f8` — one attribute in `index.pug`.

Result (vs iter 2): Slow 4G cold FCP 2392 → **2184ms** (−208ms), cold load
3041 → 2869, cold LCP 2856 → 2668, feedPaint 2849 → 2675. Warm flat.
Unthrottled cold 106 → 94ms. Smoke: text post renders markdown
(bold/italic/code verified), no page errors. **Keep.** Tradeoff: markdown
bodies can render a tick later on slow pipes.

### Iteration 4 — modulepreload the eager module subtree (REJECTED)

Hypothesis: eager module discovery is serial across 3 import levels (~2 extra
RTT waves on Slow 4G); 29 `<link rel=modulepreload>` hints in the shell will
flatten the waterfall and cut cold load/FCP.

Result (vs iter 3): Slow 4G cold load 2869 → 2919 (+50), cold LCP 2668 → 2720
(+52), feedPaint 2675 → 2710 (+35), FCP flat (2184 → 2188). Unthrottled FCP
improved (116 → 100) but load/feedPaint flat-to-worse. Verified all 29 hints
were emitted, so the test was valid. On a bandwidth-saturated 1.6Mbps HTTP/1.1
pipe (6 connections) discovery latency isn't the constraint, and the preload
burst competes with CSS/document. Wash-to-regression on the discriminating
environment → **reject, reverted** (matches speedupskill "high-entanglement
JS splits below the noise floor" / no unmeasured fetchpriority-style hints).

### Iteration 5 — gzip dev-server responses (KEPT)

Hypothesis: Slow 4G cold is transfer-bound on ~680KB of uncompressed text
assets; gzip for compressible types (JS/CSS/HTML/JSON/SVG/wasm, document
included) cuts cold load/FCP.

Change: `soci-frontend@e9e4e89` — `send()` helper gzips when the client sends
`Accept-Encoding: gzip`; `Vary: Accept-Encoding`; ETag/304 path unchanged.
soci.css goes 49KB → 9KB on the wire.

Result (vs iter 3, the kept base): Slow 4G cold load 2869 → **1767ms** (−38%),
cold FCP 2184 → **1560ms** (−29%), cold LCP 2668 → 1980, feedPaint 2675 → 1973,
warm load 313 → **206ms** (document now gzipped too). Unthrottled cold load
94 → 106ms (+12ms — synchronous gzip CPU; a keyed gzip cache is the natural
follow-up). Smoke: 21 posts, no page errors. **Keep.**

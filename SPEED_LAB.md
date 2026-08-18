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
| 6 | embed /posts payload in feed shell HTML | 126 | 71 | 140 | 140 | 124 | 83 | 7 | kept | loadEventEnd later (thumbs join load window); +TTFB for server-side API fetch |
| 7 | de-block 8 parser-blocking page scripts (lazyload pattern) | 114 | 61 | 120 | 128 | 113 | 78 | 7 | kept | page scripts init at DCL instead of during parse |
| 8 | markdown-wasm on demand (+post.js race fix) | 112 | 65 | 124 | 128 | 114 | 82 | 7 | kept | first markdown render waits for loader+wasm |
| 9 | esbuild-bundle critical module graphs at boot | 100 | 58 | 108 | 108 | 98 | 71 | 7 | kept | bundles rebuilt only on server restart; esbuild devDependency |
| 10 | minify boot-time bundles | 107 | 65 | 124 | 124 | 108 | 80 | 7 | kept | minified stack traces in dev |
| 11 | modulepreload the 2 shared bundle chunks | 102 | 61 | 108 | 116 | 101 | 74 | 7 | kept | dist wiped each boot; preloads injected server-side |
| 12 | preload the LCP thumbnail (one image) | 104 | 62 | 108 | 112 | 100 | 74 | 7 | kept | one extra early request on the pipe |
| 13 | skip redundant boot-time /posts merge fetch | 101 | 60 | 112 | 112 | 98 | 72 | 7 | kept | returning to filter=all reuses loaded data instead of re-merging |
| 14 | compile shell template once at boot | 66 | 26 | 88 | 88 | 64 | 40 | 7 | kept | template edits need a server restart |
| 15 | dedupe boot GETs (/tags ×3, /communities ×2 → 1+1) | 64 | 25 | 72 | 72 | 62 | 36 | 7 | kept | identical GETs within 2s share one response object |
| 16 | gzip output cache keyed by path+ETag | 64 | 23 | 72 | 76 | 60 | 36 | 7 | kept (first-principles wash) | memory holds gzipped copies of served statics |
| 17 | inline minified soci.css into the shell | 61 | 25 | 72 | 72 | 57 | 38 | 7 | rejected | — (reverted) |
| 18 | defer inactive routes' page scripts past load | — | — | — | — | — | — | — | skipped | profiling showed page scripts already start at/after load, past LCP — no pre-LCP contention to remove |
| 19 | brotli (q11 statics / q5 dynamic) over gzip | 65 | 24 | 52 | 76 | 63 | 37 | 7 | kept | br needs secure context (localhost/https) |

### Slow 4G

| iter | change | cold | warm | FCP(c) | LCP(c) | feed(c) | feed(w) | n | verdict | tradeoff |
|------|--------|------|------|--------|--------|---------|---------|---|---------|----------|
| 0 | baseline | 4606 | 4435 | 3968 | 4448 | 4448 | 4269 | 5 | baseline | — |
| 1 | static-file ETag/304 + max-age=300 | 4663 | 315 | 3996 | 4468 | 4460 | 506 | 5 | kept | assets may be ≤5min stale for devs |
| 2 | defer non-feed components until after load | 3041 | 313 | 2392 | 2856 | 2849 | 513 | 5 | kept | later routes' components define shortly after load |
| 3 | defer markdown-wasm loader script | 2869 | 313 | 2184 | 2668 | 2675 | 508 | 5 | kept | markdown bodies render a tick later on slow pipes |
| 4 | modulepreload eager module subtree (29 links) | 2919 | 321 | 2188 | 2720 | 2710 | 519 | 5 | rejected | — (reverted) |
| 5 | gzip compressible dev-server responses | 1767 | 206 | 1560 | 1980 | 1973 | 407 | 5 | kept | ~10ms sync gzip CPU per cold load on localhost |
| 6 | embed /posts payload in feed shell HTML | 1982 | 214 | 1564 | 1788 | 1783 | 230 | 5 | kept | loadEventEnd later (thumbs join load window); +TTFB for server-side API fetch |
| 7 | de-block 8 parser-blocking page scripts (lazyload pattern) | 1882 | 208 | 1444 | 1664 | 1658 | 223 | 5 | kept | page scripts init at DCL instead of during parse |
| 8 | markdown-wasm on demand (+post.js race fix) | 1802 | 214 | 1376 | 1584 | 1578 | 227 | 5 | kept | first markdown render waits for loader+wasm |
| 9 | esbuild-bundle critical module graphs at boot | 1396 | 211 | 968 | 1188 | 1180 | 223 | 5 | kept | bundles rebuilt only on server restart; esbuild devDependency |
| 10 | minify boot-time bundles | 1367 | 213 | 936 | 1144 | 1141 | 221 | 5 | kept | minified stack traces in dev |
| 11 | modulepreload the 2 shared bundle chunks | 1210 | 213 | 776 | 1000 | 982 | 230 | 5 | kept | dist wiped each boot; preloads injected server-side |
| 12 | preload the LCP thumbnail (one image) | 1224 | 213 | 784 | 828 | 816 | 226 | 5 | kept | one extra early request on the pipe |
| 13 | skip redundant boot-time /posts merge fetch | 1210 | 207 | 780 | 824 | 808 | 224 | 5 | kept | returning to filter=all reuses loaded data instead of re-merging |
| 14 | compile shell template once at boot | 1203 | 211 | 784 | 824 | 816 | 224 | 5 | kept | template edits need a server restart |
| 15 | dedupe boot GETs (/tags ×3, /communities ×2 → 1+1) | 1203 | 211 | 780 | 824 | 815 | 226 | 5 | kept | identical GETs within 2s share one response object |
| 16 | gzip output cache keyed by path+ETag | 1202 | 207 | 784 | 824 | 814 | 223 | 5 | kept (first-principles wash) | memory holds gzipped copies of served statics |
| 17 | inline minified soci.css into the shell | 1152 | 583 | 736 | 776 | 765 | 260 | 5 | rejected | — (reverted) |
| 19 | brotli (q11 statics / q5 dynamic) over gzip | 1166 | 212 | 744 | 796 | 777 | 225 | 5 | kept | br needs secure context (localhost/https) |

### Lighthouse desktop (comparable to the local Qwen track)

`speed-lab/harness/lighthouse.mjs` — Lighthouse desktop preset (simulated
40ms RTT / 10Mbps / 1× CPU), cold = fresh profile with storage reset, warm =
second run with `disableStorageReset`, medians of n=5. Iter 0 backfilled by
checking out the pre-change frontend (`soci-frontend@75e4cab`).

| iter | FCP(c) | LCP(c) | FCP(w) | LCP(w) | n |
|------|--------|--------|--------|--------|---|
| 0 (this track, backfilled) | 866 | 1290 | 868 | 1295 | 5 |
| 0 (local Qwen, reference) | 788 | 1334 | 790 | 1258 | 5 |
| 12 | 374 | 614 | 185 | 325 | 5 |
| 13 | 341 | 607 | 186 | 267 | 5 |
| 14 | 374 | 607 | 185 | 267 | 5 |
| 15 | 338 | 587 | 184 | 310* | 5 |
| 16 | 365* | 586 | 184 | 265* | 5 |
| 17 | 409 | 594 | 224 | 305 | 5 | (rejected) |
| 19 | 371* | 563 | 184 | 266 | 5 |

\* Lighthouse warm LCP is bimodal (~265 vs ~311 modes) in every iteration
13–15; medians flip on mode draws. Cold LCP distributions for iter 15
(568–590) sit uniformly below iter 14 (589–615).

The two tracks' iter0 numbers agree within ~10%, confirming both measure the
same fixture. This track's current state: cold FCP −57%, cold LCP −52%,
warm FCP −79%, warm LCP −75% vs its own Lighthouse baseline. A Lighthouse
column is recorded per iteration from here on.

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

### Iteration 6 — embed the feed's /posts payload in the shell HTML (KEPT)

Hypothesis: the feed's data fetch starts only after the JS graph boots;
embedding the anonymous `/posts` payload path-keyed in the shell removes an
API roundtrip from the critical path, cutting feedPaint/LCP cold and warm.

Change: `soci-frontend@53f7181` — dev server inlines
`window.__sociPreload={"/posts":…}` for the `/` route only (fetch failure →
no embed); `soci-post-list._loadPosts` consumes the payload once, only when
anonymous and only when the path key matches exactly — anything else is a
live fetch (speedupskill: "path-key drift → live fetch, not a wrong payload").

Result (vs iter 5, Slow 4G, tight distributions): cold LCP 1980 → **1788ms**
(−192), cold feedPaint 1973 → 1783, warm feedPaint 407 → **230ms** (−43%),
FCP flat. Cold `loadEventEnd` 1767 → 1982 (+215): first-principles, content
now renders *before* the load event, so the 10 thumbnails become load-gating
subresources — the page shows the feed ~190ms earlier while the load event
lands later; user-felt metrics (LCP/feedPaint) are the ones that matter for
this route. Smoke: 21 posts render, one fewer /posts call, tag route
(`#speedlab`) correctly live-fetches (`/posts?tag=speedlab`; empty result is
fixture behavior — the shared seed has no tag rows). **Keep.** Tradeoffs:
document TTFB includes a local server→API fetch; loadEventEnd optics.

### Iteration 7 — de-block the 8 parser-blocking page scripts (KEPT)

Hypothesis: eight classic page scripts (home, user, notifications, post,
why-webcomics, admin settings/financials/subscribe) embedded mid-body stall
HTML parsing on every route; converting them to the codebase's existing
`lazyload()` pattern removes them from the parse path.

Change: `soci-frontend@64a1213` — pug script tags → `lazyload(...)`, and each
script's trailing `DOMContentLoaded` listener → direct `init()` call
(lazyload injects after DCL, matching the tags.js/submit.js convention;
`soci.registerPage` already handles late registration via `page.dom.active`).

Result (vs iter 6): Slow 4G cold FCP 1564 → **1444ms**, cold LCP 1788 →
**1664ms**, feedPaint 1783 → 1658, cold load 1982 → 1882; warm all slightly
better. Unthrottled improved across the board. Smoke: feed 21 posts; post
deep-link renders with correct title; user page identical to pre-change
(title "All posts" and one `activateTag` console error verified pre-existing
by re-testing the stashed baseline). **Keep.**

### Iteration 8 — load markdown-wasm on demand (KEPT, includes a race fix)

Hypothesis: the feed's list view renders no markdown, yet every load fetches
`markdown.js` + 56KB wasm and the defer script gates DOMContentLoaded; loading
it on demand from `soci-markdown-view` removes ~66KB from the feed transfer
and the script from the DCL path.

Change: `soci-frontend@947499b` — shell script tag removed;
`soci-markdown-view._getMarkdown` injects the loader on first render behind a
shared promise. Only that component touched `window.markdown` (grep-verified).

Correctness find: the first smoke caught text posts rendering empty — not the
markdown change itself, but a latent race from iteration 7: `post.js` adds its
`routeactivate` listener manually (doesn't use `registerPage`), and lazyload
now loads it after the router has already activated the route on deep links.
Fixed by activating on init when `postRoute.active`. Re-smoked 3× green, plus
image post, video post (readyState 4), login modal, feed 21 posts.

Result (vs iter 7): Slow 4G cold FCP 1444 → **1376ms**, cold LCP 1664 →
**1584ms**, feedPaint 1658 → 1578, cold load 1882 → 1802. Warm flat. **Keep.**
Tradeoff: first markdown render on a route waits for loader+wasm fetch.

### Iteration 9 — esbuild-bundle the critical module graphs (KEPT)

Hypothesis: a Slow 4G resource profile showed the eager module graph occupying
the network from 171→1200ms (30 requests, only ~80KB gz; third discovery level
config/api/lib landing 1115–1200ms) with modules executing only after the whole
graph arrives — request-wave latency, not bytes, gates FCP. Bundling the two
entries collapses ~30 pre-FCP requests to ~3.

Change: `soci-frontend@d24b215` — `esbuild.buildSync` at server boot bundles
`soci.js` + `components/soci-components.js` (ESM, `splitting: true` keeps the
deferred subtree as separate chunks, no minify — isolating the wave effect);
dev server serves `.speed-lab-dist` artifacts when present, falls back to raw
modules if the build fails. (Context: iteration 4 showed modulepreload alone
regressing — parallel *discovery* didn't help a saturated HTTP/1.1 pipe;
collapsing the *request count* is what works.)

Result (vs iter 8): Slow 4G cold FCP 1376 → **968ms** (−30%), cold LCP
1584 → **1188ms**, feedPaint 1578 → 1180, cold load 1802 → 1396 (−23%).
Unthrottled improved across the board (warm load 65 → 58). Full smoke green:
feed 21 posts, image post detail, video (readyState 4), login modal, markdown.
**Keep.** Tradeoffs: bundles rebuild only on server restart (stale during live
component edits); esbuild added as devDependency.

### Iteration 10 — minify the boot-time bundles (KEPT)

Hypothesis: minifying the bundles trims pre-FCP transfer (43KB → 37.5KB gz).

Change: `soci-frontend@c31f9dd` — `minify: true` on the same esbuild build.

Result (vs iter 9): Slow 4G cold FCP 968 → **936ms**, cold LCP 1188 →
**1144ms**, cold load 1396 → 1367. Small but the run distributions are fully
separated (FCP 956–968 vs 928–940), so it's real, not noise. Warm and
unthrottled within noise. Smoke green. **Keep.** Tradeoff: minified stack
traces during dev.

### Iteration 11 — preload the shared bundle chunks (KEPT)

Hypothesis: profiling showed the shared esbuild chunks loading in a serial
wave after the entry bundles (586→749ms) because they're only discoverable at
parse; server-injected `modulepreload` for just those 2 chunk files removes
one RTT wave. (Contrast with rejected iteration 4: that preloaded 29 files
that were all *already* discoverable; this targets a genuinely serial tail.)

Change: `soci-frontend@f1dd1b3` — shell HTML gets `<link rel=modulepreload>`
for `chunk-*.js` (deferred route chunk excluded); dist dir wiped before each
rebuild after the first measurement accidentally preloaded 2 stale chunks
from the previous build (re-measured clean).

Result (vs iter 10): Slow 4G cold FCP 936 → **776ms** (−17%), cold LCP
1144 → **1000ms**, feedPaint 1141 → 982, cold load 1367 → 1210. Warm flat.
Smoke: feed, post detail, markdown all green. **Keep.**

### Iteration 12 — preload the LCP thumbnail, one image only (KEPT)

Hypothesis: the LCP element (first post's thumbnail) only starts fetching
after JS boot + render (~800ms on Slow 4G); a shell `<link rel=preload
as=image>` for that single image starts it at document parse. The server
already fetches the payload for embedding, so it emits the preload for the
first image-type post. Deliberately one image, not the grid (speedupskill:
grid thumb preload measured slower on a constrained pipe), and gated on a
measured LCP win per the fetchpriority/preload rule.

Change: `soci-frontend@e28bc66`.

Result (vs iter 11): Slow 4G cold LCP 1000 → **828ms** (−17%), feedPaint
982 → 816, FCP and cold load flat (within noise). Unthrottled LCP 116 → 112.
Smoke green. **Keep.** Tradeoff: one extra early request competing on the
pipe (measured: no FCP cost).

### Iteration 13 — skip the redundant boot-time /posts merge (KEPT)

Hypothesis: despite the embedded payload, every load still made one network
`/posts` request — a CDP initiator trace showed boot-time filter attribute
initialization triggering `fetchAndMerge` for the exact URL the initial load
had just consumed. Skipping the merge when the built URL equals what's loaded
removes a redundant 13KB request that competes pre-LCP.

Change: `soci-frontend@e301163` — `_refreshFilterFetch` returns early when
no data exists or the URL is unchanged; real filter changes (different type
query) still fetch. Verified: boot makes **zero** `/posts` requests; filter
to images fetches `/posts?type=image` and renders 10 items; back to all
renders 21.

Result (vs iter 12): Lighthouse warm LCP 325 → **267ms** (−18%, distributions
separated), cold FCP 374 → 341. Playwright deltas all positive but small
(Slow 4G cold load 1224 → 1210, warm 213 → 207). **Keep.** Tradeoff:
returning to filter=all reuses already-loaded data instead of re-merging.

### Iteration 14 — compile the shell template once at boot (KEPT)

Hypothesis: `pug.renderFile` re-parses `index.pug` and all includes on every
shell request — measured 33–50ms of document TTFB; `pug.compileFile` at boot
cuts TTFB to ~2–3ms and shifts every first-paint metric left where server CPU
isn't hidden by simulated RTT.

Change: `soci-frontend@5c58b06`.

Result (vs iter 13): unthrottled cold load 101 → **66ms**, warm 60 → **26ms**,
warm FCP 60 → 28, feedPaint 98 → 64 (cold) / 72 → 40 (warm) — the full TTFB
saving. Slow 4G flat (RTT-dominated). Lighthouse LCP/warm identical; its cold
FCP is bimodal across runs (≈340 vs ≈374 modes in both iter 13 and 14), not a
regression. **Keep.** Tradeoff: template edits need a server restart (same
class as the bundle rebuild tradeoff).

### Iteration 15 — dedupe boot-time API GETs (KEPT)

Hypothesis: boot fires 5 API requests for 2 distinct resources (`/tags`×3
from the sidebar's connected/activated/community-change paths, `/communities`
×2 across two different data helpers, plus a CORS preflight); a short-window
promise cache collapses them.

Change: `soci-frontend@f201d79` — `SociComponent.getData` and `api.getData`
share a window-scoped 2s promise cache keyed by path+auth. Verified boot
traffic is exactly one `/tags` + one `/communities`; feed renders 21 posts,
no page errors.

Result (vs iter 14): unthrottled cold FCP 88 → **72ms**; Lighthouse cold LCP
607 → **587ms** (distributions 568–590 vs 589–615, separated) and cold FCP
374 → 338. Slow 4G flat (these fetches sit post-FCP there). Lighthouse warm
LCP median moved 267 → 310 but that metric is bimodal (~265/~311 modes) in
every iteration 13–15 — mode draw, not regression. **Keep.** Tradeoff:
identical GETs within 2s share one response object.

### Iteration 16 — gzip output cache keyed by path+ETag (KEPT, first-principles wash)

Hypothesis: static responses re-gzip synchronously per request (~3–8ms CPU on
the critical path); caching gzipped bytes keyed by path+ETag removes it.

Change: `soci-frontend@33f8f63` — `send()` takes an optional cache key
(static file path+ETag; the dynamic document stays uncached), invalidation is
automatic because the ETag changes with the file.

Result (vs iter 15): direct server measurement is unambiguous — largest-file
TTFB 6.9ms → **0.9ms** cached — but every headline browser median is within
1–2ms (a wash; the single-client harness hides per-request CPU, and
Lighthouse cold FCP / warm LCP again drew their known bimodal modes).
**Kept as a labeled first-principles wash** per the lab rules: strictly less
CPU per request, scales with concurrency, zero staleness risk. Tradeoff:
memory holds gzipped copies of served statics (~100KB here).

### Iteration 17 — inline minified soci.css into the shell (REJECTED)

Hypothesis: inlining the stylesheet (9.3KB gz) removes one render-blocking
request from the pre-FCP critical path, cutting cold FCP on throttled
profiles at the risk of growing every document fetch.

Result (vs iter 16): Slow 4G cold did improve (FCP 784 → 736, LCP 824 → 776)
— but warm load exploded 207 → **583ms** (the no-cache document doubled to
17.4KB gz and the stylesheet lost its separate max-age cache entry), and
Lighthouse regressed consistently (cold FCP 365 → 409, warm FCP 184 → 224 —
outside its bimodal band, because Lighthouse refetches the document every
load). Cold-only win paid for by every repeat visit → **reject, reverted**.
The right version of this would need a content-hashed document or critical-
subset extraction, both out of scope tonight.

### Iteration 18 — defer inactive routes' page scripts (SKIPPED)

Hypothesis: the 13 route page scripts load at DCL on every route, competing
pre-LCP. Profiling on Slow 4G invalidated it before full measurement: with
the current critical path they all start at ~930ms — at/after the load event
and **after** LCP (824ms) — so there is no pre-LCP contention to remove.
Change reverted without a measurement cycle; logged as skipped.

### Iteration 19 — brotli over gzip (KEPT)

Hypothesis: brotli trims 10–20% off pre-FCP critical bytes vs gzip
(Chromium accepts `br` on localhost as a trustworthy origin).

Change: `soci-frontend@943d931` — `send()` prefers brotli when accepted;
cached statics compress at q11 (bundle 37.5KB → **31.5KB**, css 9.0 → 7.7KB),
dynamic documents at q5 to protect TTFB; cache keyed by encoding+path+ETag.

Result (vs iter 16): Slow 4G cold FCP 784 → **744ms**, cold LCP 824 →
**796ms**, feedPaint 814 → 777, cold load 1202 → 1166 — distributions fully
separated (FCP 784–788 vs 744–756). Lighthouse cold LCP 586 → **563ms**.
Warm flat everywhere (documents dominate warm and shrink only ~7%). Smoke
green. **Keep.** Tradeoff: `br` requires a secure context in production
(https), gzip fallback retained.

# SPEED LAB — VPS performance loop (2026-08-24)

Live target: **http://108.61.219.46/** and **https://108-61-219-46.sslip.io/** (same box).
Vultr, 1 vCPU, 1 GB RAM, 3 GB swap, Ubuntu 26.04, MariaDB 11.8. Branch `cursor/speed-vps-loop-27f0`
deployed via `speed-lab/vps/deploy.sh`; services run under systemd (`nonio-*`).

Seeded data (`speed-lab/seed/generate.mjs`, deterministic): 300 users, 40 tags, 2,600 posts
(45% image / 34% text / 13% link / 8% video), 18,053 comments, 13,037 tag votes, 1,689 media
files + 300 avatars fanned out to the CDNs.

## Measurement setup

- Harness runs on a separate cloud VM, **real WAN hop to the VPS: RTT ≈ 53 ms**.
- `speed-lab/harness/measure.mjs`: cold + warm homepage loads, n=7 medians.
  Lanes: `wan` (no throttle) and `slow4g` (CDP: 150 ms latency, 1.6 Mbps down).
- `speed-lab/harness/transitions.mjs`: warm SPA transitions homepage→tag/user/post, n=5 medians
  (fcr / visible / usable), lanes wifi + slow4g.
- `speed-lab/harness/api-timing.sh`: curl TTFB/total medians, on-box and over WAN.
- Full JSON for every run: `speed-lab/results/`.

Decision rule: keep if ≥5% or ≥20 ms on a user-felt median (cold FCP/LCP/feedPaint/allDone,
transition usable), no FCP-only win that regresses LCP. Revert otherwise. Stop after 5
consecutive misses or a clear plateau.

## Baseline (iter00) — the branch as deployed by quickStart-style layout

Six origins: frontend :80, API :4201, avatar :4202, image :4203, video :4204, html :4205.
All HTTP/1.1, no TLS.

API server-side is already fast (prior pass): `/posts` **3 ms** warm on box, 22 ms cold;
over WAN it is pure network (TTFB ≈ 107 ms ≈ 2×RTT).

| metric (median) | wan cold | wan warm | slow4g cold | slow4g warm |
|---|---|---|---|---|
| FCP | 884 | 104 | 2720 | 220 |
| LCP | 1240 | 104 | 6824 | 220 |
| feedPaint | 1224 | 158 | 6816 | 419 |
| allDone | 2568 | 1712 | 31325 | 1956 |
| TBT | 0 | 0 | 0 | 0 |
| requests / transfer | 244 / 256 KB | | same | |

Transitions (usable): slow4g tag 259 / user 292 / post 225; wifi tag 110 / user 110 / post 125.

Read: TBT=0 — the cost is **not JS execution**, it is the network waterfall: 244 requests
(~60 JS modules at depth 2, ~100 post thumbnails, ~100 avatars) over per-origin HTTP/1.1
connection pools. Server SQL/API time is a rounding error at this size.

---

## Iterations

### iter01 — single origin + TLS + HTTP/2/3 via Caddy — **KEEP**

**Hypothesis:** Six plain-HTTP origins cost DNS/TCP setup per origin and serialize 244 requests
on h1.1 pools; collapsing everything onto one TLS origin with h2 multiplexing (h3 via Alt-Svc)
removes the connection ceiling.

**Change:** Caddy 2.11 on 80/443. `/api/*`, `/image/*`, `/avatar/*`, `/video/*`, `/htmlcdn/*`
strip-prefix proxy to the local services; everything else → node frontend (:4200 now).
Let's Encrypt cert on `108-61-219-46.sslip.io`. Frontend config hosts become relative paths
(`/api`, `/image`, …) so both the TLS name and the bare-IP HTTP origin work. VPS-only change +
`speed-lab/vps/` configs; no app code.

| metric | wan cold | slow4g cold | wan warm |
|---|---|---|---|
| FCP | 884 → **568** (−36%) | 2720 → **1988** (−27%) | 104 → 124 |
| LCP | 1240 → **752** (−39%) | 6824 → **3720** (−45%) | 104 → 124 |
| feedPaint | 1224 → **733** (−40%) | 6816 → **3704** (−46%) | 158 → 186 |
| allDone | 2568 → **2217** (−14%) | 31325 → **4084** (−87%) | 1712 → 1723 |

Transitions: post/wifi unchanged; slow4g tag/user +15…48 ms (within run noise for a
rAF-probed metric; watching in later iters). Warm +20 ms from TLS on the first connection —
accepted, cold wins dominate.

**Decision: KEEP.** Largest single change available to this stack.

### iter02 — lazy-load offscreen media — **KEEP**

**Hypothesis:** 100 post thumbnails + 100 avatars fetch eagerly for a feed where ~9 rows are
visible; `loading=lazy` on below-fold media cuts cold-network work without touching LCP if the
first screen stays eager.

**Change:** `soci-post-list.renderPostLi` marks the first 12 rows `eager`;
`soci-post-li._setImageSource` sets `loading=lazy decoding=async` on non-eager rows;
`soci-user` avatars always lazy (never LCP candidates).

Results (vs iter01): WAN cold LCP 752 → **716**, feedPaint 733 → **701**, transfer
**6.1 MB → 2.0 MB (−67%)**, requests 244 → 193. Warm neutral. slow4g (h2-pinned reference
after the fix below): 116 requests / 517 KB cold. Transitions neutral-to-better
(slow4g tag/user −31 ms).

**Decision: KEEP.** Biggest transfer cut available; LCP unharmed.

### Measurement integrity fixes (harness, not site)

1. **QUIC bypasses CDP throttling.** After iter01 added TLS, Chrome upgraded to h3 mid-page
   and the slow4g lane silently stopped throttling those connections (6 MB "transferred" in
   4 s at 1.6 Mbps). All throttled lanes now launch Chromium with `--disable-quic`
   (h3 measurable separately, unthrottled). slow4g numbers from iter01/iter02 are superseded
   by the re-referenced `iter02b` run.
2. **Chrome's lazy-image margin is connection-estimate dependent** and flips bimodally under
   CDP throttle (114 vs 145 requests across identical runs). All lanes now pin
   `lazyImageLoadingDistanceThresholdPx*` to the 4G default (1250 px) via `--blink-settings`,
   so what loads is deterministic. `allDone`/`reqs` on throttled lanes before this pin are
   descriptive only; decisions use FCP/LCP/feedPaint + transitions.

### iter03 — modulepreload the whole ES module graph — **REVERT** (miss 1)

**Hypothesis:** 65 modules discovered at depth 2-3 cost one RTT per level; emitting
`<link rel="modulepreload">` for the crawled graph flattens discovery.

**Change:** import-graph crawler in `soci-frontend/index.js`, links injected in `index.pug`.

Results: WAN cold neutral (FCP 556→552, LCP 716→708 — discovery already overlaps other work
on h2). Warm slightly better (−20 ms FCP). slow4g cold: FCP −188 ms but **LCP +112 ms** and
feedPaint +115 ms — 65 high-priority JS preloads contend with the LCP thumbnails on a
1.6 Mbps pipe. Classic FCP-up/LCP-down preload contention, exactly what the decision rule
forbids. ES module semantics also cap the upside: `soci-components.js` cannot execute until
its slowest import arrives, so partial preloading cannot help either.

**Decision: REVERT.**

### iter04 — defer markdown-wasm loader — **KEEP**

**Hypothesis:** `lib/markdown-wasm/markdown.js` is a parser-blocking classic script in `<head>`;
`defer` keeps its execution before the module scripts (document order) so `window.markdown`
still exists before any component runs, but stops blocking the parse.

First measured together with the lane instability above; after pinning the lazy margins a
clean A/B gave: slow4g cold FCP 2008→**1852**, LCP 3736→**3592**, feedPaint 3725→**3580**;
WAN cold LCP 724→**696**, feedPaint −25 ms. (The earlier "+LCP" read was the unpinned lane's
bimodal artifact, visible as 114 vs 145 request flips in i2b's own runs.)

**Decision: KEEP.**

### iter05 — shell-level feed prefetch — **KEEP**

**Hypothesis:** the `/posts` fetch waits for the whole module graph to load and execute; an
inline script in the shell can start the identical request at byte-one of the HTML and let
`soci-post-list` consume the in-flight promise.

**Change:** inline script in `index.pug` mirrors `_buildPostsUrl` (sort/filter from
localStorage, tag from hash, user from path — param order identical) for anonymous sessions,
stores the promise in `window.__preFetch`; `_loadPosts` consumes it and falls back to a
normal fetch on any miss. `index.js` passes `API_HOST` into the template.

Results (on top of iter04): slow4g cold **LCP 3592 → 2096 (−42%)** — the feed's text content
now paints as the largest element well before thumbnails finish; feedPaint (first row with
decoded image) neutral at 3572; FCP +188 ms (the early JSON + first thumbnails share the
throttled pipe with CSS) — accepted: LCP and every content metric dominate. WAN cold
LCP 696→**576**, feedPaint 688→**634**. Warm feedPaint 542→408 (slow4g) / 181→159 (WAN).
`loadEventEnd` grows because eager row images now start before the load event — cosmetic,
`allDone`/LCP/feedPaint are the real signals.

**Decision: KEEP.**

### iter06 — prefetch post + comments on deep links — **KEEP**

Same mechanism extended to the default (post) route: the shell starts `/posts/<slug>` and
`/comments?post=<slug>` (community-aware) and `soci-component.getData` consumes matching
anonymous prefetches, so `soci-post` and `soci-comment-list` both skip a round trip.

Results: post deep link slow4g cold LCP 2332→**1996** (−14%), WAN 672→**552** (−18%).
FCP unchanged. Comments still render (24/24) with no page errors.

**Decision: KEEP.**

### iter07 — statics via Caddy file_server + precompressed brotli — **REVERT** (miss 2)

**Hypothesis:** brotli (−15% on JS/CSS) plus kernel-served files should beat node's runtime
gzip for the 65-file module graph.

Result: WAN flat; slow4g FCP/LCP −112 ms **but** feedPaint bimodal — 2 of 5 runs at **8.5 s**
(vs 3.5 s reference): with Caddy fair-multiplexing 65 static streams alongside the proxied
thumbnails on a 1.6 Mbps pipe, the first row's image can starve. Node's single-loop
serialization avoided exactly that. Byte win kept via iter08 instead.

**Decision: REVERT.**

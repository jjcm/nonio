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

**Change:** `nonio-post-list.renderPostLi` marks the first 12 rows `eager`;
`nonio-post-li._setImageSource` sets `loading=lazy decoding=async` on non-eager rows;
`nonio-user` avatars always lazy (never LCP candidates).

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

**Change:** import-graph crawler in `nonio-frontend/index.js`, links injected in `index.pug`.

Results: WAN cold neutral (FCP 556→552, LCP 716→708 — discovery already overlaps other work
on h2). Warm slightly better (−20 ms FCP). slow4g cold: FCP −188 ms but **LCP +112 ms** and
feedPaint +115 ms — 65 high-priority JS preloads contend with the LCP thumbnails on a
1.6 Mbps pipe. Classic FCP-up/LCP-down preload contention, exactly what the decision rule
forbids. ES module semantics also cap the upside: `nonio-components.js` cannot execute until
its slowest import arrives, so partial preloading cannot help either.

**Decision: REVERT.** (Also surfaced a deploy bug worth recording: a failing `find` in
`deploy.sh`'s remote block aborted deploys *after* rsync but *before* service restarts, so two
measurement passes ran against half-deployed states until the canary caught it. `deploy.sh`
now verifies the Caddyfile is in sync and prints service status for every unit.)

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
`nonio-post-list` consume the in-flight promise.

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
`/comments?post=<slug>` (community-aware) and `nonio-component.getData` consumes matching
anonymous prefetches, so `nonio-post` and `nonio-comment-list` both skip a round trip.

Results: post deep link slow4g cold LCP 2332→**1996** (−14%), WAN 672→**552** (−18%).
FCP unchanged. Comments still render (24/24) with no page errors.

**Decision: KEEP.**

### iter07 — statics via Caddy file_server + precompressed brotli — **REVERT** (miss 2)

**Hypothesis:** brotli (−15% on JS/CSS) plus kernel-served files should beat node's runtime
gzip for the 65-file module graph.

Result: WAN flat; slow4g FCP/LCP −112 ms **but** feedPaint bimodal — 2 of 5 runs at **8.5 s**
(vs 3.5 s reference): with Caddy fair-multiplexing 65 static streams alongside the proxied
thumbnails on a 1.6 Mbps pipe, the first row's image can starve. Node's single-loop
serialization avoided exactly that.

**Decision: REVERT.**

### iter08 — brotli in the node server (memoized, q7) — **REVERT** (miss 2)

Same byte-savings idea as iter07 but keeping node's serving order: prefer `br` over gzip in
`send()` with a memoized compression cache. Clean measurement (after fixing the partial-deploy
bug): slow4g FCP −108 ms but LCP +188 / feedPaint +256; WAN uniformly ~+15 ms. The recurring
slow4g seesaw: on a saturated pipe, shrinking JS bytes just reorders which milestone lands
first, and brotli's win over gzip (~10 KB across the graph) is too small to matter here.

**Decision: REVERT.**

### seed realism fix (not an iteration)

`nonio-image-cdn` produces thumbnails with imagemagick `-resize 192x144^`; the lab seed had
generated 640 px / ~40 KB thumbnails — 4-6× production weight. Regenerated at production
geometry (256x144 / 192x144 / 192x342 cover, ~6-14 KB) and re-referenced every lane (refD).
slow4g cold feedPaint dropped 3572 → 2471 from data realism alone; all keep/revert decisions
above compared like-for-like within their own seed era, so none flip.

### iter09 — kernel TCP tuning (BBR + fq, `tcp_slow_start_after_idle=0`, notsent_lowat) — **REVERT** (miss 3)

WAN cold/warm consistently −8 ms on every metric, slow4g flat: real but below both keep
thresholds (≥5% / ≥20 ms). Reverted to keep the box explainable; recommended as a harmless
server default outside lab rules.

### iter10 — browser cache for anonymous read APIs — **KEEP**

**Hypothesis:** `/posts`, `/posts/:url`, `/comments`, `/tags` ship no `Cache-Control`, so a
warm reload pays a full RTT re-fetching JSON the server-side PostCache would serve unchanged
anyway.

**Change:** `allowAnonymousBrowserCache` in the backend: requests without `Authorization` get
`Cache-Control: private, max-age=30` + `Vary: Authorization` on the four read endpoints.
Logged-in requests stay uncached, so submit-then-reload is always fresh; anonymous staleness
is bounded at 30 s (no worse than the server cache's own invalidation-based semantics).

Results: warm feedPaint 412→**219 ms** slow4g (−47%), 166→**138 ms** WAN. Cold untouched
mechanically (WAN medians wobbled +40 ms with overlapping spreads and no causal path — noise).
Backend tests green.

**Decision: KEEP.**

### iter11 — preload markdown.wasm on post routes — revert (miss, −12 ms)

The wasm fetch already overlaps the module graph; it was never the serialized gate. Below
threshold everywhere. Reverted.

### Stop condition

Remaining candidates were all shaving <20 ms (eager-count tuning, sidebar /tags, unix
sockets, GOGC) or invasive against flat evidence (shell splitting). Plateau declared after
iter11; server-side CPU was never the constraint (API 3 ms warm on-box, TBT 0 in every run).

---

## Final scorecard (medians, n=7 home / n=5 post+transitions)

| metric | baseline | final | change |
|---|---|---|---|
| home cold FCP, wan | 884 | **528** | −40% |
| home cold LCP, wan | 1240 | **576** | −54% |
| home cold feedPaint, wan | 1224 | **618** | −50% |
| home cold FCP, slow4g | 2720 | **2036** | −25% |
| home cold LCP, slow4g | 6824 | **2128** | −69% |
| home cold feedPaint, slow4g | 6816 | **2512** | −63% |
| home cold allDone, slow4g | 31325 | **4599** | −85% |
| home warm feedPaint, wan | 158 | **141** | −11% |
| home warm feedPaint, slow4g | 419 | **239** | −43% |
| post cold LCP, wan | 672* | **520** | −23% |
| post cold LCP, slow4g | 2332* | **1984** | −15% |
| transitions (usable) | 110-292 | 104-298 | at network floor, unchanged |

\* post baselines measured at refC (post pages were not in the iter00 pass).
Warm FCP on wan is 104→156: the TLS handshake tax on the shell revalidation — accepted
when it bought h2/h3 and −54% cold LCP; warm *content* metrics all improved.

Capacity context (not a lab metric): the 1-core box sustains ~2,400 req/s on
`GET /posts` at 20 ms mean under 50 concurrent connections (autocannon, on-box,
gzip responses from PostCache).

## Keep / ditch recap

**Kept (in this branch + on the VPS):**
1. iter01 — Caddy single TLS origin, h2+h3, path-prefix proxying (`speed-lab/vps/Caddyfile`)
2. iter02 — lazy offscreen media (post-list `eager` window, lazy avatars)
3. iter04 — `defer` on the markdown-wasm loader
4. iter05 — shell-level feed prefetch (`__preFetch` → `nonio-post-list`)
5. iter06 — deep-link prefetch for post + comments (`__preFetch` → `getData`)
6. iter10 — anonymous read-API browser cache (30 s, `Vary: Authorization`)
7. Harness/lab infra: `speed-lab/vps/*`, `speed-lab/seed/*`, harness pins + TBT

**Ditched (tried, measured, reverted):**
1. iter03 — modulepreload of the full ES module graph (preload contention regressed LCP on slow links)
2. iter07 — Caddy file_server + precompressed brotli statics (h2 fair-multiplexing starved the LCP thumbnail bimodally)
3. iter08 — node-side brotli (win too small, milestone seesaw)
4. iter09 — BBR/fq + `tcp_slow_start_after_idle=0` (real but −8 ms, below threshold; fine server default outside lab rules)
5. iter11 — markdown.wasm preload on post routes (−12 ms, below threshold)

## Wanted but can't from this VPS

Concrete next steps that need infrastructure this single Vultr box cannot provide:

1. **Edge HTML + API cache (Cloudflare/Fastly).** The anonymous shell and
   `/posts` are cache-safe for 30 s (iter10 proved the semantics); serving both from an edge
   PoP removes the 53-300 ms origin RTT from FCP/LCP entirely for the anonymous majority.
   The shell is origin-agnostic after iter01 (relative hosts), so this is a config change,
   not an app change.
2. **Anycast / multi-PoP TLS termination.** Cold TLS+TCP setup to a single Vultr region is
   the dominant fixed cost in cold WAN loads (~2 RTT before byte one). Terminating at the
   nearest edge and keeping a warm h2 connection to origin cuts it to ~0-1 local RTT.
3. **Image resizing at the edge.** Thumbnails are fixed at 192x144^ by the upload pipeline;
   feed cards and lanes view could use DPR-matched variants (1x/2x) via an edge resizer
   (`/image/thumbnail/<slug>.webp?w=256&dpr=2`) without re-encoding the archive or changing
   upload code. The lab box lacks a webp encoder path fast enough to do this per-request on
   one core.
4. **HTTP/3 you can actually measure.** h3 is enabled (Caddy) but this lab's throttled lanes
   must pin h2 because QUIC bypasses Chrome's devtools throttling; a real multi-region RUM
   (or a second measurement host with `tc netem` on the path) is needed to quantify h3's
   loss-recovery advantage on bad links.
5. **MySQL read replicas / multi-region.** Irrelevant at this dataset (3 ms queries) but the
   moment PostCache is bypassed (logged-in feeds, per-user votes), replica reads near the
   edge are the only way to keep TTFB flat for non-US users.
6. **Real RUM.** Every number here is synthetic Chromium from one vantage point. A
   `PerformanceObserver` beacon (LCP/INP/TTFB percentiles by route) would validate the lab
   deltas against real users before productionizing the keepers onto non.io.

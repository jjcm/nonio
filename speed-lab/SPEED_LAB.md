# Speed lab (EXPERIMENTAL — DO NOT MERGE)

Shared Nonio feed fixture for overnight Fable vs local Qwen comparison.

**Never merge this branch.** Experimental seed only. It lives in the superrepo (`speed-lab/`) so both tracks can pin one SHA without touching submodule gitlinks.

SEED_COMMIT=4dc103a4306564ed7bb6cddb48a9f14f078f6b16

SEED_COMMIT is this branch's seed commit; run `git log -- SPEED_LAB.md` if you need to recover it. The canonical shared SHA is the **first fixture commit** on this branch (the follow-up commit only fills this line).

## Fixture (21 posts)

| lane | slugs | files |
|------|-------|-------|
| 10 images | `sl-img-01` … `sl-img-10` | 800×450 WebP + 320×180 thumbnails |
| 10 text | `sl-txt-01` … `sl-txt-10` | markdown bodies under `fixtures/text/` |
| 1 video | `sl-vid-01` | ~1.6s 1280×720 color MP4 + WebP poster |

Manifest: `speed-lab/fixtures/posts.json` (ids 1001–1021, feed order). SQL scores are `21-i` so order is stable.

Frontend URL shapes:

- `IMAGE_HOST/{url}.webp` — localhost:4203
- `THUMBNAIL_HOST/{url}.webp`
- `VIDEO_HOST/{url}.mp4` — localhost:4204

## How to run

```bash
git checkout <SEED_COMMIT> --recurse-submodules
./quickStart.sh
./speed-lab/seed.sh
```

`seed.sh` copies committed media into the local CDN working trees (not committed; those paths are gitignored) and applies `speed-lab/seed.sql`.

Copies:

- `fixtures/images/*.webp` → `soci-image-cdn/files/images/`
- `fixtures/thumbnails/sl-img-*.webp` → `soci-image-cdn/files/thumbnails/`
- `fixtures/videos/sl-vid-01.mp4` → `soci-video-cdn/files/videos/`
- `fixtures/thumbnails/sl-vid-01.webp` → `soci-video-cdn/files/thumbnails/`

### Database

`seed.sh` resolves MySQL credentials in this order:

1. `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DATABASE` / `MYSQL_HOST` / `MYSQL_PORT`
2. `soci-backend/config.json` (common key names: `dbUser`, `dbPassword`, `dbDatabase`, …)
3. `soci-backend/localRun.sh` or `localrun.sh` (`DB_USER`, `DB_PASSWORD`, `DB_DATABASE`, `DB_HOST`, `DB_PORT`)
4. Defaults: user `root`, empty password, database `soci`, host `127.0.0.1`, port `3306`

Typical `localRun.sh` values are `dbuser` / `password` / `socidb`. Override with env if your local DB differs.

Lab user: `id=9001` email `speedlab@local.test` username `speedlab` password `speedlab` (plaintext; ownership only). Posts use `community_id=0`. Re-running deletes `posts` where `url LIKE 'sl-%' AND user_id=9001` then re-inserts.

## Metrics

| track | cold | warm | FCP | LCP |
|-------|------|------|-----|-----|
| Fable |  |  |  |  |
| Qwen  | 587 / 1053 | 584 / 996 | 587 | 1053 |

## Qwen track (OpenCode + sabin/Qwen3.8-27B)

Harness: Lighthouse 13.4.1 desktop, headless Chrome, URL `http://127.0.0.1:4200/`, median of 3. Fixture 21 posts after `./speed-lab/seed.sh`. SHA `4dc103a4306564ed7bb6cddb48a9f14f078f6b16`. Branch `cursor/speed-lab-qwen-nonio`. Avatar CDN 4202 up. Never merge.

### iter0 baseline (2026-08-17 21:35 PT)

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 787.8 | 1333.5 | 1336.8 | 0 | 0.96 |
| warm median | 790.3 | 1257.8 | 1258.3 | 0 | 0.96 |

Cold runs: FCP 787.8 / 789.5 / 787.2; LCP 1319.4 / 1339.0 / 1333.5
Warm runs: FCP 790.3 / 790.4 / 788.7; LCP 1257.8 / 1236.2 / 1302.5

Notes: 133 requests on cold. Static component graph includes admin/subscribe/financials. `/posts` fetched twice. Warm FCP ≈ cold (no immutable JS). 10 `sl-img` thumbs load. This is the number to beat.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter0.json`).

### iter1: split eager component barrel (2026-08-18 PT)

Change: `soci-frontend/components/soci-components.js` no longer eagerly defines non-home components. Only the home-route graph (post list/card/li, core inputs, sidebar, modals, tabs, icons) stays eager. Non-home components (avatar uploader, community picker, ledger rows, contribution slider, text-channel view, message rows, comment lists, post detail extras, encoding progress, url/link inputs, image/video/html uploaders) are dynamically imported by their owning pages via `ensureComponents(...)` before first use. Also fixed a pre-existing race in `soci.js` `navigateToSubmit`: now awaits `submit.components` before touching uploader shadow roots (previously `routeactivate` could fire before the dynamic import resolved, leaving `shadowRoot` null).

KEEP — faster and correct.

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | **624.2** (−163.6) | **1096.3** (−237.2) | **1096.3** (−240.5) | 0 | **0.98** |
| warm median | **623.8** (−166.5) | **1056.4** (−201.4) | **1060.3** (−198.0) | 0 | **0.98** |

Cold runs: FCP 625.3 / 624.2 / 623.9; LCP 1098.2 / 1055.8 / 1096.3
Warm runs: FCP 623.9 / 623.8 / 623.4; LCP 1076.3 / 1056.4 / 1034.7

Correctness: API serves exactly 21 fixture posts (10 image / 10 text / 1 video). Feed fetches `/posts` and renders all 10 `sl-img-*.webp` thumbnails + avatars; 21st (video) card below Lighthouse fold. 110 requests cold (was 133); barrel import count 59 → 37 (22 fewer eager component modules on home load).

Tradeoff: non-home routes pay a one-time dynamic import before their components render (first activation gated on `ensureComponents`); home route unaffected.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter1.json`).

### iter2: dedupe startup double `/posts` fetch (2026-08-18 PT)

Hypothesis: the second startup `/posts` fetch is wasted work delaying LCP. Root cause confirmed: `connectedCallback` → `_initializeControls` runs `setAttribute('sort')` → `_refreshData` → `_loadPosts('/posts')` (fetch A), then `setAttribute('filter')` → `_refreshFilterFetch` → `fetchAndMerge('/posts')` (fetch B) — two identical GET `/posts` (6844 B, `High`, 97.4/98.0 ms in `cold-1.json`). Fetch B is a no-op (all 21 post-ids already in DOM/cache when it resolves).

Change: one line at the top of `soci-post-list.js` `fetchAndMerge` — `if(url === this._currentDataUrl) return` before the abort (skips re-fetching a URL `_loadPosts` is already loading; `_currentDataUrl` is set synchronously by `_refreshData` before the fetch starts).

REVERT — not measurably faster.

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 622.9 (−1.3) | 1055.6 (−40.7) | 1059.7 | 0 | 0.98 |
| warm median | 623.1 (−0.7) | 1074.0 (+17.6) | 1076.0 | 0 | 0.98 |

Cold runs: FCP 603.9 / 622.9 / 623.2; LCP 1037.6 / 1073.0 / 1055.6
Warm runs: FCP 623.1 / 623.2 / 623.1; LCP 1093.9 / 1054.3 / 1074.0

Verdict: every delta is inside iter1's own run-to-run spread (LCP spread ~42 ms in both series; FCP ≤1.3 ms). Removing one 6.8 KB fetch does not move FCP/LCP — FCP/LCP are not data-fetch-bound.

Key finding for iter3: in every run all JS/wasm/css is on disk by ~119 ms, main-thread tasks total ~23 ms, long tasks 0, TBT 0 — yet FCP ~625 ms and LCP ~1038–1113 ms. The dominant cost is a ~500–980 ms paint gap after load-idle that the dup fetch cannot explain. LCP element is still the `div#placeholder` text ("Viewing all tags") inside `soci-post-list` shadow DOM (rendered only after the element upgrade + template render). Next hypothesis: what delays first paint / the LCP node past ~119 ms (Lighthouse `--preset=desktop` CPU-slowdown multiplier, deferred/staggered render in `createPosts`, or the remaining eager heavy assets: `soci-sidebar.js` 53 KB, `soci-post-list.js` 28.5 KB, `markdown.wasm` 56 KB + `markdown.js`).

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter2.json`).

### iter3: defer eager classic scripts (markdown + per-route pages) (2026-08-18 PT)

Hypothesis: the remaining eager classic `<script src>` tags block the feed's parse/render. `markdown.js` is a **blocking head** script (halts the whole-DOM parse, then kicks the 56.8 KB `markdown.wasm`); the six per-route page scripts (`post`, `user`, `notifications`, `admin/subscribe`, `admin/settings`, `admin/financials`) are classic **blocking** at their `<soci-route>` DOM positions. Give all seven `defer` so they fetch in parallel and execute after parse but **before** `DOMContentLoaded` — preserving their existing `document.addEventListener('DOMContentLoaded', init)` bootstrap and `document.currentScript.closest('soci-route')` binding with **zero JS changes** (pure `.pug`).

Change (7 × `.pug`, 1 attr each): `index.pug` (`markdown.js` head L7, `post.js` trailing L68) + `pages/{notifications.pug, user.pug, admin/{subscribe,settings,financials}.pug}` — add `defer` to each `<script src>`.

REVERT — FCP win but LCP regression on the feed's north-star metric; not a net "faster."

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | **562.8** (−61.4) | **1208.2** (+111.9) | 1212.0 (+115.7) | 0 | 0.97 |
| warm median | **562.7** (−61.1) | **1067.0** (+10.6) | 1071.8 (+11.5) | 0 | 0.98 |

Cold runs: FCP 563.6 / 562.7 / 562.8; LCP 1210.7 / 1207.8 / 1208.2
Warm runs: FCP 562.7 / 562.8 / 562.7; LCP 1067.0 / 1065.9 / 1070.3

Read: unblocking the parse shaves ~61 ms off FCP (FCP≈SI → the shell paints alone) but the LCP node — the `div#placeholder` "Viewing all tags" text in `soci-post-list` (iter2 finding) — is painted **by JS after element upgrade**. Deferring the classic scripts (incl. `markdown.js`→`markdown.wasm` init) pushes that paint later: cold LCP +112 ms (tight 1207.8–1210.7 spread ⇒ real, not noise), warm +11 ms. We traded the feed's headline metric for an earlier empty-shell paint. Not faster on the metric this lab optimizes.

Follow-up (different iteration): the ~61 ms FCP is real, so a *narrower* variant — defer only the six per-route page scripts, keep `markdown.js`/`markdown.wasm` eager — may capture the FCP win without the wasm-init LCP cost. That is a second hypothesis, parked, not run here.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter3.json`).

### iter4: defer ONLY the six per-route page scripts (markdown stays eager) (2026-08-18 PT)

Hypothesis (iter3 follow-up): the iter3 LCP penalty came from deferring `markdown.js` → its `markdown.wasm` init; deferring only the six per-route classic page scripts should capture the ~61 ms FCP win without delaying the feed's LCP paint.

Change (6 × `.pug`, 1 attr each, zero JS): add `defer` to `post.js` (`index.pug` L68) + `pages/{notifications.pug, user.pug, admin/{subscribe,settings,financials}.pug}`. `markdown.js` (head L7) left eager/blocking. Served HTML verified: exactly the 6 page scripts carry `defer`; `markdown.js` still eager. Bootstrap safety re-verified: `document.currentScript.closest('soci-route')` top-level binding + `DOMContentLoaded` init survive `defer`.

REVERT — FCP-only win that regresses cold LCP (and warm LCP/TTI). Rule: do not keep.

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | **549.5** (−74.7) | **1154.3** (+58.0) | 1163.8 (+67.5) | 0 | 0.98 |
| warm median | **551.2** (−72.6) | **1139.9** (+83.5) | 1143.5 (+83.2) | 0 | 0.98 |

Cold runs: FCP 545.8 / 549.7 / 549.5; LCP 1148.6 / 1154.3 / 1215.7
Warm runs: FCP 553.4 / 551.2 / 548.3; LCP 1208.9 / 1139.9 / 1133.2

Correctness: served HTML has exactly 6 deferred page scripts, `markdown.js` eager; API serves exactly 21 fixture posts (10 image / 10 text / 1 video).

Read: iter3's follow-up hypothesis is falsified — `markdown.wasm` init was **not** the LCP cost; deferring just the six small per-route scripts still pushes the JS-painted LCP node later, while static-shell FCP improves ~73–75 ms in both lanes. All 3 cold LCP runs (1148.6–1215.7) exceed iter1's worst (1098.2), and all 3 warm runs exceed iter1's worst warm (1076.3) ⇒ real regression, not noise. Combined with iter3: unblocking the mid-body parse reliably buys ~60–75 ms FCP and costs ~58–112 ms LCP/TTI, regardless of whether `markdown.js` is deferred. The LCP paint is downstream of these scripts' blocking, not caused by their parse-time blocking.

Next hypotheses: stop optimizing parse-blocking; attack the painted LCP node itself — `div#placeholder` ("Viewing all tags") in `soci-post-list` shadow DOM and the ~500–980 ms post-load-idle paint gap (iter2 finding): earlier placeholder render, less staggered `createPosts`, or a smaller of the 37 eager home modules (`soci-sidebar.js` 53 KB, `soci-post-list.js` 28.5 KB).

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter4.json`).

### iter5: make the LCP element static route markup (no JS creation) (2026-08-18 PT)

Hypothesis (iter4 follow-up): the painted LCP node (`div#placeholder` "Viewing all tags" in `soci-post-list` shadow DOM) only exists after JS creates the element — `tags.js` is `lazyload`ed post-parse, then `onActivate` does `innerHTML = ''` + `createElement('soci-post-list')`, which can only upgrade once the eager barrel registers the tag. Put a static `soci-post-list` in the route markup so it upgrades during module evaluation (before the route's 1 ms `active` timer) and its shadow DOM (incl. the placeholder) is laid out and paintable as early as FCP.

Change (2 files): `pages/tags.pug` adds `<soci-post-list tag="all">` as the route's first child (lazyload script tag unchanged); `pages/tags.js` `onActivate` now queries for the existing `soci-post-list` (fallback: create) and sets/removes `tag` + `community` attributes instead of clearing and creating. Precedent: `pages/user.pug` already ships a static list. Route safety verified: on `/` only the tags route matches its test (`/` matches the tags path, not the user path), so no double live list; the static list in the *inactive* user route already existed pre-iter5, so startup request count is unchanged. Define-order verified in `soci-components.js`: `new SociRouter()` (L7) fires `route()` before the `soci-post-list` `define` (L42–43), but that only defers activation — all defines complete in the same synchronous module evaluation, so the router's 1 ms `active` `setTimeout` (the only activation trigger) always runs after every `customElements.define`; the static element is upgraded with shadow DOM rendered before it becomes visible.

REVERT — no measurable improvement; deltas are mixed and inside run-to-run spread. Not "overall faster."

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 623.4 (−0.8) | 1088.8 (−7.5) | 1092.4 (−3.9) | 0 | 0.98 |
| warm median | 603.2 (−20.6) | 1069.8 (+13.4) | 1076.5 (+16.2) | 0 | 0.98 |

Cold runs: FCP 623.4 / 623.2 / 623.4; LCP 1092.4 / 1070.4 / 1088.8
Warm runs: FCP 603.2 / 623.7 / 602.9; LCP 1069.8 / 1070.9 / 1029.6

Correctness: served `/` HTML contains the static `<soci-post-list tag="all">`; API serves 21 fixture posts; `/posts` still fetched twice (pre-existing, unchanged).

Read: element *availability* is not the LCP gate — LCP is pinned ~1050–1092 ms in every run since iter1 (iter1 1096.3/1056.4, iter5 1088.8/1069.8: cold −7.5 ms / warm +13.4 ms, i.e. noise in opposite directions against the ~40 ms per-run LCP spread seen in iter1–iter4). The placeholder is laid out by ~FCP regardless of who creates it; the ~500–980 ms post-load-idle paint gap (iter2) is downstream of element creation. Bonus measurement: `lcp-breakdown-insight` for this node is unreliable — it reports TTFB 59.1 ms + element render delay 110.2 ms (Σ 169 ms) while the LCP metric is 1092.4 ms, so do not trust the insight's sub-parts for shadow-DOM pseudo-element nodes.

Next hypotheses: (a) the final LCP candidate may be *replaced* by a later node of equal/larger area after the initial placeholder paint — verify from the trace's LCP event log rather than the insight; (b) trim the remaining eager home modules (top: `soci-sidebar.js` 53 KB, `soci-post-list.js` 28.5 KB) to shrink the module-eval/paint cost; (c) reduce staggered/late re-layout in `createPosts` that may flush a later LCP candidate.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter5.json`).

### iter6: lazy-load the sidebar voice module (2026-08-18 PT)

Hypothesis (iter5 follow-up b): trim the biggest remaining eager home module, `soci-sidebar.js` (53.1 KB). Its voice-channel subsystem (LiveKit join/leave, presence socket, VAD, voice UI — ~583 lines) does nothing for the anonymous feed; it is dead weight on the home path that parses and evaluates before the LCP paint. Move it behind a dynamic import that only authenticated voice use triggers.

Change (2 files):
- New `soci-frontend/components/voice/soci-voice.js` (19.8 KB): `class SociVoice` with `constructor(sb)` (sb = the sidebar element); moved bodies alias `this.currentCommunity`/`this.authToken`/`this.select()`/`this.appendChild()` through `this.sb.…`.
- `soci-sidebar.js` (53,134 → 34,689 B, −18,445 B): the subsystem is replaced by a lazy stub — `_ensureVoice()` caches one `import('./voice/soci-voice.js')` and instantiates `SociVoice(this)`; async proxies `joinVoiceChannel`/`disconnectVoice`/`_voiceDisconnect` await the load first; `_startVoicePresenceSocket()` early-returns on `!this.authToken` (keeps the module out of the anonymous benchmark path); sync no-op proxies `_stopVoicePresenceSocket`/`_updateVoiceUI`/`_renderVoicePresenceParticipants` use `this._voice?._…`. Two eager guards patched to `this._voice?._…` (community change, logout reset).

KEEP — faster on every metric and correct.

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | **587.4** (−36.8) | **1052.8** (−43.5) | **1052.9** (−43.4) | 0 | **0.98** |
| warm median | **584.4** (−39.4) | **995.5** (−60.9) | **1001.5** (−58.8) | 0 | **0.99** |

Cold runs: FCP 587.4 / 604.6 / 584.0; LCP 1018.6 / 1054.2 / 1052.8
Warm runs: FCP 584.4 / 605.1 / 584.0; LCP 976.3 / 1035.5 / 995.5

Correctness: CDP smoke on `http://127.0.0.1:4200/` — all 21 fixture posts render (`soci-post-li`/`soci-post-card`), sidebar upgraded, 0 exceptions, 0 console errors, and **zero fetches** of `/components/voice/soci-voice.js` on the anonymous path (module itself serves 200). `node --check` passes on both files.

Verdict: every one of the 3 cold LCP runs (1018.6–1054.2) is below iter1's worst cold (1098.2); every warm LCP run (976.3–1035.5) is below iter1's worst warm (1076.3); all six FCP runs (584.0–605.1) are below iter1's worst (625.3) ⇒ real, not noise. Confirms the iter2–iter5 paint-gap story: the ~500–980 ms post-load-idle gap is driven by eager module parse/eval cost — shaving 18.4 KB of home-path-dead JS moves both FCP and the JS-painted LCP node.

Tradeoff: an authenticated voice participant pays a one-time 19.8 KB dynamic import on first `joinVoiceChannel`/presence; the home/anonymous path pays zero.

Next hypotheses: (a) same treatment for `soci-post-list.js` (28.5 KB), the largest remaining eager home module; (b) verify from the trace whether a later, larger node replaces the placeholder as the final LCP candidate (iter5's (a)); (c) reduce staggered `createPosts` re-layout.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter6.json`).

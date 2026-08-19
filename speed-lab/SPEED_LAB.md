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

### iter7: lazy-load the grid-lanes polyfill from soci-post-list.js (2026-08-18 PT)

Hypothesis (iter6 next-hypothesis a): trim the next-largest remaining eager home module, `soci-post-list.js` (28,374 B). Its masonry-lanes subsystem is dead weight on the default list view: the static `import { polyfill, unpolyfill, relayout, SUPPORTS_GRID_LANES } from '../lib/grid-lanes-polyfill.js'` (7,940 B) and the `view="lanes"` branches never run for the anonymous benchmark path. Move the whole subsystem behind a dynamic import that only lanes-view code loads.

Change (1 file, reverted):
- `soci-post-list.js`: static import removed; module-level `_loadLanes()` caches one `import('../lib/grid-lanes-polyfill.js')`, holding the resolved module in `_lanes`. Async contexts (`createPosts` lanes branch, `fetchAndMerge`) `await _loadLanes()`; sync contexts (`_onCardLoaded`, `disconnectedCallback`, `_updateView`) guard on the already-resolved `_lanes` (no-op when lanes never loaded — `unpolyfill`/`relayout` are instance no-ops otherwise). `_renderPostCardsSequential` destructures from `_lanes` (guaranteed loaded after the awaited `createPosts` branch). Added a `_renderGeneration` re-check after the new `await` in the lanes branch to close a view-switch race the static import didn't have.

REVERT — not faster; LCP regressed on both cold and warm.

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 598.2 (+10.8) | 1091.2 (+38.4) | 1100.5 (+47.6) | 0 | 0.98 |
| warm median | 585.6 (+1.2) | 1061.5 (+66.0) | 1065.6 (+64.1) | 0 | 0.98 |

Cold runs: FCP 598.2 / 617.7 / 584.7; LCP 1161.9 / 1081.9 / 1091.2
Warm runs: FCP 587.6 / 585.6 / 585.0; LCP 1061.5 / 1017.4 / 1069.1

Correctness (pre-revert): `node --check` passes; all 7 Lighthouse runs rendered the 21-post feed (TBT 0, score 0.98); no console exceptions observed in metrics runs.

Verdict: every cold LCP run (1081.9–1161.9) is above iter6's worst cold (1054.2); warm median +66.0 ms. No win to keep. Caveat: this run's spread is wider than the usual ±30 ms noise band (cold LCP 1081.9–1161.9 ≈ 80 ms), so the regression magnitude may be partially noise — but even the best cold (1081.9) and best warm (1017.4) don't credibly beat iter6 by enough to hold, and the predicted 15–40 ms saving was already inside the noise. Reading: shaving ~8 KB of *sibling-module* parse off a 28 KB module that LCP still needs to execute is not a meaningful lever here — unlike iter1/iter6, which cut whole components the home paint never needed. `soci-post-list.js` is on the LCP critical path; only work that defers its *own* parse/eval (not just its imports) could move it.

Next hypotheses: (b) verify from the trace whether a later, larger node replaces the placeholder as the final LCP candidate (iter5/iter6 b); (c) reduce staggered `createPosts` re-layout (iter6 c); (d) if (b) shows the card grid is the true LCP, reconsider the forbidden static-markup idea *with* measured LCP impact.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter7.json`).

### iter8: drop the `#items` opacity/translate entrance transition (2026-08-19 PT)

Hypothesis (iter6/iter7 next-hypothesis b, restated as the single remaining *paint-gate* candidate): the default-view feed fades in as a unit — `#items { opacity:0; transform:translateY(12px) }` animating `→ opacity:1; translateY(0)` over 0.35s once `[loaded]` flips (i.e. after the `/posts` fetch resolves). The LCP node `div#placeholder` ("Viewing all tags") is a *child* of `#items`, so while the container sits at `opacity:0` the placeholder is not contentful-painted. If we make `#items` visible from first paint (lanes view already does this via its override), the placeholder can register as LCP ~350ms+ earlier. Pure paint-timing change, zero extra bytes, zero layout change.

Change (1 file, reverted):
- `soci-post-list.js` `css()`: removed `opacity: 0; transform: translateY(12px)` from the base `#items` rule, deleted the now-redundant `:host([view="lanes"]) #items { opacity:1; transform:none }` override, and deleted the `:host([loaded]) #items { … transition: transform 0.35s …, opacity 0.35s … }` block. Kept the separate lane/unplaced `translateY(12px)` rules (L183/L194) and the appended-post stagger (L617). No `transitionend`/`loaded`-attribute JS dependency removed — `loaded` is only an attribute toggle around the fetch.

REVERT — mixed profile, not "faster" (regresses cold FCP + warm LCP/TTI).

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 604.9 (+17.5) | 998.0 (−54.8) | 1003.9 (−49.0) | 0 | 0.99 |
| warm median | 585.0 (+0.6) | 1036.5 (+41.0) | 1038.6 (+37.1) | 0 | 0.98 |

Cold runs: FCP 604.3 / 605.1 / 604.9; LCP 998.0 / 1054.8 / 996.3
Warm runs: FCP 605.2 / 585.0 / 585.0; LCP 998.2 / 1036.5 / 1037.6

Correctness (pre-revert): `node --check` passes; all 7 Lighthouse runs rendered the 21-post feed (TBT 0, score ≥0.98, no console exceptions); CDP smoke confirmed 21 fixture posts (10 sl-img / 10 sl-txt / 1 sl-vid) and `#items` computed `opacity:1` under the change.

Verdict: the paint-gate hypothesis is **partially** real — cold LCP drops 54.8ms and cold TTI 49.0ms, but it is *purchased* with a consistent cold FCP regression (all three cold runs land 604.3–605.1 vs iter6's 587.4 median, i.e. ~+17.5ms, tight enough to be signal not noise) and a warm LCP regression (+41.0ms) with warm TTI +37.1ms. Making the whole `#items` subtree visible at first paint adds a larger paint region to the very first contentful frame, which delays FCP by ~17ms on cold and shifts the warm LCP/TTI later. Net: it trades FCP + warm LCP for cold LCP — exactly the "FCP-only that regresses LCP" shape the keep-rule excludes, mirrored. Not a uniform win ⇒ REVERT. Reading: the 0.35s `[loaded]` fade was not the *sole* LCP gate (removing it moves LCP but not to the thumbnail/FCP floor), so the placeholder's LCP timestamp is set mostly by when `#items` first becomes non-zero-opacity *and* the surrounding paint, not by the duration of the fade — consistent with iter5's finding that element *availability*, not animation, is the real gate.

Next hypotheses: (b) verify from the trace whether a later, larger node replaces the placeholder as the final LCP candidate (iter5/iter6 b) — now sharpened: the lever is making `#items` non-zero-opacity *at first paint without enlarging the first-paint region* (e.g. fade only a background/overlay rather than the content container); (c) reduce staggered `createPosts` re-layout (iter6 c); (d) if (b) shows the card grid is the true LCP, reconsider the forbidden static-markup idea *with* measured LCP impact.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter8.json`).

### iter9: bounded-batch the staggered `createPosts` appends (list view) (2026-08-19 PT)

Hypothesis (iter6/iter7/iter8 next-hypothesis c): list-view `createPosts` renders the first `Math.ceil(window.innerHeight / 104)` cards synchronously, then appends the rest **one per `requestIdleCallback`** (`renderNextPost`). Each append forces its own style recalc + layout, and those cycles interleave with the 0.35s `[loaded]` opacity ramp, stalling transition frames and delaying the LCP candidate's contentful paint. Batch the remainder (5 cards per idle tick, one `innerHTML` join per batch, same per-tick yield) to cut per-card DOM round-trips ~5× and reduce layout churn during the fade. No `#items` CSS touched (no path to iter8's FCP regression); initial slice unchanged.

Change (1 file, reverted):
- `soci-post-list.js` list-view `renderNextPost`: per-card `temp.innerHTML = renderFn(remainingPosts[0])` + `slice(1)` recursion replaced with `batch = 5` — chunk HTML built via `chunk.map(renderFn).join('')`, appended via `while (temp.firstElementChild) this.appendChild(temp.firstElementChild)`, recurse on `remainingPosts.slice(batch)`. Generation and `_itemsSlot` guards preserved.

REVERT — cold LCP win purchased with FCP regressions on both lanes; warm LCP/TTI also regressed. Not "overall faster."

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 604.2 (+16.8) | 1019.9 (−32.9) | 1019.9 (−33.0) | 0 | 0.98 |
| warm median | 605.2 (+20.8) | 1000.6 (+5.1) | 1006.6 (+5.1) | 0 | 0.98 |

Cold runs: FCP 585.6 / 605.4 / 604.2; LCP 1041.5 / 1019.9 / 977.3
Warm runs: FCP 605.5 / 605.2 / 605.2; LCP 1000.6 / 957.6 / 1038.8

Correctness (pre-revert): all 7 Lighthouse runs rendered the 21-post feed under the patched module (TBT 0, TTI 959.4–1043.2 ms, score ≥0.98, no console exceptions).

Verdict: the staggered-re-layout lever is **not** the LCP gate. Batching moved cold LCP −32.9ms at the median (best cold run 977.3 ms is the best cold LCP this track has ever recorded) but cost +16.8ms cold FCP and +20.8ms warm FCP, with warm LCP/TTI +5.1ms. The LCP candidate is already in the DOM via the synchronous initial slice *before any idle callback fires*, so post-append timing only chases below-the-fold cards — consistent with iter8's reading that the LCP timestamp is set by when `#items` first becomes non-zero-opacity, not by what is appended afterwards. Caveat on the FCP column: the edit cannot touch first paint, and cold FCP here is bimodal (585.6 vs 604.2–605.4) in the same ~605 ms cluster all three iter8 cold runs landed in — the cluster looks environmental/run-to-run rather than caused by this change. Either way the keep-rule excludes an LCP win that regresses FCP, and warm is unambiguously slower ⇒ REVERT.

Next hypotheses: (a) sharpened iter6/7/8 (b): make `#items` non-zero-opacity *at first paint without enlarging the first-paint region* — fade a background/overlay (or apply the opacity ramp to a `::before` veil sized to the header/input FCP region only) instead of the content container; (d) if trace-verification shows the card grid is the true final LCP candidate, reconsider the static-markup idea *with* measured LCP impact.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter9.json`).

### iter10: replace the `#items` opacity/transform fade with a fading `::before` background veil (2026-08-19 PT)

Hypothesis (iter9 next-hypothesis a, the sharpened iter6/7/8 (b)): the placeholder/candidate LCP element cannot contentful-paint while `#items` sits at `opacity: 0`, but making the container visible at first paint (iter8) enlarged the first-paint region and cost ~+17ms cold FCP. Keep `#items` at full opacity from first paint *without enlarging the first visible contentful region* by fading a non-contentful background instead of the content container: an `#items::before` veil (solid `var(--bg-bold)`, the host's own background, so visually indistinguishable from empty space, and solid-color paint is not contentful — FCP should stay the small header/input region) that fades out on `[loaded]`.

Change (1 file, reverted):
- `soci-post-list.js` `#items`: dropped `opacity: 0; transform: translateY(12px)`, the `:host([loaded]) #items` ramp, and the now-redundant `:host([view="lanes"]) #items { opacity: 1; transform: none }` override; added `position: relative` plus `&::before { content: ''; position: absolute; inset: 0; background: var(--bg-bold); pointer-events: none; transition: opacity 0.35s var(--soci-ease); }` and `:host([loaded]) #items::before { opacity: 0; }`. Per-card fades (`soci-post.js` `[loaded]` ramps, lanes-view `::slotted` rules) untouched. Lanes container rules (`display: grid-lanes` etc.) untouched.

REVERT — no win on any metric; uniformly slower than both the locked keep-bar (iter6) and the immediately preceding measurement (iter9).

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 605.4 (+18.0) | 1057.3 (+4.5) | 1057.5 (+4.6) | 0 | 0.98 |
| warm median | 605.0 (+20.6) | 1037.6 (+42.1) | 1039.8 (+38.3) | 0 | 0.98 |

(deltas vs locked iter6 keep-bar 587.4/1052.8 cold, 584.4/995.5 warm, TTI lock 1052.9/1001.5)

Cold runs: FCP 604.8 / 605.4 / 607.0; LCP 1056.2 / 1057.3 / 1066.1
Warm runs: FCP 604.9 / 605.0 / 605.1; LCP 1037.4 / 1037.6 / 1038.3

vs iter9 (previous measurement): cold LCP +37.4ms (1019.9 → 1057.3), warm LCP +37.0ms (1000.6 → 1037.6), TTI cold +37.6 / warm +33.2, FCP effectively flat.

Cluster caveat (not used to excuse KEEP, only noted for the record): every single run landed in the known slow environmental clusters — cold/warm FCP in the ~604.9–607.0 band (same cluster iter8/iter9 FCPs landed in), warm LCP/TTI in the ~1037–1040 band (iter9 warm run 3 alone hit 1038.8 on otherwise-unchanged warm-lane code paths). Some of the absolute delta is therefore run-to-run variance, but the *direction* (no improvement anywhere, TTI regressed on both lanes) holds regardless.

Verdict: the veil is effectively a no-op for the cards — `soci-post-li :host` is `position: relative`, so every card always paints *above* the veil (verified in `soci-post-li.js:21`), meaning the veil never occludes LCP-eligible content: this variant reduces to "remove the container fade entirely + fade a background-colored rectangle". Under that reading it is strictly weaker than iter8 (which removed the fade *and* still produced the −54.8ms cold LCP win), and it produced no cold LCP win at all. Two readings follow: (1) "non-zero container opacity at first paint" is **not** what bought iter8's cold LCP — iter10 had it from first paint and gained nothing, so iter8's win is most plausibly attributable to dropping `transform: translateY(12px)` (the animating transform creates a composited layer on `#items`; a 350ms CSS transform animation keeps the whole subtree on the compositor, which defers LCP contentful-paint of its slotted children); or (2) the placeholder-reported LCP element and its ~1000ms+ timestamp is an artifact of the fade/layer stack in a way that only full structural changes (static markup) would move. Either way the keep-rule excludes this (no uniform win; TTI +4.6/+38.3) ⇒ REVERT.

Next hypotheses: (a) isolate the transform — keep the `[loaded]` opacity ramp but drop *only* `transform: translateY(12px)` (and the lanes `transform: none` override) from `#items`; if that alone reproduces iter8's cold LCP win without (or with less) the FCP cost, the composited-transform layer is the gate; (b) trace-level identification of the *true* final LCP node — Lighthouse's `lcp-element` audit keeps attributing the tiny header placeholder (238×17, 4046px²) while cold LCP lands ~977–1066ms, 200–450ms after FCP and ~300–500ms after the feed + first image thumbnail are already visible in the frame shots, so the audit's attribution is suspect and the real candidate (first image `img`? card text block?) is unidentified; (c) re-baseline pristine iter6 HEAD once if the ~605/~1038 clusters persist, to separate machine state from code effects.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter10.json`).

### iter11: drop ONLY `transform: translateY(12px)` from `#items`, keep the `[loaded]` opacity ramp (2026-08-19 PT)

Hypothesis (iter10 next-hypothesis a): iter8 removed the `#items` fade wholesale and won −54.8 ms cold LCP, but iter10 showed that first-paint visibility *without* the fade bought nothing — so the remaining suspect from iter8's change set is the `transform: translateY(12px)` composited layer (a 350 ms transform animation keeps the whole `#items` subtree on the compositor, deferring contentful paint of slotted children). Isolate it: keep the `opacity: 0 → 1` ramp, drop the translate.

Change (1 file, reverted):
- `soci-post-list.js` `#items`: dropped `transform: translateY(12px)` (kept `opacity: 0`); `:host([view="lanes"]) #items`: dropped the translate-cancel `transform: none` (kept `opacity: 1`); `:host([loaded]) #items`: dropped `transform: translateY(0)` and narrowed `transition` to `opacity 0.35s var(--soci-ease)` only. Lanes per-`::slotted` child transforms (pre-polyfill flash rules) and the `_loadMore` JS inline stagger untouched — the hypothesis targets `#items` itself only.

REVERT — no win on any lane; uniformly slower than the locked iter6 keep-bar.

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 604.2 (+16.8) | 1085.5 (+32.7) | 1088.7 (+35.8) | 0 | 0.98 |
| warm median | 604.7 (+20.3) | 1067.5 (+72.0) | 1072.7 (+71.2) | 0 | 0.98 |

(deltas vs locked iter6 keep-bar 587.4/1052.8 cold, 584.4/995.5 warm, TTI lock 1052.9/1001.5)

Cold runs: FCP 604.6 / 584.8 / 604.2; LCP 1087.5 / 1027.5 / 1085.5 (cold run 2 hit the fast FCP cluster — 584.8 FCP with 1027.5 LCP, the only run anywhere near the bar; the other two sit in the slow FCP ~604 cluster with LCP ~1086)
Warm runs: FCP 604.4 / 604.9 / 604.7; LCP 1086.8 / 1049.5 / 1067.5

vs iter7 (closest pristine-ish recent measurement, 598.2/1091.2 cold, 585.6/1061.5 warm): cold FCP +6.0, cold LCP −5.7 (noise), warm FCP +19.1, warm LCP +6.0. No lane uniformly faster.

Correctness (pre-revert): all 7 Lighthouse runs rendered the 21-post fixture feed under the patched module (TBT 0, TTI 1036.5–1094.0 ms, score 0.98, no console exceptions); 21-post smoke via `/posts` before and after revert.

Verdict: the composited-transform hypothesis is **not supported**. Keeping the opacity ramp while dropping the translate reproduced none of iter8's cold LCP win (median +32.7 vs bar; the one fast-cluster run's 1027.5 LCP is within the ~1027–1088 bimodal spread that has characterized LCP since iter8). Since iter10 (first-paint visibility, no fade) also produced no cold LCP win, neither "remove the translate" nor "make the container visible at first paint" alone explains iter8's −54.8 ms — the opacity ramp (element at `opacity: 0` until `[loaded]`) remains the common factor gating the LCP timestamp, and iter8's win may have been a within-run artifact rather than a reproducible code effect (iter8's run was the last one that hit the fast warm-FCP ~585 cluster).

Machine-state caveat (now the dominant confound): warm FCP drifted 585.0 (iter8) → 605.2 (iter9) → 605.0 (iter10) → 604.7 (iter11) **on the same reverted pristine code** — a +20 ms cluster shift larger than most deltas chased in this track. Absolute numbers measured after ~14:00 PT cannot be compared directly to the iter6 bar (measured the prior evening). This does not change the keep call (keep requires being *faster*; nothing beat the bar) but it means the next iteration's verdict must be made against a fresh pristine re-baseline, not the iter6 bar.

Next hypotheses: (c first) re-baseline **pristine iter6 HEAD** once to re-anchor the keep-bar against current machine state — only then do fade-related comparisons mean anything; (b) trace-level identification of the *true* final LCP node (Lighthouse still attributes the 238×17 header placeholder while frame shots show the feed + first thumbnail visible 200–450 ms earlier); if the re-baseline reproduces a cold LCP ~1050 ± 40 on pristine code, the LCP lever is likely structural (static first-card markup) rather than in the fade/transform stack — at which point the forbidden-list static-markup idea would need re-scoping with measured impact.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter11.json`).

### iter12: pristine re-baseline, NO code change (calibration, 2026-08-19 PT)

Purpose (iter11 next-hypothesis c, now the only pre-committed branch): warm FCP drifted +20 ms (585 → ~605) across iter8→iter11 on the *same* reverted pristine code, i.e. the machine-state confound now out-sizes most deltas chased in this track. Re-baseline pristine HEAD once (submodule verified clean at `faf6932` = iter1+iter6 kept state, 21-post smoke OK) to re-anchor the keep-bar against current machine state before any further comparison.

No change. `run_baseline.py` on pristine iter1+iter6 code:

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 604.8 | 1054.3 | 1054.4 | 0 | 0.98 |
| warm median | 604.8 | 998.8 | 1000.8 | 0 | 0.98 |

Cold runs: FCP 604.3 / 605.3 / 604.8 (all in the ~605 cluster); LCP 956.2 / 1057.8 / 1054.3; TTI 958.1 / 1058.1 / 1054.4
Warm runs: FCP 585.3 / 604.8 / 604.8 (bimodal — one fast-cluster run); LCP 1036.9 / 957.4 / 998.8; TTI 1039.2 / 959.3 / 1000.8

Reading:
1. **FCP floor shifted, LCP did not.** FCP cold is permanently in the ~605 cluster (+17.4 vs the 587.4 bar) and warm is bimodal 585/605 (median +20.4) — the old FCP bar (587.4/584.4) is unreachable in the current window. LCP/TTI reproduce the iter6 bar within noise (cold LCP +1.5, warm LCP +3.3, TTI +1.5/−0.7). LCP comparisons remain valid against the iter6 bar; FCP comparisons must now use the 604.8 floor.
2. **Correction to the iter8 log:** iter8's recorded "cold FCP +17.5 cost (all 3 runs 604.3–605.1 = signal)" was **environmental, not code** — pristine now measures the identical cold-FCP cluster (604.3–605.3). iter8's only true cost was warm LCP +37.7 (1036.5 vs re-anchored 998.8); its win stands: cold LCP −56.3 (998.0 vs 1054.3). iter8 remains REVERT under the standing keep rule (warm-LCP regression), but as a pure −56 cold LCP / +38 warm LCP trade, not an FCP-tax story. (The iter6-era log already showed 584–605 FCP variance *within* one run, so the bimodality is long-standing; the current window is simply stuck slow-side.)
3. **iter11 REVERT confirmed against the re-anchored floor:** cold LCP 1085.5 vs 1054.3 (+31.2), warm LCP 1067.5 vs 998.8 (+68.7) — a genuine regression, not drift.
4. **iter10 reading unchanged:** 1057.3 ≈ floor +3.0 — still "no win"; the veil ate the entire iter8-style gain (+~59 ms vs the iter8 reading), consistent with a full-feed-region `::before` paint + fade delaying first thumbnail paint.

Verdict: CALIBRATION (no keep/revert — no code changed). Effective comparison bar for future iterations: **LCP/TTI = iter6 bar (1052.8/995.5, TTI 1052.9/1001.5); FCP = current floor 604.8/604.8** (any future FCP "regression" vs the 587/584 bar under ~20 ms is environmental). Keep rule unchanged: overall faster, no lane regressed.

Next hypotheses for iter13: the fade/transform space is **exhausted** — iter10 (visibility, no fade) and iter11 (ramp kept, no transform) both produced no win, and the one remaining pre-committed branch (structural/static first-card markup) is on the locked do-not-retry list. Strongest remaining non-forbidden, never-retried lever is the one that produced both prior KEEPs (iter1 barrel split, iter6 voice split): **trim the largest remaining eager home module, `soci-post-list.js` (28.5 KB)** — named the next target in the iter6 log, then abandoned for paint-side hypotheses. Candidate shape: extract the lanes-view machinery (alternate-view CSS/JS) into a dynamically imported module loaded only on first switch to lanes, if sizing shows ≥ ~8 KB movable without touching the default `list` path or the `[loaded]` chain.

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter12.json`).

### iter13 gate: lanes-view split closed without measurement (2026-08-19 PT)

Gate review of the iter13 candidate above. No code changed; no `run_baseline.py` cycle spent.

- Movable mass without touching the eager polyfill is only ≈ **6 KB** (lanes methods ≈ 4.5 KB + lanes CSS ≈ 1.3 KB + lanes radio template ≈ 0.2 KB), below the pre-committed **~8 KB** threshold.
- Moving `grid-lanes-polyfill.js` too would raise the total to ≈ **13–14 KB**, but that is a strict superset of iter7's already-reverted lazy-polyfill import. Iter7 regressed LCP by **+38.4 ms cold** and **+66.0 ms warm** (TTI +47.6 / +64.1), and its reading was explicit: `soci-post-list.js` is on the LCP critical path, and removing sibling imports/code from it is not a meaningful lever unless the module's own parse/eval is deferred.
- Checked `opencode-prompt.md`: it contains no independent locked do-not-retry list. The only explicit locked branch in the lab record is the structural/static first-card markup idea (line 379). The lanes split is therefore formally non-forbidden, but the iter7 precedent + size gate make it not worth measuring.

Direction pending: (b) un-forbid CDP true-LCP-node tracing, (c) re-scope the frozen static/structural markup idea with measured impact, or (d) pause at the iter6 kept state.

### iter14: immutable Cache-Control for JS/CSS on the :4200 static handler (2026-08-19 PT) — **KEEP**

Hypothesis (never tried before): warm is a no-cache/re-download storm because the node dev server serving :4200 sends **zero** cache headers. Proven before touching code: `curl -D -` on `/soci.js`, `/soci.css`, `/components/soci-components.js`, `/pages/post.js` shows no `Cache-Control`, no `ETag`, no `Last-Modified` → responses are uncacheable (no heuristic cache possible), so every warm Lighthouse pass re-downloaded the full JS/CSS set. This is the plain-HTTP explanation for iter0's "warm FCP ≈ cold".

Change: `soci-frontend/index.js` `handler.file` now sends `Cache-Control: public, max-age=31536000, immutable` for `.js .css .wasm .png .webp .jpg .jpeg .gif .svg .ico .woff .woff2`. HTML (pug renders, SPA fallback) and the range-request mp4 path are untouched; the API is a separate host (:4201) and unchanged. Submodule commit `c43db4f`; server restarted on 4200; smoke: `GET :4201/posts` = exactly 21 fixture posts; `curl` confirms `immutable` header on JS/CSS and none on `/`.

Medians vs re-anchored bar (FCP 604.8/604.8, LCP/TTI = iter6 1052.8/995.5, TTI 1052.9/1001.5):

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 606.4 | 961.4 | 963.2 | 0 | 0.99 |
| warm median | 217.0 | 470.1 | 472.1 | 0 | 1.00 |

Cold runs: FCP 606.4 / 606.6 / 605.6; LCP 960.8 / 961.4 / 1017.6; TTI 962.7 / 963.2 / 1021.6. Warm runs: FCP 217.0 / 217.4 / 217.0 (tightest cluster of the whole lab); LCP 530.2 / 470.1 / 449.7; TTI 530.2 / 472.1 / 449.7.

Reading:
1. **Biggest single win of the lab.** Warm FCP −387.8, warm LCP −525.4, warm TTI −529.4; Lighthouse performance score 0.98 → 1.00. The warm lane now runs on a fully disk-cached shell: no asset network time remains in that lane.
2. **Cold also improved** — cold LCP 961.4 (−91.4 vs the iter6 bar, and below iter8's 998.0 reading) with cold FCP +1.6 (606.4 vs 604.8 = within the long-standing ±3 ms cluster; all runs sit in the 605–607 band the iter12 calibration calls environmental). No lane regressed.
3. The iter0 anomaly (warm ≈ cold) is explained: it was never a code property, it was missing cache headers on the harness's own static server. Every prior iteration's warm numbers were inflated by full JS/CSS re-download.
4. Tradeoff: the dev server now pins JS/CSS in the browser cache for a year — stale-code risk in dev if a file changes in place (mitigated in this lab because the warm profile is recreated per baseline; a reload with the user-data-dir wiped is always possible). Not yet content-hashed filenames; `immutable` + stable URLs is the lab-scoped approximation.

Verdict: **KEEP.** New Qwen-track best: cold 606.4/961.4, warm 217.0/470.1 (FCP/LCP medians). Committed as `qwen-iter14` (superrepo gitlink + submodule `c43db4f`).

Raw: `speed-lab/metrics/baseline.json` (copied to `baseline-iter14.json`).

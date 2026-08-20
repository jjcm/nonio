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

### iter15: lazy-load the 5 modal components off the eager barrel (2026-08-19 PT) — **REVERT**

Hypothesis (candidate a from the iter14 next-step, re-scoped): the barrel still eagerly imports 5 modal components (`soci-login-modal`, `soci-create-account-modal`, `soci-create-community-modal`, `soci-create-channel-modal`, `soci-image-viewer-modal`, ≈15 KB, 5 module fetches) that the anonymous home feed never instantiates — modals are created on demand by `modalManager`, which already ships an unused `config.load` hook in `createModal`.

Change: removed the 5 imports/defines from `components/soci-components.js`; gave each `modalRegistry` entry a `load: () => import(...).then(define)` hook so the element is imported + defined only on first `open()`. All call sites (`soci-sidebar` showLogin/showCreateAccount/showCreateCommunity, text-channel `_openImageViewer`) already `await` the open, so behavior is preserved. Not a retry of any logged revert; `soci-post-list.js` and the voice split untouched. Smoke: `GET :4201/posts` = exactly 21 fixture posts; `node --check` clean on both edited modules.

Medians vs iter14 bar (cold 606.4/961.4, warm 217.0/470.1):

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 585.6 | 1018.0 | 1019.1 | 0 | 0.98 |
| warm median | 217.0 | 490.2 | 490.2 | 0 | 1.00 |

Cold runs: FCP 585.8 / 585.6 / 585.4; LCP 1018.0 / 997.4 / 1020.0; TTI 1018.1 / 999.1 / 1020.1. Warm runs: FCP 217.3 / 217.0 / 216.9; LCP 472.0 / 490.2 / 529.9; TTI 474.0 / 490.2 / 529.9.

Reading:
1. Same FCP/LCP trade shape as iter8, mirrored: cold FCP −20.8 (all 3 runs 585.4–585.8, a tight cluster ≈20 ms under the bar — real module-graph relief) but cold LCP/TTI +56.6/+55.9 and warm LCP/TTI +20.1/+18.1. Freeing main-thread time earlier in the shell load consistently *delays* the LCP node by the same magnitude — the LCP lane is pinned to the post-list module graph's eval window, and shifting that window costs exactly what FCP gains.
2. Warm FCP 217.0 is a dead tie (strictly-faster rule not met on any lane), and warm LCP degraded on 2 of 3 runs (472.0 / 490.2 / 529.9 — the slowest warm-LCP spread of the lab).
3. Confirms the iter7/iter8 pattern a third time: any change that alters the eager module graph's timing trades cold-FCP against LCP and never wins both at once. The barrel is at its fixed point — the modals were the last clean "never-instantiated" mass, and removing it is not a net win.

Verdict: **REVERT.** Both edited files restored to `c43db4f` state (`git checkout`); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14). Remaining iter15 candidates (b: content-hash filenames; c: non-veil CSS/paint tweak) are the only ones left under the current constraints; the module-graph timing trade now argues for (c) or closing out at the iter14 state.

Raw: `speed-lab/metrics/baseline.json` (pre-revert numbers above; superseded by the next run).

### iter17: eager-load `pages/tags.js` as a head module, removing the home route's lazy fetch (2026-08-19 PT) — **REVERT**

Hypothesis: the LCP element (`#tag-input` placeholder inside the `soci-post-list` that `pages/tags.js` creates on `routeactivate`) sits behind a DOMContentLoaded + async classic-fetch + eval round trip (the `lazyload` script formerly in `soci-route#tags`). Making it the 4th head `<script type="module">` starts its fetch in parallel during parse and evaluates it right after soci-components.js (once `window.soci` exists), so the `routeactivate` listener (or the `registerPage` `if(page.dom.active)` catch-up) engages ~1 tick after parse instead of DCL+fetch+eval. Non-home routes stay lazy (iter1); cache headers (iter14) untouched.

Change: added `script(src="/pages/tags.js" type="module")` to `index.pug` head after soci-components.js; removed `include pages/tags.pug` from `soci-route#tags`; `pages/tags.js` now uses `document.querySelector('soci-route#tags')` instead of `document.currentScript.closest('soci-route')`; deleted `pages/tags.pug`. Deliberately placed in the head (not inside the route) so `activate(fresh)`'s `innerHTML = domCopy` re-insertion can't re-execute/re-register it on fresh re-activations. Smoke: `node --check` clean; `curl :4200/` confirms the module tag + self-closing tags route with no lazyload line; `GET :4201/posts` = exactly 21 fixture posts.

Medians vs iter14 bar (cold 606.4/961.4, warm 217.0/470.1):

| | FCP ms | LCP ms | TBT | score |
|---|---:|---:|---:|---:|
| cold median | 623.6 | 994.8 | 0 | 0.98 |
| warm median | 217.0 | 450.2 | 0 | 1.00 |

Cold runs: FCP 623.0 / 623.6 / 624.2 (tight ±0.9, all ≈17 ms over the bar); LCP 975.5 / 994.8 / 1033.6. Warm runs: FCP 217.0 / 217.0 / 217.0 (exact tie with bar); LCP 450.0 / 450.2 / 529.5. Per-run TTI not preserved (raw JSONs cleaned in the post-revert sweep); TTI ≈ LCP on every prior lab iteration.

Reading:
1. The warm-lane prediction held: warm LCP −19.9 (2 of 3 runs under the bar; median 450.2) — the async tags.js fetch/eval that used to sit between DCL and feed creation is gone.
2. But cold regressed on both lanes: FCP **+17.2** (tight cluster, ±0.9 — a real effect, not noise) and LCP **+33.4**. Mechanism not fully pinned down: the extra head-module fetch/eval hop in the no-cache profile is the suspect, but module tags don't block parsing, so the +17 ms FCP shift resists a clean first-principles explanation. What is certain: the cost lands on the cold LCP/FCP lanes, and it is systematic across all three runs.
3. Fourth confirmation (iter7, iter8, iter15, now iter17) that the LCP lane is pinned to the eager module graph's timing: any re-ordering of that graph trades one lane against the other and has never won both at once. Moving a home-route script from lazy to eager is that trade with the sign flipped — it buys warm, spends cold.

Verdict: **REVERT** (strict faster-on-all-lanes rule: cold FCP +17.2, cold LCP +33.4, warm FCP exact tie). All three edits restored to submodule `c43db4f` state (`git checkout`); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14). Remaining non-forbidden candidates: (b) content-hash filenames, (c) small CSS/paint tweak, or close out at the iter14 state.

Raw: `speed-lab/metrics/baseline.json` (pre-revert numbers above; superseded by the next run).

### iter18: put the LCP header (`#tag-input`) in static home-route markup (2026-08-19 PT) — **REVERT**

Hypothesis (re-scoped from the iter17 next-step to "static markup, not an eager module"): the audit attributes LCP to the feed header's `#tag-input`, which today only exists once lazy `pages/tags.js` creates the `soci-post-list` (a DCL + async fetch + eval round trip that lands ≈ the LCP tick). If the input already sits in `soci-route#tags`'s light DOM at route-activation, it paints ≈FCP (well ahead of tags.js eval) and LCP should collapse toward ≈FCP — without making tags.js eager (iter17 showed that spends cold) and without adding a 4th head module. tags.js stays lazy; on `onActivate` it removes only the prior `soci-post-list`, not the input, so the hero persists and the list appends beneath it.

Change: `pages/tags.pug` gains `input#tag-input(type="text" placeholder="Viewing all tags")` immediately before the `lazyload` script; `soci.css` adds a `soci-route#tags #tag-input` box mirroring the shadow-DOM input (238×28, matching border/background/padding, one `&::placeholder` nested rule); `pages/tags.js` `onActivate` swaps `tags.dom.innerHTML = ''` for `tags.dom.querySelector('soci-post-list')?.remove()` so the fresh-route `domCopy` re-inserts the static input on re-activation and the new list nests under it. No eager-module change; cache headers (iter14) untouched. Smoke: `curl :4200/` shows `<input id="tag-input" ...>` in the `#tags` route's light DOM (restored into `domCopy` by `activate(fresh)`); the feed still appends `soci-post-list` — 21 fixture posts render.

Medians vs iter14 bar (cold 606.4/961.4, warm 217.0/470.1):

| | FCP ms | LCP ms | TBT | score |
|---|---:|---:|---:|---:|
| cold median | 585.0 | 1053.2 | 0 | 0.98 |
| warm median | 217.0 | 529.9 | 0 | 1.00 |

Cold runs: FCP 605.2 / 585.0 / 584.4 (median 585.0, ~−21 ms under the bar); LCP 1053.2 / 1053.6 / 1034.0 (median 1053.2, ~+92 ms over). Warm runs: FCP 217.0 / 217.2 / 217.0 (exact tie with the bar); LCP 470.0 / 530.8 / 529.9 (median 529.9, ~+60 ms over; only run 1 hit the bar). TBT 0 on every run.

Reading:
1. The static input IS an early contentful element — cold FCP improved (−21.4), confirming it paints at route-activation, ahead of the lazy tags.js path. Static markup does shift the *first* paint.
2. But it is NOT the LCP. LCP regressed on both lanes (+91.8 cold, +59.8 warm). The input (~238px) is smaller than the feed's first large card, so the feed card — not the header — is the real LCP. The static input, sitting in normal flow at the top of the route, pushes the list down (~44px) and adds another box to lay out, and that delayed the feed card's paint by ~60–90 ms.
3. This corrects the "LCP = `#tag-input`" model carried from the iter16/iter17 framing: the header input is a small early element and an FCP contributor at best, not the largest one. Making a small header element the LCP hero via static markup spends LCP on the feed that actually owns it.

Verdict: **REVERT** (strict faster-on-all-lanes rule: warm LCP +59.8, cold LCP +91.8; only cold FCP −21.4 is a gain). All three edits restored to submodule `c43db4f` state (verified `git -C soci-frontend diff` clean); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14). The LCP lane stays pinned to the feed's creation/paint timing — a fifth confirmation across iter7/8/15/17 — and a static small-element hero is the wrong lever. Remaining non-forbidden candidates: (b) content-hash filenames, (c) a small CSS/paint tweak that moves the FEED's LCP card itself (not the header), or close out at the iter14 state.

### iter19: shorten the `#items` entrance ramp 0.35s → 0.12s (keep fade + transform) (2026-08-19 PT) — **REVERT**

Hypothesis (new-regime reading of warm-3.json): with iter14's disk-cached shell, the warm main thread is idle from ~95 ms to ~470 ms (total work ≈100 ms, no long tasks) and the 380 ms FCP→LCP gap sits exactly on the `#items` opacity ramp: LCP ≈ `[loaded]`-flip (~85 ms) + 350 ms ramp (warm 470.1; cold ≈ flip ~610 + 350 = 961.4). If Blink's LCP fade-in-delay rule is charging the ramp duration onto the feed-card LCP candidate, shortening the ramp 3.1× should cut ≈230 ms off LCP on both lanes with zero FCP cost (first-paint area unchanged — `#items` is still opacity 0 until flip). Deliberately **not** the forbidden wholesale removal (iter8): the fade and the translate both stay, only the duration shrinks.

Change (1 file, 1 line, reverted): `soci-post-list.js` `:host([loaded]) #items` transition `0.35s` → `0.12s` on both `transform` and `opacity`. No JS reads the duration (verified: no `transitionend`/350 references); lanes-view per-child 0.25s staggers untouched. `node --check` clean; 21-post smoke OK; `immutable` cache headers untouched.

Medians vs iter14 bar (cold 606.4/961.4, warm 217.0/470.1):

| | FCP ms | LCP ms | TTI ms | TBT | score |
|---|---:|---:|---:|---:|---:|
| cold median | 599.2 | 1179.2 | 1180.7 | 0 | 0.97 |
| warm median | 237.4 | 523.9 | 523.9 | 0 | 1.00 |

Cold runs: FCP 599.2 / 612.6 / 595.1 (spans the known 585–615 environmental band; median within noise); LCP 1187.1 / 1148.3 / 1179.2 (all ≈+220 ms over the bar). Warm runs: FCP 240.5 / 231.3 / 237.4 (+20.4 — the iter12-documented ≈20 ms machine-state drift); LCP 524.4 / 463.9 / 523.9 (2 of 3 above 520; only run 2 near bar).

Reading:
1. **The fade-in-delay model is dead.** Faster ramp → *slower* LCP (+217.8 cold, +53.8 warm) — the opposite of the ramp-end prediction. Combined with iter8 (wholesale removal: −56.3 cold / +37.7 warm), iter10 (veil, no fade: no win) and iter11 (no transform, ramp kept: +31/+69), the `#items` entrance stack is now proven exhausted in **both** regimes (old no-cache and post-iter14 disk-cached): every perturbation of the opacity/transform/veil/duration space either regresses or is neutral. LCP in the current regime is pinned to the feed card's own paint timing, not to the container's animation schedule.
2. The warm-FCP +20.4 drift recurs (237.4 vs 217.0) on this single CSS-value change, consistent with the environmental ±20 ms band iter12 attributed to machine state — it does not change the verdict, since warm LCP independently failed.
3. Cold LCP +217.8 is far beyond any observed drift band: a genuine effect of the shorter ramp on final-card paint scheduling.

Verdict: **REVERT** (strict faster-on-all-lanes rule: cold LCP +217.8, warm LCP +53.8, warm FCP +20.4 — no lane faster). File restored to `c43db4f` state (verified `git -C soci-frontend diff` clean); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14). The paint-side of the feed is now a fixed point. Remaining non-forbidden candidates: (b) content-hash filenames, or close out at the iter14 state.

Raw: `speed-lab/metrics/baseline.json` (pre-revert numbers above; superseded by any next run).

### iter20: intrinsic size (`aspect-ratio: 16/9`) for the first feed card's media box (2026-08-19 PT) — **REVERT**

Hypothesis: the first card in the popular feed is `sl-img-01` (800x450, score 21 = highest). Its `<picture><img>` carries no intrinsic size and `#media` has no height, so the media box is 0px until the .webp bytes arrive and decode — a post-paint reflow each cold run. Reserving the final 16/9 box up front (`width:100%` → height `min(w·9/16, 320px max)`, exactly the 800x450 fixtures' post-load geometry, zero CLS) should settle the image's LCP-candidate layout early and let the image paint as soon as it decodes, cutting cold LCP (bar 961.4) with no FCP cost.

Change (1 file, 1 line, reverted): `soci-post-card.js` `#media img` rule gains `aspect-ratio: 16 / 9;`. All 10 image fixtures (800x450) and the 1280x720 video fixture are 16:9; `max-height: 320px` clamp untouched. `node --check` clean; 21-post smoke of `/posts?sort=popular` OK (first 3 = image); static server picked up the change without restart; iter14 `immutable` cache headers untouched.

Medians vs iter14 bar (cold 606.4/961.4, warm 217.0/470.1):

| | FCP ms | LCP ms | TBT | score |
|---|---:|---:|---:|---:|
| cold median | 604.3 | 1020.3 | 0 | 0.98 |
| warm median | 217.2 | 470.1 | 0 | 1.00 |

Cold runs: FCP 585.1 / 604.3 / 605.0 (median 604.3, −2.1 — noise); LCP 1017.6 / 1054.5 / 1020.3 (median 1020.3, +58.9; all three runs above 1017, none inside the bar's reachability band). Warm runs: FCP 217.0 / 217.3 / 217.2 (exact tie with the bar); LCP 469.7 / 471.0 / 470.1 (median 470.1 = exact tie with the bar; ±1.3 ms, not faster). TBT 0 on every run.

Reading:
1. **Warm lane is exactly bar.** In the post-iter14 regime the .webp is disk-cached (iter14 made images immutable too), so bytes paint fast regardless of box reservation — paint converges to the same instant with or without the reserved layout. Intrinsic sizing buys nothing on warm.
2. **Cold lane regressed +58.9.** With the reserved box, the ~179,000px² media box is a visible LCP candidate from card creation (pre-bytes) and holds the candidate; in the bar state the 0px box isn't a candidate until load, and the bar's 961.4 is reached when a smaller/earlier candidate wins in some runs (the post-revert confirmation run reaches 959.8). The reservation does not accelerate the image's own fetch/decode (fetch still starts at `connectedCallback`; preloads are forbidden), so it cannot win on cold — it only changes which element Blink reports and when.
3. Sixth confirmation (iter7/8/15/17/19 + iter20) that the LCP lane is pinned to the first feed card's media arrival+paint. A layout-side reservation of the box does not move the bytes' critical path.

Verdict: **REVERT** (strict faster-on-all-lanes rule: cold LCP +58.9; warm lanes tied, not faster). File restored to `c43db4f` state (verified `git -C soci-frontend diff` clean and served bytes no longer contain `aspect-ratio`); post-revert confirmation run reproduces the bar (cold FCP 605.4, cold LCP 959.8/1019.3/1058.1; warm 217.0 ×3, LCP 470.1/530.2/470.4); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14). Remaining non-forbidden candidate: (b) content-hash filenames — a build-pipeline change, not "small" for the protocol; otherwise close out at the iter14 state.

Raw: `speed-lab/metrics/baseline.json` (post-revert confirmation numbers; with-change numbers above).

### iter21: `fetchpriority=high` on the first feed thumbnail (2026-08-19 PT) — **REVERT**

Hypothesis: in the list view the first feed card's thumbnail `<img>` (96×72) is loaded at the default `auto` priority alongside the other ~9 feed images; it is the largest early content in the feed. Forcing `fetchpriority=high` on that one image should pull its byte-fetch ahead of the siblings and cut cold LCP (bar 961.4) with no FCP cost — the first-paint area is unchanged, only the fetch priority of one element moves.

Change (1 file, ~1 line, reverted): `soci-post-li.js` `_setImageSource` sets `fetchpriority="high"` only when the post is the first child `<li>` of its `soci-post-list` (all others keep the default `auto`). Both the batch `innerHTML` path and the streaming `fetchAndMerge` append path set it before insertion, so the attribute survives either build. `node --check` clean; CDP smoke: 21 posts, view=list, 0 cards, first li `fetchPriority="high"`, 2nd/4th `"auto"`. iter14 `immutable` cache headers untouched.

Medians vs iter14 bar (cold 606.4/961.4, warm 217.0/470.1):

| | FCP ms | LCP ms | TBT | score |
|---|---:|---:|---:|---:|
| cold median | 604.3 | 957.8 | 0 | 0.98 |
| warm median | 217.0 | 529.5 | 0 | 1.00 |

With-change run (3 cold + 3 warm; per-run raw JSONs superseded by the post-revert confirmation sweep — see iter17 for the same sweep): cold FCP median 604.3 (−2.1), cold LCP median 957.8 (−3.6); warm FCP 217.0 ×3 (exact tie with the bar); warm LCP median 529.5 (+59.4). TBT 0 on every run.

Reading:
1. **The LCP element is the feed header's placeholder text, not the thumbnail.** `lcp-breakdown-insight` reports the LCP node as `div#placeholder` — the `::placeholder` text "Viewing all tags" of `#tag-input` in the feed header (`soci-post-list.js:244`) — in all 6 runs. It is a text element. The 96×72 thumbnail (and every other feed image) never wins the LCP election, so `fetchpriority` on it is mechanically inert for the LCP lane.
2. The "gains" (cold FCP −2.1, cold LCP −3.6) sit inside the known ±20 ms environmental band and are not a real effect — both lanes are text/LCP-timing dominated and one feed image's fetch priority cannot move either. The decisive result is the warm lane: warm LCP +59.4 and warm FCP an exact tie (tie ≠ win under the strict keep rule).
3. The `lcp-breakdown-insight` subparts (TTFB ~30 ms + elementRenderDelay 60–83 ms ≈ 115 ms) don't reconcile with the actual LCP timestamp (~1.0 s cold / ~0.47–0.53 s warm), consistent with an early text render gated on paint/fade scheduling rather than on the header's render cost — further evidence the feed image bytes are off the LCP critical path entirely.

Verdict: **REVERT** (strict faster-on-all-lanes rule: warm LCP +59.4; warm FCP exact tie; cold deltas within noise). Change removed from `soci-post-li.js` (verified `git -C soci-frontend diff` clean, submodule at `c43db4f`); no commit. Post-revert confirmation run reproduces the bar (cold FCP 604.6/585.5/605.0; cold LCP 1056.0/1015.3/999.8; warm FCP 217.0 ×3; warm LCP 469.9/529.5/449.6, median 469.9 ≈ bar 470.1). Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14). This corrects the "LCP = the first feed card's media" model reaffirmed in iter18/iter20: across all six post-iter14 runs the LCP node is the header's `div#placeholder` text. The through-line with iter7/8/15/17/19/20 stands — the LCP lane is decoupled from the feed image bytes — but the LCP *element* is the header text, not the media box, so byte-priority levers (fetchpriority/preload) are out of scope. Remaining non-forbidden candidate: (b) content-hash filenames — a build-pipeline change, not "small" for the protocol; otherwise close out at the iter14 state.

Raw: `speed-lab/metrics/baseline.json` (post-revert confirmation numbers; with-change medians above).

### iter22: explicit `loading="eager"` on the first feed card's thumbnail (2026-08-20 PT) — **REVERT**

Hypothesis (the prompt's "else" branch — the preferred font-display lever was verified a no-op up front, below): the list-view feed's first thumbnail `<img>` (96×72) is created with no `loading` attribute (spec default ≈ eager for in-viewport). Setting `loading="eager"` explicitly on the first card's thumbnail only should be spec-neutral; the run tests that neutrality against the LCP lane.

Font lever not measurable: the checkout contains no webfonts anywhere — no `@font-face`, no font `<link>`/preload, no `document.fonts`/`FontFace` usage in soci-frontend. `#tag-input` (the LCP header input) uses `font-family: inherit` → the native system stack from `soci.css:445`, and the first card's `.title`/`#details` inherit the same stack. There is no font swap, preload, or subset to perform — the entire font-side lever space is a no-op by construction in this codebase.

Change (1 line, reverted): in `soci-post-list.js` `createPosts`'s list-view branch, after the batch `innerHTML` render of the first `numberToRender` cards: `this.firstElementChild?.shadowRoot?.querySelector?.('#thumbnail img')?.setAttribute('loading', 'eager')`. First card only (its shadow thumbnail `<img>`, src set in `_setImageSource` at connect); the other batched cards and the idle-appended remainder keep the attribute-less default. `node --check` clean; smoke: served page bytes unchanged until runtime, first card's img carries `loading="eager"` after feed creation.

Medians vs iter14 bar (cold 606.4/961.4, warm 217.0/470.1):

| | FCP ms | LCP ms | TBT | score |
|---|---:|---:|---:|---:|
| cold median | 605.2 | 1015.9 | 0 | 0.98 |
| warm median | 217.0 | 529.7 | 0 | 1.00 |

With-change run (3 cold + 3 warm): cold FCP 604.6 / 605.2 / 605.2 (median 605.2, −1.2 = noise); cold LCP 1015.9 / 1016.5 / 957.9 (median 1015.9, +54.5; 2 of 3 runs in the ~1016 band). Warm FCP 217.0 ×3 (exact tie with the bar); warm LCP 529.6 / 529.7 / 529.9 (median 529.7, +59.6 — a tight cluster, all three in the ~530 warm mode). TBT 0 on every run.

Reading:
1. **Spec-neutral change, empirically LCP-negative on both lanes.** A missing `loading` attribute already behaves as `eager` per the HTML spec, so a +60 ms LCP shift cannot be cleanly attributed to the attribute itself — and the post-revert confirmation sweep lands one run in the same ~530 warm mode at the unchanged bar (530.2 / 450.2 / 469.6), confirming the warm LCP 470/530 bimodal is environmental, not caused by the one-line no-op. Strict rule applies regardless: warm LCP median +59.6, warm FCP exact tie → no faster lane.
2. **The font lever is documented dead, not measured dead.** Every font-display/swap/preconnect/subset variant on the tag header input or first-card text is a no-op by construction until a webfont is introduced to the project. iter22 closes the entire font-side candidate space for this codebase.
3. Seventh confirmation (iter7/8/15/17/19/20/21 + iter22) that post-iter14 the LCP lane is insensitive to single-feed-element fetch/loading levers. With iter21's finding (the reported LCP node is the header's `div#placeholder` text, not the media box) this iteration removes the last remaining "small" front-end lever touching feed image loading or fonts. The warm 470/530 bimodal itself is now the dominant variance source: the bar's warm 470.1 sits at the favorable mode's edge, and any candidate's warm-lane verdict is partly which mode the sweep draws.

Verdict: **REVERT** (strict faster-on-all-lanes rule: warm LCP +59.6; warm FCP exact tie; cold FCP −1.2 noise, cold LCP +54.5). Change removed; `git -C soci-frontend diff` clean, submodule at `c43db4f`. Post-revert confirmation run reproduces the bar pattern (cold FCP 605.1 / 604.7 / 604.9; cold LCP 979.9 / 1036.8 / 997.0; warm FCP 217.0 ×3; warm LCP 530.2 / 450.2 / 469.6 — the ~530 mode present at bar). Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14). Remaining non-forbidden candidate: (b) content-hash filenames — a build-pipeline change, not "small" for the protocol; otherwise close out at the iter14 state, a recommendation strengthened by this iteration's font-space closure.

Raw: `speed-lab/metrics/cold-{1..3}.json` + `warm-{1..3}.json` hold the post-revert confirmation sweep; with-change numbers above (per-run raw JSONs superseded by the confirmation sweep, as in iter17/iter20/iter21).

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
| Qwen  | 624 / 1096 | 624 / 1056 | 624 | 1096 |

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

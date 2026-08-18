# Speed lab (EXPERIMENTAL — DO NOT MERGE)

Shared Nonio feed fixture for overnight Fable vs local Qwen comparison.

**Never merge this branch.** Experimental seed only. It lives in the superrepo (`speed-lab/`) so both tracks can pin one SHA without touching submodule gitlinks.

SEED_COMMIT=PENDING

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
| Qwen  |  |  |  |  |

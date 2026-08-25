# Nonio

This is the whole system in one repo — no submodules, no extra remotes. A plain
`git clone` gives you everything needed to build and run.

## Layout

| Directory         | What it is                                        | Port |
|-------------------|---------------------------------------------------|------|
| `soci-frontend`   | Web frontend (vanilla JS webcomponents, node server) | 4200 |
| `soci-backend`    | Go API (`noniod`), MySQL via goose migrations      | 4201 |
| `soci-avatar-cdn` | Go CDN for avatars + emojis                       | 4202 |
| `soci-image-cdn`  | Go CDN for post images + thumbnails               | 4203 |
| `soci-video-cdn`  | Go CDN for video upload/encode/serve              | 4204 |
| `soci-html-cdn`   | Go CDN for sanitized HTML embeds                  | 4205 |
| `nonio-simulator` | Synthetic user/activity simulator (dev tool)      | —    |
| `nonio-tui`       | Terminal client                                   | —    |

MySQL/MariaDB listens on 3306 (database `socidb`, user `dbuser`/`password` for
local dev — see `soci-backend/localRun.sh`).

## A note on the `soci` prefix

`soci` was the old name for the product; everything user-facing is now `nonio`.
Custom elements are `<nonio-*>`, CSS custom properties are `--nonio-*`, the API
binary is `noniod`. Three things deliberately still say `soci`, because they name
live infrastructure rather than code and moving them is a deploy step:

- the service directories in the table above, and the Go module paths that
  follow from them,
- the MariaDB database `socidb` (and the `socidb_testing` /
  `socidb_handlers_testing` databases the Go tests use, plus the `soci-db` dev
  container),
- the `soci-build` unix group mentioned in `soci-backend/README.md`.

## Quick start

```
git clone git@github.com:jjcm/nonio.git
cd nonio
./quickStart.sh
```

Requirements: `go`, `node`/`npm`, GNU `screen`, and
[`goose`](https://github.com/pressly/goose) for DB migrations
(`go install github.com/pressly/goose/cmd/goose@latest`).

If nothing is listening on 3306, `quickStart.sh` starts a `mariadb:11` docker
container (named `soci-db`) with the dev credentials above; if you already run
MySQL/MariaDB locally it is reused as-is. Each service copies its
`config.json.example` / `config.js.example` on first launch, so there is
nothing to configure for local dev.

The script opens one GNU screen session with a window per service. Switch
windows with `ctrl+a n` (next) / `ctrl+a p` (previous), detach with `ctrl+a d`,
reattach with `screen -r nonio`.

Once up: [http://localhost:4200](http://localhost:4200).

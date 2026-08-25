## 2026-08-25 — Feed video posts: poster + play badge + inline playback (branch `cursor/feed-video-thumbnails-7d3e`)

Video rows in the list feed (`soci-post-li`) behaved like text posts: no media, no
way to watch without opening the post page. They now look and expand like image
rows.

- **`soci-post-li`**
  - `loadContent` treats `video` like `image`/`link`, so the row loads
    `THUMBNAIL_HOST/{url}.webp` (the same 2× 192x144^ webp, `loading=lazy`
    beyond the first 12 rows) as a poster.
  - Poster wrapped in a `#thumbnail` div (the picture had no box to anchor to);
    the 8px gap moved from the image to the wrapper so the play badge centers on
    the poster. The expanded width cap moved to the boxes that lay out in flow
    (`#thumbnail`, `#preview img`, `#preview soci-video`) — a percentage
    max-width on the image alone resolves against the shrink-to-fit float and
    silently halved the expanded image. Verified pixel-identical to master for
    image rows, collapsed and expanded, desktop and mobile.
  - Play badge (`#play`, new `playFilled` glyph) over the poster; clicking the
    poster runs the same `expand()` as images and mounts a `soci-video` in
    `#preview` at the expanded geometry, with `--media-width/--media-height`
    from the post so the player picks a rendition (480p inline) instead of the
    source file. No navigation. A collapse badge (`#collapse`, new `close`
    glyph) closes the row, since clicks on the player belong to play/pause.
  - Videos keep their aspect where the width cap bites (mobile, ultrawide)
    instead of cropping like images; the player never letterboxes as a result.
  - Video posts whose poster 404s get `.no-poster`: a plain tile with the play
    badge instead of the `.no-image` blank row, so playback still works.
    **This is the common case in production today** — `soci-video-cdn` never
    writes a poster (the thumbnail half of `route/move.go` is commented out and
    `encode.Image` is unused for videos), so only a handful of 2023 posts have
    one. Generating posters at encode time is the follow-up that lights up real
    frames here.
- **`soci-post-list`**: `renderPostLi` passes `width`/`height` for video posts
  (already in the feed payload) for the player's rendition choice and as the
  aspect fallback when there's no poster to measure.
- **`soci-video`**: `height: 100%` + `object-fit: contain` so the player fills a
  host with an explicit box (no-op where the host height is auto, as on the post
  page — verified identical); `disconnectedCallback` now removes its document
  keydown listener, which matters once players mount and unmount in a feed.

Verified against production data and a local fixture stack (correct-aspect
poster, portrait video, poster-less video, legacy poster whose aspect disagrees
with the file): playback starts on click, pause/resume works, collapse removes
the player, `npm test` 12/12.

## 2026-08-24 — VPS speed lab: live deploy + measured perf loop (branch `cursor/speed-vps-loop-27f0`)

Deployed the monorepo to a live 1-vCPU/1 GB Vultr box (108.61.219.46) with a
deterministic 2,600-post seed and ran a makefaster-style loop against it over a
real 53 ms WAN hop. Everything logged in `SPEED_LAB.md` + `speed-lab/results/`;
infra in `speed-lab/vps/` (systemd units, Caddyfile, deploy.sh, provision.sh),
seed generator in `speed-lab/seed/`.

**Keepers (measured, medians):**
- Single TLS origin via Caddy (h2+h3): `/api|/image|/avatar|/video|/htmlcdn/*`
  strip-prefix proxied; cold home LCP 1240→752 ms WAN, slow4g allDone 31.3 s→4.1 s.
- Lazy offscreen media (`loading=lazy` beyond first 12 rows + all avatars):
  cold transfer −67%, LCP −36 ms WAN.
- `defer` on markdown-wasm loader: slow4g cold FCP/LCP/feed −140…−156 ms.
- Shell-level API prefetch (`window.__preFetch` in index.pug, consumed by
  `soci-post-list._loadPosts` + `soci-component.getData`): home/tag/user feeds
  and post+comments deep links; slow4g home LCP −42%, post LCP −14…−18%.
- Anonymous browser cache on read APIs (`private, max-age=30` +
  `Vary: Authorization` on /posts, /posts/:url, /comments, /tags): warm
  feedPaint 412→219 ms slow4g.

**Reverted after measurement (see SPEED_LAB.md for numbers):** modulepreload of
the 65-file module graph (LCP regression from preload contention), Caddy
file_server + precompressed brotli for statics (h2 fair-multiplexing starved
the first thumbnail bimodally), node-side brotli (byte win too small, seesaw),
kernel TCP tuning (−8 ms, below threshold), markdown.wasm preload (−12 ms).

**Harness hardening (speed-lab/harness):** TBT/bytes/requests collection in
measure.mjs; Chromium pinned with `--disable-quic` on throttled lanes (QUIC
bypasses CDP throttling) and fixed lazy-image margins via `--blink-settings`
(Chrome's connection estimate flips them bimodally); transitions probe treats
empty-`src` template imgs as decoded. Seed thumbnails regenerated at
production geometry (`-resize 192x144^` per soci-image-cdn) after discovering
the lab was serving 4-6× production weight.

All suites green at wrap: backend `go test ./...`, frontend `npm test` (12/12),
avatar/html CDN tests. Not merged to master.

## 2026-08-23 — Condensed migrations, test coverage, architecture perf pass

Follow-on to the monorepo unification below, same branch/PR.

- **Migrations condensed to one file** (`soci-backend/migrations/00001_initial_schema.sql`).
  Reproduces the old 55-migration chain exactly — verified by diffing
  `mysqldump --no-data` of a fresh DB built each way (byte-identical). The old
  chain's UPDATEs were all mid-chain backfills (no-ops on empty DBs), so no
  seed script is needed. Note: old `00037_add_admin_users.sql.sql` was a silent
  no-op under goose (double extension), so `admin_users` never existed on
  fresh DBs and is referenced nowhere — intentionally absent. Deployed DBs at
  goose v55 treat version 1 as applied; they pick up the new indexes via the
  one-shot `soci-backend/scripts/2026-08-23-add-hot-path-indexes.sql`.
- **Backend perf (measured on a seeded local stack: 3000 posts, 30000
  comments, 300 users; medians of 9; responses byte-identical before/after):**
  - Batch hydration: `GET /posts` was 201 queries per uncached page (1 list +
    100 per-post tags + 100 per-post authors via lazy `MarshalJSON`); now 3.
    `GET /comments` was 202 (author + post per comment); now 3. Latency
    24.6→5.7 ms and 19.4→5.4 ms respectively.
  - Five hot-path indexes in the initial schema: `comments(post_id)`,
    `posts(community_id, created_at)`, `posts(user_id)`,
    `posts_tags_votes(voter_id)`, `notifications(user_id)`. EXPLAIN
    comments-by-post went ALL/29967 rows → ref/120; `/comments` 5.4→2.0 ms.
  - Feed query now selects `LEFT(content, 4096)` instead of full bodies;
    `PostCache` capped at 1024 entries (was unbounded, keyed by raw URL);
    `FixUserSubs` no longer blocks startup (was ~1 min per restart with a few
    hundred unpatched users).
- **CDN perf:** all four CDNs served files with no Cache-Control at all
  (browser heuristic caching). Now: avatars/emojis `max-age=300` (mutable,
  username-keyed paths), image/video media `max-age=86400` (write-once but not
  content-hashed, so no immutable), html-cdn pages `max-age=3600` +
  temp previews `no-store` + gzip on its HTML/CSS/JS (~10x on markup).
  video-cdn uploads stream to disk via `io.Copy` instead of buffering whole
  files in memory.
- **Frontend perf:** back-navigation to the same feed reattaches the previous
  `soci-post-list` (5-minute bound) instead of remounting — verified live:
  1 `/posts` on initial load, 0 on back-navs (was 1 each), 1 on tag change.
  Fresh routes no longer leak every detached child forever
  (`soci-route.currentDom` cleared on fresh activation). `soci-post-list`
  no longer fires a doomed fetch from attributes set before insertion.
  `/votes` arriving after paint now re-marks upvote chrome in place
  (`votesloaded` event, additive-only). Stylesheet moved above the
  synchronous markdown script in `index.pug` head.
- **Tests added** (all green): backend hydration + first-ever
  `httpd/handlers` HTTP tests + gzip middleware tests (handlers use their own
  `socidb_handlers_testing` DB so `go test ./...` can run packages in
  parallel); CDN tests (fake-API auth utils, avatar upload guards, emoji name
  sanitization, config parsing, video session/url-mapping state, cache/gzip
  wrappers); frontend `npm test` via node's built-in runner (server ETag/304/
  gzip behavior + api client logic), no new framework. Also fixed two
  pre-existing breaks that Go 1.24 vet turned into compile failures
  (`models/user_test.go`, `soci-image-cdn/route/move.go`).

## 2026-08-23 — Monorepo unification (no more submodules)

- Vendored all five former submodules (`soci-frontend`, `soci-backend`,
  `soci-avatar-cdn`, `soci-image-cdn`, `soci-video-cdn`) into this repo as real
  directories, byte-exact at the SHAs the superrepo pinned. `.gitmodules` and
  the gitlinks are gone; a plain `git clone` is a complete checkout.
- `quickStart.sh` is now the single start path: it verifies go/node/screen/goose,
  reuses any MySQL already on 3306 or starts a `mariadb:11` docker container
  (`soci-db`, database `socidb`, user `dbuser`/`password`), then launches
  frontend + API + all four CDNs in one screen session.
- README.md rewritten for the one-repo checkout with a directory/port table
  (4200 frontend, 4201 api, 4202 avatar, 4203 image, 4204 video, 4205 html,
  3306 mysql). AGENTS.md notes the repo layout.
- No product behavior changed in this step; history of the old standalone
  repos stays in those repos.

## 2026-08-21 — Speed: feed load + in-app transitions

Measured on a local stack (MariaDB, goose, Go API, CDNs, frontend) with a
Playwright harness on two throttled lanes: Slow 4G (150 ms RTT / 1.6 Mbps) and
a desktop wifi profile (20 ms RTT / 20 Mbps). Medians of n=9.

- **Frontend (soci-frontend)**
  - `index.js`: gzip for text/JSON/JS/CSS/SVG over 512 B, with output memoized
    per path+ETag so a hot asset is compressed once rather than per request.
    ETag + 304 on static files (size+mtime) and on the rendered shell (content
    hash). `Cache-Control: public, max-age=300` for static assets —
    deliberately short and deliberately not `immutable`, because these
    filenames are not content-hashed. Shell is compiled once instead of on
    every request (was 31 ms per request); the cache is validated against
    pug's own reported include list, so template edits still take effect
    without a restart.
  - `pages/user.pug`: dropped a bare `soci-post-list` placeholder that fetched
    the entire unfiltered frontpage feed and was then discarded by
    `user.renderContent()`.
  - `soci-post-list`: suppressed the duplicate feed request that
    `attributeChangedCallback('filter')` issued during `_initializeControls()`.
    API requests per navigation: user 6 → 3, tag 2 → 1.
  - `soci-post`: reveal on the next frame instead of after a fixed
    `setTimeout(…, 100)`. The element renders at opacity 0 for the whole
    fetch, so the entrance transitions still animate; the 100 ms was dead time.
  - `soci-comment-list`: build the comment tree before fetching
    `/comment-votes`, and skip that request entirely when not signed in (it
    answered 401 for anonymous readers, costing them a full round trip before
    any comment appeared).
  - Entrance animations on the feed and the post page now ease opacity on
    `--soci-ease-out` instead of the symmetric `--soci-ease`. Durations and
    transform curves are unchanged. The old curve held content below
    perceptible opacity for ~65 ms after the response had already landed.

- **Backend (soci-backend)**
  - New `httpd/middleware/gzip.go`, wrapping all three route groups. Feed JSON
    is the largest thing a client downloads during an in-app navigation and
    compresses ~5x. Buffers the first 512 B so the decision uses both content
    type and actual size; WebSocket upgrades bypass it; Hijack/Flush pass
    through. `/posts` 8894 → 1860 B.

- **Results** (Slow 4G medians, click to first contentful render of the
  destination)
  - Homepage → tag: 241.1 → 191.1 ms (−21 %)
  - Homepage → user: 275.9 → 224.5 ms (−19 %)
  - Homepage → post: 292.5 → 197.9 ms (−32 %); time-to-usable, meaning body
    plus comments, 342.5 → 197.9 ms (−42 %)
  - Homepage load: cold FCP 3976 → 2640 ms, cold LCP 4480 → 3056 ms, warm FCP
    3968 → 208 ms, warm feed paint 4300 → 361 ms. No metric regressed.
## 2026-08-21 — Faster, shorter page and post load animations

- **Frontend (soci-frontend)**
  - Halved the duration and vertical travel distance of post-list load animations in list and lanes views.
  - Halved the duration and vertical travel distance of primary, secondary, and tertiary route load animations.

## 2026-02-27 — User page post-list filtering + sidebar Posts default active

- **Frontend (soci-frontend)**
  - Fixed `soci-post-list` to honor `data` and `user` attributes: when `data` is set (e.g. `data="/posts?user=username&sort=top"`), the component now uses that URL and merges sort/filter from its controls. Added `user` attribute support so `_buildPostsUrl()` includes `?user=` when present.
  - User page post list now correctly filters to the current user's posts (user.js already passed `data`; soci-post-list now consumes it).
  - Sidebar user panel: Posts is the default active nav item when navigating to `/user/:username`. Fixes: (1) `_setActiveNavItem('none')` was clearing all `soci-tag-li[active]` after the user panel set them—now `_notifyUserPanelRouteState` is called again after `_setActiveNavItem`; (2) `soci-post-list`'s `_syncFromLocation` was calling `activateTag` on connect/hashchange, which cleared the user panel's Posts—now it skips `activateTag` when pathname is `/user/...`.

## 2026-02-24 — Added soci-emoji component and migrated custom emoji rendering

- **Frontend (soci-frontend)**
  - Added new `components/soci-emoji.js` web component (`<soci-emoji name="...">`) with shadow-root `<img>` rendering.
  - `soci-emoji` now updates image URL whenever `name` changes and uses fixed sizing behavior:
    - host-managed inline sizing,
    - inner image `height: calc(100% + 4px)` and `margin: -2px 0`.
  - Registered `soci-emoji` globally in `components/soci-components.js`.
  - Migrated custom emoji usage to `soci-emoji` in:
    - markdown rich-text decoration (`lib/soci-rich-text.js`),
    - text-channel reaction chips and picker (`components/soci-text-channel-view-threaded.js`),
    - inline token rendering + emoji suggestion rows in `soci-input` (`components/soci-input.js`),
    - personal/community emoji admin grids (`pages/admin/emojis.js`, `pages/community-emojis.js`).
  - Updated emoji CSS selectors to style `soci-emoji` hosts in emoji grids.
  - Follow-up polish:
    - removed legacy `.emoji` class attachment from `soci-emoji` usage paths,
    - sized markdown paragraph emojis to `21px` (`soci-markdown-view p soci-emoji`),
    - sized reaction-chip emojis to `14px` (`.reaction soci-emoji` in text-channel view).

## 2026-02-24 — Text channel composers moved to soci-input

- **Frontend (soci-frontend)**
  - Updated `components/soci-text-channel-view-threaded.js` to replace both channel composers (`#message-input` and `#thread-input`) from `textarea` to `soci-input`.
  - Preserved Enter-to-send behavior (Shift+Enter newline) by intercepting keydown in capture phase on `soci-input`.
  - Updated emoji picker insertion path to use `soci-input.insertText(...)` so selected emojis insert at the current cursor in the active composer.
  - Removed textarea-specific resize behavior in the text-channel composer (now no-op with `soci-input`-managed editing).
  - Added public `insertText(...)` method to `components/soci-input.js` for programmatic token insertion from external controls (emoji picker).

## 2026-02-24 — Markdown/user-input rich token rendering (emoji + mentions)

- **Frontend (soci-frontend)**
  - Added shared rich-text token utilities in `lib/soci-rich-text.js` for `:emoji:` and `@username` scanning plus DOM decoration helpers.
  - Updated `components/soci-markdown-view.js` to post-process parsed markdown with token-aware DOM decoration:
    - custom emojis render as inline images (`/emoji/:name.webp`) with text fallback on image load failure,
    - mentions render as `/user/:username` links,
    - token conversion skips code/unsafe contexts (`pre`, `code`, links, etc.).
  - Refactored `components/soci-input.js` from `textarea` to a `contenteditable` editor that:
    - preserves form-associated value as plain text,
    - renders inline emoji and mention tokens while editing,
    - supports dynamic suggestion menus for `@username` (from `/users/search`) and custom emojis (from emoji sets),
    - supports keyboard selection/acceptance for suggestions (arrow keys, Enter/Tab, Escape).
  - Removed legacy text-channel-only markdown emoji post-processing from `components/soci-text-channel-view-threaded.js` in favor of centralized `soci-markdown-view` behavior.
## 2026-02-23 — Community admin settings refactor

- **Frontend (soci-frontend)**
  - Added dedicated "Community settings" link to sidebar under "Submit post", visible to community admins.
  - Replaced inline admin links in the sidebar description block.
  - Added unified admin navigation header across `community-settings`, `community-users`, `community-financials`, and `community-emojis` pages.
  - Added a new `settings` icon in `soci-icon.js`.
  - Updated JS controllers for admin pages to properly rewrite header `soci-link` paths based on the active community URL.

- **Backend (soci-backend)**
  - Updated `localRun.sh` to include the same local LiveKit dev env defaults used by `nonio-tui`:
    - `LIVEKIT_URL=http://localhost:7880`
    - `LIVEKIT_API_KEY=devkey`
    - `LIVEKIT_API_SECRET=secret`
  - This keeps voice endpoints configured when backend is launched directly via `soci-backend/localRun.sh`.

## 2026-02-22 — Voice presence websocket reconnect diagnostics

- **Frontend (soci-frontend)**
  - Added targeted client-side diagnostics in `components/soci-sidebar.js` for voice presence websocket lifecycle:
    - open/start trigger logging (including reconnect attempt),
    - close/error logging (close code, reason, cleanliness, readyState),
    - reconnect scheduling/skip logging,
    - explicit stop/restart reason logging at call sites (auth, community change, logout, disconnect callback, reconnect).
  - This is instrumentation only; behavior is unchanged.

- **Backend (soci-backend)**
  - Added targeted server-side diagnostics in `httpd/handlers/voice_presence_ws.go`:
    - per-connection connect/disconnect logs (community, user ID, remote address, close reason),
    - current per-community client counts on connect/disconnect,
    - receive-loop termination logging,
    - initial snapshot sent logging,
    - broadcaster update logging (changes count + fanout client count).
  - This is instrumentation only; behavior is unchanged.
  - Follow-up diagnostics added for handshake-failure visibility:
    - explicit reject logs for each early-return branch (method/config/auth/community/membership),
    - upgrade-attempt and post-handler-return logs,
    - panic recovery with stack trace in `VoicePresenceWS`.

## 2026-02-22 — Text channel live message delivery over websocket

- **Backend (soci-backend)**
  - Added `GET /community/channel/ws` websocket endpoint (`httpd/handlers/channel_ws.go`) for channel-scoped realtime text message delivery with JWT auth and community membership checks.
  - Registered `/community/channel/ws` in `httpd/routes.go`.
  - Wired channel message create + thread reply create handlers to broadcast `channel.message.created` events to connected channel websocket clients.
  - Wired reaction toggles to broadcast `channel.message.reaction` events with authoritative per-emoji counts.
  - Follow-up fix: message create/reply now send/broadcast pointers (`&msg`) so custom channel-message JSON marshalling applies in both HTTP responses and websocket events (ensures `user` is populated).
  - Updated backend docs for the new route in `docs/sidebar.pug`, `docs/api/channels.pug`, and `docs/LLM.md`.

- **Frontend (soci-frontend)**
  - Added `window.api.channelMessages.wsUrl(...)` helper in `api.js`.
  - `soci-text-channel-view-threaded` now opens a channel websocket connection, handles reconnect with exponential backoff, and applies incoming `channel.message.created` events live.
  - Added live websocket handling for `channel.message.reaction` events so reaction chips/counts update across clients in real time.
  - Added per-window local-send dedupe markers so websocket echoes do not duplicate messages sent from the same browser window, while still allowing same-user activity from other windows/devices.
  - Hardened message normalization for websocket/local paths so user + timestamp always resolve (`user` and `date`, with `createdAt` fallback parsing).
  - Follow-up fix: resolved websocket-vs-response race by making local sends idempotent per message ID (upsert/merge instead of blind append), preventing duplicate rows when websocket arrives first.
  - Follow-up fix: timestamp normalization now treats digit-only strings as unix timestamps and parses ISO datetimes with `Date.parse`, preventing malformed `time="2026"` values.
  - Added live thread metadata updates (reply count + reply users) when thread replies arrive over websocket.

## 2026-02-22 — Text channel multi-image attachments + viewer

- **Frontend (soci-frontend)**
  - `soci-text-channel-view` now supports attaching multiple images on both main messages and thread replies.
  - Added composer thumbnail previews for pending attachments in both composers (`max-height: 80px`).
  - Added image paste support while composing in text channels and drag/drop image attach support across the full channel view surface.
  - Added fullscreen image viewer using `soci-modal`; clicking message thumbnails opens the viewer and supports left/right navigation for multi-image messages.
  - Message attachment thumbnails are now constrained to `max-height: 200px`.

- **Backend (soci-backend)**
  - Channel message create and thread reply create now accept `imageUrls` in addition to legacy `imageUrl`.
  - Message serialization now returns `imageUrls` while preserving `imageUrl` compatibility.
  - Message persistence stores multiple image references in the existing `image_url` field in a backward-compatible serialized form.

## 2026-02-15 — API docs migrated to soci-backend/docs

- **Backend (soci-backend)**
  - Created `soci-backend/docs/` and ported nonio-api-docs project (Node.js server, pug, stylus).
  - Updated all API docs to match current routes: fixed paths (/posts/:url, /comments query params), methods (POST notification/mark-read), added community scoping.
  - Added new sections: Communities, Channels, Voice, Stripe, Subscriptions, Admin, Emojis.
  - Added `LLM.md` (full API in markdown for LLM consumption), served at /LLM.md.
  - Added "LLMs" button in sidebar header that copies LLM.md to clipboard.
  - Updated AGENTS.md: docs must be updated when backend routes change.

## 2026-02-15 — nonio-tui now starts local LiveKit

- **Tooling (nonio-tui)**
  - Added a new `livekit` managed service entry (port `7880`) that runs `livekit-server --dev`.
  - Updated service startup order so LiveKit is started alongside backend/frontend/CDNs.
  - Added backend env defaults in TUI startup (`LIVEKIT_URL=http://localhost:7880`, `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret`) so voice endpoints are configured automatically in local runs.
  - Updated the TUI layout sizing math to account for dynamic service counts.
  - Updated `nonio-tui/README.md` service and requirement lists to include LiveKit.

## 2026-02-15 — Voice presence: websocket-based community activity

- **Backend (soci-backend)**
  - Added `GET /voice/presence/ws` websocket endpoint (community-scoped, token-authenticated, member-gated) in `httpd/handlers/voice_presence_ws.go`.
  - Added a shared in-process voice presence hub that tracks active websocket clients per community and broadcasts updates only to subscribed viewers.
  - Added server-side change detection for voice presence and broadcast events (`voice.presence.snapshot` on connect, `voice.presence.update` on participant changes).
  - Refactored `VoicePresence` (`POST /voice/presence`) to reuse shared voice presence snapshot logic (`getVoicePresenceChannels`).
  - Registered websocket route in `httpd/routes.go`.

- **Frontend (soci-frontend)**
  - Replaced sidebar voice presence interval polling with websocket connection lifecycle in `components/soci-sidebar.js`.
  - Added reconnect/backoff behavior for voice presence socket, scoped to the currently viewed community.
  - Sidebar now consumes realtime socket events (`voice.presence.snapshot` and `voice.presence.update`) to update `_voicePresenceByChannel` and re-render channel previews immediately.
  - Kept `_refreshVoicePresence()` as on-demand fallback for immediate local refresh paths.
  - Added `window.api.voice.presenceWsUrl(...)` helper in `api.js`.

## 2026-02-13 — Move `/user/:name` context into sidebar user panel

- **Frontend (soci-frontend)**
  - Added a dedicated `soci-sidebar-user-panel` view in `components/soci-sidebar-panel.js` and registered it in `components/soci-components.js`.
  - Sidebar now switches to `view="user"` on `/user/*` routes and falls back to `community` when leaving that route (`components/soci-sidebar.js`).
  - New user panel includes:
    - user switcher header with selected `soci-user`
    - Nonio + subscribed communities dropdown options
    - stats (posts, post karma, comments, comment karma)
    - self-only links (edit profile / view financials)
    - optional description render
    - posts/comments nav that drives main user-route content
  - Refactored `pages/user.pug` and `index.html` user route markup to remove the in-route `.sidebar`; route now keeps content only.
  - Refactored `pages/user.js` so posts/comments switching is driven by sidebar panel events (`user-tab`) and sort remains in the route header.
  - Added sidebar panel styling for the new user panel and simplified old `soci-route#user` layout rules in `soci.css`.
  - Added `soci-sidebar-user-panel` to sidebar markup (`sidebar.pug` and `index.html`).
  - Follow-up: converted user-panel actions (`edit profile`, `view financials`, `posts`, `comments`) to `soci-tag-li`.
  - Follow-up: grouped self links under an `Admin` section header in the user panel.
  - Follow-up: user panel now remains active on `/admin/settings` and `/admin/financials` routes.

## 2026-02-13 — Refactor: DRY community switcher + user panel cleanup

- **Frontend (soci-frontend)**
  - Created `soci-sidebar-switcher` component (`components/soci-sidebar-switcher.js`): reusable wrapper for the community option dropdown shared between the community panel and user panel. Handles option population, navigation on select, and "Create Community" action.
  - Both `soci-sidebar-community-panel` and `soci-sidebar-user-panel` now wrap their `soci-select` in `soci-sidebar-switcher`, eliminating duplicated select-event handlers and option-building code.
  - Removed `_onCommunitySelect` from `soci-sidebar.js` (switcher handles it).
  - Removed duplicated methods from user panel: `_onUserSwitch`, `_escapeAttr`, `_communityOptionHtml`, `_renderSwitcherOptions`.
  - Removed circular two-event round-trip (`user-tab` → `user-type-change`); panel now reads initial type from URL hash and updates its own nav state directly.
  - Removed `window.user` global from `user.js`; nuke button now uses `user-nuke` custom event instead of inline `onclick`.
  - Removed verbose try/catch in `_refreshFromRoute`; uses `.catch(() => ({}))` fallback.
  - Changed `<header id="user-panel-header">` to `<div>` (semantic fix: it's not page/section header content).
  - Changed financials glyph from `mail` to `info` (closer semantic match).
  - DRY-ed CSS: consolidated duplicate `h2`/`soci-tag-li` rules for `.admin-links` and `#user-content-nav` into a shared rule.
  - Removed unused `config` import from `soci-sidebar-panel.js`.

## 2026-01-08 — Reduce frontend bundle bloat + safer feed payloads

- **Frontend (soci-frontend)**
  - Replaced large inline SVG blocks in `soci-column` header controls with `soci-icon` glyphs (smaller HTML strings, shared icon defs)
  - Sidebar “All posts” icon now uses the same glyph as the header
  - Added shared helper `lib/post-filter.js` to DRY filter→type mapping
  - `soci-post-card` now uses the post list payload for descriptions (no per-card network request); masonry relayout is triggered on image/markdown load via `card-loaded`
  - `soci-post-card`: clicking media now navigates to the post
  - Extracted the post timestamp clock SVG into `soci-icon` as `time` glyph; `soci-post-li` now uses the shared icon
  - Added grid-lanes autoInit + style-injection logging to measure impact
  - `soci-post-list`: removed `ResizeObserver` “large” toggle; header control layout now uses `@media (min-width: 1025px)` instead
  - `soci-post-list` lanes/masonry: prevent initial vertical-list flicker by hiding cards until the grid-lanes polyfill marks them positioned, then fade+slide them in (shadow DOM-safe)

- **Backend (soci-backend)**
  - `/posts` list responses now truncate `content` to a short preview (max ~10 lines / 2000 chars) to avoid shipping full long-form content with every feed fetch
  - Fixed `/posts` handler crash (`fatal error: concurrent map writes`) by guarding `PostCache` with an RWMutex (concurrent requests were writing the global map)
  - Fixed `/posts` failing during tag enrichment when `posts_tags.tag_id` was `0` or referenced a missing tag row:
    - `models.GetPostTags()` now does a JOIN against `tags` (avoids N+1 lookups and drops dangling tag links instead of erroring)
    - `models.GetPostsByParams(sort=popular)` now uses `TIMESTAMPDIFF` for correct time units in the decay formula
  - Scoped tags to communities:
    - DB migration `00052_scope_tags_to_community.sql` makes tags unique by (`name`, `community_id`) instead of global `name` uniqueness
    - `/tags` and `/tags/:prefix` now properly resolve `?community=` (including `@slug`) and only return tags for that community
  - Scoped subscriptions to communities:
    - DB migration `00053_scope_subscriptions_to_community.sql` adds `subscriptions.community_id` (backfilled from tags) + a primary key `id`
    - `/subscriptions` now resolves `?community=` via `resolveCommunityID` and `models.User.GetSubscriptions` filters by `subscriptions.community_id`

## 2026-01-09 — Speed up backend `go test` by migrating DB once + truncating between tests

- **Backend (soci-backend)**
  - Tests in `models/` now run DB migrations **once** per package test run (instead of per test), then **TRUNCATE** tables between tests to keep isolation.
  - `00053_scope_subscriptions_to_community.sql` made robust for fresh DBs and partially-migrated DBs:
    - Fix MySQL AUTO_INCREMENT requirement (must be keyed)
    - Backfill `subscriptions.id` when present-but-duplicated before adding the primary key

## 2026-01-07 — Server-side type filtering + incremental post loading

- **Backend (soci-backend)**
  - Added `type` parameter to `PostQueryParams` struct in `models/post.go`
  - Added `?type=image|video|blog|link|audio` query parameter to `/posts` endpoint
  - Server-side filtering by post type for more efficient queries

- **Frontend (soci-frontend)**
  - Updated `soci-column.js`:
    - Refactored `sortPosts` and `filterPosts` to use shared `_buildPostsUrl()` method
    - Filter changes now trigger server request with `type` parameter
    - Two-step filtering: immediate CSS-based hiding + async server fetch for new posts
  - Added `fetchAndMerge()` method to `soci-post-list.js`:
    - Fetches filtered posts from server
    - Merges new posts that aren't already displayed
    - Animates new posts in with staggered fade+slide effect

## 2026-01-06 — Header bar reorganization + tag input

- **Frontend (soci-frontend)**
  - Reorganized `soci-column` header bar layout:
    - New layout: `[menu] [tag input] |--spacer--| [view toggle] | [sort] | [filter]`
    - Added `#tag-input`: 32px text input for navigating to tags
    - Input pre-populated with current tag (e.g. `#baseball` from URL)
    - Press Enter to navigate to typed tag (updates URL hash + triggers route)
    - Removed absolute positioning from controls, using flexbox layout
  - Fixed `soci-post-list` first child margin: removed margin-top from first `soci-post-li`, increased top padding to 12px

## 2026-01-06 — Fix video posts missing from feed (encoding flag fallback + better logging)

- **Backend (soci-backend)**
  - `models/post.go`: feed query now includes video posts stuck in `is_encoding=true` for >24h (fallback in case encoding-complete notify fails)
  - `models/post.go`: improved `MarkEncodingComplete` logging + detects “0 rows updated” to catch URL mismatches
  - `httpd/handlers/postEncodingComplete.go`: added request + success/error logs for encoding-complete notifications

## 2026-01-06 — Fix community “Who can post?” = All Users not allowing free users

- **Backend (soci-backend)**
  - `httpd/handlers/postCreate.go`: post creation now respects community `post_permission`; for community posts, **only** enforces `User.CanPost()` when `post_permission="paid"`.
  - `httpd/handlers/postHelpers.go`: added `resolveCommunity(...)` helper to share normalized slug + community lookup.

## 2026-01-05 — CSS Grid Lanes polyfill + post list view toggle

- **Frontend (soci-frontend)**
  - Added `lib/grid-lanes-polyfill.js`: a polyfill implementing CSS Grid Level 3 "grid lanes" (masonry/waterfall) layout
    - Based on [CSS Grid Layout Module Level 3 spec](https://drafts.csswg.org/css-grid-3/#grid-lanes-layout)
    - Auto-calculates column count based on container width and minimum column width (300px)
    - ResizeObserver re-layouts on any resize (updates column widths responsively)
    - MutationObserver for automatic re-layout when children change
    - Perf: coalesces repeated relayout requests to a single `requestAnimationFrame` and batches DOM writes/reads (reduces forced reflow thrash)
  - **Added `soci-post-card.js`**: New card component for masonry view (extends `soci-post-li`)
    - Different element order: Title → Media → Description (markdown) → Details bar → Tags
    - Fetches and renders post content as `soci-markdown-view`
    - Card-optimized styling: reduced heading sizes, max-height description with fade gradient
    - Fires `card-loaded` event when content/images load (triggers grid relayout)
  - Updated `soci-post-list.js`:
    - Added `view` attribute (`list` | `lanes`) to toggle between `soci-post-li` and `soci-post-card`
    - Caches posts data to allow view switching without re-fetching
    - Listens for `card-loaded` events to trigger grid relayout
  - Updated `soci-column.js`:
    - Added view toggle button group **centered in header** (list icon / masonry icon)
    - Toggle persists view preference to child `soci-post-list`
    - Hidden on mobile (< 768px) to save header space
  - Added card markdown styles to `soci.css` (h1-h3 reduced to 14px, compact paragraphs)

## 2026-01-04 — Switch email sending from Gmail OAuth2 to App Password

- **Backend (soci-backend)**
  - Changed all email sending from `utils.SendEmailOAUTH2()` to `utils.SendEmail()`:
    - `models/user.go` (forgot password)
    - `httpd/handlers/userBan.go` (ban notification)
  - Simplified email sending to use Gmail SMTP with App Password instead of OAuth2 (which had token expiry issues)
  - Updated `localRun.sh` and `migrateQuill.sh` to clarify `ADMIN_EMAIL` and `ADMIN_EMAIL_PASSWORD` are for Gmail App Password
  - Removed unused OAuth env vars (`EMAIL_ACCESS_TOKEN`, `EMAIL_REFRESH_TOKEN`, `EMAIL_CLIENT_ID`, `EMAIL_CLIENT_SECRET`) from shell scripts
  - Extended forgot password token expiry from 1 hour to 24 hours (workaround for local dev timezone mismatch between Go and MySQL)

## 2025-12-16 — Dev activity simulator + daily payout cycle (dev-only)

- **Backend (soci-backend)**
  - Added **dev-only subscription-funded payout scheduling**: `DEV_SUBSCRIPTION_PAYOUTS=true` enables a scheduler that creates future `payouts` rows for users with `subscription_amount > 0`, using `PAYOUT_CYCLE_DAYS` (set to `1` for daily).
  - Added **dev-only endpoint** `POST /dev/user/set-subscription` (requires `DEV_TOOLS_ENABLED=true`) to set the authenticated user’s `subscription_amount` and ensure a corresponding future payout exists.
  - Updated `soci-backend/localRun.sh` to default these flags on for local testing:
    - `DEV_TOOLS_ENABLED=true`
    - `DEV_SUBSCRIPTION_PAYOUTS=true`
    - `PAYOUT_CYCLE_DAYS=1`

- **Simulator (new project: non-framework Node.js)**
  - Added `nonio-simulator/` which:
    - Bootstraps **multiple users** and assigns each a **different subscription amount** (via `/dev/user/set-subscription`).
    - Runs an **every-1-minute** activity loop:
      - **5%** create a post (blog/image). Image posts use fal.ai Z-Image Turbo and upload to `soci-image-cdn`.
      - **95%** tag/upvote/tag-create interactions; sometimes reads comments, upvotes, and replies.
    - Uses **Grok (xAI)** for action/content selection and to generate **distinct personas** (background/personality/interests/tag prefs).
    - Sets each sim user’s **profile description** using `POST /user/update-description`.
    - Gives each sim user an **avatar** by generating an image (fal.ai) and uploading it to `soci-avatar-cdn` (`AVATAR_HOST`, default `http://localhost:4202`).
    - Persists sim users/personas/tokens in `nonio-simulator/.sim-state.json`.

- **Known issue / next work**
  - Rich text on the site is **Quill JSON**, but simulator content is currently **plain text** in `content`.
  - Next agent will migrate rich-text handling to **markdown** (or otherwise align simulator output with the site’s rich-text format).

## 2025-12-22 — Sidebar light-DOM refactor (slots + logged-out behavior)

- **Frontend (soci-frontend)**
  - Moved sidebar default markup to **light DOM** via `soci-frontend/sidebar.pug` (included from `soci-frontend/index.pug`).
  - `soci-sidebar` now exposes:
    - `<slot name="user">`
    - default `<slot>` (community/tags + panels)
    - `<slot name="footer">`
  - Renamed panels: **`#auth` → `#community`**, **`#noauth` → `#login`**.
  - Logged-out users now still see **community + tags**; **subscribed tags are hidden** until authenticated; login view only shown via explicit action (footer “Login”).
  - Migrated sidebar styles into `soci-frontend/soci.css` and scoped user-route styles from `#user` to `soci-route#user` to avoid collisions with sidebar’s `section#user`.

## 2026-01-03 — Login-required modals for gated actions (create community / tag interactions)

- **Frontend (soci-frontend)**
  - Added a reusable `window.soci.requireLogin(...)` helper that opens a `soci-modal` explaining login is required.
  - Gated:
    - Sidebar community switcher “Create Community”
    - Tag upvotes
    - Adding a tag to a post

## 2026-01-04 — Sidebar simplification + links filter

- **Frontend (soci-frontend)**
  - Sidebar: removed pseudo-filters (**Images / Videos / Blogs**) from the sidebar list; kept **All posts** and added **Submit post** under it.
  - Feed filters now live strictly in `soci-column`; added **Links** filter (before Images) and added post-list filtering support for link posts.

## 2026-01-03 — Fix "Subscribed Tags" section animation

- **Frontend (soci-frontend)**
  - Fixed the "Subscribed Tags" section in the sidebar snapping in instead of animating. Multiple issues:
    1. CSS `transition: all` is unreliable for `height` - changed to explicitly list `height`, `min-height`, `opacity`
    2. The function was being called multiple times in quick succession (race from async tag loaders) - added `_subscribedListAnimating` guard
    3. Inline `height: 0px` from HTML needed to be cleared first to measure natural height, then reset to 0, then animate
    4. Changed from calculated height formula to measuring actual `offsetHeight` to avoid snap-back at animation end

## 2026-01-03 — Remove live preview from soci-input

- **Frontend (soci-frontend)**
  - Removed live markdown preview from `soci-input` component (the preview that appeared below the textarea while editing)
  - Simplified component by removing preview-related HTML, CSS, and JS (focus/blur handlers for toggling preview visibility)

## 2026-01-03 — Mobile sidebar and post list fixes (hamburger close + footer + delete)

- **Frontend (soci-frontend)**
  - Added hamburger close button in mobile sidebar overlay: hamburger icon floats (position absolute) over the community selector on the left
  - Added 40px left padding to selected `soci-option` in mobile overlay to make room for the hamburger
  - Fixed footer (`#sidebar-user`) width in mobile view: now fills 100% width instead of being stuck at 280px
  - Mobile header is rendered in sidebar's shadow DOM with `:host([overlay])` scoped styles
  - Hid delete link on `soci-post-li` elements in mobile view to prevent accidental deletions and save space
  - Stacked `.sidebar` and `.content` vertically on the user page (`soci-route#user`) for mobile view, allowing natural scrolling of the profile followed by their posts/comments


## 2026-02-13 — Remove user route header (moved controls to sidebar panel)

- **Frontend (soci-frontend)**
  - Removed the `<header>` block from `pages/user.pug` so the user route no longer renders duplicated in-page controls.
  - Simplified `pages/user.js` by removing header click wiring and deleting the now-unused `headerClick` + mutable `sort` state; user content requests now always use `sort=top`.
  - Scoped the old header UI CSS in `soci.css` to notifications only, so stale `#user` header selectors are no longer carried in the user route styles.

## 2026-02-14 — Sidebar user-route DRY refactor + nav active fix

- **Frontend (soci-frontend)**
  - Removed duplicate user-route detection from `soci-sidebar-user-panel`: deleted panel-side route regex parsing and `hashchange`/`popstate`/`link` listeners.
  - Added a single user-route resolver in `soci-sidebar` (`_resolveUserRouteState`) and route-state handoff to the user panel (`setRouteState`) from `_onRouteChange`.
  - Kept route matching behavior centralized in sidebar routing flow, so user panel now renders from sidebar-provided `username` + `section` context.
  - Fixed sidebar user nav highlighting so active state now correctly reflects `posts`, `comments`, `edit profile` (`/admin/settings`), and `view financials` (`/admin/financials`) routes.
  - Updated user-panel refresh flow to avoid unnecessary profile refetches while still updating active nav state when only route section/hash changes.

## 2026-02-14 — Move sidebar auth/create flows into top-level modals

- **Frontend (soci-frontend)**
  - Moved `soci-sidebar-login-panel`, `soci-sidebar-account-creation`, and `soci-sidebar-create-community-panel` out of the sidebar and into dedicated top-level `soci-modal` containers in `index.pug`.
  - Simplified sidebar view semantics so sidebar panels remain route/context-driven (`community` / `user`) while login/create flows are modal actions.
  - Rewired sidebar actions (`showLogin`, signup click, create community from selector) to open the new modals, and added modal close coordination (`closeSidebarAuthModals`) after successful login/community creation.
  - Updated modal panel logic to resolve sidebar context from either local ancestry or global `soci-sidebar`, so existing login/register/create-community submit behavior still calls shared sidebar refresh/auth flows.
  - Added explicit modal-scoped CSS for the moved flows in `soci.css`, including login footer link styling and create-community form/error styles.
  - Fixed `soci.showRegister()` to call the real sidebar API (`showCreateAccount`) instead of a non-existent `_createAccount()` method.

## 2026-02-14 — Modal components directory + lazy modal manager

- **Frontend (soci-frontend)**
  - Added `components/modals/` with one file per modal component: `soci-login-modal`, `soci-create-account-modal`, and `soci-create-community-modal`.
  - Added `components/modals/soci-modal-manager.js` as a small registry-based, lazy-loaded modal manager (`open`, `close`, `closeAll`) that dynamically imports each modal component only when first opened.
  - Removed static auth/create modal instances from `index.pug`; auth/create modals are now mounted on demand and removed on close to avoid idle DOM pollution.
  - Updated `soci-modal` to dispatch lifecycle events (`modalactivate`, `modaldeactivate`) so modal cleanup can be event-driven without mutation observers.
  - Simplified `soci-sidebar` modal integration: removed observer-based syncing and legacy panel activation toggling; sidebar now delegates to modal manager APIs directly.
  - Removed legacy auth/create panel classes from `components/soci-sidebar-panel.js`; file now contains sidebar panel components only.
  - Cleaned stale sidebar-scoped CSS for legacy `#login/#create/#create-community` panel blocks and retargeted modal styles to the new modal custom-element selectors.

## 2026-02-14 — Event-driven auth modals + standard styling

- **Frontend (soci-frontend)**
  - Decoupled `soci-login-modal`, `soci-create-account-modal`, and `soci-create-community-modal` from `soci-sidebar`. They now dispatch `auth-login`, `auth-signup`, and `community-created` events on `window`.
  - Updated `soci-sidebar` to listen for these global events instead of injecting callbacks or methods into the modals.
  - Standardized modal CSS: added `.modal-form` and `.modal-footer` classes in `soci.css` and applied them to all auth/create modals for consistent layout.
  - Centralized component registration: modals are now imported and defined in `soci-components.js` (eagerly loaded) rather than self-defining or lazy-loading, matching the project pattern.
  - Updated `soci-modal-manager.js` to support a `register()` API (extensibility) and updated its default registry to use the eagerly-loaded components.
  - **UX Improvements**:
    - `soci-create-account-modal`: Added Enter key submission support and auto-close (500ms delay) on success, matching login behavior.
    - `soci-create-community-modal`: Added Enter key submission support. 

## 2026-02-15 — Text channel threads/reactions/emojis + emoji admin surfaces

- **Backend (soci-backend)**
  - Added thread + reaction + emoji metadata APIs and route registration for text channels (`/community/channel/thread`, `/community/channel/message/react`, `/community/emojis`, `/community/emoji/create`, `/emoji/create`, `/emojis/sets`, `/emoji/subscribe`, `/emoji`).
  - Added message model support for `parentID`, `replyCount`, and reaction summaries, including reaction toggle and metadata hydration helpers for list responses.
  - Added emoji metadata model helpers for community-owned, user-owned, subscribed, and default emoji sets.
  - Added migration for threaded messages, message reactions, emoji metadata, and user emoji subscriptions.

- **CDN (soci-avatar-cdn)**
  - Added `type=emoji` upload handling with deterministic keys for community/user scopes.
  - Added emoji encoder pipeline for 64x64 WebP output with animated GIF -> animated WebP conversion support.

- **Frontend (soci-frontend)**
  - Added message-row hover actions (reply/react), hover clock timestamp gutter, and reactions slot rendering hooks.
  - Added threaded text-channel UX: right-side thread panel on desktop and single-column thread view with back arrow on narrow screens.
  - Added reaction chips + emoji picker with default/community/personal/subscribed sets; picker supports reacting or token insertion (`:e<ID>:`).
  - Added markdown emoji token rendering and right-click subscribe behavior for rendered custom emojis.
  - Added community emoji admin page and personal emoji admin page with upload+register flows.
  - Wired sidebar/admin routes for community/user emoji management.

## 2026-02-21 — Thread reply avatar stacks on message rows

- **Backend (soci-backend)**
  - Added `replyUsers` metadata to channel message responses by hydrating top reply participants (up to 5, ordered by reply frequency per parent message).

- **Frontend (soci-frontend)**
  - Updated `soci-message-row` reply chips to render a stacked avatar strip before the reply count text.
  - Wired threaded channel rendering to pass `replyUsers` through to rows and refresh row avatar stacks when thread data loads or new replies are sent.

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

## 2026-08-18 — Speed lab Qwen track: iteration 2 (REVERT)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 2 hypothesis: the confirmed duplicate startup `GET /posts` (two identical 6844 B requests from `soci-post-list` init — `sort` setAttribute → `_refreshData`, then `filter` setAttribute → `_refreshFilterFetch`) delays LCP.
  - One-line guard in `soci-post-list.js` `fetchAndMerge` (`if(url === this._currentDataUrl) return`); measured via `run_baseline.py`: cold 622.9/1055.6, warm 623.1/1074.0 (FCP/LCP medians) vs iter1 targets 624.2/1096.3 and 623.8/1056.4 — all deltas inside run-to-run noise.
  - REVERTED the code change (no commit); lab record + key finding appended to `speed-lab/SPEED_LAB.md`, raw metrics in `speed-lab/metrics/baseline-iter2.json`.
  - Key finding: FCP/LCP are not data-fetch-bound — all resources load by ~119 ms, TBT 0, yet FCP ~625 ms / LCP ~1055–1113 ms; iter3 target is the ~500–980 ms post-load paint gap (desktop CPU-throttle multiplier, staggered render, or remaining eager assets: `soci-sidebar.js` 53 KB, `soci-post-list.js` 28.5 KB, `markdown.wasm`).

## 2026-08-18 — Speed lab Qwen track: iteration 4 (REVERT)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 4 hypothesis (iter3 follow-up): defer only the six per-route page scripts (`post.js`, `user.js`, `notifications.js`, `admin/{subscribe,settings,financials}.js`) while keeping `markdown.js`/`markdown.wasm` eager — capture the ~61 ms FCP win without the `markdown.wasm`-init LCP cost blamed for iter3's regression.
  - One `defer` attr per script tag across 6 `.pug` files (zero JS changes); bootstrap safety re-verified (`document.currentScript.closest('soci-route')` + `DOMContentLoaded` init survive `defer`).
  - Measured via `run_baseline.py`: cold FCP median 549.5 (−74.7 vs iter1 624.2), warm FCP 551.2 (−72.6); but cold LCP median 1154.3 (+58.0 vs 1096.3), warm LCP 1139.9 (+83.5), TTI +67.5/+83.2. All 3 cold LCP runs (1148.6–1215.7) exceed iter1's worst (1098.2) and all 3 warm (1133.2–1208.9) exceed iter1's worst warm (1076.3) ⇒ real regression, not noise.
  - REVERTED (six `.pug` files checked out; submodule clean at `115703b`); no commit. Lab record + raw metrics appended to `speed-lab/SPEED_LAB.md` (`speed-lab/metrics/baseline-iter4.json`).
  - Key finding: iter3's follow-up falsified — `markdown.wasm` init was **not** the LCP cost; deferring even six small per-route scripts still delays the JS-painted LCP node while static-shell FCP improves ~73 ms in both lanes. Combined with iter3: unblocking mid-body parse reliably buys ~60–75 ms FCP at a ~58–112 ms LCP/TTI cost, with or without `markdown.js` deferred. Stop optimizing parse-blocking; next target is the painted LCP node itself (`div#placeholder` in `soci-post-list` + the ~500–980 ms post-load paint gap).

## 2026-08-18 — Speed lab Qwen track: iteration 5 (REVERT)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 5 hypothesis (iter4 follow-up): the LCP node (`div#placeholder` "Viewing all tags" in `soci-post-list` shadow DOM) is created by `tags.js` post-parse (`lazyload` → `onActivate` → `createElement`); a static `<soci-post-list tag="all">` in `pages/tags.pug` would upgrade during eager module evaluation and paint the placeholder as early as FCP. `pages/tags.js` `onActivate` now reuses the static element (sets/removes `tag`/`community`) instead of clearing and creating.
  - Measured via `run_baseline.py`: cold median 623.4/1088.8 (FCP/LCP), warm median 603.2/1069.8 vs iter1 targets 624.2/1096.3 and 623.8/1056.4 — cold LCP −7.5 ms, warm LCP +13.4 ms, warm FCP −20.6 ms: mixed deltas inside the ~40 ms run-to-run LCP spread. Not "overall faster."
  - REVERTED (both `.pug`/`.js` files checked out; submodule clean at `115703b`); no commit. Lab record + raw metrics appended to `speed-lab/SPEED_LAB.md` (`speed-lab/metrics/baseline-iter5.json`).
  - Key finding: element *availability* is not the LCP gate — the placeholder is laid out by ~FCP no matter who creates it; LCP stays pinned ~1050–1092 ms in every run since iter1. Also: `lcp-breakdown-insight` is unreliable for shadow-DOM pseudo-element LCP nodes (claims TTFB 59 ms + render delay 110 ms vs the actual 1092 ms LCP metric). Next targets: verify from the trace whether a later, larger node *replaces* the placeholder as the final LCP candidate; trim remaining eager home modules (`soci-sidebar.js` 53 KB, `soci-post-list.js` 28.5 KB); reduce staggered `createPosts` re-layout.

## 2026-08-18 — Speed lab Qwen track: iteration 6 (KEEP)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 6 hypothesis (iter5 follow-up): trim the biggest remaining eager home module — move the voice/LiveKit subsystem out of `soci-sidebar.js` (53.1 KB → 34.7 KB, −18.4 KB) into `soci-frontend/components/voice/soci-voice.js` (19.8 KB), dynamically imported only by authenticated voice use; `_startVoicePresenceSocket` gated on `authToken` so the anonymous home path never loads it.
  - Measured via `run_baseline.py`: cold median 587.4/1052.8 (FCP/LCP), warm median 584.4/995.5 vs iter1 targets 624.2/1096.3 and 623.8/1056.4 — all six FCP runs (584.0–605.1) and all six LCP runs (cold 1018.6–1054.2, warm 976.3–1035.5) beat iter1's worst ⇒ real, not noise. CDP smoke: 21 fixture posts, sidebar upgraded, 0 exceptions, 0 console errors, zero fetches of the voice module on the anonymous path.
  - KEPT and committed (`qwen-iter6` in superrepo + submodule): sidebar `53,134 → 34,689 B`, new `components/voice/soci-voice.js`. Lab record + raw metrics in `speed-lab/SPEED_LAB.md` / `speed-lab/metrics/baseline-iter6.json`. New Qwen-track best: cold 587/1053, warm 584/996.
   - Key finding: confirms the iter2–iter5 paint-gap story — the ~500–980 ms post-load-idle gap is driven by eager module parse/eval cost; shaving home-path-dead JS moves both FCP and the JS-painted LCP node. Next targets: `soci-post-list.js` (28.5 KB, largest remaining eager home module); verify from the trace whether a later, larger node replaces the placeholder as the final LCP candidate.

## 2026-08-19 — Speed lab Qwen track: iteration 8 (REVERT)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 8 hypothesis (iter6/7 next-hypothesis b, restated as the last paint-gate candidate): the default-view feed fades in as a unit (`#items` `opacity:0; translateY(12px)` → 0.35s transition on `[loaded]`); the LCP node `div#placeholder` is a child of `#items`, so it can't be contentful-painted while the container is at zero opacity. Making `#items` visible from first paint should move the placeholder's LCP ~350 ms earlier, zero extra bytes.
  - Measured via `run_baseline.py`: cold median 604.9/998.0, warm median 585.0/1036.5 (FCP/LCP) vs iter6 587.4/1052.8 and 584.4/995.5. Trade, not a win: cold LCP −54.8 and cold TTI −49.0, but cold FCP +17.5 (all three runs 604.3–605.1 = signal) and warm LCP +41.0 / warm TTI +37.1. Not "overall faster" ⇒ REVERT.
  - REVERTED (edit-tool restore of the `#items` CSS block; `soci-frontend` submodule clean at HEAD = iter1+iter6 kept state; no commit, matching iter2/4/5 precedent). Lab record + raw metrics in `speed-lab/SPEED_LAB.md` / `speed-lab/metrics/baseline-iter8.json`.
  - Key finding: the paint-gate hypothesis is only partially real — removing the fade does move LCP, but making the whole feed visible at first paint enlarges the first-paint region and costs ~17 ms cold FCP and ~41 ms warm LCP. Sharpened next lever: make `#items` non-zero-opacity at first paint *without* enlarging the first-paint region (e.g. fade an overlay, not the content container), or trace-verify whether the placeholder is the true final LCP candidate at all. Qwen-track best remains iter6: cold 587/1053, warm 584/996.

## 2026-08-19 — Speed lab Qwen track: iteration 9 (REVERT)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 9 hypothesis (iter6/7/8 next-hypothesis c): list-view `createPosts` appends the posts past the first viewport slice **one per `requestIdleCallback`**, each append forcing its own layout cycle interleaved with the 0.35s `[loaded]` opacity ramp; batch the remainder (5 cards per idle tick, one `innerHTML` join) to cut layout churn. No `#items` CSS touched; initial slice unchanged.
  - Measured via `run_baseline.py`: cold median 604.2/1019.9, warm median 605.2/1000.6 (FCP/LCP) vs iter6 587.4/1052.8 and 584.4/995.5. Trade, not a win: cold LCP −32.9 (best cold run 977.3 = track-best) but cold FCP +16.8 and warm FCP +20.8 (all three warm runs 605.2–605.5), warm LCP/TTI +5.1. Not "overall faster" ⇒ REVERT.
  - REVERTED (`git checkout -- components/soci-post-list.js` in the submodule; superrepo working tree at iter6 kept state; no commit, matching iter2/4/5/7/8 precedent). Lab record + raw metrics in `speed-lab/SPEED_LAB.md` / `speed-lab/metrics/baseline-iter9.json`.
   - Key finding: the staggered-re-layout hypothesis is **falsified** as an LCP lever — the LCP candidate is already in the DOM via the synchronous initial slice before any idle callback fires, so batched vs per-card appends only change below-the-fold layout frequency. The LCP timestamp is set by when `#items` first becomes non-zero-opacity (per iter8), not by append timing. Also: the ~605 ms cold-FCP cluster reappeared (2 of 3 cold runs; iter8 had all 3) from a change that cannot affect first paint — treat the 585/605 cold-FCP bimodality as an environmental run-to-run variable in future keep calls. Qwen-track best remains iter6: cold 587/1053, warm 584/996. Next lever: overlay/veil fade so `#items` is non-zero-opacity at first paint without enlarging the first-paint region.

## 2026-08-19 — Speed lab Qwen track: iteration 10 (REVERT)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 10 hypothesis (iter9 next-hypothesis a, sharpened iter6/7/8 (b)): keep `#items` at full opacity from first paint *without enlarging the first visible contentful region* — fade a non-contentful `#items::before` background veil (solid `var(--bg-bold)` = the host's own background, so visually indistinguishable; solid-color paint is not contentful, so FCP should stay the small header/input region) instead of the content container.
  - Measured via `run_baseline.py`: cold median 605.4/1057.3, warm median 605.0/1037.6 (FCP/LCP), TTI 1057.5/1039.8 vs iter6 587.4/1052.8 and 584.4/995.5 (TTI lock 1052.9/1001.5). No win on any metric: cold FCP +18.0, cold LCP +4.5 vs lock (+37.4 vs iter9), warm FCP +20.6, warm LCP +42.1, TTI +4.6/+38.3 ⇒ "overall slower" ⇒ REVERT. All seven runs landed in the known slow environmental clusters (FCP ~604.9–607.0, warm LCP/TTI ~1037–1040) — noted in the lab record, not used to excuse a keep.
  - REVERTED (`git checkout -- components/soci-post-list.js` in the submodule; superrepo working tree at iter6 kept state; no commit, matching iter2/4/5/7/8/9 precedent). Lab record + raw metrics in `speed-lab/SPEED_LAB.md` / `speed-lab/metrics/baseline-iter10.json`.
  - Key findings: (1) `soci-post-li :host` is `position: relative`, so cards always paint *above* the veil — the variant effectively reduces to "drop the container fade + fade a background rectangle", strictly weaker than iter8 (which dropped the fade outright), yet produced **no** cold LCP win: "non-zero container opacity at first paint" is therefore **not** what bought iter8's −54.8 ms cold LCP; the prime suspect is now the `transform: translateY(12px)` composited layer iter8 also removed. (2) Correction to the iter8 log: in the `soci-post-list` template, `div#placeholder` sits in the sticky *header*, a **sibling** of `#items`, not a child — the container opacity never directly gated the placeholder; the true final LCP node remains unidentified (Lighthouse attributes a 238×17 placeholder while LCP fires ~300–450 ms after the feed + first thumbnail are visible in frame shots). Qwen-track best remains iter6: cold 587/1053, warm 584/996. Next lever: drop *only* `transform: translateY(12px)` from `#items` (keep the opacity ramp) to isolate the composited-transform hypothesis; in parallel, trace-level identification of the true LCP node.

## 2026-08-19 — Speed lab Qwen track: iteration 11 (REVERT)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 11 hypothesis (iter10 next-hypothesis a): isolate the composited-transform suspicion — drop *only* `transform: translateY(12px)` (plus the lanes `transform: none` cancel and the `[loaded]` `translateY(0)`/transform-transition) from `#items` in `soci-post-list.js`, **keep** the `opacity: 0 → 1` `[loaded]` ramp. If the composited layer was the LCP gate, this should reproduce iter8's cold-LCP win without its FCP cost.
  - Measured via `run_baseline.py`: cold median 604.2/1085.5 (FCP/LCP), warm median 604.7/1067.5 vs iter6 587.4/1052.8 and 584.4/995.5 (+16.8/+32.7 cold, +20.3/+72.0 warm) — no win on any lane ⇒ REVERT. 21-post fixture smoke OK before and after; TBT 0, score 0.98 on all 7 runs.
  - REVERTED (`git checkout -- components/soci-post-list.js` in the submodule; working tree back at iter1+iter6 kept state; no commit, matching iter2/4/5/7/8/9/10 precedent). Lab record + raw metrics in `speed-lab/SPEED_LAB.md` / `speed-lab/metrics/baseline-iter11.json`.
  - Key finding: the composited-transform hypothesis is **not supported** — transform removed, ramp kept ⇒ no LCP win anywhere, and iter10 (fade removed, visibility kept) also won nothing; the opacity-ramp gate (or iter8's win being a within-run artifact) now explains both. Also: warm FCP drifted +20 ms (585 → ~605) across iter8→iter11 **on identical pristine code** — machine-state cluster is now a larger confound than most deltas chased. Qwen-track best remains iter6: cold 587/1053, warm 584/996. Next: re-baseline pristine HEAD once to re-anchor the keep-bar before any further fade work; then trace-identify the true final LCP node.

## 2026-08-19 — Speed lab Qwen track: iteration 12 (CALIBRATION — no code change)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 12 (iter11 next-hypothesis c): pristine re-baseline with **no code change** to re-anchor the keep-bar — warm FCP had drifted +20 ms (585 → ~605) across iter8→iter11 on the *same* reverted pristine code, so the machine-state confound now out-sizes most deltas chased in this track.
  - Measured via `run_baseline.py` on pristine iter1+iter6 state (submodule verified clean at `faf6932`, 21-post smoke OK): cold median 604.8/1054.3, warm median 604.8/998.8 (FCP/LCP), TTI 1054.4/1000.8; TBT 0, score 0.98.
  - Reading: the **FCP floor shifted but LCP did not** — all three cold FCP runs sit in the ~605 cluster and warm FCP is bimodal 585/605; LCP/TTI reproduce the iter6 bar within noise (+1.5/+3.3 LCP, +1.5/−0.7 TTI). Future deltas compare FCP against the 604.8/604.8 floor (the old 587.4/584.4 FCP bar is unreachable in the current window) and LCP/TTI against the iter6 bar (1052.8/995.5, TTI 1052.9/1001.5). Keep rule unchanged.
  - Log corrections recorded: iter8's "cold FCP +17.5 cost" was **environmental** (pristine now measures the identical ~605 cold-FCP cluster), so iter8's only true cost was warm LCP +37.7 and its cold-LCP win stands (−56.3 vs the re-anchored floor); iter11's REVERT is confirmed against the re-anchored floor (cold LCP +31.2, warm LCP +68.7 = genuine regression, not drift); iter10's "no win" reading unchanged (the `::before` veil ate the entire iter8-style gain, +~59 ms).
  - No commit (no code change, matching the REVERT precedent). Lab record + raw metrics in `speed-lab/SPEED_LAB.md` / `speed-lab/metrics/baseline-iter12.json`.
  - Qwen-track best remains iter6: cold 587/1053, warm 584/996. Next: the fade/transform space is exhausted (iter10/iter11) and the pre-committed branch is either forbidden (static first-card markup) or needs the currently-forbidden CDP trace machinery (true-LCP-node identification); the only remaining never-retried non-forbidden candidate is lazy-splitting the lanes-view code out of `soci-post-list.js` (~8 KB beyond iter7's already-lazy polyfill) — but iter7's direct precedent (same lever family, ~8 KB, no win) implies a near-zero expected delta, so the direction call is pending.

## 2026-08-19 — Speed lab Qwen track: iteration 13 gate closed (no code change)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - iter13 candidate from the iter12 log: lazy-split lanes-view machinery out of `soci-post-list.js`. Gate reviewed before any implementation or measurement.
  - Movable mass without the eager `grid-lanes-polyfill.js` import is only ≈6 KB (lanes methods ~4.5 KB + lanes CSS ~1.3 KB + lanes radio template ~0.2 KB), below the pre-committed ~8 KB threshold. Including the 7,940 B polyfill makes the change a strict superset of iter7, which already regressed LCP +38.4 ms cold / +66.0 ms warm and was reverted.
  - `speed-lab/opencode-prompt.md` contains no independent locked do-not-retry list; the only explicit locked lab branch is structural/static first-card markup. The lanes split is formally non-forbidden but is not worth spending a measurement cycle on given iter7's direct precedent and the iter7 conclusion that `soci-post-list.js` is on the LCP critical path.
  - No code changed, no baseline run, no commit. Gate recorded in `speed-lab/SPEED_LAB.md`.
  - Decision now required: (b) un-forbid CDP true-LCP-node tracing, (c) re-scope the frozen static/structural markup idea with measured impact, or (d) pause at the iter6 kept state.

## 2026-08-19 — Speed lab Qwen track: iteration 14 (KEEP — biggest win of the lab)

- **Speed lab** (`speed-lab/`, branch `cursor/speed-lab-qwen-nonio`, never merge)
  - Iteration 14 hypothesis (never tried before): the warm lane was a full re-download storm because the node dev server on :4200 sends **zero** cache headers (verified: no `Cache-Control`/`ETag`/`Last-Modified` on any JS/CSS) → uncacheable, so every warm Lighthouse pass re-downloaded the entire JS/CSS set. This explains iter0's warm≈cold anomaly.
  - Fix: `soci-frontend/index.js` `handler.file` sends `Cache-Control: public, max-age=31536000, immutable` for js/css/wasm/images/fonts; HTML + mp4 range path + separate :4201 API untouched. Smoke: 21 fixture posts.
  - Measured via `run_baseline.py`: cold median 606.4/961.4, warm median **217.0/470.1** (FCP/LCP) vs bar FCP 604.8/604.8, LCP 1052.8/995.5 (iter6). Warm FCP −387.8, warm LCP −525.4, score 0.98→1.00; cold LCP also −91.4, cold FCP +1.6 (noise band). Warm runs tightest cluster of the lab (217.0/217.4/217.0).
  - **KEPT and committed** as `qwen-iter14` (superrepo gitlink bump + submodule `c43db4f`). New Qwen-track best: cold 606.4/961.4, warm 217.0/470.1. Lab record + raw metrics in `speed-lab/SPEED_LAB.md` / `speed-lab/metrics/baseline-iter14.json`.
  - Key finding: the missing-cache-header property of the harness's static server, not the app code, set the warm ceiling for all 13 prior iterations. All prior warm numbers are superseded.

## 2026-08-19 — Speed lab Qwen track: iteration 15 (REVERT)
- Hypothesis: lazy-load the 5 modal components (≈15 KB, 5 module fetches) off the eager barrel via the existing `config.load` hook in `soci-modal-manager.js`; modals are only ever created on demand.
- Measured via `run_baseline.py`: cold FCP 585.6 (−20.8 vs bar) but cold LCP/TTI +56.6/+55.9; warm LCP/TTI +20.1/+18.1; warm FCP dead tie at 217.0. Third confirmation of the FCP↔LCP module-graph timing trade (iter7, iter8 pattern).
- **Reverted** (both files back to submodule `c43db4f` state); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14).
- Remaining non-forbidden candidates: (b) content-hash filenames, (c) small CSS/paint tweak; or close out at the iter14 state. Full log in `speed-lab/SPEED_LAB.md`.

## 2026-08-19 — Speed lab Qwen track: iteration 17 (REVERT)
- Hypothesis: make `pages/tags.js` (home route, creates the LCP element's host `soci-post-list`) the 4th eager head module instead of the DCL lazy fetch, so feed creation lands ~1 tick after parse.
- Measured via `run_baseline.py`: warm LCP 450.2 (−19.9 vs bar) but cold FCP 623.6 (+17.2, tight cluster — real) and cold LCP 994.8 (+33.4); warm FCP exact tie at 217.0. Fourth confirmation of the FCP↔LCP module-graph timing trade (iter7, iter8, iter15 pattern): buying the warm lane with an eager home-route script spends the cold lane.
- **Reverted** (all 3 edits back to submodule `c43db4f` state; `pages/tags.pug` restored); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14). Note: lab log has no iter16 entry (launch script exists, unrecorded). Remaining candidates: (b) content-hash filenames, (c) small CSS/paint tweak, or close out at iter14. Full log in `speed-lab/SPEED_LAB.md`.

## 2026-08-19 — Speed lab Qwen track: iteration 19 (REVERT)
- Hypothesis: LCP ≈ `[loaded]`-flip + the 0.35s `#items` opacity ramp (470.1 warm / 961.4 cold = flip + 350 on both lanes); shortening the ramp to 0.12s (keeping fade + transform — not the forbidden wholesale removal) should cut ≈230 ms off LCP if Blink's LCP fade-in-delay rule is charging the ramp onto the feed card.
- Measured via `run_baseline.py`: **opposite effect** — cold LCP 1179.2 (+217.8), warm LCP 523.9 (+53.8), warm FCP 237.4 (+20.4, the documented environmental drift band); cold FCP 599.2 (noise). No lane faster.
- **Reverted** (1-line CSS change in `soci-post-list.js` restored to submodule `c43db4f`; verified diff clean); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14).
- Key finding: the `#items` entrance stack (opacity/transform/veil/duration) is now proven an LCP fixed point in both regimes — iter8/10/11 (old) + iter19 (post-iter14 cache) cover removal, veil, transform-only, and duration. The paint side of the feed is exhausted; LCP is pinned to the feed card's own paint timing. Remaining candidates: (b) content-hash filenames, or close out at iter14. Full log in `speed-lab/SPEED_LAB.md`.
 ## 2026-08-19 — Speed lab Qwen track: iteration 20 (REVERT)
 - Hypothesis: the popular feed's first card is `sl-img-01` (800x450, score 21 = highest); its `#media img` has no intrinsic size and `#media` no height, so the media box is 0px until the .webp bytes arrive — a post-paint reflow. Reserving the final box with `aspect-ratio: 16 / 9` (exactly the fixtures' post-load geometry, zero CLS) should settle the image LCP candidate early and cut cold LCP (bar 961.4).
 - Measured via `run_baseline.py`: cold LCP 1020.3 (+58.9, all 3 runs above 1017); cold FCP 604.3 (−2.1, noise); warm FCP 217.2 / warm LCP 470.1 (both exact ties with the bar — the .webp is disk-cached post-iter14, so paint converges regardless of box reservation). No lane faster.
 - **Reverted** (1-line CSS addition in `soci-post-card.js` restored to submodule `c43db4f`; verified diff clean and served bytes no longer contain `aspect-ratio`); post-revert confirmation run reproduces the bar (cold FCP 605.4, cold LCP 959.8/1019.3/1058.1, warm 217.0 ×3); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14).
 - Key finding: reserving the media box's layout does not move the image's fetch/decode critical path (fetch still starts at `connectedCallback`; preloads forbidden). Sixth confirmation (iter7/8/15/17/19 + iter20) that the LCP lane is pinned to the first feed card's media arrival+paint. Remaining non-forbidden candidate: (b) content-hash filenames (build-pipeline scale, not "small" per protocol), else close out at iter14. Full log in `speed-lab/SPEED_LAB.md`.

## 2026-08-19 — Speed lab Qwen track: iteration 21 (REVERT)
- Hypothesis: the list-view feed's first thumbnail `<img>` (96×72) loads at the default `auto` priority alongside the other feed images and is the largest early content; forcing `fetchpriority=high` on that one image (first child `<li>` only, set in both the batch-`innerHTML` and streaming-`fetchAndMerge` paths) should pull its bytes ahead and cut cold LCP (bar 961.4) with no FCP cost.
- Measured via `run_baseline.py`: cold FCP 604.3 / cold LCP 957.8 (−2.1 / −3.6, within the ±20 ms noise band); warm FCP 217.0 (exact tie), warm LCP 529.5 (+59.4). No lane faster.
- **Reverted** (`fetchpriority` guard removed from `soci-post-li.js`; submodule clean at `c43db4f`, verified diff clean); post-revert confirmation reproduces the bar (cold FCP 604.6/585.5/605.0, cold LCP 999.8/1015.3/1056.0; warm FCP 217.0 ×3, warm LCP 449.6/469.9/529.5, median 469.9 ≈ bar 470.1); no commit. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14).
- Key finding: the LCP element is the feed header's placeholder text (`div#placeholder`, "Viewing all tags", `#tag-input` at `soci-post-list.js:244`), not the thumbnail — in all 6 post-iter14 runs. The 96×72 image never wins the LCP election, so `fetchpriority` (and byte-priority levers like preload) are mechanically inert for the LCP lane. Corrects the "LCP = the first feed card's media" model carried from iter18/iter20. Remaining non-forbidden candidate: (b) content-hash filenames, else close out at iter14. Full log in `speed-lab/SPEED_LAB.md`.

## 2026-08-20 — Speed lab Qwen track: iteration 22 (REVERT)
- Hypothesis (prompt's "else" branch; the preferred font-display lever verified a no-op up front — the project has zero webfonts and `#tag-input`/first-card text already inherit the native system stack): explicit `loading="eager"` on the first feed card's thumbnail (1 line in `soci-post-list.js` list-view render).
- Measured via `run_baseline.py`: cold FCP 605.2 (−1.2, noise) / cold LCP 1015.9 (+54.5); warm FCP 217.0 (exact tie) / warm LCP 529.7 (+59.6, tight 529.6–529.9 cluster in the ~530 warm mode). No lane faster.
- **Reverted** (line removed; submodule clean at `c43db4f`, diff verified); post-revert confirmation reproduces the bar pattern (cold FCP 604.7–605.1, cold LCP 979.9–1036.8; warm 217.0 ×3, warm LCP 450.2/469.6/530.2 — the ~530 mode exists at bar). Revert + lab log committed. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14).
- Key finding: the font-side lever space is closed by construction — with no `@font-face`/font links/`FontFace` usage anywhere in soci-frontend, any font-display/swap/preconnect/subset variant on the LCP header input or first-card text is a no-op until a webfont is introduced. The warm LCP 470/530 bimodal is environmental (the 530 mode drew in the bar-state confirmation sweep too); the bar's 470.1 sits at the favorable edge. Remaining non-forbidden candidate: (b) content-hash filenames (build-pipeline scale, not "small" per protocol), else close out at iter14. Full log in `speed-lab/SPEED_LAB.md`.

## 2026-08-20 — Speed lab Qwen track: iteration 24 (REVERT)
- Hypothesis (prompt's "else" branch; the preferred webfont preconnect lever is closed by construction — the project has zero webfonts, confirmed again in iter22): a `<link rel="preconnect" href="http://localhost:4203">` for the image CDN (the exact origin `config.js` dials — `127.0.0.1:4203` is *not* the host the browser connects to, so a `127.0.0.1` preconnect would be a total no-op) to cut the cold-lane DNS+TCP(+TLS) handshake before the first feed image lands. Video CDN `:4204` deliberately skipped (one of 21 posts far down, not on the FCP/LCP critical path; "only if cheap" fails on iter23's cold-FCP lesson).
- Measured via `run_baseline.py`: cold FCP 605.3 (−1.1, noise) / cold LCP 1038.3 (+76.9, tight 1037–1039 cluster); warm FCP 217.0 (exact tie) / warm LCP 529.9 (+59.8, 2 of 3 in the ~530 bimodal mode). No lane faster.
- **Reverted** (1-line `index.pug` change removed; submodule clean at `c43db4f`, preconnect confirmed absent from served bytes); post-revert confirmation sweep reproduces the bar (cold FCP 585.5/605.1/604.0, cold LCP 1056.4/957.9/1036.1, warm FCP 217.0 ×3, warm LCP 530.2/469.5/529.7); log + this changelog committed. Keep bar unchanged: cold 606.4/961.4, warm 217.0/470.1 (iter14).
- Key finding: `rel="preconnect"` was the last remaining "small" front-end resource-hint lever — every post-iter14 hint (defer, preload, fetchpriority, eager, head-preload tags.js, preconnect) has now reverted, all with LCP pinned to the feed card's paint. The resource-hint space is exhausted by measurement; LCP stays insensitive to connection/fetch/priority hints. Remaining non-forbidden candidate: (b) content-hash filenames (build-pipeline scale, not "small" per protocol), else close out at iter14. Full log in `speed-lab/SPEED_LAB.md`.

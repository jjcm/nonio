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

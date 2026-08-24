# EDGE PLAYBOOK — what to set up in the real world, and what I'll do once you have

Audience: Jacob. Everything below is something the VPS speed loop (`SPEED_LAB.md`)
wanted but could not do from a single box at 108.61.219.46. Each item says why
(with the measured numbers), exactly what you click or create, what credentials
to hand back, and what I will do with them (exact config/PRs). Items are in
recommended order; 1–3 are one sitting.

The short version: create one Cloudflare account, move `non.io`'s nameservers
to it, flip the proxy on, and send me one scoped API token. That single setup
unlocks items 1–5. Item 6 (RUM) is a checkbox in the same dashboard.

---

## 0. Prerequisite: Cloudflare account + zone (~20 minutes, free plan is fine to start)

**Why Cloudflare and not Fastly/Bunny:** we need, in one product: anycast TLS
close to users, HTTP/3, request-header-conditional cache rules (to keep
logged-in traffic out of shared caches), an image resizer, and free RUM.
Cloudflare is the only one with all five on a hobby budget. Nothing below is
irreversible — DNS TTLs aside, you can grey-cloud any record and be back to
direct-to-VPS in minutes.

**What you do:**
1. Create an account at dash.cloudflare.com (use an account email you keep —
   this becomes prod infra).
2. Add site → `non.io` → Free plan. Cloudflare imports existing records;
   verify the list against your registrar before continuing.
3. At your registrar, replace the nameservers with the two Cloudflare gives
   you. Wait for the zone to go Active (minutes to hours).
4. DNS records (Cloudflare → DNS → Records). Target state:
   - `A non.io → 108.61.219.46` — **Proxied** (orange cloud)
   - `CNAME www → non.io` — Proxied
   - Keep `api`, `image`, `avatar`, `video`, `thumbnail` (A → 108.61.219.46)
     **DNS only (grey)** for now — they keep working exactly as today while we
     cut over, and I'll fold them into the single origin (see item 2's PR).
     Flip them to Proxied only after the path-prefix migration lands.
   - Leave MX/TXT untouched.
5. SSL/TLS → Overview → set mode **Full (strict)**. Then SSL/TLS → Origin
   Server → Create Certificate (Cloudflare Origin CA, RSA, 15 years,
   `non.io, *.non.io`). Save the cert+key pair — it goes on the VPS so the
   edge↔origin hop is verified TLS. (Caddy currently uses Let's Encrypt; with
   CF proxied in front, LE HTTP-01 renewals get flaky. The Origin CA cert
   removes that whole failure mode.)
6. Create the API token: My Profile → API Tokens → Create Token → Custom:
   - Zone → Zone: Read, Zone Settings: Edit
   - Zone → DNS: Edit
   - Zone → Cache Purge: Purge
   - Zone → Cache Rules: Edit
   - Zone Resources: Include → Specific zone → `non.io`

**What you send me:**
- The API token (that's the "what services do you want access to" answer: one
  scoped Cloudflare token covers items 1–5).
- The Origin CA cert + key (or just install them yourself: they go in
  `/etc/caddy/` on the VPS and the Caddyfile's `tls` line points at them —
  I'll prep that Caddyfile change either way).
- Zone ID (Overview page, right column) — saves me one API call.

**What I do after:** everything below, via `curl` against the Cloudflare API
plus PRs into this repo. You review DNS-affecting steps before I flip them.

---

## 1. Edge cache for the HTML shell (biggest cold-load win per minute of setup)

**Why:** iter01+iter05 got home cold LCP to 576 ms WAN / ~2.1 s slow4g, but
every cold visit still pays 2×RTT to Vultr (TCP+TLS) before the first HTML
byte, ~53 ms×2 from the US test host and 150–300 ms×2 from Europe/Asia. The
shell is identical for every user (auth is client-side from localStorage; the
server renders one anonymous shell — that's why `index.js` can cache one
compiled copy). Serving it from a PoP 10 ms from the user removes the origin
round trips entirely for the majority anonymous audience — and for logged-in
users too, since the *document* is auth-agnostic.

**What you click (Cloudflare → Caching → Cache Rules → Create rule):**
- Rule "shell edge cache":
  - When: Hostname equals `non.io` AND Request Method equals GET AND NOT
    (URI Path starts with `/api`) AND NOT (URI Path contains `.`)
    — i.e. document navigations: `/`, `/post-slug`, `/user/x`, not assets,
    not API.
  - Then: Eligible for cache; Edge TTL: **Override origin → 5 minutes**;
    Browser TTL: Respect origin (origin sends `no-cache` + ETag, which keeps
    browser revalidation semantics exactly as today).
- Rule "static assets": When URI Path matches `\.(js|css|svg|png|webp|woff2?)$`
  on `non.io` → Eligible, Edge TTL Override 1 hour, Browser TTL respect
  origin. (Origin sends `public, max-age=300` — deliberately not immutable
  because filenames aren't hashed; the edge copy is purged on deploy, below.)

**What I do after (needs only the token):**
- Add a purge step to `speed-lab/vps/deploy.sh` so deploys are visible within
  seconds despite the 5 min edge TTL:

  ```bash
  curl -sX POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
    --data '{"purge_everything":true}'
  ```
- Verify with `curl -sI https://non.io/ | grep -i cf-cache-status` (want `HIT`
  from two consecutive requests, `MISS` right after a deploy purge).
- Re-run the WAN lanes from the second measurement host and append the deltas
  to SPEED_LAB.md. Expected: cold FCP/LCP drop by roughly the full origin RTT
  share (100–500 ms depending on the user's distance from Vultr NJ).

**Risk note:** if the shell ever becomes per-user server-rendered (it isn't
today), this rule must die first. I'll leave a comment in `index.js` at the
`renderPug` cache pointing at this playbook.

---

## 2. Anonymous API reads at the edge (`/posts`, `/posts/:url`, `/comments`, `/tags`)

**Why:** iter10 proved the semantics browser-side: anonymous responses for the
four read endpoints are cache-safe for 30 s (`private, max-age=30` +
`Vary: Authorization`, warm feedPaint 412→219 ms slow4g). Doing the same at
the edge gives *first-time* anonymous visitors a PoP-local `/posts` response —
that's the request that gates feedPaint after the lazy-graph work.

**The `private` nuance (why this needs a small origin PR, not just a rule):**
`Cache-Control: private` correctly forbids shared caches, so Cloudflare will
not cache these today — and Cloudflare also **ignores `Vary`** for cache keys,
so we must never let it cache a logged-in response. The safe design is:

- Origin change (my PR): `allowAnonymousBrowserCache` in
  `soci-backend/httpd/middleware` emits, for requests **without** an
  `Authorization` header: `Cache-Control: public, max-age=30, s-maxage=30` +
  `Vary: Authorization` (browser behavior unchanged — 30 s private reuse;
  `Vary` keeps any correct intermediary honest). Logged-in responses keep no
  cache headers at all.
- Cache rule (me, via token): "anonymous API reads":
  - When: Hostname `non.io` AND URI Path starts with `/api/` AND Request
    Method GET AND **Header `Authorization` is not present** AND URI Path is
    one of `/api/posts`, `/api/posts/*`, `/api/comments`, `/api/tags`
  - Then: Eligible for cache, Edge TTL: Respect origin (30 s via `s-maxage`),
    cache key: default (query string included — sort/tag/filter variants each
    cache separately, which is what we want).
  - The Authorization-present case needs no rule: those responses carry no
    cache headers and CF won't cache them; the header condition is
    belt-and-suspenders so even a misconfigured origin can't leak a logged-in
    body into the shared cache.

**What you do:** nothing beyond item 0 — this one is all me:
1. PR: the `s-maxage` origin change + tests (the existing
   `allowAnonymousBrowserCache` tests extend naturally).
2. Cache rule via API, verify `cf-cache-status: HIT` on anonymous `/api/posts`
   and `BYPASS`/`DYNAMIC` with an `Authorization` header attached.
3. 30 s staleness is identical to today's browser-side allowance, so no
   product behavior changes.

**Prerequisite (same PR):** this assumes the single-origin path layout
(`non.io/api/...`) that the lab ran. Production still uses `api.non.io`.
The migration PR: `soci-frontend/config.js.server` hosts become relative
paths (exactly `speed-lab/vps/config.vps.js`), the production Caddyfile gets
the lab's strip-prefix proxy blocks (`speed-lab/vps/Caddyfile` is
copy-paste-ready), and `api.non.io` stays alive as a grey-cloud alias until
old clients age out. This is also what makes item 0's "one proxied hostname"
clean — the browser then opens exactly one h3 connection for everything.

---

## 3. Anycast TLS termination + HTTP/3 (free, mostly checkboxes)

**Why:** cold TCP+TLS to Vultr NJ is ~2 RTT before byte one; terminating at
the nearest PoP makes that 0–1 *local* RTT, and the PoP holds a warm,
long-lived connection to origin. h3/QUIC additionally survives lossy mobile
paths better (the lab could never measure this because QUIC bypasses CDP
throttling — item 6 gets us real numbers instead).

**What you click (after item 0's proxied records):**
- Speed → Optimization → Protocol: **HTTP/3 (with QUIC): On**, 0-RTT
  Connection Resumption: On.
- Network: gRPC off (unused), WebSockets: **On** — required, the app now uses
  `/notifications/ws`, `/voice/presence/ws`, `/community/channel/ws`.
  Cloudflare proxies WebSockets fine on all plans.
- Speed → Optimization → Content: Early Hints: On (harmless, free).
  Rocket Loader: **Off** (it rewrites script loading and will fight the
  module graph). Auto Minify: Off for JS/CSS (the gzip pipeline already
  handles bytes; minify-by-proxy has bitten pug-rendered inline scripts
  before).
- On the VPS (you or me over SSH): firewall 80/443 to Cloudflare's published
  IP ranges (`https://www.cloudflare.com/ips/`) once you confirm nothing else
  fetches the box directly. I'll script it into `speed-lab/vps/provision.sh`
  as a commented-out block first — flipping it on is a one-liner after a week
  of watching.

**What you send me:** nothing new; the item-0 token covers verification. If
you want me to do the VPS side, the `fable@108.61.219.46` key I had during
the loop isn't on this machine — either re-add the key or run the two
commands I'll put in the PR description yourself.

**What I do after:** verify h3 negotiation (`curl --http3 -sI https://non.io`),
confirm `Alt-Svc` and 0-RTT resumption, re-measure, and watch for the one
known failure mode: Caddy's own h3 advertisement behind CF is redundant once
CF terminates — I'll turn off h3 origin-side to keep the hop h2 (CF↔origin
over h3 is not a win; warm h2 with keepalive is).

---

## 4. Edge image resizing (DPR-matched thumbnails)

**Why:** the upload pipeline bakes thumbnails at one geometry
(imagemagick `-resize 192x144^` in soci-image-cdn). Feed rows render them at
CSS sizes that vary with viewport and DPR: a 2x phone gets a 1x-sharp thumb,
and the lanes view upscales. Re-encoding the archive is off the table, and
the 1-core box can't do per-request webp encoding (measured: it can't even
brotli statics without starving thumbnails, iter07/08). Cloudflare's resizer
runs at the edge, caches variants, and needs zero origin changes.

**What you click:**
- Images → Transformations → enable for zone `non.io` ("Transform images from
  any origin" can stay off; we only transform our own paths). This is the
  usage-billed feature (first 5k unique transformations/month free as of
  2025 pricing — at nonio's current traffic that's likely $0/mo; check the
  price page while you're there).
- Nothing else — transformations are URL-driven
  (`https://non.io/cdn-cgi/image/width=384,dpr=2,format=auto/<origin-path>`),
  no rules needed.

**What you send me:** just "it's enabled". Item 0's token lets me verify.

**What I do after (PR, frontend only):**
- `soci-post-li._setImageSource` / `soci-post-card`: emit `srcset` with
  `/cdn-cgi/image/width=192,dpr=1|2,format=auto/image/thumbnail/<slug>.webp`
  variants behind a config flag (`EDGE_IMAGE_RESIZE: true` in
  `config.js.server` only, so local dev and the lab box keep plain URLs).
  `format=auto` also hands AVIF to browsers that take it — measured ~30%
  smaller than our webp at the same visual quality on photo content.
- Re-run the transfer-size lanes; expected: another 30–50% off cold feed
  media bytes on 2x devices, no LCP regression (the 1x eager window stays).

**Skip-for-now alternative:** Polish (Pro plan, $25/mo) recompresses
everything automatically with zero code, but it can't upscale/DPR-match and
double-compresses our already-tuned thumbnails. Transformations are the right
tool; Polish is not worth the plan bump for us.

---

## 5. MySQL read replicas / multi-region — **not yet, and here's the tripwire**

**Why not now:** on-box queries are 2–5 ms against the hot-path indexes;
anonymous feeds come from PostCache without touching MySQL; the 1-core box
sustains ~2,400 req/s on `/posts`. Replication would add operational surface
for zero user-visible gain today.

**The tripwire (from RUM, item 6):** when logged-in TTFB p75 from any region
exceeds ~2× anonymous TTFB p75 from that region for a week (logged-in
requests bypass every cache in this playbook), that's the signal. Not before.

**What you'd do then (so it's written down):** second Vultr instance in
Amsterdam or Singapore (whichever RUM says), MariaDB 11 as a read replica
(GTID, `read_only=1`), and hand me `replica_host` + a replication status
check. What I'd do: a read-only DSN in soci-backend config, route
`GET /posts|/comments|/tags` model reads through it when
`REPLICA_DSN` is set, keep writes and anything after auth on primary, and a
lag guard (skip replica when `Seconds_Behind_Master > 5`). It's a contained
PR; the models already funnel reads through a small number of query sites.

---

## 6. RUM — real-user measurement (free checkbox now, custom beacon later)

**Why:** every SPEED_LAB number is synthetic Chromium from one US vantage.
Before/after for items 1–4 needs percentiles from real users, and item 5's
tripwire depends on it. Also the only way to see h3's real effect (lab lanes
must pin h2).

**What you click (fastest version):**
- Cloudflare → Web Analytics → enable for `non.io`, choose **automatic
  injection** (zone is proxied, so CF injects its beacon into HTML at the
  edge; zero code, no cookies, free). Core Web Vitals (LCP/INP/CLS) by path
  and country show up within a day.

**What you send me:** access works through the same dashboard; if you want me
pulling numbers programmatically, add `Account → Account Analytics: Read` to
the token (or just screenshot the dashboard into the issue, honestly fine).

**What I do after:** baseline for two weeks, then land items 1–4 one at a
time and annotate the RUM timeline in SPEED_LAB.md. If we outgrow CF's
dashboard (want per-route SPA-transition timings, which no third-party RUM
sees properly), the custom beacon is a small PR I can do without you: a
`PerformanceObserver` in `soci.js` batching LCP/INP/TTFB + route-transition
marks to a `POST /rum` handler with a sampled write to a `rum_events` table —
the notification-ws PR shows the shape of adding a small handler + tests.

**Beacon note:** automatic injection adds one ~6 KB deferred script. That's
measurable on slow4g (~30 ms) — worth it for sight, and I'll confirm it
doesn't move LCP in the first annotated window.

---

## 7. Small stuff still impossible from one box (grab-bag)

- **Second measurement vantage:** a $5 VPS in Frankfurt or Singapore running
  `speed-lab/harness` gives WAN lanes with a different RTT than 53 ms. Create
  it, put the harness's SSH pubkey on it, send me `user@ip`. (Once RUM is
  live this matters less; nice for controlled A/Bs.)
- **Kernel TCP defaults on the VPS (iter09):** BBR+fq and
  `tcp_slow_start_after_idle=0` measured −8 ms — below the lab's keep
  threshold but strictly free; once CF fronts origin the edge↔origin hop is
  warm anyway. If you re-add my SSH key I'll apply them as sysctl.d config in
  `speed-lab/vps/provision.sh`; they're already written there, commented.
- **Email deliverability (ops, not perf):** password resets go through a
  Gmail app password (`utils.SendEmail`). Behind CF nothing changes, but if
  Gmail rate-limits or the app password rotates, resets silently die. When
  you're in DNS anyway, adding SPF/DKIM for a transactional sender
  (Postmark/SES free tiers cover nonio's volume) is 15 minutes; I'd swap the
  SMTP config in a small PR.
- **The `fable@108.61.219.46` SSH key:** this machine doesn't have it. If you
  want the VPS-side steps (Origin CA cert install, CF IP firewall, sysctls,
  re-measuring from the box) done by me rather than from the PR descriptions,
  re-add the key from the speed-loop era or send a fresh one.

---

## Sequence summary (your half, in order)

| # | You do | Sends me | Unblocks |
|---|---|---|---|
| 0 | CF account, zone `non.io`, nameservers, proxied A record, Full (strict) + Origin CA cert, scoped token | token, zone id, (cert+key or install it) | everything |
| 1 | two Cache Rules (or let me create them via token) | — | edge HTML |
| 2 | nothing (my PRs + rules) | — | edge anon API |
| 3 | protocol checkboxes: h3, 0-RTT, WebSockets ON, Rocket Loader OFF | — | anycast TLS/h3 |
| 4 | enable Images → Transformations | "enabled" | DPR srcset PR |
| 5 | nothing until RUM trips the wire | — | replicas |
| 6 | enable Web Analytics (auto injection) | (optional) analytics-read on token | real numbers |
| 7 | optional: second VPS, SSH key back | `user@ip`, key | vantage 2, VPS-side tuning |

# Nonio SPA transition speed lab

**LAB FILE. Not for the product PR.**

Goal: make three warm in-app navigations faster, measured *after* the homepage
has already loaded. This is not about first paint of the initial document.

1. Homepage → viewing a filtered tag (`/` → `/#photography`)
2. Homepage → viewing a user (`/` → `/user/speedlab`)
3. Homepage → viewing a post (`/` → `/sl-txt-01`)

## Metric (fixed for the whole lab)

Per run: load the homepage, wait until its feed is painted, fully revealed and
its first thumbnail decoded, settle 1200 ms. Then `t0 = performance.now()`
immediately before dispatching a click on a real in-feed `<soci-link>` anchor,
so the app's own `pushState` → router path runs. From `t0`, poll every frame:

| Number | Meaning |
| --- | --- |
| **fcr** | First contentful render. The destination's primary content node is in the DOM, has non-zero layout, and its *effective* opacity (product of opacity along the flattened tree, so shadow-side entrance animations count) is > 0.01. First frame on which the user sees any of the destination. |
| **visible** | That same node reaches effective opacity ≥ 0.9. Separates "content exists" from "content finished fading in", so an entrance animation can neither be mistaken for render work nor hide it. |
| **usable** | Time to usable content, route-specific: tag/user → ≥ 8 rows present *and* the first row's media decoded; post → post body painted *and* ≥ 5 comments in the tree. `usable` implies `fcr`. |

Destinations are identified by the attribute the app sets on them
(`soci-post-list[tag=photography]`, `[user=speedlab]`, `soci-post[url=sl-txt-01]`),
never by "a post list exists". Homepage → tag is a *same-route* navigation, so
the previous feed and its 21 rows are still in the DOM at `t0`; without that
check the stale homepage feed scores as an instant render.

Two lanes, medians of n≥3 (n=5 for keep/revert decisions):

- **slow4g** — 150 ms RTT, 1.6 Mbps down. Headline lane; matches the throttle the
  earlier nonio feed-load lab used, so numbers stay comparable.
- **wifi** — 20 ms RTT, 20 Mbps down. Realistic desktop.

An unthrottled localhost lane was tried and dropped: the destination fetch
resolves inside the click's own frame, so all three numbers collapse to one
value and both the fetch and the entrance animation disappear from the
measurement.

Two harness details that materially change the numbers, recorded so results are
reproducible:

- Opacity is measured along the **flattened** tree (following `assignedSlot`).
  Feed rows are light-DOM children slotted into `soci-post-list`'s shadow
  `#items`, and `#items` is the node the 350 ms entrance animation puts at
  opacity 0. Walking `parentElement` alone reports a fully-hidden row as
  opacity 1.
- The harness forces a style read on those wrappers **every frame**. Without it
  the harness decides whether the entrance fade arms at all: the fade only runs
  if the browser resolves style on a freshly created `#items` while it is still
  opacity 0, and on a fast lane the destination fetch can resolve inside the
  same frame as the click.

Reproduce: `speed-lab/boot.sh`, then `speed-lab/seed.sh`, then
`node speed-lab/harness/transitions.mjs --label X --n 5`.

Homepage-load guard (must not regress) uses the earlier lab's
`harness/measure.mjs` on Slow 4G.

## Fixture

`speed-lab/seed.sql`. LAB ONLY — extends the earlier feed fixture (10 image, 10
text, 1 video) with what the three navigations actually need:

- **5 tags, 2–3 per post.** `photography` is the measured tag: 11 posts, mixed
  media, so the filtered feed is a real render rather than a one-row response.
- **3 authors.** `speedlab` owns 11 posts, so the user route is a real
  multi-post author page.
- **21 comments** including one nested reply, on post `sl-txt-01`, so the post
  route exercises the `/comments` → `/comment-votes` path.

## Baseline (master, n=5)

| lane | route | fcr | visible | usable |
| --- | --- | --- | --- | --- |
| slow4g | tag | 240.6 | 440.6 | 240.6 |
| slow4g | user | 274.9 | 474.8 | 274.9 |
| slow4g | post | 290.9 | 359.4 | 340.6 |
| wifi | tag | 90.8 | 290.7 | 90.8 |
| wifi | user | 173.6 | 340.1 | 173.6 |
| wifi | post | 173.6 | 240.4 | 173.6 |

Homepage load, Slow 4G, n=5: cold FCP 3972, cold LCP 4464, warm FCP 3964,
warm LCP 3996, cold load 4262.6, warm load 4265.6, warm feed paint 4292.8.
(Warm ≈ cold because master sends no caching headers at all.)

### What the baseline traces show

Network waterfall of each navigation, `t=0` at click, Slow 4G:

**Homepage → user** — 6 API calls, 4 of them pure waste:

```
+6ms   /posts                  <- unfiltered frontpage feed, discarded
+6ms   /posts                  <- exact duplicate of the above
+8ms   /communities
+9ms   /users/speedlab         <- needed (sidebar)
+18ms  /posts?user=speedlab    <- needed
+18ms  /posts?user=speedlab    <- exact duplicate
```

Attributed to source:

- The two unfiltered `/posts` come from a **bare `soci-post-list` placeholder**
  in `pages/user.pug`. The `#user` route is `fresh`, so activating it restores
  that placeholder from the template; the placeholder connects, fetches the
  whole frontpage feed, and is then thrown away by `user.renderContent()`,
  which replaces it with `<soci-post-list user="…">`. The largest payload on the
  site is fetched twice per user navigation and never rendered.
- Every duplicate is `attributeChangedCallback('filter')` →
  `_refreshFilterFetch()` → `fetchAndMerge()` firing during
  `_initializeControls()`, requesting the same URL `_loadPosts()` is already
  fetching. `fetchAndMerge` has no dedupe guard.

**Homepage → tag** — `/posts?tag=photography` fired twice (same duplicate cause).

**Homepage → post** — `/posts/{slug}` and `/comments?post=` already run in
parallel (good). `/comment-votes` is sequential after comments and returns
**401 for anonymous visitors** — a wasted round trip. The post response lands at
173 ms but `fcr` is 290.9 ms; ~117 ms of that gap is an artificial
`setTimeout(…, 100)` before `soci-post` gets its `loaded` attribute.

## Iterations

One hypothesis per iteration. Keep only if the targeted route(s) improve without
regressing the other two routes or homepage load. Otherwise revert.

All numbers are medians, n=5. Deltas are against the previous kept state.

### Iteration 1 — KEEP (weak win, removes provable waste)

*Hypothesis:* the bare `soci-post-list` in `pages/user.pug` fetches the whole
unfiltered frontpage feed and is then discarded, so deleting it should speed up
the user route.

Targets: user. `pages/user.pug` — delete the placeholder element.

| lane | route | before | after | Δ fcr |
| --- | --- | --- | --- | --- |
| slow4g | user | 274.9 | 274.7 | −0.2 |
| wifi | user | 173.6 | 157.3 | **−16.3** |

tag and post unchanged. API calls on a user navigation 6 → 4.

Kept, but honestly: on Slow 4G this is a wash. The wasted requests are issued in
parallel with the one that matters and the lab feed is only 21 posts, so
bandwidth never becomes the constraint. The 16 ms on wifi is connection
contention. It is kept because it deletes two fetches of the largest payload on
the site per navigation for zero behaviour change — the placeholder is
unconditionally replaced by `user.renderContent()` — and because the lab fixture
understates the payload of a real frontpage.

### Iteration 2 — KEEP (wash on latency, halves request volume)

*Hypothesis:* `attributeChangedCallback('filter')` → `_refreshFilterFetch()`
fires during `_initializeControls()` and duplicates the request
`connectedCallback` is already making; suppressing it should help.

Targets: tag, user. `soci-post-list` — `_initializing` guard.

| lane | route | before | after | Δ fcr |
| --- | --- | --- | --- | --- |
| slow4g | tag | 241.1 | 239.6 | −1.5 |
| slow4g | user | 274.7 | 274.7 | 0 |
| wifi | tag | 91.6 | 91.2 | −0.4 |
| wifi | user | 157.3 | 158.3 | +1.0 |

A wash on every lane and route — within run-to-run noise. API calls per
navigation: user 4 → 3, tag 2 → 1.

Kept on request volume, not latency, and the PR says so. The duplicate is a
second identical query hitting the database for every feed view the site
serves; halving that is worth shipping even though the client cannot feel it.

### Iteration 3 — KEEP (large win)

*Hypothesis:* `soci-post` waits `setTimeout(…, 100)` after the response before
setting `[loaded]`, which is what its entrance transitions key on, so that 100 ms
is dead time.

Targets: post. `soci-post.loadPost` — `requestAnimationFrame` instead.

| lane | route | before | after | Δ |
| --- | --- | --- | --- | --- |
| slow4g | post fcr | 290.7 | 191.6 | **−99.1** |
| slow4g | post visible | 360.1 | 258.2 | **−101.9** |
| wifi | post fcr | 173.7 | 57.2 | **−116.5** |
| wifi | post usable | 173.7 | 81.9 | **−91.8** |

tag and user unchanged. `visible − fcr` is 66.6 ms after vs 68.5 ms before, so
the entrance animation still runs for its full duration — only the dead wait in
front of it is gone.

### Iteration 4 — KEEP (large win)

*Hypothesis:* `soci-comment-list` awaits `/comment-votes` *before* building the
comment tree, so anonymous readers pay a full round trip — answered 401 — before
any comment appears.

Targets: post. Build the tree first; fetch votes only when authenticated.

| lane | route | before | after | Δ |
| --- | --- | --- | --- | --- |
| slow4g | post usable | 343.1 | 198.7 | **−144.4** |
| wifi | post usable | 81.9 | 58.9 | **−23.0** |

`fcr` moved +7.1 ms on slow4g and +1.7 ms on wifi, both inside noise. tag and
user unchanged. The 401 request is gone entirely for anonymous readers.

### Iteration 5 — KEEP (real win, all feed routes)

*Hypothesis:* the API sends no `Content-Encoding`, so the uncompressed feed JSON
sits on the critical path on a slow link.

Targets: tag, user, post, homepage. New `middleware.Gzip` wrapping all three
route groups in `soci-backend`.

`/posts` 8894 → 1860 B, `/posts?tag=photography` 4530 → 1011 B,
`/comments?post=` 1627 → 506 B, `/tags` 146 B left uncompressed (below the
512 B threshold).

| lane | route | before | after | Δ fcr |
| --- | --- | --- | --- | --- |
| slow4g | tag | 241.3 | 224.0 | **−17.3** |
| slow4g | user | 275.0 | 257.6 | **−17.4** |
| slow4g | post | 198.7 | 195.9 | −2.8 |
| wifi | all | — | — | ±1 (noise) |

wifi is unchanged because 20 Mbps was never the constraint there. Verified:
identical JSON after decompression, plain bytes when the client does not send
`Accept-Encoding`, WebSocket upgrades bypass the middleware, `Vary:
Accept-Encoding` set.

### Iteration 6 — KEEP (largest win on tag and user)

*Hypothesis:* the feed's entrance animates opacity on `--soci-ease`
(`cubic-bezier(0.65, 0, 0.35, 1)`, a symmetric ease-in-out). That curve leaves
the feed below perceptible opacity for roughly its first 65 ms *after the
response has already landed*, which matches the measured gap between the
response and `fcr`. The design system already defines `--soci-ease-out` for
entrances.

Targets: tag, user. `soci-post-list` `#items` — opacity easing only. Duration
(0.35 s) and the `translateY` slide are unchanged.

| lane | route | before | after | Δ fcr | Δ visible |
| --- | --- | --- | --- | --- | --- |
| slow4g | tag | 224.0 | 189.7 | **−34.3** | **−51.9** |
| slow4g | user | 257.6 | 225.0 | **−32.6** | **−51.4** |
| wifi | tag | 92.7 | 58.5 | **−34.2** | **−51.4** |
| wifi | user | 159.1 | 107.9 | **−51.2** | **−17.7** |

post moved +1.1 ms (noise). Note `visible` improves too, not just `fcr`: an
ease-out reaches 0.9 opacity at ~55 % of its duration where the symmetric curve
needs ~70 %. So this is not the threshold being gamed — the whole reveal is
genuinely earlier while lasting exactly as long.

This is the one change with a visible design consequence, so it is called out
explicitly rather than buried. It is a gate, and the measurement above is the
proof: on Slow 4G the tag feed was fully rendered and laid out ~65 ms before the
user could perceive any of it.

### Homepage load guard after iterations 1–6

Slow 4G, n=5, master vs lab, both submodules rebuilt:

| metric | master | lab | Δ |
| --- | --- | --- | --- |
| cold FCP | 3976 | 3948 | −28 |
| warm FCP | 3968 | 3952 | −16 |
| cold LCP | 4480 | 4380 | **−100** |
| warm LCP | 4008 | 3988 | −20 |
| cold feed paint | 4472 | 4375 | **−98** |
| warm feed paint | 4300 | 4198 | **−101** |
| cold all-resources-done | 4684 | 4576 | **−108** |
| warm all-resources-done | 4656 | 4556 | **−101** |
| cold loadEventEnd | 4277 | 4576 | +299 |
| warm loadEventEnd | 4271 | 4556 | +285 |

`loadEventEnd` moved later and everything else moved earlier. That is not a
regression, and the two rows that prove it are the last three:

- On **master**, `warmLoad` 4271 fires *before* `warmFeedPaint` 4300 and 385 ms
  before `warmAllDone` 4656. The homepage was firing its load event while the
  posts were not on screen yet and their thumbnails had not been requested.
- On the **lab build**, `warmLoad` 4556 equals `warmAllDone` 4556. The feed now
  renders early enough that its thumbnails are requested *before* the load
  event, so they are counted in it.

The page finishes ~100 ms sooner (`allAllDone`), shows its posts ~100 ms sooner,
and its LCP is 100 ms earlier cold. `loadEventEnd` grew because it started
including work that master deferred past it. This is why `allDone` was added to
the harness.

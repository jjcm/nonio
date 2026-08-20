# Fable vs Qwen 3.8 — Nonio feed speed lab recap

**EXPERIMENTAL. NOTHING HERE SHIPS.** Both tracks are lab branches on a dev server.
[PR #161](https://github.com/jjcm/nonio/pull/161) (Fable) must not be merged or closed, and
`cursor/speed-lab-qwen-nonio` (Qwen) must not be merged either. This recap branch is for the
graphs, the videos and the tweet pack — it changes no product code.

Two agents were pointed at the same problem overnight: make the Nonio main feed load faster.
Same 21-post fixture (10 image, 10 text, 1 video), same seed commit
`4dc103a4306564ed7bb6cddb48a9f14f078f6b16`, same backend, same route.

| | Fable | Qwen 3.8 |
|---|---|---|
| Runtime | Cursor cloud agent, Fable 5 | OpenCode 1.18.18 + local llama.cpp Qwen3.8-27B on `sabin` |
| Iterations | 20, one overnight run on a cloud VM | 31 logged, ~2 days on local hardware |
| Kept / reverted / not measured | 17 / 2 / 1 | 6 / 22 / 3 |
| Harness | Playwright Slow 4G (primary) + Lighthouse desktop from iter12 | Lighthouse desktop only, all iterations |
| Champion | iter20, `f915ff11` | iter31, `ef1a141` |

Logs: `speed-lab/results.json` and root `SPEED_LAB.md` on `cursor/speed-lab-nonio-feed`;
`speed-lab/SPEED_LAB.md` on `cursor/speed-lab-qwen-nonio`. Where this recap and those logs
disagree, the logs win.

## 1. The graphs

`charts/` holds six 1600px PNGs, and `data/` holds the CSV behind every plotted point.

- **A / B** — Lighthouse desktop cold and warm FCP/LCP by iteration, both tracks, filled markers
  for kept changes and hollow for reverted. Fable's Lighthouse column only starts at iteration 12,
  so its line before that is a dotted bridge, not data.
- **C** — each champion against its own iteration 0. The two Lighthouse bars are comparable; the
  hatched Slow 4G bars are Fable-only.
- **D** — Fable's Slow 4G series, the harness Qwen never ran.
- **E** — every kept change ranked by the milliseconds it removed, coloured by agent, split by
  harness because the two are not comparable on one axis.
- **F** — all three variants re-measured on Slow 4G in one sitting for this recap. This is the only
  apples-to-apples Slow 4G number that exists for the Qwen build.

The two tracks never shared a harness, so read the charts accordingly. Fable measured Playwright
Slow 4G (1.6 Mbps, 150 ms RTT) and added Lighthouse desktop (40 ms RTT, 10 Mbps, n=5) at iteration
12 for comparability. Qwen measured Lighthouse desktop only (n=3), on different hardware. Their
iteration 0 numbers agree within about 10% (cold FCP 866 vs 788, cold LCP 1290 vs 1334), which is
enough to say they measured the same page and not enough to call a cross-track difference of under
10% a win for anyone.

Headline: on Lighthouse desktop, Fable's champion is cold 366/564 and warm 184/265; Qwen's is cold
423/785 and warm 177/430. Fable is ahead on three of the four lanes and Qwen is 7 ms ahead on warm
FCP, which is inside the machine gap. On Slow 4G, where only Fable's build had ever been measured,
this recap's own run puts Fable at cold 768/816 against Qwen's 2004/2440 and vanilla's 4180/4700 —
and puts them within 4 ms of each other on warm.

## 2. What each one did better

**Fable picked the harness that could see the problem.** Slow 4G at 150 ms RTT punishes request
*count*, not just bytes. That is how Fable found the biggest lever neither obvious nor cheap:
esbuild-bundling the boot module graph collapsed roughly 30 pre-FCP requests into 3 and took cold
FCP from 1376 to 968 ms in one iteration. Lighthouse's desktop preset simulates 40 ms RTT, so the
same waterfall barely shows up there — Qwen's cold load still makes 86 requests versus Fable's 40,
and on Lighthouse that costs it far less than it costs on a phone. Fable also found both transport
levers early (cache headers at iteration 1, gzip at iteration 5) rather than at 14 and 28, which
left it fifteen more iterations of runway. It went further into the stack too: minified bundles,
preloaded chunks, a preloaded LCP thumbnail, the `/posts` payload inlined into the shell, the pug
template compiled once, brotli, and ETags on the document.

**Qwen was the stricter scientist.** Its keep rule was "faster on every lane or revert", and it
held to it: it threw away an FCP win worth 61 ms because cold LCP moved 112 ms the wrong way
(iter3), and threw away a 56 ms cold LCP win because warm LCP regressed 38 ms (iter8). Fable's rule
was looser — it kept iteration 6 and iteration 20 with `loadEventEnd` moving backwards, arguing
correctly that the load event was picking up thumbnails and avatar fetches once the page rendered
earlier, but that is still a judgement call Qwen would not have made. Qwen also caught its own
instrument drifting: when warm FCP moved 20 ms across four iterations of *reverted* code, it spent
a whole iteration re-baselining pristine HEAD with no code change and re-anchored every later
verdict against the new floor. Fable reasoned about its bimodal Lighthouse distributions in prose
instead. And Qwen's 22 reverts are the more useful artifact than they look: they close whole
families of lever — fonts, resource hints, layout containment, LCP-candidate area — with a
mechanism-level reading for each.

**Qwen kept the product surface smaller.** Its only two behaviour-adjacent changes are code splits
(the eager component barrel, and the sidebar's voice/LiveKit subsystem). Everything else is
transport headers. Fable shipped more machinery: a build step in the dev server, an API payload
inlined into the HTML shell, a 2-second shared promise cache over boot GETs, and a filter-refetch
skip. Each of those is individually justified in its log and individually a thing that can drift.

**The cache headers are not the same change.** Fable used `max-age=300` with ETag/304 precisely
because the filenames are not content-hashed, so a year-long cache would be unrevocable. Qwen used
`public, max-age=31536000, immutable` on the same non-hashed URLs. Qwen's is faster on paper and is
the one you cannot ship without content hashing first. Its own log flags the staleness risk.

**Neither is ready.** Both moved `soci-frontend/index.js`, a dev server. Fable's remaining headroom
is server-rendering or skeletoning the feed cards; Qwen's own stated remaining candidate is
content-hashed filenames, which is exactly the prerequisite its cache header needs.

### The LCP-node problem, and why some Qwen misses were the instrument

Nonio's feed cards animate in from `opacity: 0`, so Chrome does not treat their first paint as an
LCP candidate and attributes LCP to early text instead. Fable hit this at iteration 0 and added a
`feedPaint` column — first post card revealed with a decoded thumbnail — and steered by that.
Qwen's Lighthouse kept reporting the header's `div#placeholder` ("Viewing all tags", 238×17 px) as
the LCP element, and it spent roughly ten iterations attacking the feed's paint path before iter21
identified the node. `fetchpriority=high` and `loading=eager` on the first thumbnail (iters 21, 22)
could not move an LCP that was never the thumbnail. Those were not bad hypotheses; they were
hypotheses aimed by a mis-attributing instrument.

### Brotli: the same idea, opposite verdicts, and the ordering explains it

Fable kept brotli (iter19): Slow 4G cold FCP 784 → 744, Lighthouse cold LCP 586 → 563. Qwen
reverted it (iter29): cold FCP +168 ms, cold LCP +259 ms. Both measured correctly. The difference
is that Fable had already added a compressed-output cache keyed by path and ETag at iteration 16,
so brotli at quality 11 runs once per file; Qwen was calling `zlib.brotliCompressSync` at quality
11 on every cold request, roughly 165 ms of CPU per load, which ate the 15% byte saving whole. Qwen
added the same memoization two iterations later at iter31 — after it had already written brotli off.
Compression quality is free only once compression is cached.

## 3. The changes that actually moved the needle

Ranked by milliseconds one change removed, on the harness that measured it. Chart E is this list
as bars; `data/keep-deltas.csv` is the numbers.

1. **Fable, iter1 — static-asset ETag/304 + `max-age=300`.** Slow 4G warm load 4435 → 315 ms, warm
   FCP 3968 → 328 ms. The single biggest number in either lab. The vanilla server sent no cache
   headers at all, so every repeat visit re-downloaded all 690 KB.
2. **Qwen, iter14 — `immutable` `max-age=31536000` on js/css/wasm/fonts/images.** Lighthouse warm
   FCP 605 → 217 ms, warm LCP 996 → 470 ms. Same lever, thirteen iterations later, more aggressive
   header.
3. **Fable, iter2 — defer the ~35 non-feed components to a dynamic import after load.** Slow 4G cold
   FCP 3996 → 2392 ms.
4. **Fable, iter5 — gzip compressible responses.** Slow 4G cold load 2869 → 1767 ms, cold FCP
   2184 → 1560 ms.
5. **Qwen, iter28 — gzip js/css/html/svg.** Lighthouse cold FCP 606 → 428 ms, cold LCP 961 → 803 ms.
   Its largest cold win, and the change that dissolved the "pinned band" noise nine previous
   iterations had been fighting: the band was download time.
6. **Fable, iter9 — esbuild-bundle the boot module graph.** Slow 4G cold FCP 1376 → 968 ms, cold
   load 1802 → 1396 ms. Latency-bound waterfalls are a request-count problem, and iteration 4 had
   already proved that preloading the same 29 files does not help.
7. **Qwen, iter1 — split the eager component barrel.** Lighthouse cold LCP 1334 → 1096 ms. Same
   family as Fable's iter2, found first on that track.
8. **Fable, iter11 — modulepreload the 2 shared bundle chunks.** Slow 4G cold FCP 936 → 776 ms.
   Narrow and measured, unlike the 29-hint version it had already rejected.
9. **Fable, iter12 — preload the single LCP thumbnail.** Slow 4G cold LCP 1000 → 828 ms. One image,
   not the grid.
10. **Fable, iter6 — inline the anonymous `/posts` payload in the shell HTML.** Slow 4G cold LCP
    1980 → 1788 ms, warm feedPaint 407 → 230 ms.
11. **Fable, iter20 — content-hash ETag + 304 for the shell document.** Slow 4G warm FCP 236 → 180 ms.
12. **Qwen, iter30 — gzip the 56 KB `markdown.wasm`.** Lighthouse cold LCP 803 → 783 ms; 56,655 B
    down to 25,907 B.
13. **Qwen, iter6 — lazy-load the sidebar voice/LiveKit module.** Lighthouse cold LCP 1096 → 1053 ms.
14. **Fable, iter13 — skip the redundant boot-time `/posts` merge.** Lighthouse warm LCP 325 → 267 ms;
    zero `/posts` requests on boot.

Both agents independently found the same top two levers — cache headers and compression — from
opposite ends of a 30-iteration search. Everything that separates the two champions on cold load is
what Fable did *after* those.

## 4. The videos

`video/` has the compiled 2×3 grid and six raw clips, all recorded for this recap on one machine
in one sitting: Chromium under CDP throttling at 1.6 Mbps down / 750 kbps up / 150 ms RTT, 1280×800,
against the same backend, the same 21-post fixture and the same seeded database. Only the
`soci-frontend` checkout changes between variants (`75e4cab` vanilla, `cc90eb9` Fable, `ada6eff`
Qwen).

Every frame carries a CDP wall-clock stamp and every lane carries its document's
`performance.timeOrigin`, so the burned-in timer starts at navigation start, not at "roughly when
recording began".

| | cold FCP | cold LCP | cold load | warm FCP | warm LCP | requests | cold bytes | warm bytes |
|---|---|---|---|---|---|---|---|---|
| vanilla `75e4cab` | 4180 | 4700 | 4843 | 4180 | 4208 | 108 | 690 KB | 690 KB |
| Fable `cc90eb9` | 768 | 816 | 1182 | 228 | 228 | 40 | 104 KB | 0.3 KB |
| Qwen `ada6eff` | 2004 | 2440 | 2217 | 232 | 232 | 86 | 158 KB | 8.4 KB |

n=1 per cell — this is the video's measurement, not a replacement for either lab's medians. It
lands within a few percent of Fable's logged Slow 4G medians (748/788/1166), which is the check
that the harness is sane.

What each variant actually put on the wire, `GET /soci.js` with `Accept-Encoding: gzip, br`:

| | `Content-Encoding` | `Cache-Control` | `/posts` inlined in the shell |
|---|---|---|---|
| vanilla | none | none | no |
| Fable | `br` | `max-age=300` | yes |
| Qwen | `gzip` | `public, max-age=31536000, immutable` | no |

That middle column is the difference the two agents' cache iterations are usually described as
sharing, and do not.

Warm is where the two agents converge: 228 vs 232 ms to first contentful paint. Cold is where the
bundling shows: 40 requests against 86.

## 5. Files

```
speed-lab/compare/
  README.md                     this
  tweets.md                     thread + standalone, with alt text and media mapping
  charts/*.png                  A-F, 1600px
  data/*.csv                    every plotted point
  stills/*.png                  frames pulled from the clips, tweet-ready
  video/clips/*.mp4             6 raw clips, 1280x800, 6 s each
  video/nonio-slow4g-vanilla-fable-qwen.mp4   2x3 grid, 1920x968
  video/measured.json           raw harness output behind the table above
  tools/                        record.mjs, compile-video.py, build-data.py, make-charts.py
```

Reproduce: `python3 tools/build-data.py && python3 tools/make-charts.py`. The recording tools need
the full local stack (MariaDB, the Go API and CDNs, `speed-lab/seed.sh`) plus a `soci-frontend`
worktree per variant; `tools/run-variant.sh` drives one variant end to end.

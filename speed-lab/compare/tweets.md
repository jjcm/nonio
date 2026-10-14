# Tweet pack — Fable vs Qwen 3.8 Nonio speed lab

Everything below is measured in this repo. Nothing is shipped; both branches are experimental and
must not be merged. Media paths are relative to `speed-lab/compare/`.

---

## Thread (6 tweets)

### 1 — hook

> Two coding agents, same job: make the Nonio feed load faster. Same 21-post fixture, same seed
> commit, one night each.
>
> One was Fable on Cursor's cloud. One was Qwen 3.8 27B on a box in my house.
>
> Slow 4G, cold and warm, side by side. Nothing here ships.

**Media:** `video/nonio-slow4g-vanilla-fable-qwen.mp4` (1920×968, 6s, silent)

**Alt text:** Six browser recordings in a 2×3 grid loading the same Nonio feed on throttled Slow
4G. Top row is a cold load, bottom row is a warm load; columns are vanilla, Fable's build and
Qwen's build. A timer runs in each panel. At two and a half seconds the vanilla panels are still
blank white while both agent builds already show the full feed of 21 posts.

---

### 2 — both found the same two levers

> Both found the same two biggest levers independently: cache headers, then compression.
>
> Fable found cache at iteration 1 and gzip at 5. Qwen found cache at 14 and gzip at 28.
>
> Same destination, thirteen iterations apart. That head start is most of the story.

**Media:** `charts/e-keep-deltas-ranked.png`

**Alt text:** A ranked bar chart titled "The single changes that actually moved the needle", split
into a Slow 4G panel and a Lighthouse desktop panel. Bars are coloured blue for Fable and amber for
Qwen and are labelled with the change and the milliseconds it removed. The two longest bars are
Fable's iteration 1 cache headers, worth 4,120 ms and 3,640 ms on Slow 4G warm; the longest amber
bars are Qwen's iteration 14 immutable cache headers, worth 525 ms and 388 ms on Lighthouse warm.

---

### 3 — where Fable pulled ahead

> Where Fable pulled ahead: it measured on Slow 4G first, so it could see that 150 ms RTT punishes
> request count, not just bytes.
>
> Bundling the boot module graph took ~30 requests before first paint down to 3. Cold FCP
> 1376 → 968 ms.
>
> Cold load today: 40 requests vs Qwen's 86.

**Media:** `charts/f-slow4g-head-to-head.png`

**Alt text:** A three-panel bar chart comparing vanilla, Fable and Qwen builds on Slow 4G. Cold
first contentful paint and largest contentful paint: vanilla 4180 and 4700 ms, Fable 768 and 816
ms, Qwen 2004 and 2440 ms. Warm: vanilla 4180 and 4208 ms, Fable 228 ms, Qwen 232 ms. Bytes over
the wire: vanilla 690 KB cold and warm, Fable 104 KB cold and 0.3 KB warm, Qwen 158 KB cold and 8
KB warm.

---

### 4 — the brotli own-goal

> Best miss: Qwen tried brotli, measured cold FCP +168 ms, reverted. Correct call — it was
> compressing at quality 11 on every request, ~165 ms of CPU per load.
>
> Fable kept brotli, because it had added a compressed-output cache three iterations earlier.
>
> Qwen added the same cache two iterations too late.

**Media:** `charts/a-lighthouse-cold.png`

**Alt text:** Two line charts of Lighthouse desktop cold first contentful paint and largest
contentful paint against iteration number, blue for Fable and amber for Qwen. Fable's line ends
around 366 and 564 ms; Qwen's ends around 423 and 785 ms after a visible spike back to 596 and 1062
ms at iteration 29, the reverted brotli attempt.

---

### 5 — what Qwen did better

> What Qwen did better: discipline. Faster on every lane or revert. It threw out a 61 ms FCP win
> because LCP moved 112 ms the wrong way. 22 reverts to 6 keeps.
>
> It also caught its own machine drifting mid-lab and spent a whole iteration re-baselining with
> zero code changed.

**Media:** `charts/b-lighthouse-warm.png`

**Alt text:** Two line charts of Lighthouse desktop warm first contentful paint and largest
contentful paint against iteration number. Qwen's amber line sits near 605 ms warm FCP for thirteen
iterations, drops to 217 ms at iteration 14 when cache headers land, then to 177 ms at iteration 28
with gzip. Fable's blue line is already at 184 ms warm FCP from iteration 12 onward. Most of Qwen's
points are hollow, marking reverted changes.

---

### 6 — the numbers, and the caveat

> Lighthouse desktop, each against its own baseline:
>
> Fable cold 866→366 FCP, 1290→564 LCP; warm 868→184, 1295→265
> Qwen cold 788→423, 1334→785; warm 790→177, 1258→430
>
> Qwen takes warm FCP by 7 ms. Different machines, so don't read anything under 10% as a win.
>
> Experimental branch. Not merging it.

**Media:** `charts/c-reduction-vs-vanilla.png`

**Alt text:** A grouped bar chart of percent reduction against each track's own vanilla baseline.
On Lighthouse desktop, Fable cuts cold FCP 58%, cold LCP 56%, warm FCP 79% and warm LCP 80%; Qwen
cuts 46%, 41%, 78% and 66%. A third hatched group shows Fable's Slow 4G reductions of 81%, 82%, 96%
and 95%, labelled as Fable-only because the Qwen track ran no throttled harness.

---

## Standalone tweet

> Two coding agents, one night each, same task: make this feed load faster. Same 21-post fixture,
> same seed commit.
>
> Slow 4G cold: vanilla paints at 4.18s. Fable's build at 0.77s. Qwen 3.8 27B, running locally, at
> 2.00s.
>
> Both found cache headers and gzip on their own. Bundling is what separated them.
>
> Experimental. Not shipped.

**Media:** `video/nonio-slow4g-vanilla-fable-qwen.mp4`, or `stills/grid-t2s5.png` if a single image
is preferred.

**Alt text (still):** A 2×3 grid of browser screenshots taken 2.5 seconds into a Slow 4G load of
the same Nonio feed. The vanilla column is blank white in both the cold and warm rows; the Fable
and Qwen columns both show the full feed of 21 posts with thumbnails.

---

## Media index

| File | Size | Goes with |
|---|---|---|
| `video/nonio-slow4g-vanilla-fable-qwen.mp4` | 1920×968, 6s | tweet 1, standalone |
| `video/clips/vanilla-cold-slow4g.mp4` | 1280×896, 6s | reply/quote material |
| `video/clips/vanilla-warm-slow4g.mp4` | 1280×896, 6s | reply/quote material |
| `video/clips/fable-cold-slow4g.mp4` | 1280×896, 6s | reply/quote material |
| `video/clips/fable-warm-slow4g.mp4` | 1280×896, 6s | reply/quote material |
| `video/clips/qwen-cold-slow4g.mp4` | 1280×896, 6s | reply/quote material |
| `video/clips/qwen-warm-slow4g.mp4` | 1280×896, 6s | reply/quote material |
| `charts/a-lighthouse-cold.png` | 1600×960 | tweet 4 |
| `charts/b-lighthouse-warm.png` | 1600×960 | tweet 5 |
| `charts/c-reduction-vs-vanilla.png` | 1600×950 | tweet 6 |
| `charts/d-fable-slow4g.png` | 1600×960 | spare, Slow 4G detail |
| `charts/e-keep-deltas-ranked.png` | 1600×1040 | tweet 2 |
| `charts/f-slow4g-head-to-head.png` | 1600×920 | tweet 3 |
| `stills/grid-t1s0.png`, `stills/grid-t2s5.png` | 1920×968 | standalone, image-only variant |
| `stills/{vanilla,fable,qwen}-{cold,warm}-t2s5.png` | 1280×896 | single-variant illustrations |

Alt text for the single-variant stills: a browser screenshot 2.5 seconds into a throttled Slow 4G
load of the Nonio feed, labelled with the variant, the lane and the measured FCP, LCP and load
times. The vanilla frames are blank; the Fable and Qwen frames show the full 21-post feed.

## Things to not say

- Do not claim Qwen was measured on Slow 4G during its own lab. It was not; the only Slow 4G
  numbers for its build are the single run recorded for this recap.
- Do not present the two Lighthouse series as same-machine. They are not, and their baselines
  differ by about 10%.
- Do not imply any of this is live on non.io. It is a dev server on two experimental branches.

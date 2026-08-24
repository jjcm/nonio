# SPEED LAB — VPS performance loop (2026-08-24)

Live target: **http://108.61.219.46/** and **https://108-61-219-46.sslip.io/** (same box).
Vultr, 1 vCPU, 1 GB RAM, 3 GB swap, Ubuntu 26.04, MariaDB 11.8. Branch `cursor/speed-vps-loop-27f0`
deployed via `speed-lab/vps/deploy.sh`; services run under systemd (`nonio-*`).

Seeded data (`speed-lab/seed/generate.mjs`, deterministic): 300 users, 40 tags, 2,600 posts
(45% image / 34% text / 13% link / 8% video), 18,053 comments, 13,037 tag votes, 1,689 media
files + 300 avatars fanned out to the CDNs.

## Measurement setup

- Harness runs on a separate cloud VM, **real WAN hop to the VPS: RTT ≈ 53 ms**.
- `speed-lab/harness/measure.mjs`: cold + warm homepage loads, n=7 medians.
  Lanes: `wan` (no throttle) and `slow4g` (CDP: 150 ms latency, 1.6 Mbps down).
- `speed-lab/harness/transitions.mjs`: warm SPA transitions homepage→tag/user/post, n=5 medians
  (fcr / visible / usable), lanes wifi + slow4g.
- `speed-lab/harness/api-timing.sh`: curl TTFB/total medians, on-box and over WAN.
- Full JSON for every run: `speed-lab/results/`.

Decision rule: keep if ≥5% or ≥20 ms on a user-felt median (cold FCP/LCP/feedPaint/allDone,
transition usable), no FCP-only win that regresses LCP. Revert otherwise. Stop after 5
consecutive misses or a clear plateau.

## Baseline (iter00) — the branch as deployed by quickStart-style layout

Six origins: frontend :80, API :4201, avatar :4202, image :4203, video :4204, html :4205.
All HTTP/1.1, no TLS.

API server-side is already fast (prior pass): `/posts` **3 ms** warm on box, 22 ms cold;
over WAN it is pure network (TTFB ≈ 107 ms ≈ 2×RTT).

| metric (median) | wan cold | wan warm | slow4g cold | slow4g warm |
|---|---|---|---|---|
| FCP | 884 | 104 | 2720 | 220 |
| LCP | 1240 | 104 | 6824 | 220 |
| feedPaint | 1224 | 158 | 6816 | 419 |
| allDone | 2568 | 1712 | 31325 | 1956 |
| TBT | 0 | 0 | 0 | 0 |
| requests / transfer | 244 / 256 KB | | same | |

Transitions (usable): slow4g tag 259 / user 292 / post 225; wifi tag 110 / user 110 / post 125.

Read: TBT=0 — the cost is **not JS execution**, it is the network waterfall: 244 requests
(~60 JS modules at depth 2, ~100 post thumbnails, ~100 avatars) over per-origin HTTP/1.1
connection pools. Server SQL/API time is a rounding error at this size.

---

## Iterations

### iter01 — single origin + TLS + HTTP/2/3 via Caddy — **KEEP**

**Hypothesis:** Six plain-HTTP origins cost DNS/TCP setup per origin and serialize 244 requests
on h1.1 pools; collapsing everything onto one TLS origin with h2 multiplexing (h3 via Alt-Svc)
removes the connection ceiling.

**Change:** Caddy 2.11 on 80/443. `/api/*`, `/image/*`, `/avatar/*`, `/video/*`, `/htmlcdn/*`
strip-prefix proxy to the local services; everything else → node frontend (:4200 now).
Let's Encrypt cert on `108-61-219-46.sslip.io`. Frontend config hosts become relative paths
(`/api`, `/image`, …) so both the TLS name and the bare-IP HTTP origin work. VPS-only change +
`speed-lab/vps/` configs; no app code.

| metric | wan cold | slow4g cold | wan warm |
|---|---|---|---|
| FCP | 884 → **568** (−36%) | 2720 → **1988** (−27%) | 104 → 124 |
| LCP | 1240 → **752** (−39%) | 6824 → **3720** (−45%) | 104 → 124 |
| feedPaint | 1224 → **733** (−40%) | 6816 → **3704** (−46%) | 158 → 186 |
| allDone | 2568 → **2217** (−14%) | 31325 → **4084** (−87%) | 1712 → 1723 |

Transitions: post/wifi unchanged; slow4g tag/user +15…48 ms (within run noise for a
rAF-probed metric; watching in later iters). Warm +20 ms from TLS on the first connection —
accepted, cold wins dominate.

**Decision: KEEP.** Largest single change available to this stack.

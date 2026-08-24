#!/usr/bin/env bash
# speed-lab/harness/api-timing.sh [BASE_API] [N]
# curl timing for the hot API endpoints. Reports median ttfb/total (ms).
# Run locally for WAN numbers, or on the VPS with BASE_API=http://127.0.0.1:4201
# for server-side numbers.
set -euo pipefail
BASE="${1:-http://108.61.219.46:4201}"
N="${2:-9}"

paths=(
  "/posts"
  "/posts?tag=photography"
  "/posts?sort=new"
  "/posts?user=speedlab"
  "/posts/speed-lab-measured-post"
  "/comments?post=speed-lab-measured-post"
  "/tags"
)

med() { sort -n | awk '{a[NR]=$1} END {print (NR%2 ? a[(NR+1)/2] : (a[NR/2]+a[NR/2+1])/2)}'; }

for p in "${paths[@]}"; do
  ttfbs=(); totals=(); size=0
  for _ in $(seq "$N"); do
    out=$(curl -s -o /dev/null -H 'Accept-Encoding: gzip' \
      -w '%{time_starttransfer} %{time_total} %{size_download}' "$BASE$p")
    ttfbs+=("$(awk '{printf "%.1f", $1*1000}' <<<"$out")")
    totals+=("$(awk '{printf "%.1f", $2*1000}' <<<"$out")")
    size=$(awk '{print $3}' <<<"$out")
  done
  mt=$(printf '%s\n' "${ttfbs[@]}" | med)
  mo=$(printf '%s\n' "${totals[@]}" | med)
  printf '%-42s ttfb %7.1fms total %7.1fms gzip %6dB\n' "$p" "$mt" "$mo" "$size"
done

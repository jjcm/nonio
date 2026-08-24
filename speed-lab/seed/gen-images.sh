#!/usr/bin/env bash
# speed-lab/seed/gen-images.sh
# Generate 24 photo-entropy source images x 3 aspects (full + thumbnail webp)
# into srcimg/. Run locally; srcimg/ is rsynced to the VPS and fanned out by
# media-fanout.sh. Requires ffmpeg with libwebp.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
mkdir -p srcimg

gen() { # idx aspect W H tw th
  local i=$1 a=$2 W=$3 H=$4 tw=$5 th=$6
  local full="srcimg/src-$i-$a.webp" thumb="srcimg/src-$i-$a-thumb.webp"
  [[ -f $full && -f $thumb ]] && return 0
  # gradients + uniform noise + slight blur: compresses like a photo, not a chart
  ffmpeg -hide_banner -loglevel error -y \
    -f lavfi -i "gradients=size=${W}x${H}:n=$((3 + i % 5)):seed=$((1000 + i))" \
    -vf "noise=alls=$((12 + i % 14)):allf=u,gblur=sigma=0.9" \
    -frames:v 1 -c:v libwebp -quality 82 "$full"
  ffmpeg -hide_banner -loglevel error -y -i "$full" \
    -vf "scale=${tw}:${th}" -c:v libwebp -quality 80 "$thumb"
}

for i in $(seq 0 23); do
  gen "$i" 16x9 1280 720 640 360
  gen "$i" 4x3 1200 900 600 450
  gen "$i" 9x16 810 1440 405 720
  gen "$i" sq 512 512 96 96
done

# default avatar fallback the frontend requests when a user has none
[[ -f srcimg/default.png ]] || ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "gradients=size=96x96:n=2:seed=7" -frames:v 1 srcimg/default.png

du -sh srcimg
ls srcimg | wc -l

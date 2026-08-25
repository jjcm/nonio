#!/usr/bin/env bash
# speed-lab/seed/media-fanout.sh
# Runs ON the VPS after rsync. Hardlinks source media to per-slug CDN paths
# per media-manifest.tsv (slug \t kind \t srcIdx \t aspect).
set -euo pipefail
ROOT="${1:-$HOME/nonio}"
SEED="$ROOT/speed-lab/seed"
SRC="$SEED/srcimg"
MAN="$SEED/media-manifest.tsv"
IMG="$ROOT/nonio-image-cdn/files"
VID="$ROOT/nonio-video-cdn/files"
AVA="$ROOT/nonio-avatar-cdn/files"
VIDEO_FIXTURE="$ROOT/speed-lab/fixtures/videos/sl-vid-01.mp4"

[[ -f $MAN ]] || { echo "missing $MAN" >&2; exit 1; }
[[ -d $SRC ]] || { echo "missing $SRC" >&2; exit 1; }

mkdir -p "$IMG/images" "$IMG/thumbnails" "$VID/videos" "$VID/thumbnails" "$AVA/images" "$AVA/thumbnails"
[[ -f $SRC/default.png ]] && ln -f "$SRC/default.png" "$AVA/thumbnails/default.png" && ln -f "$SRC/default.png" "$AVA/images/default.png"

n=0
while IFS=$'\t' read -r slug kind idx aspect; do
  [[ -z $slug ]] && continue
  full="$SRC/src-$idx-$aspect.webp"
  thumb="$SRC/src-$idx-$aspect-thumb.webp"
  if [[ $kind == avatar ]]; then
    ln -f "$full" "$AVA/images/$slug.webp"
    ln -f "$thumb" "$AVA/thumbnails/$slug.webp"
  elif [[ $kind == video ]]; then
    ln -f "$VIDEO_FIXTURE" "$VID/videos/$slug.mp4"
    ln -f "$thumb" "$VID/thumbnails/$slug.webp"
    ln -f "$thumb" "$IMG/thumbnails/$slug.webp"
  else
    ln -f "$full" "$IMG/images/$slug.webp"
    ln -f "$thumb" "$IMG/thumbnails/$slug.webp"
  fi
  n=$((n + 1))
done < "$MAN"
echo "fanned out $n media entries"

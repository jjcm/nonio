#!/usr/bin/env bash
# EXPERIMENTAL lab tool — boot one frontend variant on :4200 and record it.
# Backend (:4201) and the CDNs (:4202-4205) stay up across variants; only the
# soci-frontend checkout changes, so all three variants serve the same fixture.
#
# Usage: run-variant.sh <label> <frontend-worktree> <out-dir> <recorder-dir>
set -euo pipefail

LABEL="$1"; FE="$2"; OUT="$3"; REC="$4"

fuser -k 4200/tcp 2>/dev/null || true
sleep 2
( cd "$FE" && nohup npm start > "/tmp/fe-$LABEL.log" 2>&1 & )

for _ in $(seq 1 90); do
  curl -sf -o /dev/null http://127.0.0.1:4200/ && break
  sleep 1
done
curl -sf -o /dev/null http://127.0.0.1:4200/ || { echo "$LABEL: :4200 never came up"; tail -20 "/tmp/fe-$LABEL.log"; exit 1; }

POSTS=$(curl -s http://127.0.0.1:4201/posts | grep -o '"ID"' | wc -l)
[ "$POSTS" = "21" ] || { echo "$LABEL: expected 21 fixture posts, got $POSTS" >&2; exit 1; }

# Fingerprints that distinguish the three variants on the wire. These must be
# GETs: both lab servers only reach their compression path on a real body.
HDRS=$(curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip, br' http://127.0.0.1:4200/soci.js | tr -d '\r')
EMBED=$(curl -s http://127.0.0.1:4200/ | grep -c '__sociPreload' || true)
ENC=$(awk -F': ' 'tolower($1)=="content-encoding"{print $2}' <<< "$HDRS")
CC=$(awk -F': ' 'tolower($1)=="cache-control"{print $2}' <<< "$HDRS")
echo "$LABEL: $FE @ $(cd "$FE" && git rev-parse --short HEAD) | 21 posts | embedded /posts: ${EMBED:-0} | soci.js encoding: ${ENC:-none} | cache-control: ${CC:-none}"

# Warm the server's own boot-time work (esbuild bundles, compiled pug, gzip
# caches) so the recording measures the browser, not a one-shot server start.
for _ in 1 2 3; do curl -s -o /dev/null -H 'Accept-Encoding: gzip, br' http://127.0.0.1:4200/; done
sleep 2

node "$REC/record.mjs" "$LABEL" "$OUT"

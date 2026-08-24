#!/usr/bin/env bash
# speed-lab/vps/deploy.sh
# Build Go binaries locally (same arch as VPS), rsync the tree, restart units.
# Usage: deploy.sh [--seed] [--skip-build] [--migrate]
set -euo pipefail

VPS="fable@108.61.219.46"
KEY="$HOME/.ssh/nonio_vps"
SSH_CMD="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

SEED=0; BUILD=1; MIGRATE=0
for a in "$@"; do
  case "$a" in
    --seed) SEED=1 ;;
    --skip-build) BUILD=0 ;;
    --migrate) MIGRATE=1 ;;
  esac
done

if [[ $BUILD == 1 ]]; then
  echo "== build =="
  (cd "$ROOT/soci-backend/cmd" && GOFLAGS=-buildvcs=false go build -o ../dist/socid .) &
  for d in avatar image video html; do
    (cd "$ROOT/soci-$d-cdn" && GOFLAGS=-buildvcs=false CGO_ENABLED=0 go build -o "$d-cdn" .) &
  done
  wait
fi

echo "== rsync =="
rsync -az --delete -e "$SSH_CMD" \
  --exclude .git \
  --exclude node_modules \
  --exclude 'soci-*-cdn/files' \
  --exclude 'soci-frontend/config.js' \
  --exclude 'speed-lab/harness/*.json' \
  --exclude 'speed-lab/results' \
  --exclude nonio-simulator \
  --exclude nonio-tui \
  "$ROOT/" "$VPS:nonio/"

echo "== remote setup =="
$SSH_CMD $VPS bash -s <<'REMOTE'
set -euo pipefail
cd ~/nonio
cp speed-lab/vps/config.vps.js soci-frontend/config.js
for d in avatar image video html; do
  port=$((4202 + $(printf '%s\n' avatar image video html | grep -n "^$d$" | cut -d: -f1) - 1))
  printf '{\n  "port": "%s",\n  "api_host": "http://127.0.0.1:4201"\n}\n' "$port" > "soci-$d-cdn/config.json"
done
cd soci-frontend && npm i --omit=dev --no-audit --no-fund --silent 2>&1 | tail -1 || true
REMOTE

if [[ $MIGRATE == 1 ]]; then
  echo "== migrate =="
  $SSH_CMD $VPS '~/nonio/bin/goose -dir ~/nonio/soci-backend/migrations mysql "dbuser:password@tcp(127.0.0.1:3306)/socidb?parseTime=true" up'
fi

if [[ $SEED == 1 ]]; then
  echo "== seed =="
  $SSH_CMD $VPS 'mariadb -h 127.0.0.1 -u dbuser -ppassword socidb < ~/nonio/speed-lab/seed/seed-big.sql && bash ~/nonio/speed-lab/seed/media-fanout.sh'
fi

echo "== restart =="
$SSH_CMD $VPS 'sudo cp ~/nonio/speed-lab/vps/units/*.service /etc/systemd/system/ && sudo systemctl daemon-reload; if command -v caddy >/dev/null; then sudo cp ~/nonio/speed-lab/vps/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy 2>/dev/null || sudo systemctl restart caddy; fi; sudo systemctl restart nonio-api nonio-frontend nonio-avatar-cdn nonio-image-cdn nonio-video-cdn nonio-html-cdn && sleep 1 && systemctl is-active nonio-api nonio-frontend nonio-avatar-cdn nonio-image-cdn nonio-video-cdn nonio-html-cdn'

echo "deploy done"

#!/usr/bin/env bash
# speed-lab/boot.sh — bring up the local nonio stack for transition measurement.
# LAB ONLY. Not for production.
#
# Services:
#   4200 frontend (node dev server)   4201 api (Go)
#   4202 avatar-cdn  4203 image-cdn  4204 video-cdn
set -uo pipefail

ROOT="${NONIO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
LOG=/tmp/speed-lab
mkdir -p "$LOG"
export PATH="$PATH:/home/ubuntu/go/bin"

wait_port() {
  local port=$1 name=$2 tries=${3:-60}
  for _ in $(seq "$tries"); do
    curl -sf -o /dev/null "http://localhost:$port" 2>/dev/null && { echo "  $name :$port up"; return 0; }
    # some services answer 404 on / but are listening
    (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && { echo "  $name :$port listening"; return 0; }
    sleep 1
  done
  echo "  !! $name :$port did not come up (see $LOG/$name.log)"
  return 1
}

start_mariadb() {
  mariadb -h 127.0.0.1 -u dbuser -ppassword -e 'SELECT 1' >/dev/null 2>&1 && { echo "  mariadb up"; return 0; }
  sudo mkdir -p /run/mysqld && sudo chown mysql:mysql /run/mysqld
  sudo -u mysql mariadbd > "$LOG/mariadb.log" 2>&1 &
  for _ in $(seq 60); do
    mariadb -h 127.0.0.1 -u dbuser -ppassword -e 'SELECT 1' >/dev/null 2>&1 && { echo "  mariadb up"; return 0; }
    sleep 1
  done
  echo "  !! mariadb did not come up"; return 1
}

start_api() {
  (exec 3<>/dev/tcp/127.0.0.1/4201) 2>/dev/null && { echo "  api :4201 already up"; return 0; }
  cd "$ROOT/soci-backend/cmd" && go build -o ../dist/noniod || return 1
  cd "$ROOT/soci-backend"
  env APP_KEY=asdfa323faefjifajwiefawef WEB_HOST=http://localhost:4200 \
      DB_HOST=127.0.0.1 DB_PORT=3306 DB_DATABASE=socidb DB_USER=dbuser DB_PASSWORD=password \
      APP_PORT=4201 ADMIN_EMAIL=nonio@non.io ADMIN_EMAIL_PASSWORD=x \
      LIVEKIT_URL=http://localhost:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret \
      STRIPE_SECRET_KEY=sk_test_lab STRIPE_PUBLISHABLE_KEY=pk_test_lab WEBHOOK_ENDPOINT_SECRET= \
      DEV_TOOLS_ENABLED=true DEV_SUBSCRIPTION_PAYOUTS=true PAYOUT_CYCLE_DAYS=1 \
      ./dist/noniod > "$LOG/api.log" 2>&1 &
  wait_port 4201 api
}

start_cdn() {
  local dir=$1 port=$2
  (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && { echo "  $dir :$port already up"; return 0; }
  cd "$ROOT/$dir" || return 1
  [[ -f config.json ]] || cp config.json.example config.json
  go build -o "$dir" main.go || return 1
  "./$dir" > "$LOG/$dir.log" 2>&1 &
  wait_port "$port" "$dir"
}

start_frontend() {
  (exec 3<>/dev/tcp/127.0.0.1/4200) 2>/dev/null && { echo "  frontend :4200 already up"; return 0; }
  cd "$ROOT/soci-frontend"
  [[ -f config.js ]] || cp config.js.example config.js
  [[ -d node_modules ]] || npm install --silent
  node index.js > "$LOG/frontend.log" 2>&1 &
  wait_port 4200 frontend
}

echo "speed-lab: booting stack from $ROOT"
start_mariadb
cd "$ROOT/soci-backend/migrations" && goose mysql "dbuser:password@tcp(127.0.0.1:3306)/socidb" up >/dev/null 2>&1
start_api
start_cdn soci-avatar-cdn 4202
start_cdn soci-image-cdn 4203
start_cdn soci-video-cdn 4204
start_frontend
echo "speed-lab: stack ready. logs in $LOG"

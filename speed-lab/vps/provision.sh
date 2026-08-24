#!/usr/bin/env bash
# speed-lab/vps/provision.sh
# One-time VPS setup. Run ON the VPS as fable (passwordless sudo).
# Packages (mariadb-server, nodejs, npm, rsync, brotli, curl, jq) are assumed
# installed already (apt). Idempotent.
set -euo pipefail

echo "== database =="
sudo mariadb <<'SQL'
CREATE DATABASE IF NOT EXISTS socidb;
CREATE USER IF NOT EXISTS 'dbuser'@'localhost' IDENTIFIED BY 'password';
CREATE USER IF NOT EXISTS 'dbuser'@'127.0.0.1' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON socidb.* TO 'dbuser'@'localhost';
GRANT ALL PRIVILEGES ON socidb.* TO 'dbuser'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

echo "== api env =="
mkdir -p ~/env
if [[ ! -f ~/env/api.env ]]; then
  cat > ~/env/api.env <<EOF
APP_KEY=$(head -c 32 /dev/urandom | base64 | tr -d '/+=')
APP_PORT=4201
WEB_HOST=http://108.61.219.46
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=socidb
DB_USER=dbuser
DB_PASSWORD=password
STRIPE_SECRET_KEY=sk_test_51EpA4oH4gvdXgbs5rBv4JI29C38uWuNEGuB8Agt5hfya1fjgVGOQePyfj7x6ANDPE7hyYNZEMRWwkP93NAa7QTCl00GPr79F0w
STRIPE_PUBLISHABLE_KEY=pk_test_51EpA4oH4gvdXgbs5r0aq0i3U6IzOwbWRVYaBYXMFLLHvihVHGHotHPAi2EJ7Km9JqudFZyLE30kt2YQSUOSK88Xx00Q6eEqxmS
WEBHOOK_ENDPOINT_SECRET=
ADMIN_EMAIL=nonio@non.io
ADMIN_EMAIL_PASSWORD=unused
LIVEKIT_URL=http://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
DEV_TOOLS_ENABLED=false
EOF
  echo "wrote ~/env/api.env"
fi

echo "== systemd units =="
sudo cp ~/nonio/speed-lab/vps/units/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable nonio-api nonio-frontend nonio-avatar-cdn nonio-image-cdn nonio-video-cdn nonio-html-cdn

echo "== perms (caddy file_server needs to traverse into ~/nonio) =="
chmod o+x "$HOME" "$HOME/nonio" 2>/dev/null || true

echo "== firewall =="
if command -v ufw >/dev/null && sudo ufw status | grep -q 'Status: active'; then
  for p in 80 443 4201 4202 4203 4204 4205; do sudo ufw allow "$p"/tcp; done
fi

echo "provision done"

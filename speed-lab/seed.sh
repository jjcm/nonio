#!/usr/bin/env bash
# speed-lab/seed.sh
# Copy committed fixtures into local CDN file trees and apply seed.sql.
# EXPERIMENTAL. Run from a nonio superrepo checkout. Do not use in production.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# ROOT of nonio checkout (parent of speed-lab/)
if [[ -n "${NONIO_ROOT:-}" ]]; then
  ROOT="$NONIO_ROOT"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

FIX="$SCRIPT_DIR/fixtures"
SQL="$SCRIPT_DIR/seed.sql"

die() { echo "speed-lab/seed.sh: $*" >&2; exit 1; }

[[ -d "$FIX/images" ]] || die "missing $FIX/images"
[[ -f "$SQL" ]] || die "missing $SQL"

IMG_CDN="$ROOT/nonio-image-cdn/files"
VID_CDN="$ROOT/nonio-video-cdn/files"

mkdir -p "$IMG_CDN/images" "$IMG_CDN/thumbnails" "$VID_CDN/videos" "$VID_CDN/thumbnails"

echo "Copying image fixtures -> nonio-image-cdn/files/images/"
cp -f "$FIX/images/"*.webp "$IMG_CDN/images/"

echo "Copying image thumbnails -> nonio-image-cdn/files/thumbnails/"
cp -f "$FIX/thumbnails/"sl-img-*.webp "$IMG_CDN/thumbnails/"

echo "Copying video fixture -> nonio-video-cdn/files/videos/"
cp -f "$FIX/videos/sl-vid-01.mp4" "$VID_CDN/videos/"

echo "Copying video poster -> nonio-video-cdn/files/thumbnails/"
cp -f "$FIX/thumbnails/sl-vid-01.webp" "$VID_CDN/thumbnails/"

# DB creds: env overrides, then nonio-backend config.json, then localRun.sh, then defaults.
MYSQL_HOST="${MYSQL_HOST:-}"
MYSQL_PORT="${MYSQL_PORT:-}"
MYSQL_USER="${MYSQL_USER:-}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"
MYSQL_DATABASE="${MYSQL_DATABASE:-}"

read_json_field() {
  # $1 file, $2 key (best-effort, no jq required)
  local file="$1" key="$2"
  python3 - "$file" "$key" <<'PY' 2>/dev/null || true
import json, sys
path, key = sys.argv[1], sys.argv[2]
try:
    data = json.load(open(path))
except Exception:
    sys.exit(0)
# try several common shapes
candidates = [key]
low = {
    "user": ["dbUser", "db_user", "user", "username", "DB_USER"],
    "password": ["dbPassword", "db_password", "password", "DB_PASSWORD"],
    "database": ["dbDatabase", "db_database", "database", "db", "DB_DATABASE"],
    "host": ["dbHost", "db_host", "host", "DB_HOST"],
    "port": ["dbPort", "db_port", "port", "DB_PORT"],
}
if key in low:
    candidates = low[key]
for c in candidates:
    if c in data and data[c] not in (None, ""):
        print(data[c])
        break
    db = data.get("db") or data.get("mysql") or data.get("database") or {}
    if isinstance(db, dict) and c in db and db[c] not in (None, ""):
        print(db[c])
        break
PY
}

parse_localrun() {
  local file="$1" var="$2"
  # export DB_USER="dbuser"
  grep -E "^[[:space:]]*(export[[:space:]]+)?${var}=" "$file" 2>/dev/null | tail -n1 | sed -E "s/^[^=]+=//; s/^['\"]//; s/['\"]$//" || true
}

CFG_JSON="$ROOT/nonio-backend/config.json"
LOCALRUN=""
if [[ -f "$ROOT/nonio-backend/localRun.sh" ]]; then
  LOCALRUN="$ROOT/nonio-backend/localRun.sh"
elif [[ -f "$ROOT/nonio-backend/localrun.sh" ]]; then
  LOCALRUN="$ROOT/nonio-backend/localrun.sh"
fi

if [[ -z "$MYSQL_USER" && -f "$CFG_JSON" ]]; then
  MYSQL_USER="$(read_json_field "$CFG_JSON" user)"
  MYSQL_PASSWORD="$(read_json_field "$CFG_JSON" password)"
  MYSQL_DATABASE="$(read_json_field "$CFG_JSON" database)"
  MYSQL_HOST="$(read_json_field "$CFG_JSON" host)"
  MYSQL_PORT="$(read_json_field "$CFG_JSON" port)"
fi

if [[ -n "$LOCALRUN" ]]; then
  [[ -z "$MYSQL_USER" ]] && MYSQL_USER="$(parse_localrun "$LOCALRUN" DB_USER)"
  [[ -z "${MYSQL_PASSWORD:-}" ]] && MYSQL_PASSWORD="$(parse_localrun "$LOCALRUN" DB_PASSWORD)"
  [[ -z "$MYSQL_DATABASE" ]] && MYSQL_DATABASE="$(parse_localrun "$LOCALRUN" DB_DATABASE)"
  [[ -z "$MYSQL_HOST" ]] && MYSQL_HOST="$(parse_localrun "$LOCALRUN" DB_HOST)"
  [[ -z "$MYSQL_PORT" ]] && MYSQL_PORT="$(parse_localrun "$LOCALRUN" DB_PORT)"
fi

# Documented defaults (override with MYSQL_*). localRun.sh typically uses dbuser/password/socidb.
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_PASSWORD="${MYSQL_PASSWORD:-}"
MYSQL_DATABASE="${MYSQL_DATABASE:-nonio}"

echo "Applying $SQL to ${MYSQL_USER}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}"

MYSQL_ARGS=( -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "$MYSQL_DATABASE" )
export MYSQL_PWD="${MYSQL_PASSWORD}"

mysql "${MYSQL_ARGS[@]}" < "$SQL"

unset MYSQL_PWD
echo "speed-lab seed applied."
echo "Frontend loads: IMAGE_HOST/{url}.webp (localhost:4203)  THUMBNAIL_HOST/{url}.webp  VIDEO_HOST/{url}.mp4 (localhost:4204)"

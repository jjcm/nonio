#!/usr/bin/env bash
# Nonio quick start - one clone, one command. No submodules.
#
# Ports:
#   4200 frontend    4201 api          4202 avatar-cdn
#   4203 image-cdn   4204 video-cdn    4205 html-cdn
#   3306 mysql/mariadb
cd "$(dirname "$0")"

for bin in go node npm screen; do
  command -v "$bin" >/dev/null || { echo "Missing dependency: $bin"; exit 1; }
done
command -v goose >/dev/null || {
  echo "Missing goose (DB migrations). Install with:"
  echo "  go install github.com/pressly/goose/cmd/goose@latest"
  exit 1
}

# MySQL: reuse whatever already listens on 3306, otherwise bring up mariadb in docker.
if ! (exec 3<>/dev/tcp/127.0.0.1/3306) 2>/dev/null; then
  echo "Nothing on :3306 - starting mariadb via docker..."
  command -v docker >/dev/null || {
    echo "Install docker, or run your own MySQL/MariaDB on 3306 with database" \
         "'socidb' and user dbuser/password (see nonio-backend/localRun.sh)."
    exit 1
  }
  docker start soci-db >/dev/null 2>&1 || docker run -d --name soci-db -p 3306:3306 \
    -e MARIADB_ROOT_PASSWORD=password -e MARIADB_DATABASE=socidb \
    -e MARIADB_USER=dbuser -e MARIADB_PASSWORD=password mariadb:11 >/dev/null
  printf 'Waiting for mysql'
  until (exec 3<>/dev/tcp/127.0.0.1/3306) 2>/dev/null; do printf .; sleep 1; done
  echo ' up.'
fi

screen -AdmS nonio -t frontend bash -c "bash --init-file <(echo 'cd nonio-frontend; npm i; npm start;')"
screen -S nonio -X screen -t api bash -c "bash --init-file <(echo 'cd nonio-backend; ./localRun.sh')"
screen -S nonio -X screen -t avatar-cdn bash -c "bash --init-file <(echo 'cd nonio-avatar-cdn; go build -o avatar-cdn .; ./avatar-cdn')"
screen -S nonio -X screen -t image-cdn bash -c "bash --init-file <(echo 'cd nonio-image-cdn; go build -o image-cdn .; ./image-cdn')"
screen -S nonio -X screen -t video-cdn bash -c "bash --init-file <(echo 'cd nonio-video-cdn; go build -o video-cdn .; ./video-cdn')"
screen -S nonio -X screen -t html-cdn bash -c "bash --init-file <(echo 'cd nonio-html-cdn; go build -o html-cdn .; ./html-cdn')"
screen -rD nonio

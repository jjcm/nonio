screen -AdmS soci -t frontend bash -c "bash --init-file <(echo 'cd soci-frontend; npm i; npm start;')"
screen -S soci -X screen -t api bash -c "bash --init-file <(echo 'cd soci-backend; ./localRun.sh')"
screen -S soci -X screen -t avatar-cdn bash -c "bash --init-file <(echo 'cd soci-avatar-cdn; go build -o avatar-cdn main.go; ./avatar-cdn')"
screen -S soci -X screen -t image-cdn bash -c "bash --init-file <(echo 'cd soci-image-cdn; go build -o image-cdn main.go; ./image-cdn')"
screen -S soci -X screen -t video-cdn bash -c "bash --init-file <(echo 'cd soci-video-cdn; go build -o video-cdn main.go; ./video-cdn')"
screen -rD soci

#!/bin/bash

# let's build the web server!
cd cmd

# this command will build a staticly linked binary for 64 bit linux systems
# and place it in the dist folder
echo "Building linux binary..."
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o ../dist/socid
echo "done!"
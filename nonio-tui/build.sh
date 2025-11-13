#!/bin/bash

# Build script for nonio-tui

echo "Building nonio-tui..."

cd "$(dirname "$0")"

# Download dependencies
go mod download

# Build the binary
go build -o nonio-tui .

if [ $? -eq 0 ]; then
    echo "✓ Build successful! Binary: ./nonio-tui"
else
    echo "✗ Build failed!"
    exit 1
fi


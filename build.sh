#!/bin/bash

# Install dependencies
npm install

# Create dist directory if it doesn't exist
mkdir -p dist

# Build TypeScript
npm run build

# Ensure proper permissions
chmod +x dist/server.js || true
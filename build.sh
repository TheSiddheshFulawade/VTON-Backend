#!/bin/bash

# Install dependencies
npm install

# Clean dist directory
npm run clean

# Build TypeScript
npm run build

# Make start script executable
chmod +x dist/server.js
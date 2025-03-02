#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting build process..."

# Update npm to latest
echo "Updating npm..."
npm install -g npm@latest

# Install build essentials if needed (for Linux environments)
if [[ "$(uname)" == "Linux" ]]; then
  echo "Linux detected, ensuring build tools are installed..."
  apt-get update || echo "Skipping apt-get update, may not have permission"
  apt-get install -y build-essential python3 || echo "Skipping apt install, may not have permission"
fi

# Install node-gyp globally
echo "Installing node-gyp..."
npm install -g node-gyp

# Clean npm cache and reinstall dependencies
echo "Cleaning npm cache..."
npm cache clean --force

# Install dependencies, bypassing the problematic postinstall script for now
echo "Installing dependencies..."
npm ci --ignore-scripts || npm install --ignore-scripts

# Explicitly install latest bcrypt
echo "Installing latest bcrypt..."
npm install bcrypt@latest --save --build-from-source

# Rebuild bcrypt specifically
echo "Rebuilding bcrypt..."
npm rebuild bcrypt --build-from-source

echo "Testing bcrypt installation..."
node -e "try { const bcrypt = require('bcrypt'); console.log('✅ bcrypt version:', bcrypt.version || 'unknown'); console.log('✅ bcrypt installed successfully!'); } catch(e) { console.error('❌ bcrypt still not working:', e); process.exit(1); }"

echo "Build completed successfully"
exit 0

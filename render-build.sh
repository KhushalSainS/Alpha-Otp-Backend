#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting build process..."

# Install dependencies without running scripts
npm ci --ignore-scripts

# Install node-pre-gyp globally - this helps with bcrypt issues
echo "Installing node-pre-gyp..."
npm install -g node-pre-gyp

# Rebuild bcrypt specifically for the platform
echo "Rebuilding bcrypt..."
cd node_modules/bcrypt && npm install --build-from-source
cd ../..

echo "Build completed successfully"
exit 0

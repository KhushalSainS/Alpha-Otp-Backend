#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting build process..."

# Update npm to latest
echo "Updating npm..."
npm install -g npm@latest

# Clean npm cache 
echo "Cleaning npm cache..."
npm cache clean --force

# Remove node_modules if exists
if [ -d "node_modules" ]; then
  echo "Removing existing node_modules..."
  rm -rf node_modules
fi

# Remove package-lock.json if exists
if [ -f "package-lock.json" ]; then
  echo "Removing package-lock.json..."
  rm package-lock.json
fi

# Install dependencies
echo "Installing dependencies..."
npm install --no-optional

# Ensure bcryptjs is properly installed
echo "Verifying bcryptjs installation..."
node -e "try { require('bcryptjs'); console.log('✅ bcryptjs installed successfully!'); } catch(e) { console.error('❌ bcryptjs failed to load:', e); process.exit(1); }"

echo "Build completed successfully"
exit 0

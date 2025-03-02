#!/bin/bash

# Install dependencies
npm ci

# Rebuild bcrypt specifically for the platform
npm rebuild bcrypt --build-from-source

# Exit with success
exit 0

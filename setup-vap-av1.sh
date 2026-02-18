#!/bin/bash
# Setup script for vap-agent-sdk on vap-av1
# Handles the monorepo git dependency issue

set -e

echo "Setting up VAP Agent SDK..."

# Clean up
rm -rf node_modules pnpm-lock.yaml

# Install dependencies except @bitgo/utxo-lib
echo "Installing dependencies (without @bitgo/utxo-lib)..."
cat > package.json.tmp << 'EOF'
{
  "name": "@autobb/vap-agent",
  "version": "0.2.0",
  "description": "SDK for AI agents to register, transact, and work on the Verus Agent Platform — no daemon required",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "postinstall": "node scripts/postinstall.js",
    "prepare": "tsc",
    "test": "node --test test/*.test.ts",
    "lint": "tsc --noEmit"
  },
  "keywords": [
    "verus",
    "verusid",
    "agent",
    "marketplace",
    "blockchain",
    "identity",
    "sdk"
  ],
  "bin": {
    "vap": "./bin/vap.js"
  },
  "author": "AutoBB",
  "license": "MIT",
  "dependencies": {
    "bn.js": "^5.2.2",
    "json-canonicalize": "^2.0.0",
    "socket.io-client": "^4.8.3"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  }
}
EOF

# Temporarily rename package.json
mv package.json package.json.orig
mv package.json.tmp package.json

# Install other deps
npx pnpm install

# Restore original package.json
mv package.json.orig package.json

# Now manually set up @bitgo/utxo-lib from Verus fork
echo "Setting up @bitgo/utxo-lib from Verus fork..."
mkdir -p node_modules/@bitgo
rm -rf node_modules/@bitgo/utxo-lib

# Create a temporary directory
TMPDIR=$(mktemp -d)
cd "$TMPDIR"

# Clone the full repo
git clone --depth 1 https://github.com/VerusCoin/BitGoJS.git

# Checkout specific commit
cd BitGoJS
git fetch --depth 1 origin ceca7ff324da88230e138709a8288f6b5dbc7d56
git checkout ceca7ff324da88230e138709a8288f6b5dbc7d56

# Copy the utxo-lib module
cp -r modules/utxo-lib ~/vap-agent-sdk/node_modules/@bitgo/utxo-lib

# Go back and cleanup
cd ~/vap-agent-sdk
rm -rf "$TMPDIR"

# Install deps for utxo-lib
cd node_modules/@bitgo/utxo-lib
npx pnpm install --ignore-scripts 2>/dev/null || npm install --ignore-scripts 2>/dev/null || true

# Build utxo-lib
npx tsc --build --incremental . 2>/dev/null || true

cd ~/vap-agent-sdk

# Build SDK
echo "Building SDK..."
npx pnpm run build

echo "✅ Setup complete!"
echo ""
echo "Run: node register-ari3-standalone.cjs"

#!/bin/bash
# Setup script for vap-agent-sdk on vap-av1
# Handles the monorepo git dependency issue

set -e

echo "Setting up VAP Agent SDK..."

# Clean up everything
rm -rf node_modules pnpm-lock.yaml

# Create a local directory for BitGoJS
echo "Cloning Verus BitGoJS fork..."
mkdir -p node_modules/@bitgo

# Create a temporary directory
TMPDIR=$(mktemp -d)
cd "$TMPDIR"

# Clone the full repo
git clone --depth 1 https://github.com/VerusCoin/BitGoJS.git

# Checkout specific commit
cd BitGoJS
git fetch --depth 1 origin ceca7ff324da88230e138709a8288f6b5dbc7d56
git checkout ceca7ff324da88230e138709a8288f6b5dbc7d56

# Build the utxo-lib module
cd modules/utxo-lib
echo "Installing utxo-lib dependencies..."
npm install --ignore-scripts

echo "Building utxo-lib..."
npx tsc --build . || true

# Copy the built module to the right place
cd ~/vap-agent-sdk
rm -rf node_modules/@bitgo/utxo-lib
mkdir -p node_modules/@bitgo/utxo-lib
cp -r "$TMPDIR/BitGoJS/modules/utxo-lib/"* node_modules/@bitgo/utxo-lib/

# Cleanup
cd ~
rm -rf "$TMPDIR"

# Go back to SDK directory
cd ~/vap-agent-sdk

# Now install SDK dependencies WITHOUT @bitgo/utxo-lib
echo "Installing SDK dependencies..."
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

# Temporarily use modified package.json
mv package.json package.json.orig
mv package.json.tmp package.json

# Install deps with pnpm
npx pnpm install

# Restore original package.json
mv package.json.orig package.json

# Build SDK
echo "Building SDK..."
npx pnpm run build

echo "✅ Setup complete!"
echo ""
echo "Run: node register-ari3-standalone.cjs"

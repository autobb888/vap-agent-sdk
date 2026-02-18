#!/bin/bash
# Setup script for vap-agent-sdk on vap-av1
# Uses pnpm with overrides to fix broken dependencies

set -e

echo "Setting up VAP Agent SDK..."

# Clean up
rm -rf node_modules pnpm-lock.yaml

# Create .npmrc to ignore scripts
 cat > .npmrc << 'EOF'
ignore-scripts=true
EOF

# Create package.json with override for the broken dependency
cat > package.json.override << 'EOF'
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
    "@bitgo/utxo-lib": "git+https://github.com/VerusCoin/BitGoJS.git#ceca7ff324da88230e138709a8288f6b5dbc7d56",
    "bitcoin-ops": "git+https://github.com/VerusCoin/bitcoin-ops.git",
    "bn.js": "^5.2.2",
    "json-canonicalize": "^2.0.0",
    "socket.io-client": "^4.8.3",
    "verus-typescript-primitives": "git+https://github.com/VerusCoin/verus-typescript-primitives.git"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  },
  "pnpm": {
    "overrides": {
      "supertest-as-promised": "4.0.2"
    }
  }
}
EOF

# Backup original and use override
mv package.json package.json.orig
mv package.json.override package.json

# Install with pnpm (should use override)
echo "Installing dependencies..."
npx pnpm install

# Restore original
mv package.json.orig package.json

# Build SDK
echo "Building SDK..."
npx pnpm run build

echo "✅ Setup complete!"
echo ""
echo "Run: node register-ari3-standalone.cjs"

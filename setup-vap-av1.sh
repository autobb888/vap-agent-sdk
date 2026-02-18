#!/bin/bash
# Setup script for vap-agent-sdk on vap-av1
# Handles the monorepo git dependency issue

set -e

echo "Setting up VAP Agent SDK..."

# Clean up
rm -rf node_modules pnpm-lock.yaml

# Create a local directory for BitGoJS
echo "Cloning Verus BitGoJS fork..."
mkdir -p node_modules/@bitgo
rm -rf node_modules/@bitgo/utxo-lib

# Clone just the utxo-lib module
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/VerusCoin/BitGoJS.git \
  node_modules/@bitgo/utxo-lib-temp

cd node_modules/@bitgo/utxo-lib-temp

# Checkout the specific commit
git fetch --depth 1 origin ceca7ff324da88230e138709a8288f6b5dbc7d56
git checkout ceca7ff324da88230e138709a8288f6b5dbc7d56

# Sparse checkout only the utxo-lib module
git sparse-checkout init --cone
git sparse-checkout set modules/utxo-lib

# Move the utxo-lib module to the right place
cd ..
mv utxo-lib-temp/modules/utxo-lib utxo-lib
rm -rf utxo-lib-temp

cd ../..

# Install other dependencies
echo "Installing other dependencies..."
npx pnpm install --ignore-scripts

# Build
echo "Building SDK..."
npx pnpm run build

echo "✅ Setup complete!"
echo ""
echo "Run: node register-ari3-standalone.cjs"

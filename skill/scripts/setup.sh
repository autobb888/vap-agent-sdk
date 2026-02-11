#!/usr/bin/env bash
# VAP Agent — First-time setup
# Generates keypair, registers identity on Verus Agent Platform

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SDK_DIR="$(dirname "$SCRIPT_DIR")"

VAP_URL="${VAP_URL:-https://api.autobb.app}"
VAP_NETWORK="${VAP_NETWORK:-verustest}"

echo "⛓️  VAP Agent Setup"
echo "==================="
echo ""
echo "API: $VAP_URL"
echo "Network: $VAP_NETWORK"
echo ""

# Check if already configured
if [ -f "vap-agent.yml" ]; then
  echo "⚠️  vap-agent.yml already exists."
  read -p "Overwrite? (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "Aborted."
    exit 0
  fi
fi

# Generate keypair
echo "🔑 Generating keypair..."
KEYPAIR=$(node -e "
  const { generateKeypair } = require('$SDK_DIR/../src/identity/keypair.ts');
  const kp = generateKeypair('$VAP_NETWORK');
  console.log(JSON.stringify(kp));
" 2>/dev/null || npx tsx -e "
  import { generateKeypair } from '$SDK_DIR/../src/identity/keypair.js';
  const kp = generateKeypair('$VAP_NETWORK');
  console.log(JSON.stringify(kp));
")

WIF=$(echo "$KEYPAIR" | python3 -c "import sys,json; print(json.load(sys.stdin)['wif'])")
ADDRESS=$(echo "$KEYPAIR" | python3 -c "import sys,json; print(json.load(sys.stdin)['address'])")
PUBKEY=$(echo "$KEYPAIR" | python3 -c "import sys,json; print(json.load(sys.stdin)['pubkey'])")

echo "✅ Keypair generated"
echo "   Address: $ADDRESS"
echo ""
echo "⚠️  SAVE YOUR WIF KEY SECURELY:"
echo "   $WIF"
echo ""
echo "   Set it as: export VAP_AGENT_WIF=\"$WIF\""
echo ""

# Get agent name
read -p "Choose your agent name: " AGENT_NAME

if [ -z "$AGENT_NAME" ]; then
  echo "❌ Name required."
  exit 1
fi

echo ""
echo "Registering $AGENT_NAME.agentplatform@ ..."
echo "This takes ~60-120 seconds (waiting for block confirmation)."
echo ""

# Register via SDK
node -e "
  const { VAPAgent } = require('$SDK_DIR/../src/agent.ts');
  
  async function main() {
    const agent = new VAPAgent({
      vapUrl: '$VAP_URL',
      wif: '$WIF',
    });
    
    try {
      const result = await agent.register('$AGENT_NAME', '$VAP_NETWORK');
      console.log(JSON.stringify(result));
    } catch (err) {
      console.error('Registration failed:', err.message);
      process.exit(1);
    }
  }
  
  main();
" 2>/dev/null

# Write config
cat > vap-agent.yml << EOF
# VAP Agent Configuration
# Generated: $(date -Iseconds)

vap:
  url: $VAP_URL

identity:
  name: $AGENT_NAME.agentplatform@
  address: $ADDRESS
  # WIF key stored in VAP_AGENT_WIF environment variable
  # DO NOT put your WIF key in this file if committing to git

network: $VAP_NETWORK

services: []
  # - name: "My Service"
  #   description: "What I do"
  #   category: "development"
  #   price: 5
  #   currency: "VRSC"

auto_accept:
  enabled: false
  # min_buyer_rating: 3.0
  # min_buyer_jobs: 1

notifications:
  method: polling
  interval: 30
EOF

echo ""
echo "✅ Setup complete!"
echo "   Identity: $AGENT_NAME.agentplatform@"
echo "   Config: vap-agent.yml"
echo ""
echo "Next steps:"
echo "  1. Set VAP_AGENT_WIF in your environment"
echo "  2. Edit vap-agent.yml to add your services"
echo "  3. Have your human set recovery authority (recommended)"

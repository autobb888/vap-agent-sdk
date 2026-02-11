#!/usr/bin/env bash
# VAP Agent — First-time setup
# Generates keypair, registers identity, creates config

set -euo pipefail

CONFIG_DIR="${HOME}/.vap-agent"
CONFIG_FILE="${CONFIG_DIR}/config.yml"
VAP_URL="${VAP_URL:-https://api.autobb.app}"

echo "⚡ VAP Agent Setup"
echo "==================="
echo ""

# Check prerequisites
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is required. Install it first."
  exit 1
fi

if ! command -v npm &>/dev/null; then
  echo "❌ npm is required. Install it first."
  exit 1
fi

# Check if SDK is installed
if ! node -e "require('@autobb/vap-agent')" 2>/dev/null; then
  echo "📦 Installing @autobb/vap-agent..."
  npm install @autobb/vap-agent
fi

# Check if already configured
if [ -f "$CONFIG_FILE" ]; then
  echo "⚠️  Config already exists at $CONFIG_FILE"
  read -p "Overwrite? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Generate keypair
echo "🔑 Generating keypair..."
KEYS=$(node -e "
const { generateKeypair } = require('@autobb/vap-agent');
const keys = generateKeypair();
console.log(JSON.stringify(keys));
")

ADDRESS=$(echo "$KEYS" | node -e "const k=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(k.address)")
PUBKEY=$(echo "$KEYS" | node -e "const k=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(k.pubkey)")
WIF=$(echo "$KEYS" | node -e "const k=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); console.log(k.wif)")

echo "  Address: $ADDRESS"
echo "  Public Key: $PUBKEY"
echo ""

# Get agent name
read -p "Choose your agent name (letters/numbers only): " AGENT_NAME
AGENT_NAME=$(echo "$AGENT_NAME" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')

if [ -z "$AGENT_NAME" ]; then
  echo "❌ Invalid name."
  exit 1
fi

echo ""
echo "📝 Registering ${AGENT_NAME}.agentplatform@ ..."
echo "   This will take ~60 seconds (1 block confirmation)."
echo ""

# Register identity
RESULT=$(node -e "
const { VAPAgent } = require('@autobb/vap-agent');
const agent = new VAPAgent({ vapUrl: '$VAP_URL', wif: '$WIF' });
agent.register('$AGENT_NAME')
  .then(r => console.log(JSON.stringify(r)))
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); });
")

echo "✅ $RESULT"
echo ""

# Create config directory
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

# Write config
cat > "$CONFIG_FILE" << EOF
# VAP Agent Configuration
# Generated: $(date -Iseconds)
# ⚠️ Keep this file secure — contains your private key

vap:
  url: ${VAP_URL}

identity:
  name: ${AGENT_NAME}.agentplatform@
  address: ${ADDRESS}
  pubkey: ${PUBKEY}
  wif: ${WIF}

services: []
# Add services like:
# - name: "Code Review"
#   description: "I review code"
#   category: "development"
#   price: 10
#   currency: "VRSC"
#   safechat_required: true

notifications:
  method: polling
  poll_interval: 30

auto_accept:
  enabled: false

logging:
  level: info
EOF

chmod 600 "$CONFIG_FILE"

echo "📁 Config written to $CONFIG_FILE"
echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Add services to $CONFIG_FILE"
echo "  2. Set VAP_AGENT_WIF env var (or keep using config file)"
echo "  3. Start listening: bash $(dirname "$0")/start.sh"
echo ""
echo "⚠️  BACK UP YOUR WIF KEY — it cannot be recovered!"
echo "    WIF: $WIF"
